// Run: node tests/horse-cave.cjs [port]. v38 BANDIT FALLS: the hideout sits in a flattened notch (same site everywhere, the
// town and lookouts untouched), its rock is solid (walls, floors, bullets), it is a no-zombie zone, walking in starts the
// outlaw fight (10 guards, host-run, they shoot back), the last one drops the key, the key opens the vault for everyone,
// each strongbox pays once per player. Slots / tips cost game points. Co-op: a client walking in starts the host's fight,
// sees the outlaws, gets outlaw points for its kills, and its key pickup opens the vault on the host.
const puppeteer = require('puppeteer-core'); const assert = require('node:assert/strict'); const { spawn } = require('child_process'); const path = require('path');
const port = +(process.argv[2] || 8797), base = 'http://localhost:' + port, sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|ERR_|Failed to load resource|microphone|getUserMedia|NotAllowed|NotFound/i.test(t);
const until = async (p, fn, arg, ms = 60000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 200 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
async function page(br, mobile, errors, tag) { const p = await br.newPage();
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 }); return p; }
// put the player at cave-local (u, v) on the floor
const at = (p, u, v) => p.evaluate((u, v) => { const H = __horse.state, S = H.cave.site, c = Math.cos(S.rot), s = Math.sin(S.rot), x = S.x + u * c + v * s, z = S.z - u * s + v * c; __P.pos.set(x, H.cave.floorAt(x, z, S.y0 + .2, H.hAt(x, z)), z); H.fv && H.fv.set(0, 0); __P.yaw = S.rot; return [x, z]; }, u, v);
(async () => { const R = {}, errors = []; const srv = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(port)], { stdio: 'pipe' });
  await new Promise((r, j) => { srv.stdout.once('data', r); srv.once('exit', c => j(new Error('lobby exited ' + c))); }); let br;
  try { br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args });
    // ---- A: solo ----
    const d = await page(br, false, errors, 'solo'); await d.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&lobby=', { waitUntil: 'load', timeout: 300000 });
    await until(d, () => window.__booted && __horse.state.cave && __horse.state.zombies && __horse.state.zombies.state.t > 1, null, 300000);
    await d.evaluate(() => { localStorage.removeItem('hr_cave_loot'); const Z = __horse.state.zombies.state; Z.hp = 1e9; Z.spawnT = 1e9; __horse.state.zombies.clear(); __horse.state.guns.state.score += 10000; });
    R.site = await d.evaluate(() => { const H = __horse.state, C = H.cave, S = C.site, c = Math.cos(S.rot), s = Math.sin(S.rot), W = (u, v) => [S.x + u * c + v * s, S.z - u * s + v * c];
      const hs = [[0, -20], [-30, -30], [30, -50], [0, -55], [20, 5]].map(([u, v]) => H.hAt(...W(u, v)) - S.y0), pool = H.hAt(...W(0, 3)) - S.y0;
      const wall = (() => { for (const b of C.cave.colliders) if (b.max.y - b.min.y > 3) return [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, b.min.y]; })();
      const grassCave = H.grassG && H.grassG.U && H.grassG.U.uCave ? H.grassG.U.uCave.value.toArray().map(Math.round) : null;
      return { info: C.info(), town: H.places.town.slice(0, 2).map(Math.round), towers: H.places.towers.map(t => [Math.round(t[0]), Math.round(t[1])]), pad: hs.map(h => +h.toFixed(2)), pool: +pool.toFixed(2),
        wallHit: C.wallHit(wall[0], wall[1], .35, wall[2]), wallHitAbove: C.wallHit(wall[0], wall[1], .35, wall[2] + 40), floorHall: +(C.floorAt(...W(0, -30), S.y0 + .2, S.y0 - 5) - S.y0).toFixed(2),
        noZ: !!H.zombies.inTown(...W(0, -30)), goodGround: H.zombies.state.goodGround(...W(0, -30)), grassCave }; });
    assert.ok(R.site.info.x !== undefined && R.site.info.pass === 0, 'a strict site'); assert.deepEqual(R.site.town, [55, -95]); assert.deepEqual(R.site.towers, [[-973, -995], [847, 935]]);
    assert.ok(R.site.pad.slice(0, 4).every(h => Math.abs(h + .08) < .02), 'flat pad ' + R.site.pad); assert.ok(Math.abs(R.site.pool + .45) < .02, 'pool dip'); assert.equal(R.site.wallHit, true); assert.equal(R.site.wallHitAbove, false);
    assert.ok(Math.abs(R.site.floorHall) < .02, 'hall floor'); assert.equal(R.site.noZ, true); assert.ok(R.site.grassCave && R.site.grassCave[2] > 30, 'no grass inside the hideout'); assert.equal(R.site.goodGround, false);
    // walking in starts the fight: 10 outlaws, not counted as zombies, the HUD banner, they shoot
    await at(d, 0, -8); await until(d, () => __horse.state.cave.state.phase === 1, null, 30000);
    R.fight = await d.evaluate(() => { const Z = __horse.state.zombies; return { outlaws: Z.outlaws().filter(o => o.alive).length, live: Z.state.live, hud: document.getElementById('hrZ').textContent }; });
    assert.equal(R.fight.outlaws, 10); assert.equal(R.fight.live, 0); assert.match(R.fight.hud, /BANDIT FALLS/);
    await at(d, 0, -20); await sleep(9000); R.fight.shots = await d.evaluate(() => [__horse.state.zombies.state.outlawShots || 0, __horse.state.zombies.state.outlawHits || 0]); assert.ok(R.fight.shots[0] >= 2, 'outlaws shoot ' + R.fight.shots);
    // points: an outlaw pays 60 (75 headshot), a zombie still 10
    R.pts = await d.evaluate(() => { const G = __horse.state.guns, s0 = G.state.score; G.credit(false, 'outlaw'); const a = G.state.score - s0; G.credit(true, 'outlaw'); const b = G.state.score - s0 - a; G.credit(false); return [a, b, G.state.score - s0 - a - b]; }); assert.deepEqual(R.pts, [60, 75, 10]);
    // a rock wall stops a shot: cast from the hall toward the side wall
    R.rock = await d.evaluate(() => { const C = __horse.state.cave, S = C.site, b = C.cave.colliders.find(b => b.max.y - b.min.y > 3 && b.min.y < S.y0 + 1); const o = { x: (b.min.x + b.max.x) / 2, y: S.y0 + 1.5, z: (b.min.z + b.max.z) / 2 };
      const V = __horse.state.cave.cave.group.position.clone(); const src = V.clone().set(S.x + (o.x - S.x) * .2, S.y0 + 1.5, S.z + (o.z - S.z) * .2), dir = V.clone().set(o.x - src.x, 0, o.z - src.z), L = dir.length(); dir.normalize(); return [+C.rayHit(src, dir, L + 5).toFixed(2), +L.toFixed(2)]; });
    assert.ok(R.rock[0] > 0 && R.rock[0] <= R.rock[1] + .01, 'rock stops the ray ' + R.rock);
    // kill them all (host-authoritative damage) -> key drops where the last fell
    await d.evaluate(() => { const Z = __horse.state.zombies; for (const o of Z.outlaws()) Z.damage(o, 1e4, false, null, null, 'me'); }); await until(d, () => __horse.state.cave.state.phase === 2, null, 20000);
    R.key = await d.evaluate(() => { const C = __horse.state.cave, k = C.state.key, sp = __horse.state.town2.spots.find(o => o.kind === 'cave-key'), g = __horse.state.town2.spots.find(o => o.kind === 'cave-gate'); return { key: k, label: sp.label, gate: g.label, chests: __horse.state.town2.spots.filter(o => o.kind === 'cave-chest').map(o => o.label) }; });
    assert.ok(Array.isArray(R.key.key)); assert.match(R.key.label, /key/); assert.ok(R.key.chests.every(l => l === ''), 'chests locked');
    // take the key -> vault opens (gate collider gone), strongboxes pay once
    R.vault = await d.evaluate(async () => { const H = __horse.state, C = H.cave, k = C.state.key; __P.pos.set(k[0], C.floorAt(k[0], k[2], k[1], H.hAt(k[0], k[2])), k[2]); await new Promise(r => setTimeout(r, 400)); const n = H.town2.nearSpot(); const used = H.town2.use();
      await new Promise(r => setTimeout(r, 600)); const gc = C.cave.colliders.filter(b => b.isEmpty()).length; return { near: n && n.kind, used, phase: C.state.phase, open: C.cave.state.vaultOpen, emptied: gc }; });
    assert.deepEqual([R.vault.near, R.vault.used, R.vault.phase, R.vault.open], ['cave-key', true, 3, true]); assert.ok(R.vault.emptied >= 1);
    R.loot = await d.evaluate(async () => { const H = __horse.state, G = H.guns, out = []; for (const s of H.town2.spots.filter(o => o.kind === 'cave-chest')) { __P.pos.set(s.x, s.y, s.z + .2); await new Promise(r => setTimeout(r, 300)); const a = G.state.score; H.town2.use(); const b = G.state.score; H.town2.use(); out.push([b - a, G.state.score - b, H.town2.nearSpot() && H.town2.nearSpot().kind]); } return { out, saved: localStorage.getItem('hr_cave_loot') }; });
    assert.deepEqual(R.loot.out.map(x => x.slice(0, 2)), [[2500, 0], [2500, 0], [2500, 0]]); assert.match(R.loot.saved, /chest-2/);
    // slots and tips cost game points; the ladder goes up to the lookout ledge
    R.fun = await d.evaluate(async () => { const H = __horse.state, G = H.guns, go = async k => { const s = H.town2.spots.find(o => o.kind === k); __P.pos.set(s.x, s.y, s.z); await new Promise(r => setTimeout(r, 300)); return H.town2.nearSpot() && H.town2.nearSpot().kind; };
      const r = {}; r.slotNear = await go('cave-slot'); let p0 = G.pts(); H.town2.use(); r.slotSpent = G.state.spent; r.slotPulls = H.cave.slotPulls;
      r.tipNear = await go('cave-dance'); p0 = G.pts(); H.town2.use(); r.tip = p0 - G.pts(); r.drinkNear = await go('drink');
      r.ladNear = await go('cave-climb'); H.town2.use(); await new Promise(r => setTimeout(r, 1500)); r.ledge = +(__P.pos.y - H.cave.site.y0).toFixed(2); r.downNear = H.town2.nearSpot() && H.town2.nearSpot().kind; return r; });
    assert.equal(R.fun.slotNear, 'cave-slot'); assert.equal(R.fun.slotPulls, 1); assert.equal(R.fun.tipNear, 'cave-dance'); assert.equal(R.fun.tip, 50); assert.equal(R.fun.drinkNear, 'drink'); assert.equal(R.fun.ladNear, 'cave-climb'); assert.ok(Math.abs(R.fun.ledge - 3.6) < .1, 'ledge ' + R.fun.ledge); assert.equal(R.fun.downNear, 'cave-down');
    // v38.1: the falls are heard up close and go quiet far away (only if the page has an audio context)
    R.water = await d.evaluate(async () => { const H = __horse.state, C = H.cave, sx = window.__sfx, sl = ms => new Promise(r => setTimeout(r, ms)); if (sx && !sx.ctx && sx.init) try { sx.init(); } catch (_) {} if (!sx || !sx.ctx) return { ctx: false };
      const e = C.site; __P.pos.set(e.x, H.hAt(e.x, e.z) + .1, e.z); if (H.mounted) H.mounted = null; await sl(1500); const nearG = C.water(); __P.pos.set(e.x + 200, H.hAt(e.x + 200, e.z), e.z); await sl(1500); return { ctx: true, near: nearG, far: C.water() }; });
    if (R.water.ctx) { assert.ok(R.water.near > .02, 'falls audible ' + JSON.stringify(R.water)); assert.equal(R.water.far, 0); }
    await d.close();
    // ---- B: co-op ----
    const Q = '/?dev=1&loopnet=1&q=low&norender=1&prochorse=1&lobby=' + encodeURIComponent(base);
    const h = await page(br, false, errors, 'host'); await h.goto(base + Q, { waitUntil: 'load', timeout: 300000 });
    await until(h, () => __hnet.state.role === 'host' && !!__hnet.state.code && __horse.state.cave && __horse.state.zombies, null, 180000);
    await h.evaluate(() => { const Z = __horse.state.zombies; Z.state.hp = 1e9; Z.state.spawnT = 1e9; Z.clear(); });
    const c = await page(br, true, errors, 'client'); await c.goto(base + Q + '&touch=1', { waitUntil: 'load', timeout: 300000 });
    await until(c, () => __hnet.state.role === 'client' && __horse.state.cave && __horse.state.zombies && __horse.state.zombies.state.t > 1, null, 240000);
    await c.evaluate(() => { localStorage.removeItem('hr_cave_loot'); __horse.state.zombies.state.hp = 1e9; });
    R.coop = { siteSame: JSON.stringify(await h.evaluate(() => [__horse.state.cave.site.x, __horse.state.cave.site.z])) === JSON.stringify(await c.evaluate(() => [__horse.state.cave.site.x, __horse.state.cave.site.z])) }; assert.equal(R.coop.siteSame, true);
    await at(c, 0, -10); await until(h, () => __horse.state.cave.state.phase === 1, null, 60000); await until(c, () => __horse.state.cave.state.phase === 1 && __horse.state.zombies.outlaws().length >= 8, null, 60000);
    R.coop.clientOutlaws = await c.evaluate(() => __horse.state.zombies.outlaws().length);
    // a client headshot kill pays outlaw points (host confirms)
    R.coop.kill = await c.evaluate(async () => { const H = __horse.state, Z = H.zombies, o = Z.outlaws().find(o => o.alive), s0 = H.guns.state.score; const p = o.pos.clone(); p.y += 1.6; Z.onHit(o, 'sniper', true, p, null, 1); await new Promise(r => setTimeout(r, 3000)); return H.guns.state.score - s0; });
    assert.equal(R.coop.kill, 75);
    await h.evaluate(() => { const Z = __horse.state.zombies; for (const o of Z.outlaws()) Z.damage(o, 1e4, false, null, null, 'me'); }); await until(c, () => __horse.state.cave.state.phase === 2 && __horse.state.cave.state.key, null, 30000);
    await c.evaluate(async () => { const H = __horse.state, C = H.cave, k = C.state.key; __P.pos.set(k[0], C.floorAt(k[0], k[2], k[1], H.hAt(k[0], k[2])), k[2]); await new Promise(r => setTimeout(r, 1500)); H.town2.use(); });
    await until(h, () => __horse.state.cave.state.phase === 3 && __horse.state.cave.cave.state.vaultOpen, null, 30000); await until(c, () => __horse.state.cave.state.phase === 3 && __horse.state.cave.cave.state.vaultOpen, null, 30000);
    R.coop.open = true; R.errors = errors.filter(e => !ignorable(e)); console.log(JSON.stringify(R)); assert.deepEqual(R.errors, []); console.log('PASS horse-cave');
  } catch (e) { console.log(JSON.stringify(R)); console.error('FAIL', e.message, errors.slice(0, 5)); process.exitCode = 1; } finally { if (br) await br.close(); srv.kill(); } })();
