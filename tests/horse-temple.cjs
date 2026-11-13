// Run: node tests/horse-temple.cjs [port]. v39 THE HOLLOW SUN: the temple sits under a mound on a mountainside (same site
// everywhere; town, lookouts and Bandit Falls untouched); under the mound you walk on the temple's floors (not the hill top),
// the camera stays inside, walls are solid, bullets fly through the halls, traps hurt, the chasm drops you; the three puzzles
// (sun discs, glyph tiles, counterweight) open the sanctum; the gold pays 100,000 once; the hidden altar gives the Sun Pyramid,
// whose beam (charge + cooldown) blasts a cluster of the dead. Co-op: a client's actions go through the host's ordered log.
const puppeteer = require('puppeteer-core'); const assert = require('node:assert/strict'); const { spawn } = require('child_process'); const path = require('path');
const port = +(process.argv[2] || 8799), base = 'http://localhost:' + port, sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|ERR_|Failed to load resource|microphone|getUserMedia|NotAllowed|NotFound/i.test(t);
const until = async (p, fn, arg, ms = 60000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 200 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
async function page(br, mobile, errors, tag) { const p = await br.newPage();
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50);
    window.__tw = (u, v) => { const S = __horse.state.temple.site, c = Math.cos(S.rot), s = Math.sin(S.rot); return [S.x + u * c + v * s, S.z - u * s + v * c]; };
    window.__tat = (u, v, y) => { const H = __horse.state, T = H.temple, [x, z] = __tw(u, v); __P.pos.set(x, y === undefined ? T.floorAt(x, z, T.site.y0 + Math.max(-9, v * .14) + .3) : y, z); H.fv && H.fv.set(0, 0); H.vy = 0; __P.yaw = T.site.rot; return [x, z]; }; });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 }); return p; }
