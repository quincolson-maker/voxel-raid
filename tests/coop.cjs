// Run: node tests/coop.cjs [base URL]. Two separate headless Chrome instances (host + joiner) over the real
// PeerJS broker + WebRTC data channel. Checks connect, position/build/zombie sync, skip, hits, barricade
// breaking, downed/revive, both-down game over, and disconnect -> solo continuation (both directions).
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const launch = () => puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 60000, args });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, arg, ms = 20000) => { const at = new Error().stack.split('\n')[2]; try { return await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { throw new Error('until timeout ' + at + ' :: ' + fn); } };
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
async function page(browser, mobile, errors, tag) {
  const p = await browser.newPage();
  // Both tabs share one headless browser; a hidden tab gets no requestAnimationFrame, so step its game loop by timer.
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
  return p;
}
async function pair(opts = {}) {
  const errors = [], br = await launch();
  const h = await page(br, false, errors, 'host'); let c;
  await h.goto(base + '/?dev=1&loopnet=1&zmap=night&q=low' + (opts.zbuild != null ? '&zbuild=' + opts.zbuild : ''), { waitUntil: 'networkidle0' });
  await h.click('#zHost');
  await until(h, () => window.__zombies && __zombies.state.code);
  const code = await h.evaluate(() => __zombies.state.code);
  c = await page(br, true, errors, 'client');
  const hb = { close: () => h.close({ runBeforeUnload: true }) }, cb = { close: () => c.close({ runBeforeUnload: true }) };
  await c.goto(base + '/?dev=1&loopnet=1&zmap=night&q=low&touch=1&join=' + code, { waitUntil: 'networkidle0' });
  assert.equal(await c.$eval('#zCode', e => e.value), code);
  await c.evaluate(() => document.getElementById('zJoin').click());
  await until(c, () => [...__zombies.state.remotes.values()][0] && __zombies.state.role === 'client').catch(async e => { console.log('join state', await c.evaluate(() => [document.getElementById('zJoinMsg').textContent, __zombies.state.role, __zombies.net.open])); throw e; });
  await until(h, () => [...__zombies.state.remotes.values()][0] && __zombies.linked());
  return { h, c, hb, cb, br, code, errors };
}
(async () => {
  const R = {};
  // ---------- Pair A: main sync checks ----------
  let A = await pair();
  const { h, c } = A; R.code = A.code;
  R.buildPhaseBoth = await h.evaluate(() => __G.phase) === 'zbuild' && await c.evaluate(() => __G.phase) === 'zbuild';
  R.buildTimer = await h.evaluate(() => __zombies.state.buildT); assert.ok(R.buildTimer > 400 && R.buildTimer <= 420);
  // position sync both ways
  await h.evaluate(() => { __P.pos.set(34, 1, 42); __P.yaw = 1; });
  await c.evaluate(() => { __P.pos.set(44, 1, 58); });
  await until(c, () => [...__zombies.state.remotes.values()][0].pos.distanceTo(new __P.pos.constructor(34, 1, 42)) < .3);
  await until(h, () => [...__zombies.state.remotes.values()][0].pos.distanceTo(new __P.pos.constructor(44, 1, 58)) < .3);
  R.positionSync = true;
  // build sync both ways using the real place() (aim at the floor)
  await h.evaluate(() => { __P.pos.set(40, 1, 50); __P.yaw = 0; __P.pitch = -.5; __coop.syncCamera(0); __coop.place(); });
  const hb1 = await h.evaluate(() => __zombies.state.built.size); assert.ok(hb1 > 0, 'host placed blocks');
  await until(c, n => __zombies.state.built.size === n, hb1);
  await c.evaluate(() => { __P.pos.set(46, 1, 40); __P.yaw = Math.PI; __P.pitch = -.5; __coop.syncCamera(0); __coop.place(); });
  await until(h, n => __zombies.state.built.size > n, hb1);
  const [hs, cs] = [await h.evaluate(() => __zombies.state.built.size), await c.evaluate(() => __zombies.state.built.size)];
  R.buildSync = { host: hs, client: cs }; assert.equal(hs, cs);
  await h.evaluate(() => { __P.pos.set(40, 1, 56); __P.yaw = 0; __P.pitch = -.12; });
  await c.evaluate(() => { __P.pos.set(41, 1, 47); __P.yaw = Math.PI - .3; });
  await sleep(1200);
  await h.screenshot({ path: 'shot-coop-host-build.png' });
  await c.evaluate(() => { __P.pos.set(40, 1, 44); __P.yaw = 0.1; __P.pitch = -.1; });
  await sleep(800);
  await c.screenshot({ path: 'shot-coop-client-mobile-build.png' });
  R.skipVisibleOnPhone = await c.evaluate(() => !document.getElementById('tBuildBar').hidden && getComputedStyle(document.getElementById('tSkip')).display !== 'none');
  // client skips -> both leave build phase
  await c.evaluate(() => __coop.act.skip());
  await until(h, () => __G.phase !== 'zbuild'); await until(c, () => __G.phase !== 'zbuild');
  R.skipByClient = true;
  // zombies spawn on host and appear on client with the same ids
  await until(h, () => __G.units.filter(u => u.hp > 0).length >= 3, null, 30000);
  await sleep(600);
  const ids = async p => p.evaluate(() => __G.units.filter(u => u.hp > 0).map(u => u.id).sort((a, b) => a - b).join(','));
  R.zombieIds = { host: await ids(h), client: await ids(c) };
  const hi = R.zombieIds.host.split(','), ci = R.zombieIds.client.split(',');
  assert.ok(ci.filter(x => hi.includes(x)).length >= Math.min(hi.length, ci.length) - 2, 'zombie id sync');
  R.round = await c.evaluate(() => __zombies.state.round);
  // client hit kills on host and credits client points
  const before = await h.evaluate(() => (__zombies.state.pts.P2 || 0));
  const zid = await c.evaluate(() => { const u = __G.units.find(u => u.hp > 0); __zombies.damage(u, 1e6, true); return u.id; });
  await until(h, id => { const u = __G.units.find(u => u.id === id); return !u || u.hp <= 0; }, zid);
  R.clientHitCredit = (await h.evaluate(() => (__zombies.state.pts.P2 || 0))) - before; assert.ok(R.clientHitCredit >= 110);
  await until(c, p => __zombies.state.points >= p, before + 110);
  // rockets: client swaps to launcher and fires -> host sees the rocket; host splash kills zombies with credit
  await c.evaluate(() => { __coop.act.swap(); });
  R.clientSecondary = await c.evaluate(() => __P.slots[__P.w]);
  await sleep(500); await c.evaluate(() => { __P.pitch = 0; __coop.input.fire = true; }); await sleep(300); await c.evaluate(() => { __coop.input.fire = false; });
  await until(h, () => __zombies.state.rkIn > 0, null, 3000).then(() => R.rocketSyncedToHost = true).catch(() => R.rocketSyncedToHost = false);
  R.clientRocketAmmoLeft = await c.evaluate(() => __P.ammo);
  R.rocketSplash = await h.evaluate(() => { const z = __zombies; z.state.pending = Math.max(z.state.pending, 2); const u = __G.units.find(u => u.hp > 0); if (!u) return 'nounit'; const p0 = z.state.points; __coop.rocketBoom(u.pos.clone().setY(1.5), true); return u.hp <= 0 && z.state.points > p0; });
  // fight screenshot: keep players invulnerable for the shot
  await h.evaluate(() => { __zombies.state.maxHP = 1e6; __P.hp = 1e6; __P.pos.set(40, 1, 60); __P.yaw = 0; __P.pitch = -.05; });
  await c.evaluate(() => { __zombies.state.maxHP = 1e6; __P.hp = 1e6; __P.pos.set(42, 1, 58); __P.yaw = .2; });
  await sleep(2500);
  await h.screenshot({ path: 'shot-coop-fight.png' }); await c.screenshot({ path: 'shot-coop-client-mobile-fight.png' });
  // barricade breaking: wall a zombie in front of host, check blocks disappear on both peers
  const br = []; for (let x = 28; x <= 51; x++) for (let y = 1; y <= 2; y++) br.push([x, y, 36]);
  await h.evaluate(cells => { const z = __zombies, s = z.state; for (const u of __G.units) if (u.hp > 0) z.kill(u, false, false); s.pending = 0;
    const ok = cells.filter(([x, y, zz]) => !__coop.get(x, y, zz)); for (const c of ok) __coop.setB(...c, 2); z.onPlace(ok, 2); }, br);
  await sleep(300);
  const ch = await c.evaluate(() => __zombies.state.built.size); const hh = await h.evaluate(() => __zombies.state.built.size);
  R.barricadeSynced = ch === hh;
  // Breaking: host stands south of the barricade, a zombie spawns north of it.
  await h.evaluate(() => { __P.pos.set(32.5, 1, 38.5); const z = __zombies, s = z.state; s.round = Math.max(1, s.round); __G.phase = 'zombies'; s.pending = 1; s.spawnT = 0; });
  await sleep(1500);
  await h.evaluate(() => { const u = __G.units.find(u => u.hp > 0); if (u) { u.pos.set(32.5, 1, 33.5); u.tpos.copy(u.pos); u.repath = 0; } __P.pos.set(32.5, 1, 38.5); });
  const b0 = await h.evaluate(() => __zombies.state.built.size);
  await until(h, n => __zombies.state.built.size < n, b0, 40000).catch(() => {});
  const b1 = await h.evaluate(() => __zombies.state.built.size);
  R.zombiesBreakBarricades = b1 < b0; await sleep(500);
  R.breakSyncedToClient = (await c.evaluate(() => __zombies.state.built.size)) === b1;
  // downed + revive (host holds E next to downed client)
  await h.evaluate(() => { for (const u of __G.units) if (u.hp > 0) __zombies.kill(u, false, false); __zombies.state.pending = 0; __zombies.state.breakT = 999; __G.phase = 'zbreak'; });
  await c.evaluate(() => { __zombies.state.maxHP = 100; __P.hp = 0; __zombies.onZeroHP(); __P.pos.set(40, 1, 50); });
  R.clientDowned = await c.evaluate(() => __P.downed);
  await until(h, () => [...__zombies.state.remotes.values()][0].down && [...__zombies.state.remotes.values()][0].pos.distanceTo(new __P.pos.constructor(40, 1, 50)) < .3);
  await h.evaluate(() => { __P.pos.set(41.2, 1, 50); __P.yaw = Math.PI / 2; __P.pitch = -.35; });
  await sleep(300); await h.screenshot({ path: 'shot-coop-revive-prompt.png' });
  await h.keyboard.down('KeyE'); await sleep(1600); await h.screenshot({ path: 'shot-coop-reviving.png' });
  await until(c, () => !__P.downed, null, 6000); await h.keyboard.up('KeyE');
  R.revived = true; R.hostStillAlive = !(await h.evaluate(() => __G.over));
  // disconnect: joiner closes -> host continues solo
  await A.cb.close();
  await until(h, () => ![...__zombies.state.remotes.values()][0], null, 15000);
  R.hostContinuesSoloAfterP2Leaves = await h.evaluate(() => !__G.over && __zombies.state.role === 'host');
  R.errorsA = A.errors; await A.hb.close(); await A.br.close();
  // ---------- Pair B: host leaves -> client continues solo as authority ----------
  let B = await pair({ zbuild: 0 });
  await until(B.c, () => __G.units.filter(u => u.hp > 0).length >= 2, null, 30000);
  await B.c.evaluate(() => { __zombies.state.maxHP = 1e6; __P.hp = 1e6; });
  await B.hb.close();
  await until(B.c, () => __zombies.state.role === 'solo', null, 15000);
  const k0 = await B.c.evaluate(() => { const z = __zombies; for (const u of __G.units) if (u.hp > 0) z.damage(u, 1e6, false); return z.state.kills; });
  await sleep(1500);
  R.clientTakesOverAfterHostLeaves = await B.c.evaluate(k => !__G.over && __zombies.state.kills > k - 1 && __G.units.every(u => u.d && u.d.spd), k0);
  R.errorsB = B.errors; await B.br.close();
  // ---------- Pair C: both downed -> game over on both ----------
  let C = await pair({ zbuild: 0 });
  await C.c.evaluate(() => { __P.hp = 0; __zombies.onZeroHP(); });
  await until(C.h, () => [...__zombies.state.remotes.values()][0].down);
  R.hostNotOverWhileTeammateUp = !(await C.h.evaluate(() => __G.over));
  await C.h.evaluate(() => { __P.hp = 0; __zombies.onZeroHP(); });
  await until(C.h, () => __G.over); await until(C.c, () => __G.over);
  R.gameOverWhenBothDown = await C.c.$eval('#endT', e => e.textContent);
  R.errorsC = C.errors; await C.br.close();
  console.log(JSON.stringify(R, null, 1));
  const errs = [...R.errorsA, ...R.errorsB, ...R.errorsC]; assert.deepEqual(errs, [], 'console errors');
  for (const k of ['buildPhaseBoth', 'positionSync', 'skipVisibleOnPhone', 'skipByClient', 'zombiesBreakBarricades', 'breakSyncedToClient', 'barricadeSynced', 'clientDowned', 'revived', 'hostStillAlive', 'hostContinuesSoloAfterP2Leaves', 'clientTakesOverAfterHostLeaves', 'hostNotOverWhileTeammateUp', 'rocketSplash', 'rocketSyncedToHost']) assert.ok(R[k], k);
  console.log('COOP OK');
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
