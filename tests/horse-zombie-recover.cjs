// v34: zombies never get lost. Forced under the map, NaN, far away or trapped (a ring of rocks) they come back near the players
// (40-90 m, on valid ground, outside the town / pen / lookouts) and the live count stays at the 3x cap.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.state.zombies && __horse.state.town2, { timeout: 600000 });
  const R = await p.evaluate(() => { const H = __horse.state, Z = H.zombies, o = {}; const x = 40, z = 70; __P.pos.set(x, __horse.hAt(x, z), z); Z.state.hp = 1e9;
    const live = () => Z.list.filter(q => q.alive), cap = Z.state.cap; Z.state.spawnT = 0; let t = 0; while (live().length < cap && t < 60) { Z.state.hp = 1e9; __sim(.5); t += .5; } o.cap = cap; o.filled = live().length; o.fillSecs = t;
    const L = live(); o.spawnOk = L.every(q => Z.goodGround ? Z.goodGround(q.pos.x, q.pos.z) || Math.hypot(q.pos.x - __P.pos.x, q.pos.z - __P.pos.z) < 40 : true);
    const ids = L.slice(0, 4).map(q => q.id); const far = L.filter(q => Math.hypot(q.pos.x - __P.pos.x, q.pos.z - __P.pos.z) > 30), [a, b, c] = L.filter(q => !far.slice(0, 1).includes(q)), d = far[0]; d.tgt = null; a.pos.y = a.pos.y - 30; b.pos.x = NaN; c.pos.set(__P.pos.x + 600, 0, __P.pos.z); c.pos.y = __horse.hAt(c.pos.x, c.pos.z);
    const ring = []; d.hold = false; for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2, r = [d.pos.x + Math.cos(an) * 2.6, d.pos.z + Math.sin(an) * 2.6, 1.3]; H.obst.push(r); ring.push(r); } o.dStart = [d.pos.x, d.pos.z];
    const r0 = Z.state.relocs || 0; for (let i = 0; i < 26; i++) { Z.state.hp = 1e9; __sim(.5); } o.relocs = (Z.state.relocs || 0) - r0;
    for (const r of ring) H.obst.splice(H.obst.indexOf(r), 1);
    const near = q => Math.hypot(q.pos.x - __P.pos.x, q.pos.z - __P.pos.z); o.forced = [a, b, c, d].map(q => ({ ok: q.alive ? Number.isFinite(q.pos.x) && Number.isFinite(q.pos.z) && Math.abs(q.pos.y - __horse.hAt(q.pos.x, q.pos.z)) < .01 && near(q) < 250 : true, d: q.alive ? +near(q).toFixed(0) : -1, tp: q.tp || 0 }));
    o.dEscaped = Math.hypot(d.pos.x - o.dStart[0], d.pos.z - o.dStart[1]) > 3; o.liveAfter = live().length; o.allFinite = live().every(q => Number.isFinite(q.pos.x + q.pos.y + q.pos.z)); o.maxDist = Math.max(...live().map(near)) | 0;
    o.inTown = live().filter(q => Z.inTown(q.pos.x, q.pos.z)).length; o.inTower = live().filter(q => H.town2.towers.some(t => H.town2.inFoot(t, q.pos.x, q.pos.z, 0))).length;
    // host change: a client that becomes the host refills the horde
    Z.clear(); const role = H.netRole; H.netRole = () => 'client'; for (let i = 0; i < 4; i++) __sim(.5); o.clientSpawned = live().length; H.netRole = role; t = 0; while (live().length < cap && t < 60) { Z.state.hp = 1e9; __sim(.5); t += .5; } o.refillAfterHost = live().length; o.refillSecs = t;
    return o; });
  R.errors = errors; console.log(JSON.stringify(R, null, 1));
  assert.equal(R.filled, R.cap, 'fills to the cap'); assert.ok(R.relocs >= 3, 'lost zombies were brought back'); assert.ok(R.forced.every(f => f.ok), 'under the map / NaN / far / trapped all recovered');
  assert.ok(R.dEscaped, 'the trapped one got out'); assert.equal(R.liveAfter, R.cap, 'count stays at the cap'); assert.ok(R.allFinite && R.maxDist <= 250, 'all near and valid');
  assert.equal(R.inTown, 0); assert.equal(R.inTower, 0); assert.equal(R.refillAfterHost, R.cap, 'refills after becoming the host');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE ZOMBIE RECOVER OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