const wait = ms => `new Promise(r => setTimeout(r, ${ms}))`;
(async () => { const R = {}, errors = []; const srv = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(port)], { stdio: 'pipe' });
  await new Promise((r, j) => { srv.stdout.once('data', r); srv.once('exit', c => j(new Error('lobby exited ' + c))); }); let br;
  try { br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args });
    const d = await page(br, false, errors, 'solo'); await d.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&lobby=', { waitUntil: 'load', timeout: 300000 });
    await until(d, () => window.__booted && __horse.state.temple && __horse.state.zombies && __horse.state.zombies.state.t > 1, null, 300000);
    await d.evaluate(() => { localStorage.removeItem('hr_temple'); localStorage.removeItem('hr_sun'); const Z = __horse.state.zombies; Z.state.spawnT = 1e9; Z.clear(); });
    R.site = await d.evaluate(() => { const H = __horse.state, T = H.temple, S = T.site, h = (u, v) => +(H.hAt(...__tw(u, v)) - S.y0).toFixed(2);
      return { info: T.info(), town: H.places.town.slice(0, 2).map(Math.round), towers: H.places.towers.map(t => [Math.round(t[0]), Math.round(t[1])]), cave: H.cave && [Math.round(H.cave.site.x), Math.round(H.cave.site.z)], apron: h(0, 10), door: h(0, -2), mound: [h(0, -20), h(-20, -60), h(20, -40)],
        cellHall: T.cell(...(([x, z]) => [x, S.y0 + 3, z])(__tw(0, -20))), cellRock: T.cell(...(([x, z]) => [x, S.y0 + 17.5, z])(__tw(0, -20))) }; });
    assert.deepEqual(R.site.town, [55, -95]); assert.deepEqual(R.site.towers, [[-973, -995], [847, 935]]); assert.deepEqual(R.site.cave, [300, 72]);
    assert.ok(Math.abs(R.site.apron + .08) < .02 && Math.abs(R.site.door + .08) < .02, 'flat apron + doorway'); assert.ok(R.site.mound.every(m => m >= 18.4), 'mound over the halls ' + R.site.mound); assert.equal(R.site.cellHall, 1); assert.equal(R.site.cellRock, 2);
    // the seal (real USE), then walk in: under the mound you stand on the temple floor and the camera stays inside
    R.enter = await d.evaluate(async () => { const H = __horse.state, T = H.temple; __tat(0, 4.5, T.site.y0); await new Promise(r => setTimeout(r, 400)); const near = H.town2.nearSpot(); H.town2.use(); await new Promise(r => setTimeout(r, 6000));
      const open = T.temple.doors[0].progress; __tat(0, -12); await new Promise(r => setTimeout(r, 2500)); const [x, z] = __tw(0, -12);
      return { near: near && near.kind, open: +open.toFixed(2), under: T.underP, y: +(__P.pos.y - T.site.y0).toFixed(2), hill: +(H.hAt(x, z) - T.site.y0).toFixed(2), camY: +(__cam.position.y - T.site.y0).toFixed(2) }; });
    assert.equal(R.enter.near, 'tp-seal'); assert.ok(R.enter.open > .5, 'seal opening'); assert.equal(R.enter.under, true); assert.ok(Math.abs(R.enter.y + 1.68) < .15, 'on the hall ramp ' + R.enter.y); assert.ok(R.enter.camY < 15, 'camera inside ' + R.enter.camY);
    // walls + bullets inside
    R.inside = await d.evaluate(() => { const H = __horse.state, T = H.temple, S = T.site, [x, z] = __tw(0, -12), [wx, wz] = __tw(-10, -30), V = __P.pos.clone(), o = V.clone().set(x, S.y0 - 1.68 + 1.5, z), dv = V.clone().set(...(([a, b]) => [a - x, 0, b - z])(__tw(0, -26))).normalize();
      const hit = H.guns.rayCast(o, dv, 200); return { wall: T.wallHit(wx, wz, .35, S.y0 + rampY(-30)), shot: [hit.kind, +hit.t.toFixed(1)] }; function rampY(z) { return Math.max(-9, z * .14); } });
    assert.equal(R.inside.wall, true); assert.ok(R.inside.shot[1] > 8, 'bullets fly down the hall ' + R.inside.shot);
    // a trap hurts (dart wall), the chasm drops you and you climb back
    R.trap = await d.evaluate(async () => { const H = __horse.state, T = H.temple, Z = H.zombies.state; Z.hp = 100; __tat(0, -26); await new Promise(r => setTimeout(r, 6000)); return { hits: T.trapHits || 0, hp: Math.round(Z.hp) }; });
    assert.ok(R.trap.hits >= 1 && R.trap.hp < 100, 'dart wall ' + JSON.stringify(R.trap));
    R.fall = await d.evaluate(async () => { const H = __horse.state, T = H.temple; H.zombies.state.hp = 1e9; __tat(6.5, -34, T.site.y0 + .14 * -34 + .2); await new Promise(r => setTimeout(r, 6000)); return { falls: T.falls || 0, y: +(__P.pos.y - T.site.y0).toFixed(1) }; });
    assert.equal(R.fall.falls, 1); assert.ok(R.fall.y > -5, 'back on the bridge side');
    // puzzles: sun discs (real USE presses: 2, 5, 1 turns), glyph tiles (stepping 1, 3, 2, 4), counterweight (12 stones)
    R.puzzle = await d.evaluate(async () => { const H = __horse.state, T = H.temple, tm = T.temple, sleep = ms => new Promise(r => setTimeout(r, ms)), go = async o => { __P.pos.set(o.x, o.y, o.z); H.vy = 0; await sleep(350); return H.town2.nearSpot(); };
      const mir = H.town2.spots.filter(o => o.kind === 'tp-mirror'); for (const [i, n] of [[0, 2], [1, 5], [2, 1]]) { const s = await go(mir[i]); for (let k = 0; k < n; k++) { H.town2.use(); await sleep(80); } } const mirror = tm.state.mirror;
      for (const i of [0, 2, 1, 3]) { const t = tm.triggers.find(q => q.id === 'glyph_' + i).bounds; __P.pos.set((t.min.x + t.max.x) / 2, t.min.y + .2, (t.min.z + t.max.z) / 2); H.vy = 0; await sleep(500); const [x, z] = __tw(0, -40); __P.pos.set(x, T.floorAt(x, z, T.site.y0 - 5.3), z); await sleep(400); } const glyph = tm.state.glyph;
      const w = H.town2.spots.find(o => o.kind === 'tp-weight'); const near = await go(w); for (let k = 0; k < 12; k++) { H.town2.use(); await sleep(60); } await sleep(3500);
      await sleep(6000); return { mirror, glyph, weight: tm.state.weight, near: near && near.kind, log: T.state.log.length, sanctum: +tm.doors[3].progress.toFixed(2) }; });
    assert.deepEqual([R.puzzle.mirror, R.puzzle.glyph, R.puzzle.weight, R.puzzle.near], [true, true, true, 'tp-weight']); assert.ok(R.puzzle.sanctum > .3, 'sanctum opening');
    // gold once, the hidden altar, the Sun Pyramid
    R.prize = await d.evaluate(async () => { const H = __horse.state, T = H.temple, G = H.guns, sleep = ms => new Promise(r => setTimeout(r, ms)), go = async k => { const o = H.town2.spots.find(q => q.kind === k); __P.pos.set(o.x, o.y, o.z); H.vy = 0; await sleep(400); return H.town2.nearSpot() && H.town2.nearSpot().kind; };
      const gNear = await go('tp-gold'), s0 = G.state.score; H.town2.use(); const g1 = G.state.score - s0; H.town2.use(); const g2 = G.state.score - s0 - g1;
      const aNear = await go('tp-altar'); H.town2.use(); await sleep(4000); const pNear = await go('tp-pyramid'); H.town2.use(); return { gNear, g1, g2, aNear, pNear, owned: H.sun.state.owned, saved: localStorage.getItem('hr_temple') }; });
    assert.deepEqual([R.prize.gNear, R.prize.g1, R.prize.g2, R.prize.aNear, R.prize.pNear, R.prize.owned], ['tp-gold', 100000, 0, 'tp-altar', 'tp-pyramid', true]);
    // the beam: out on the meadow, a tight group of the dead 25 m ahead; one pulse, then the cooldown holds the next
    R.sun = await d.evaluate(async () => { const H = __horse.state, Z = H.zombies, sleep = ms => new Promise(r => setTimeout(r, ms)); const [x, z] = __tw(0, 40); __P.pos.set(x, H.hAt(x, z), z); H.fv.set(0, 0); __P.yaw = H.temple.site.rot + Math.PI; __P.pitch = 0; H.fp = true; await sleep(800);
      const f = new __P.pos.constructor(); __cam.getWorldDirection(f); f.y = 0; f.normalize(); const zs = []; for (let i = 0; i < 4; i++) { const px = __cam.position.x + f.x * 25 + (i % 2) * 1.2 - .6, pz = __cam.position.z + f.z * 25 + (i >> 1) * 1.2 - .6; const o = Z.spawn('walker', [px, pz]); o.hold = true; zs.push(o); }
      await sleep(600); const aim = zs[0].pos.clone(); aim.y += 1; __P.pitch = Math.atan2(aim.y - __cam.position.y, Math.hypot(aim.x - __cam.position.x, aim.z - __cam.position.z)); await sleep(500); H.sun.hold(true); const s0 = H.guns.state.score;
      dispatchEvent(new MouseEvent('mousedown', { button: 0 })); await sleep(300); dispatchEvent(new MouseEvent('mousedown', { button: 0 })); await sleep(2500);
      return { shots: H.sun.state.shots, hits: H.sun.state.hits, killed: zs.filter(o => !o.alive).length, pts: H.guns.state.score - s0, lastHit: H.sun.state.lastHit, cooling: H.sun.state.nextT > H.sun.state.t, hud: (document.getElementById('hrSun') || {}).textContent }; });
    assert.equal(R.sun.shots, 1); assert.ok(R.sun.killed >= 3, 'blast ' + JSON.stringify(R.sun)); assert.ok(R.sun.pts >= 30); assert.equal(R.sun.cooling, true);
    await d.close();
    // ---- co-op: the client's actions go through the host's log ----
    const Q = '/?dev=1&loopnet=1&q=low&norender=1&prochorse=1&lobby=' + encodeURIComponent(base);
    const h = await page(br, false, errors, 'host'); await h.goto(base + Q, { waitUntil: 'load', timeout: 300000 });
    await until(h, () => __hnet.state.role === 'host' && !!__hnet.state.code && __horse.state.temple && __horse.state.zombies, null, 180000); await h.evaluate(() => { const Z = __horse.state.zombies; Z.state.hp = 1e9; Z.state.spawnT = 1e9; Z.clear(); });
    const c = await page(br, true, errors, 'client'); await c.evaluateOnNewDocument(() => { localStorage.removeItem('hr_temple'); localStorage.removeItem('hr_sun'); }); /* one browser profile here; real riders each have their own */ await c.goto(base + Q + '&touch=1', { waitUntil: 'load', timeout: 300000 });
    await until(c, () => __hnet.state.role === 'client' && __horse.state.temple && __horse.state.zombies && __horse.state.zombies.state.t > 1, null, 240000);
    await c.evaluate(() => { localStorage.removeItem('hr_temple'); __horse.state.zombies.state.hp = 1e9; __tat(0, 4.5, __horse.state.temple.site.y0); }); await sleep(2000);
    await c.evaluate(async () => { const T = __horse.state.temple, sl = ms => new Promise(r => setTimeout(r, ms)); for (const a of [['e'], ['m', 0], ['m', 0], ['m', 1], ['m', 1], ['m', 1], ['m', 1], ['m', 1], ['m', 2], ['g', 0], ['g', 2], ['g', 1], ['g', 3], ['w', 12]]) { T._act(a); await sl(150); } });
    await until(h, () => { const s = __horse.state.temple.temple.state; return s.mirror && s.glyph && s.weight; }, null, 60000); await until(c, () => { const s = __horse.state.temple.temple.state; return s.mirror && s.glyph && s.weight; }, null, 60000);
    R.coop = { hostLog: await h.evaluate(() => __horse.state.temple.state.log.length), clientLog: await c.evaluate(() => __horse.state.temple.state.log.length) }; assert.equal(R.coop.hostLog, 14); assert.equal(R.coop.clientLog, 14);
    R.coop.gold = await c.evaluate(async () => { const H = __horse.state, o = H.town2.spots.find(q => q.kind === 'tp-gold'); __P.pos.set(o.x, o.y, o.z); H.vy = 0; await new Promise(r => setTimeout(r, 1500)); const s0 = H.guns.state.score; H.town2.use(); return H.guns.state.score - s0; }); assert.equal(R.coop.gold, 100000);
    // a client's sun hit is a known weapon for the host (not rejected)
    R.coop.sunHit = await h.evaluate(() => { const Z = __horse.state.zombies, id = [...__hnet.state.remotes.keys()][0], Rm = __horse.state.netRemotes().find(q => q.id === id), far = Z.spawn('walker', [Rm.s.x + 250, Rm.s.z]), o = Z.spawn('walker', [Rm.s.x + 20, Rm.s.z]);
      const farOk = Z.remoteHit({ id: far.id, d: 400, h: 0, w: 'sun', s: 1 }, id), ok = Z.remoteHit({ id: o.id, d: 400, h: 0, w: 'sun', s: 2 }, id); return { farOk, ok, dead: !o.alive, rejected: Z.state.rejected || {} }; });
    assert.equal(R.coop.sunHit.farOk, false); assert.equal(R.coop.sunHit.ok, true); assert.equal(R.coop.sunHit.dead, true);
    R.errors = errors.filter(e => !ignorable(e)); console.log(JSON.stringify(R)); assert.deepEqual(R.errors, []); console.log('PASS horse-temple');
  } catch (e) { console.log(JSON.stringify(R)); console.error('FAIL', e.message, errors.slice(0, 5)); process.exitCode = 1; } finally { if (br) await br.close(); srv.kill(); } })();
