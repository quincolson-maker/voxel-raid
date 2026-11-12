// Run: node tests/horse-zombies-net.cjs [port]. HORSE RIDER zombies in multiplayer (host-authoritative): the host spawns
// and simulates them, a client mirrors the same zombies (ids, kinds, positions) and never spawns its own, a client's shot
// is sent to the host (headshot kill / body damage seen by everyone), and a host zombie attacking the client's player hurts
// that client (not the host). Uses tests/serve-lobby.cjs + ?loopnet=1 like horse-voice.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const port = +(process.argv[2] || 8798), base = 'http://localhost:' + port;
let STEP = ''; const step = t => { STEP = t; if (process.env.VERBOSE) console.log('·', t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|ERR_|Failed to load resource/i.test(t);
const until = async (p, fn, arg, ms = 25000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
async function page(br, mobile, errors, tag) {
  const p = await br.newPage();
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
  return p;
}
(async () => {
  const R = {}, errors = [];
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(port)], { stdio: 'pipe' });
  await new Promise((r, j) => { srv.stdout.once('data', r); srv.once('exit', c => j(new Error('lobby test server exited ' + c))); });
  let br;
  try {
    br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args });
    await br.defaultBrowserContext().overridePermissions(base, ['microphone']);
    const Q = '/?dev=1&loopnet=1&q=low&lobby=' + encodeURIComponent(base);
    step('host'); const h = await page(br, false, errors, 'host'); await h.goto(base + Q, { waitUntil: 'load', timeout: 180000 });
    await until(h, () => __hnet.state.role === 'host' && !!__hnet.state.code && __horse.state.zombies, null, 30000);
    await h.evaluate(() => { const Z = __horse.state.zombies; Z.clear(); Z.state.spawnT = 1e9; for (const o of __horse.state.horses) { o.tgt = null; o.wait = 1e9; } });
    step('client joins'); const c = await page(br, true, errors, 'p2'); await c.goto(base + Q + '&touch=1', { waitUntil: 'load', timeout: 180000 });
    await until(c, () => __hnet.state.role === 'client' && __hnet.state.remotes.has('P1') && __horse.state.zombies, null, 30000); await until(h, () => __hnet.state.remotes.has('P2'));
    step('host spawns; client mirrors the same zombies');
    R.hostIds = await h.evaluate(() => { const Z = __horse.state.zombies; return [['walker', 30, 60], ['runner', 36, 64], ['brute', 24, 66]].map(([k, x, z]) => { const o = Z.spawn(k, [x, z]); o.hold = true; return o.id; }); });
    await until(c, ids => { const L = __horse.state.zombies.list.filter(o => o.alive); return L.length === ids.length && ids.every(id => L.some(o => o.id === id)); }, R.hostIds, 30000).catch(async e => {
      console.log('host', await h.evaluate(() => JSON.stringify({ role: __horse.state.zombies.state.role(), n: __horse.state.zombies.list.length, zs: typeof __horse.state.zSend, snap: __horse.state.zombies.state.snapT })));
      console.log('client', await c.evaluate(() => JSON.stringify({ role: __horse.state.zombies.state.role(), ids: __horse.state.zombies.list.map(o => [o.id, o.alive, !!o.net]) }))); throw e; });
    await sleep(1500);
    R.mirror = await c.evaluate(() => __horse.state.zombies.list.map(o => [o.id, o.kind, +o.pos.x.toFixed(1), +o.pos.z.toFixed(1)]));
    const hp = await h.evaluate(() => __horse.state.zombies.list.map(o => [o.id, o.kind, +o.pos.x.toFixed(1), +o.pos.z.toFixed(1)]));
    for (const [id, k, x, z] of hp) { const m = R.mirror.find(q => q[0] === id); assert.ok(m && m[1] === k && Math.hypot(m[2] - x, m[3] - z) < 1, 'client sees the host zombie ' + id); }
    R.clientNoSpawn = await c.evaluate(() => { __horse.state.zombies.state.spawnT = 0; return true; }); await sleep(2500);
    R.clientCount = await c.evaluate(() => __horse.state.zombies.list.length); assert.equal(R.clientCount, 3, 'clients never spawn their own');
    step('client headshot -> host kills it -> everyone sees it down');
    await c.evaluate(id => { const Z = __horse.state.zombies, o = Z.list.find(q => q.id === id); Z.onHit(o, 'revolver', true, Z.headPos(o, o.pos.clone()), { x: 0, y: 0, z: 1 }); }, R.hostIds[0]);
    await until(h, id => { const o = __horse.state.zombies.list.find(q => q.id === id); return !o || !o.alive; }, R.hostIds[0], 15000); R.hostKilled = true;
    await sleep(800); R.clientStillDead = await c.evaluate(id => { const o = __horse.state.zombies.list.find(q => q.id === id); return !o || !o.alive; }, R.hostIds[0]); assert.ok(R.clientStillDead);
    step('v33: the kill is credited to the client by the host (points), leaderboard synced, name tags over the other rider only');
    await until(c, () => __horse.guns.state.kills === 1 && __horse.guns.state.score >= 15, null, 15000); R.clientPts = await c.evaluate(() => [__horse.guns.state.kills, __horse.guns.state.score]);
    await until(h, () => { __horse.hud(); const r = (__horse.state.board || []).find(x => x.id === 'P2'); return r && r.k === 1 && r.pt >= 15; }, null, 15000); R.hostBoard = await h.evaluate(() => __horse.state.board.map(r => [r.id, r.k, r.pt]));
    await until(c, () => { __horse.hud(); return (__horse.state.board || []).length === 2 && __horse.state.board[0].id === 'P2'; }, null, 15000); R.clientBoard = await c.evaluate(() => __horse.state.board.map(r => [r.id, r.k, r.pt]));
    R.tags = { host: await h.evaluate(() => { __horse.hud(); return [__horse.state.tagCount, [...document.querySelectorAll('#hrTags .t')].map(e => e.textContent)]; }), client: await c.evaluate(() => { __horse.hud(); return [__horse.state.tagCount, [...document.querySelectorAll('#hrTags .t')].map(e => e.textContent)]; }) };
    // v33 saloon games over the co-op link (host-authoritative): P2 challenges P1 to checkers, both move; then darts
    await c.evaluate(() => __horse.state.town2.ck.send({ a: 'ch', to: 'P1' }));
    await until(h, () => { const G = __horse.state.town2.ck.G; return G && G.who[0] === 'P2' && G.who[1] === 'P1'; }, null, 15000); await until(c, () => !!__horse.state.town2.ck.G, null, 15000);
    await c.evaluate(() => { const T = __horse.state.town2, G = T.ck.G, m = T.ckMoves(G)[0]; T.ck.send({ a: 'mv', f: m.f, d: m.t }); });
    await until(h, () => __horse.state.town2.ck.G.n === 1, null, 15000);
    await h.evaluate(() => { const T = __horse.state.town2, G = T.ck.G, m = T.ckMoves(G)[0]; T.ck.send({ a: 'mv', f: m.f, d: m.t }); });
    await until(c, () => __horse.state.town2.ck.G.n === 2 && __horse.state.town2.ck.G.turn === 0, null, 15000);
    R.ckSync = await Promise.all([h, c].map(pg => pg.evaluate(() => __horse.state.town2.ck.G.B.join(',')))); assert.equal(R.ckSync[0], R.ckSync[1], 'checkers boards match');
    R.ckCheat = await h.evaluate(() => { const T = __horse.state.town2, G = T.ck.G, b = G.B.join(','); T.ck.netIn({ a: 'mv', f: 0, d: 9 }, 'P1'); return G.B.join(',') === b && G.n === 2; }); assert.ok(R.ckCheat, 'out-of-turn / illegal moves are refused');
    await c.evaluate(() => { const T = __horse.state.town2; T.ck.send({ a: 'q' }); T.closeUI(); }); await h.evaluate(() => __horse.state.town2.closeUI());
    await c.evaluate(() => __horse.state.town2.dartSend({ a: 'ch', to: 'P1' })); await until(h, () => { const G = __horse.state.town2.dart; return G && G.who[0] === 'P2'; }, null, 15000);
    await c.evaluate(() => __horse.state.town2.dartSend({ a: 'th', x: 0, y: 103 })); await until(c, () => __horse.state.town2.dart && __horse.state.town2.dart.s[0] === 241, null, 15000); R.dartsSync = await h.evaluate(() => __horse.state.town2.dart.s[0]); assert.equal(R.dartsSync, 241, 'darts score synced');
    await c.evaluate(() => { const T = __horse.state.town2; T.dartSend({ a: 'q' }); T.closeUI(); }); await h.evaluate(() => __horse.state.town2.closeUI());
    await h.evaluate(() => { const T = __horse.state.town2; T.jacket = true; T.wear = true; }); // the HORSE RIDER windbreaker shows on the host's avatar for the client
    await until(c, () => [...__horse.state.avatars].some(a => a.jk === true), null, 30000); R.remoteJacket = true;
    assert.equal(R.tags.host[0], 1); assert.ok(/P2/.test(R.tags.host[1][0])); assert.equal(R.tags.client[0], 1); assert.ok(/P1/.test(R.tags.client[1][0]));
    step('client body shot on the brute only damages it on the host');
    await c.evaluate(id => { const Z = __horse.state.zombies, o = Z.list.find(q => q.id === id); Z.onHit(o, 'rifle', false, o.pos.clone(), { x: 0, y: 0, z: 1 }); }, R.hostIds[2]);
    await until(h, id => { const o = __horse.state.zombies.list.find(q => q.id === id); return o && o.hp === 250; }, R.hostIds[2], 15000); R.hostBruteHp = 250;
    step('a host zombie attacks the client player -> the client takes the damage');
    await c.evaluate(() => { __P.pos.set(60, __horse.hAt(60, 90), 90); }); await sleep(1500);
    await h.evaluate(id => { const Z = __horse.state.zombies, o = Z.list.find(q => q.id === id), r = __hnet.state.remotes.get('P2').s; o.hold = false; o.pos.set(r.x + 1, o.pos.y, r.z); }, R.hostIds[1]);
    await until(c, () => __horse.state.zombies.state.hp < 100, null, 30000); R.clientHurt = await c.evaluate(() => Math.round(__horse.state.zombies.state.hp));
    R.hostUnhurt = await h.evaluate(() => Math.round(__horse.state.zombies.state.hp)); assert.equal(R.hostUnhurt, 100);
    if (process.env.SHOTS !== '0') { step('name tag screenshots'); // the two riders a little apart, each looking towards the other
      const put = async (pg, x, z, tx, tz) => pg.evaluate((x, z, tx, tz) => { __P.pos.set(x, __horse.hAt(x, z), z); __P.yaw = Math.atan2(-(tx - x), -(tz - z)); __P.pitch = -.05; }, x, z, tx, tz);
      await put(c, 40, 30, 22, 70); await put(h, 22, 70, 40, 30); await sleep(2500);
      for (const [pg, tag, ox, oz, tx, tz] of [[h, 'desktop', 22, 70, 40, 30], [c, 'mobile', 40, 30, 22, 70]]) { await pg.bringToFront(); await put(pg, ox, oz, tx, tz); await sleep(2500); await pg.evaluate(() => __horse.hud()); await pg.screenshot({ path: `shot-horserider-v33-${tag}-nametags.png` }); }
      R.tagShot = await h.evaluate(() => [...document.querySelectorAll('#hrTags .t')].map(e => [e.textContent, e.dataset.on])); }
    R.errors = errors; console.log(JSON.stringify(R, null, 1));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('HORSE ZOMBIES NET OK');
  } finally { if (br) await br.close(); srv.kill(); }
})().catch(e => { console.error('FAILED at step:', STEP); console.error(e); process.exit(1); });
