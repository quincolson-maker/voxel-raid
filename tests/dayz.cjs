// Run: node tests/dayz.cjs [base]. Daybreak — Firebase (daytime Endless Zombies): spawns, shops, door/box, build+skip,
// barricade breaking, waves, per-map best, RPG splash, co-op map handoff (loopnet). Saves shot-dayz-*.png.
const puppeteer = require('puppeteer-core'); const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const errors = [], R = {};
  const page = async (mobile, tag) => { const p = await b.newPage(); p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/pointer ?lock|fullscreen|404/i.test(m.text())) errors.push(tag + ': ' + m.text()); });
    await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 }); return p; };
  // --- solo, build phase + skip
  let p = await page(false, 'buildp'); await p.goto(base + '/?auto=zombies&zmap=day&q=medium&dev=1', { waitUntil: 'networkidle0' });
  R.buildPhase = await p.evaluate(() => [__G.phase, __zombies.state.map, Math.round(__zombies.state.buildT)]);
  await p.evaluate(() => { __P.pos.set(45.5, 1, 57.5); __P.yaw = 0; __P.pitch = -.12; }); await sleep(2500); await p.screenshot({ path: 'shot-dayz-build-desktop.png' });
  R.skip = await p.evaluate(() => { __coop.act.skip(); return __G.phase; }); await p.close();
  // --- solo gameplay checks
  p = await page(false, 'solo'); await p.goto(base + '/?auto=zombies&zmap=day&zbuild=0&q=medium&dev=1', { waitUntil: 'networkidle0' });
  Object.assign(R, await p.evaluate(() => { const z = __zombies, s = z.state, P = __P, G = __G, o = {};
    __sim(12); o.round = s.round; const live = G.units.filter(u => u.hp > 0); o.spawned = live.length;
    o.spawnDist = live.map(u => Math.round(u.pos.distanceTo(P.pos))); o.inBounds = live.every(u => u.pos.x > 2 && u.pos.x < 94 && u.pos.z > 2 && u.pos.z < 94);
    s.points = 20000; const at = n => s.stations.find(x => x.name === n), go = st => P.pos.set(st.x, 1, st.z + 1.5);
    go(at('M4A1')); o.m4 = z.buy() && P.slots.includes('carbine'); go(at('M870')); o.m870 = z.buy() && P.slots.includes('shotgun');
    go(at('MYSTERY BOX')); o.boxLockedBefore = !z.buy();
    go(at('OPEN COMMAND POST')); o.door = z.buy() && s.opened && !__coop.get(48, 1, 42);
    P.pos.set(48, 1, 43.5); o.box = z.buy(); go(at('AMMO CACHE')); o.ammo = z.buy(); go(at('IRON HEART')); o.perk = z.buy() && s.maxHP === 180; go(at('QUICK HANDS')); o.reload = z.buy();
    s.maxHP = 1e7; P.hp = 1e7; P.pos.set(45.5, 1, 57.5);
    for (let i = 0; i < 80 && s.round === 1; i++) { for (const u of G.units) if (u.hp > 0) z.damage(u, 1e9, false); __sim(1); } o.advanced = s.round >= 2;
    z.power('strike'); z.power('uav'); o.uav = s.uavT > 0;
    return o; }));
  await sleep(1500);
  // barricade break: wall 2-high line between player and a zombie
  R.breaks = await p.evaluate(async () => { const z = __zombies, s = z.state, G = __G, P = __P; for (const u of G.units) if (u.hp > 0) z.kill(u, false, false); __sim(2);
    const cells = []; for (let x = 45; x <= 52; x++) for (let zz = 57; zz <= 63; zz++) if (x === 45 || x === 52 || zz === 57 || zz === 63) for (let y = 1; y <= 2; y++) if (!__coop.get(x, y, zz)) cells.push([x, y, zz]); for (const c of cells) __coop.setB(...c, 2); z.onPlace(cells, 2);
    P.pos.set(48.5, 1, 60.5); s.pending = 1; s.spawnT = 0; G.phase = 'zombies'; __sim(.2); const u = G.units.find(u => u.hp > 0); if (!u) return 'nospawn'; u.pos.set(48.5, 1, 64.5); u.repath = 0;
    const b0 = s.built.size; for (let i = 0; i < 90 && s.built.size === b0; i++) __sim(.5); return s.built.size < b0 || JSON.stringify([u.pos, u.hp, G.phase, b0, P.downed]); });
  R.rpg = await p.evaluate(() => { const z = __zombies, s = z.state; s.pending = 3; s.spawnT = 0; __sim(3); const u = __G.units.find(u => u.hp > 0); if (!u) return 'nounit'; const k = s.kills; __coop.rocketBoom(u.pos.clone().setY(1.4), true); return s.kills > k; });
  R.bestKeySeparate = await p.evaluate(() => { __P.hp = 0; __zombies.state.maxHP = 100; __zombies.over(); return [localStorage.getItem('vr_zombies_best_day'), localStorage.getItem('vr_zombies_best')]; });
  await p.close();
  // --- screenshots gameplay desktop + mobile
  for (const [mobile, name] of [[false, 'desktop'], [true, 'mobile']]) { p = await page(mobile, name); await p.goto(base + '/?auto=zombies&zmap=day&zbuild=0&dev=1&q=' + (mobile ? 'low&touch=1' : 'medium'), { waitUntil: 'networkidle0' });
    await p.evaluate(() => { __zombies.state.maxHP = 1e7; __P.hp = 1e7; __sim(14); __P.pos.set(48, 1, 66); __P.yaw = Math.PI; __P.pitch = -.05; }); await sleep(3000); await p.screenshot({ path: `shot-dayz-${name}.png` }); await p.close(); }
  // --- co-op map handoff (host picks Day, joiner gets it)
  const h = await page(false, 'host'); await h.goto(base + '/?dev=1&loopnet=1&q=low', { waitUntil: 'networkidle0' });
  await h.click('#zHost'); await h.waitForFunction(() => __zombies.state.code, { polling: 100, timeout: 20000 });
  const code = await h.evaluate(() => __zombies.state.code); const c = await page(true, 'client'); await c.goto(base + '/?dev=1&loopnet=1&q=low&touch=1&join=' + code, { waitUntil: 'networkidle0' });
  await c.evaluate(() => document.getElementById('zJoin').click()); await c.waitForFunction(() => [...__zombies.state.remotes.values()][0] && __zombies.state.role === 'client', { polling: 100, timeout: 20000 });
  R.coopMap = await c.evaluate(() => [__zombies.state.map, __zombies.state.stations.map(s => s.name).includes('OPEN COMMAND POST')]);
  await c.evaluate(() => __coop.act.skip()); await h.waitForFunction(() => __G.phase !== 'zbuild', { polling: 100, timeout: 10000 });
  await h.waitForFunction(() => __G.units.filter(u => u.hp > 0).length >= 2, { polling: 100, timeout: 40000 }).catch(async () => console.log('hoststate', JSON.stringify(R), await h.evaluate(() => [__G.phase, __G.t, __zombies.state.round, __zombies.state.pending, __zombies.state.breakT, document.hidden]))); await sleep(800);
  R.coopZombies = await c.evaluate(() => __G.units.filter(u => u.hp > 0).length);
  await c.screenshot({ path: 'shot-dayz-coop-mobile.png' });
  console.log(JSON.stringify(R, null, 1)); console.log('errors', JSON.stringify(errors));
  assert.equal(R.buildPhase[0], 'zbuild'); assert.equal(R.buildPhase[1], 'day'); assert.notEqual(R.skip, 'zbuild');
  for (const k of ['inBounds', 'm4', 'm870', 'boxLockedBefore', 'door', 'box', 'ammo', 'perk', 'reload', 'advanced', 'uav']) assert.ok(R[k], k);
  assert.ok(R.spawned >= 2 && Math.max(...R.spawnDist) < 45, 'spawns near'); assert.equal(R.breaks, true); assert.equal(R.rpg, true);
  assert.ok(R.bestKeySeparate[0] != null); assert.deepEqual(R.coopMap, ['day', true]); assert.ok(R.coopZombies >= 1); assert.deepEqual(errors, []);
  console.log('DAYZ OK'); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
