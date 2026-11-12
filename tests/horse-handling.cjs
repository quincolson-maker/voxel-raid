// v33 horse handling: hard braking, tight turns at a walk, usable turns at a gallop, steady heading with no input,
// the camera / aim never steers the horse, phone stick deadzone, and no height gained sliding sideways along a cliff.
// Deterministic: drives the game with window.__sim (fixed 50 ms steps, no rendering needed).
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=960,540'] });
  const p = await br.newPage(); await p.setViewport({ width: 960, height: 540 }); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&zombies=0&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.state.models !== 'loading', { timeout: 300000 });
  const R = await p.evaluate(() => {
    const H = __horse.state, k = __coop.keys, inp = __coop.input, out = {}, hAt = __horse.hAt, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const clr = () => { for (const c of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft']) k[c] = false; inp.mx = inp.mz = 0; };
    // a long clear, fairly flat straight run in the meadows
    let site = null; for (let i = 0; i < 400 && !site; i++) { const x = -300 + Math.random() * 600, z = -300 + Math.random() * 600, a = Math.random() * 6.283, fx = -Math.sin(a), fz = -Math.cos(a); let ok = true;
      for (let t = -10; t <= 150 && ok; t += 2) { const px = x + fx * t, pz = z + fz * t; if (H.blockedAt(px, pz, 6) || Math.abs(hAt(px, pz) - hAt(x, z)) > 6) ok = false; } if (ok) site = { x, z, a }; }
    out.site = !!site; if (!site) return out;
    const h = H.horses.find(o => o.pos.distanceTo(__P.pos) < 400) || H.horses[0]; __P.pos.set(h.pos.x + 1, h.pos.y, h.pos.z); __horse.use(); __sim(3);
    out.mounted = !!H.mounted; const m = H.mounted;
    const put = (x, z, a) => { m.pos.set(x, hAt(x, z), z); m.yaw = a; __P.yaw = a; H.speed = 0; H.yawRate = 0; H.stam = 100; H.winded = 0; };
    // 1) gallop, then pull back: stop well inside 2 s
    put(site.x, site.z, site.a); clr(); k.KeyW = true; k.ShiftLeft = true; __sim(7); out.gallop = +H.speed.toFixed(2); clr(); k.KeyS = true;
    let t = 0; while (H.speed > .3 && t < 6) { __sim(.05); t += .05; } out.brakeS = +t.toFixed(2); clr(); __sim(.5);
    // 1b) gallop, then just let go of the reins
    put(site.x, site.z, site.a); k.KeyW = true; k.ShiftLeft = true; __sim(7); clr(); t = 0; while (H.speed > .3 && t < 8) { __sim(.05); t += .05; } out.releaseS = +t.toFixed(2);
    // 2) 180 at a walk: within a few metres
    put(site.x, site.z, site.a); H.cruise = 1; k.KeyW = true; __sim(2); const s0 = m.pos.clone(), y0 = m.yaw; k.KeyD = true; let turned = 0, ext = 0, lastY = m.yaw; t = 0;
    while (Math.abs(turned) < Math.PI && t < 10) { __sim(.05); t += .05; turned += wrap(m.yaw - lastY); lastY = m.yaw; ext = Math.max(ext, Math.hypot(m.pos.x - s0.x, m.pos.z - s0.z)); }
    out.walk180 = { s: +t.toFixed(2), across: +ext.toFixed(2), sp: +H.speed.toFixed(2) }; clr(); __sim(.4);
    // 3) a turn at the gallop is still usable (radius)
    put(site.x, site.z, site.a); k.KeyW = true; k.ShiftLeft = true; __sim(6); k.KeyA = true; const r0 = m.yaw; __sim(1.5); out.gallopTurn = { rate: +(Math.abs(wrap(m.yaw - r0)) / 1.5).toFixed(2), speed: +H.speed.toFixed(2) }; out.gallopTurn.radius = +(out.gallopTurn.speed / Math.max(.01, out.gallopTurn.rate)).toFixed(1); clr();
    // 4) no input after a turn: the turn stops and the heading holds; swinging the camera / aim round does not steer
    put(site.x, site.z, site.a); H.cruise = 3; k.KeyW = true; __sim(4); k.KeyD = true; __sim(.8); k.KeyD = false; __sim(.4); const yA = m.yaw; __P.yaw += 2.2; __P.swX = (__P.swX || 0) + 1; __sim(3);
    out.drift = +Math.abs(wrap(m.yaw - yA)).toFixed(4); out.yawRate = +H.yawRate.toFixed(4); clr(); __sim(2);
    // 5) phone stick: tiny drift inside the deadzone does nothing; pushed forward-right it rides and turns
    put(site.x, site.z, site.a); inp.mx = .05; inp.mz = -.06; __sim(2); out.deadzone = { sp: +H.speed.toFixed(2), turn: +Math.abs(wrap(m.yaw - site.a)).toFixed(3) };
    inp.mx = .35; inp.mz = -.8; __sim(3); out.stick = { sp: +H.speed.toFixed(2), turn: +Math.abs(wrap(m.yaw - site.a)).toFixed(2) }; inp.mz = .9; inp.mx = 0; t = 0; while (H.speed > .3 && t < 6) { __sim(.05); t += .05; } out.stickBrakeS = +t.toFixed(2); clr();
    // 6) cliff: ride across a too-steep face at an angle for 12 s; sliding along it must not climb it
    const G = H.maxGrade(); let cliff = null; for (let i = 0; i < 4000 && !cliff; i++) { const x = -900 + Math.random() * 1800, z = -900 + Math.random() * 1800, gx = (hAt(x + 1, z) - hAt(x - 1, z)) / 2, gz = (hAt(x, z + 1) - hAt(x, z - 1)) / 2;
      if (Math.hypot(gx, gz) > G * 1.25 && !H.blockedAt(x, z, 2)) cliff = { x, z, up: Math.atan2(-gx, -gz) }; }
    out.cliff = !!cliff; if (cliff) { const gains = [], legit = []; for (const side of [.55, -.55, 1.2, -1.2]) { put(cliff.x, cliff.z, cliff.up + side); const y0 = m.pos.y; k.KeyW = true; k.ShiftLeft = true; let mx = 0; for (let i = 0; i < 240; i++) { const sh = H.steepHits || 0, yb = m.pos.y; __sim(.05); if ((H.steepHits || 0) > sh) mx += Math.max(0, m.pos.y - yb); /* height gained on steps the too-steep gate handled (the slide) */ m.yaw = Math.atan2(-(hAt(m.pos.x + 1, m.pos.z) - hAt(m.pos.x - 1, m.pos.z)), -(hAt(m.pos.x, m.pos.z + 1) - hAt(m.pos.x, m.pos.z - 1))) + side; } gains.push(+mx.toFixed(2)); legit.push(+(m.pos.y - y0).toFixed(1)); clr(); } out.cliffGain = gains; out.netClimb = legit; }
    out.loopErr = window.__loopErr ? String(window.__loopErr) : null; return out; });
  R.errors = errors; console.log(JSON.stringify(R, null, 1));
  assert.ok(R.site && R.mounted, 'set up');
  assert.ok(R.gallop > 14, 'galloped'); assert.ok(R.brakeS < 2, 'brakes from a gallop to a stop in under 2 s'); assert.ok(R.releaseS < 3.2, 'eases to a stop when the reins go slack');
  assert.ok(R.walk180.s < 3 && R.walk180.across < 4, '180 at a walk within a few metres');
  assert.ok(R.gallopTurn.radius < 20 && R.gallopTurn.speed > 10, 'usable turn at a gallop');
  assert.ok(R.drift < .01 && R.yawRate === 0, 'no circling on its own; the camera does not steer');
  assert.ok(R.deadzone.sp < .05 && R.deadzone.turn < .01, 'stick deadzone'); assert.ok(R.stick.sp > 4 && R.stick.turn > .3, 'stick rides and turns'); assert.ok(R.stickBrakeS < 2.5, 'stick pulled back brakes');
  if (R.cliff) assert.ok(Math.max(...R.cliffGain) < 1, 'no height gained sliding along a cliff');
  assert.ok(!R.loopErr && !errors.length, 'no errors');
  console.log('HORSE HANDLING OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
