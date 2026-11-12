// v34 drunk tiers: pass-out moved to 14 drinks; very drunk sprinting trips you (down 1.5-3 s, then up), walking never does,
// letting go still stops at once; very drunk galloping can throw you off (then you climb back on); the 8+ shader renders.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = []; const R = {};
  for (const nr of [true, false]) { const p = await br.newPage(); p.on('pageerror', e => errors.push(String(e))); await p.setViewport({ width: 960, height: 540 });
    await p.goto(base + '/?dev=1&solo=1&prochorse=1' + (nr ? '&norender=1&q=low' : '&q=medium'), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.state.town2, { timeout: 600000 });
    if (!nr) { await p.evaluate(() => { const H = __horse.state; H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.town2.drunk = 12; }); await new Promise(r => setTimeout(r, 8000));
      R.render = await p.evaluate(() => ({ err: window.__loopErr ? String(window.__loopErr) : null, pass: !!(__horse.state.drunkPass && __horse.state.drunkPass.enabled), uK: __horse.state.drunkPass ? +__horse.state.drunkPass.uniforms.uK.value.toFixed(2) : -1, frames: window.__frames }));
      await p.screenshot({ path: 'shot-horserider-v34-desktop-very-drunk.png' }); await p.close(); continue; }
    Object.assign(R, await p.evaluate(() => { const H = __horse.state, T = H.town2, k = __coop.keys, inp = __coop.input, o = {}; H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.zombies.state.hp = 1e9;
      const open = () => { const x = 30, z = 60; __P.pos.set(x, __horse.hAt(x, z), z); H.fv.set(0, 0); H.fallT = 0; };
      // no pass-out until 14
      open(); T.drunk = 12.5; for (let i = 0; i < 20; i++) __sim(.05); o.awakeAt12 = !(T.passT > 0);
      // walking slowly very drunk: no trips
      open(); T.drunk = 12; const t0 = H.trips || 0; for (let i = 0; i < 600; i++) { inp.mz = -.35; __P.yaw += .004; if (i % 100 == 0) open(); T.drunk = 12; __sim(.05); } inp.mz = 0; o.walkTrips = (H.trips || 0) - t0;
      // sprinting very drunk: trips, each 1.5-3 s down (camera low), then up and running again while held
      open(); const t1 = H.trips || 0, downs = []; let cur = 0, upAgain = 0, wasDown = false;
      for (let i = 0; i < 1200 && (H.trips || 0) - t1 < 3; i++) { k.KeyW = true; k.ShiftLeft = true; T.drunk = 11; __P.yaw += .003; if (i % 150 == 0 && !(H.fallT > 0)) open(); __sim(.05);
        if (H.fallT > 0) { cur += .05; wasDown = true; } else if (wasDown) { downs.push(+cur.toFixed(2)); cur = 0; wasDown = false; }
        if (!(H.fallT > 0) && downs.length && H.fv.length() > 4) upAgain = 1; }
      o.sprintTrips = (H.trips || 0) - t1; o.downs = downs; o.upAgain = upAgain;
      // let go right after getting up: stops within ~0.5 s
      for (let i = 0; i < 80 && H.fallT > 0; i++) __sim(.05); for (let i = 0; i < 20; i++) __sim(.05); const v0 = H.fv.length(); k.KeyW = false; k.ShiftLeft = false; let t = 0; while (H.fv.length() > .15 && t < 3) { __sim(.05); t += .05; } o.stopAfter = { v0: +v0.toFixed(2), t: +t.toFixed(2) };
      // galloping very drunk: thrown off, then back on
      const h = H.horses[0]; open(); h.pos.set(__P.pos.x + 1.2, h.pos.y, __P.pos.z); h.pos.y = __horse.hAt(h.pos.x, h.pos.z); H.cd = 0; T.drunk = 0; __horse.use(); for (let i = 0; i < 40; i++) __sim(.05); o.mounted = !!H.mounted;
      const th0 = H.thrown || 0; let thrownAt = -1, remounted = false; for (let i = 0; i < 2400; i++) { T.drunk = 12; k.KeyW = true; k.ShiftLeft = true; H.stam = 100; H.winded = 0; H.cruise = 4; if (i % 200 == 0 && H.mounted) { __P.yaw += 1.5; }
        __sim(.05); if (thrownAt < 0 && (H.thrown || 0) > th0) thrownAt = i; if (thrownAt >= 0 && H.mounted) { remounted = true; break; } }
      k.KeyW = false; k.ShiftLeft = false; o.thrown = (H.thrown || 0) - th0; o.thrownAfterS = thrownAt * .05; o.remounted = remounted;
      // pass out at 14
      if (H.mounted) { H.cd = 0; H.dismT = 0; } __horse.state.mounted && (__horse.dismount ? __horse.dismount() : 0); T.drunk = 14.2; for (let i = 0; i < 10; i++) __sim(.05); o.passAt14 = T.passT > 0 || !!H.mounted;
      return o; }));
    await p.close(); }
  R.errors = errors; console.log(JSON.stringify(R));
  assert.ok(R.awakeAt12, 'no pass-out before 14'); assert.equal(R.walkTrips, 0, 'walking never trips'); assert.ok(R.sprintTrips >= 1, 'sprinting very drunk trips');
  assert.ok(R.downs.length && R.downs.every(d => d >= 1.4 && d <= 3.1), 'down 1.5-3 s'); assert.ok(R.upAgain, 'gets up and runs again'); assert.ok(R.stopAfter.v0 > 1 && R.stopAfter.t <= .55, 'letting go stops (never stuck)');
  assert.ok(R.mounted && R.thrown >= 1 && R.remounted, 'thrown off at a gallop, then back on'); assert.ok(R.render.pass && R.render.uK > 1 && !R.render.err, 'very drunk shader renders');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE DRUNK OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
