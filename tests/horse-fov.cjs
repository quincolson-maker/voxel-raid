// v36 field-of-view setting: default 70° horizontal (narrower than the old 68° vertical ≈ 101° horizontal at 16:9), slider 55-100 in
// Settings (desktop ⚙ button, phones ⋯ > Settings), saved in localStorage, survives a reload; on-foot / riding / sprint kick / sniper
// scope all scale with it; touching the panel does not turn the camera or shoot.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767', sleep = ms => new Promise(r => setTimeout(r, ms));
const vfov = (h, a) => Math.min(80, Math.max(30, 2 * Math.atan(Math.tan(h * Math.PI / 360) / a) * 180 / Math.PI));
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const R = {}; const url = base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&zombies=0';
  const boot = async (p, extra = '') => { await p.goto(url + extra, { waitUntil: 'load', timeout: 300000 }); await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __booted, { timeout: 600000 }); };
  const settle = (p, s = 3) => p.evaluate(s => { for (let i = 0; i < s * 20; i++) { __sim(.05); __coop.syncCamera(.05); } return { fov: __cam.fov, aspect: __cam.aspect }; }, s);
  { const p = await br.newPage(); await p.setViewport({ width: 1280, height: 720 }); const errs = []; p.on('pageerror', e => errs.push(String(e))); await boot(p);
    await p.evaluate(() => { localStorage.removeItem('hr_fov_h'); }); await boot(p);
    R.def = await p.evaluate(() => __horse.state.fovH); R.foot70 = await settle(p);
    R.btnVisible = await p.$eval('#setBtn', e => getComputedStyle(e).display !== 'none'); await p.click('#setBtn'); R.panel = await p.$eval('#hrSettings', e => !e.hidden);
    await p.evaluate(() => { const r = document.getElementById('fovRange'); r.value = 90; r.dispatchEvent(new Event('input')); }); R.saved = await p.evaluate(() => localStorage.getItem('hr_fov_h')); R.label = await p.$eval('#fovVal', e => e.textContent);
    await p.click('#setClose'); R.closed = await p.$eval('#hrSettings', e => e.hidden); R.foot90 = await settle(p);
    R.sprint90 = await p.evaluate(() => { const k = __coop.keys; k.KeyW = k.ShiftLeft = true; for (let i = 0; i < 60; i++) { __sim(.05); __coop.syncCamera(.05); } const f = __cam.fov; k.KeyW = k.ShiftLeft = false; return f; });
    R.scope90 = await p.evaluate(() => { const g = __horse.state.guns; g.give('sniper'); g.draw('sniper'); for (let i = 0; i < 20; i++) __sim(.05); for (let i = 0; i < 60; i++) { __coop.input.ads = true; __sim(.05); __coop.syncCamera(.05); } const f = __cam.fov; __coop.input.ads = false; for (let i = 0; i < 40; i++) { __sim(.05); __coop.syncCamera(.05); } return { f, scoped: g.state.scoped, back: __cam.fov, w: g.state.weapon, aiming: g.state.aiming, ui: __horse.state.uiOpen }; });
    await p.keyboard.press('KeyO'); R.keyO = await p.$eval('#hrSettings', e => !e.hidden); await p.keyboard.press('KeyO');
    await boot(p); R.reload = await p.evaluate(() => __horse.state.fovH); R.ride = await p.evaluate(() => { const H = __horse.state, h = H.horses[0]; h.pos.set(__P.pos.x + 1, h.pos.y, __P.pos.z); __P.pos.y = __horse.hAt(__P.pos.x, __P.pos.z); H.cd = 0; __horse.use(); for (let i = 0; i < 80; i++) { __sim(.05); __coop.syncCamera(.05); } return { m: !!H.mounted, fov: __cam.fov }; });
    R.errs = errs; await p.close(); }
  { const p = await br.newPage(); await p.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(String(e))); await boot(p, '&touch=1');
    R.mGearHidden = await p.$eval('#setBtn', e => getComputedStyle(e).display === 'none');
    const c = async sel => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    let [x, y] = await c('#tMore'); await p.touchscreen.tap(x, y); await sleep(300); [x, y] = await c('#mSet'); await p.touchscreen.tap(x, y); await sleep(300);
    R.mPanel = await p.$eval('#hrSettings', e => !e.hidden); const y0 = await p.evaluate(() => __P.yaw);
    const rr = await p.$eval('#fovRange', e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top + r.height / 2]; });
    const cdp = await p.target().createCDPSession(); const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 3 }] });
    await tp('touchStart', rr[0] + 4, rr[2]); for (let i = 1; i <= 10; i++) await tp('touchMove', rr[0] + 4 + (rr[1] - rr[0] - 8) * i / 10 * .2, rr[2]); await tp('touchEnd'); await sleep(300); await p.touchscreen.tap(rr[0] + (rr[1] - rr[0]) * .2, rr[2]); await sleep(300);
    R.mVal = await p.evaluate(() => __horse.state.fovH); R.mYaw = Math.abs(await p.evaluate(() => __P.yaw) - y0); R.mShots = await p.evaluate(() => __horse.state.guns.state.shots || 0);
    [x, y] = await c('#setClose'); await p.touchscreen.tap(x, y); await sleep(200); R.mClosed = await p.$eval('#hrSettings', e => e.hidden); R.mFoot = await settle(p); R.mErrs = errs; await p.close(); }
  console.log(JSON.stringify(R)); await br.close();
  const near = (a, b, t = .6) => Math.abs(a - b) < t;
  assert.equal(R.def, 70, 'default 70'); const K70 = vfov(70, R.foot70.aspect) / 68; assert.ok(near(R.foot70.fov, 68 * K70) || near(R.foot70.fov, 75 * K70), 'on foot = chosen FOV (third person 68 / first person 75 base)');
  assert.ok(R.foot70.fov < 68 - 10, 'narrower than before (68° vertical)');
  assert.ok(R.btnVisible && R.panel && R.closed && R.keyO, 'desktop settings open/close'); assert.equal(R.saved, '90'); assert.equal(R.label, '90°');
  const K = vfov(90, R.foot90.aspect) / 68; const fp = near(R.foot90.fov, 75 * K); assert.ok(near(R.foot90.fov, 68 * K) || fp, 'on foot follows the slider');
  assert.ok(near(R.sprint90, (fp ? 75 : 73) * K, .8), 'sprint kick scales (first person has none)'); assert.ok(near(R.scope90.f, 8 * K, .6) && near(R.scope90.back, R.foot90.fov, .8), 'scope scales (and returns after aiming)');
  assert.equal(R.reload, 90, 'saved across reload'); assert.ok(R.ride.m && near(R.ride.fov, 70 * K, 1.2), 'riding scales');
  assert.ok(R.mGearHidden && R.mPanel && R.mClosed, 'phone: ⋯ > Settings'); assert.ok(R.mVal >= 55 && R.mVal < 90, 'phone slider drag changes it'); assert.ok(R.mYaw < 1e-6, 'slider drag does not turn the camera');
  { const k = vfov(R.mVal, R.mFoot.aspect) / 68; assert.ok(near(R.mFoot.fov, 68 * k) || near(R.mFoot.fov, 75 * k), 'phone FOV applied'); } assert.equal(R.errs.length + R.mErrs.length, 0, 'no page errors');
  console.log('HORSE FOV OK'); })().catch(e => { console.error(e); process.exit(1); });
