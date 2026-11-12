// v34: never "stuck running". On foot (sober and drunk) the player stops within ~0.5 s of letting go; a stick left "held" by
// a missed touchend is cleared by blur / the touch dead-man; the horse (sober and drunk) slows to a stop when you let go.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.state.town2, { timeout: 600000 });
  const R = await p.evaluate(() => { const H = __horse.state, T = H.town2, k = __coop.keys, inp = __coop.input, o = {}; H.zombies.clear(); H.zombies.state.spawnT = 1e9;
    const put = () => { const x = 30, z = 60; __P.pos.set(x, __horse.hAt(x, z), z); H.fv.set(0, 0); __P.yaw = 0; };
    const stopTime = (drunk, press, release) => { put(); T.drunk = drunk; for (let i = 0; i < 40; i++) { press(); __sim(.05); } const v0 = H.fv.length(); release(); let t = 0; while (H.fv.length() > .15 && t < 6) { __sim(.05); t += .05; } let moved = 0; const p0 = __P.pos.clone(); for (let i = 0; i < 20; i++) __sim(.05); moved = __P.pos.distanceTo(p0); return { v0: +v0.toFixed(2), t: +t.toFixed(2), drift1s: +moved.toFixed(2) }; };
    o.soberKeys = stopTime(0, () => { k.KeyW = true; }, () => { k.KeyW = false; });
    o.drunkKeys = stopTime(6, () => { k.KeyW = true; k.ShiftLeft = true; }, () => { k.KeyW = false; k.ShiftLeft = false; }); H.fallT = 0;
    o.drunkStick = stopTime(5, () => { inp.mx = .2; inp.mz = -1; }, () => { inp.mx = inp.mz = 0; }); H.fallT = 0;
    o.blur = stopTime(0, () => { inp.mz = -1; }, () => { window.dispatchEvent(new Event('blur')); }); o.blurClears = inp.mz === 0;
    o.hidden = stopTime(0, () => { k.KeyW = true; }, () => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; }); o.keyCleared = !k.KeyW;
    T.drunk = 0; // the horse: gallop, let go (coasts to a stop), and drunk the same
    const h = H.horses[1]; for (const q of H.horses) { q.tgt = null; q.wait = 1e9; } put(); h.pos.set(__P.pos.x + 1.2, __P.pos.y, __P.pos.z); h.inPen = false; for (let i = 0; i < 4; i++) __sim(.05); H.cd = 0; __horse.use(); for (let i = 0; i < 60; i++) __sim(.05);
    const ride = drunk => { T.drunk = drunk; H.stam = 100; H.winded = 0; k.KeyW = true; H.cruise = 4; for (let i = 0; i < 80; i++) { H.stam = 100; __sim(.05); } const s0 = H.speed; k.KeyW = false; let t = 0; while (Math.abs(H.speed) > .3 && t < 8) { __sim(.05); t += .05; } return { s0: +s0.toFixed(1), t: +t.toFixed(2) }; };
    o.horseSober = ride(0); o.horseDrunk = ride(6); T.drunk = 0; return o; });
  { const q = await br.newPage(); q.on('pageerror', e => errors.push(String(e))); await q.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true });
    await q.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&touch=1', { waitUntil: 'load', timeout: 300000 }); await q.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && window.__touchReset, { timeout: 600000 });
    Object.assign(R, await q.evaluate(() => { const H = __horse.state, inp = __coop.input; H.zombies.clear(); H.zombies.state.spawnT = 1e9; const x = 30, z = 60; __P.pos.set(x, __horse.hAt(x, z), z); H.fv.set(0, 0);
      for (let i = 0; i < 40; i++) { inp.mz = -1; __sim(.05); } const v0 = H.fv.length(); window.dispatchEvent(new Event('touchend')); let t = 0; while (H.fv.length() > .15 && t < 6) { __sim(.05); t += .05; } const p0 = __P.pos.clone(); for (let i = 0; i < 20; i++) __sim(.05);
      return { deadman: { v0: +v0.toFixed(2), t: +t.toFixed(2), drift1s: +__P.pos.distanceTo(p0).toFixed(2) }, deadClears: inp.mz === 0 }; })); await q.close(); }
  R.errors = errors; console.log(JSON.stringify(R, null, 1));
  for (const n of ['soberKeys', 'drunkKeys', 'drunkStick', 'blur', 'deadman', 'hidden']) { assert.ok(R[n].v0 > 1, n + ' was moving'); assert.ok(R[n].t <= .55, `${n}: stops within ~0.5 s (${R[n].t})`); assert.ok(R[n].drift1s < .6, `${n}: stays stopped (${R[n].drift1s} m)`); }
  assert.ok(R.blurClears && R.deadClears && R.keyCleared, 'blur / touch dead-man / hidden clear the input');
  assert.ok(R.horseSober.s0 > 8 && R.horseSober.t < 4.5, 'the horse coasts to a stop'); assert.ok(R.horseDrunk.s0 > 8 && R.horseDrunk.t < 5, 'drunk: the horse still stops');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE STOP OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
