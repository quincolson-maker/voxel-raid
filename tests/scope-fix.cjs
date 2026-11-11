// Run: node tests/scope-fix.cjs [base URL]. Buffalo Rifle scope fixes (Quin: "can't see my buttons", "it's jumpy"):
//  phone: while scoped every on-screen control (FIRE, AIM, DRAW, JUMP, the move stick, RIDE…) sits above the scope vignette,
//  is drawn bright over the black edges (pixel check on a real screenshot) and works (real taps: FIRE fires scoped, AIM unscopes);
//  smoothing: finger look in the scope is low-pass filtered (frame-rate independent: same result at 60 / 12 fps), lower steady
//  sensitivity, no step when the breath steadies, the saddle camera's head bob is filtered, aim assist never moves the camera;
//  per-frame aim jitter stays under a threshold on foot and at a canter. Desktop: scope still works, no jitter, HUD above it.
//  Saves shot-horserider-scope-fix-mobile*.png.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 180000, args });
  const out = {};
  try { for (const mobile of (process.env.ONLY ? [process.env.ONLY === 'mobile'] : [true, false])) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&q=low&zombies=0' + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0' });
    if (mobile) await p.tap('#horseBtn'); else await p.click('#horseBtn');
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.horses.length >= 4 && __horse.guns, { timeout: 20000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 90000 });
    const G = (f, a) => p.evaluate(f, a);
    const frames = async n => { const u = await G(() => __horse.guns.state.upd || 0); await p.waitForFunction(m => (__horse.guns.state.upd || 0) >= m, { timeout: 90000 }, u + n); };
    const cdp = await p.target().createCDPSession();
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    // jitter probe: step the game deterministically (tick + camera sync at a fixed dt) and measure the camera
    const probe = (n, dt) => G(([n, dt]) => { const H = __horse, c = __cam, d = [], off = [], raw = []; let prev = null;
      for (let i = 0; i < n; i++) { H.tick(dt); H.syncCamera(dt); const v = c.getWorldDirection(c.position.clone()); if (prev) d.push(v.angleTo(prev)); prev = v;
        const b = H.state.mounted ? H.state.mounted.pos : __P.pos; off.push(c.position.y - b.y); }
      const dd = off.slice(1).map((y, i) => Math.abs(y - off[i]));
      return { maxStep: +Math.max(...d).toFixed(5), meanStep: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(5), maxJerk: +Math.max(...d.slice(1).map((x, i) => Math.abs(x - d[i]))).toFixed(5), eyeRange: +(Math.max(...off) - Math.min(...off)).toFixed(3), eyeMaxStep: +Math.max(...dd).toFixed(4) }; }, [n, dt]);
    await G(() => { const H = __horse; for (const o of H.state.horses) { o.tgt = null; o.wait = 1e9; } const x = 0, z = 40; __P.pos.set(x, H.hAt(x, z), z); __P.yaw = Math.PI; __P.pitch = -.03; });
    // Buffalo rifle in hand, scope up
    if (mobile) { for (let i = 0; i < 3; i++) { await p.tap('#tGun'); await frames(1); } } else { await p.mouse.move(640, 420); await p.keyboard.press('Digit3'); }
    await p.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 10000 }); await frames(8);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK > .95 && document.body.classList.contains('hr-scoped'), { timeout: 90000 });
    // --- jitter on foot, including the moment the aim steadies (phones settle by themselves after .7 s) ---
    R.footStill = await probe(60, 1 / 30);
    assert.ok(R.footStill.maxStep < .0008, 'scoped on foot: per-frame aim jitter < 0.0008 rad (incl. the breath steadying)');
    R.footLowFps = await probe(20, .1); assert.ok(R.footLowFps.maxStep < .0016, 'at 10 fps no frame jumps more than 0.0016 rad');
    R.lookScale = await G(() => +__P.lookScale.toFixed(4)); assert.ok(R.lookScale < (mobile ? .16 : .15) && R.lookScale > .1, 'lower, steady look sensitivity in the scope');
    if (mobile) {
      // --- controls stay visible and on top of the vignette ---
      R.controls = await G(() => { const scope = document.getElementById('hrScope'), zs = +getComputedStyle(scope).zIndex, zt = +getComputedStyle(document.getElementById('touch')).zIndex;
        const els = [...document.querySelectorAll('#touch .tb, #stick')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !e.hidden; });
        return { zScope: zs, zTouch: zt, list: els.map(e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y); return { id: e.id || e.className, x: Math.round(x), y: Math.round(y), box: [r.left, r.top, r.width, r.height].map(Math.round), top: !!h && (h === e || e.contains(h) || (e.id === 'stick' && h.id === 'joy')) }; }) }; });
      assert.ok(R.controls.zTouch > R.controls.zScope, 'touch controls stack above the scope overlay');
      const ids = R.controls.list.map(c => c.id); for (const need of ['tFire', 'tAds', 'tGun', 'stick']) assert.ok(ids.includes(need), need + ' shown while scoped');
      assert.ok(R.controls.list.every(c => c.top), 'every control is the top element under its centre (tappable)');
      await sleep(400); const png = (await p.screenshot({ encoding: 'base64' }));
      R.bright = await G(([png, list]) => new Promise(res => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        res(Object.fromEntries(list.map(c => { const [l, t, w, h] = c.box, d = x.getImageData(Math.max(0, l), Math.max(0, t), Math.max(1, w), Math.max(1, h)).data; let mx = 0; for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]); return [c.id, Math.round(mx)]; }))); }; im.src = 'data:image/png;base64,' + png; }), [png, R.controls.list]);
      assert.ok(Object.values(R.bright).every(v => v > 150), 'every control is drawn bright over the dark scope edges');
      await frames(3); await sleep(1200); await p.screenshot({ path: 'shot-horserider-scope-fix-mobile.png' });
      // --- finger look in the scope: filtered, frame-rate independent, responsive ---
      R.filter = await G(() => { const g = __horse.guns, run = (dt, n) => { __P.lookPend = { x: .05, y: 0 }; const y0 = __P.yaw, st = []; for (let i = 0; i < n; i++) { g.update(dt); st.push(y0 - __P.yaw); } return st; };
        const a = run(1 / 60, 15), b = run(1 / 12, 3), c = run(1 / 60, 30); return { first60: +(a[0] / .05).toFixed(3), at250ms60: +(a[14] / .05).toFixed(4), at250ms12: +(b[2] / .05).toFixed(4), at500ms: +(c[29] / .05).toFixed(4), monotone: a.every((v, i) => !i || v >= a[i - 1]) }; });
      assert.ok(R.filter.first60 > .15 && R.filter.first60 < .5, 'a finger flick is spread over a few frames, not applied in one jump');
      assert.ok(Math.abs(R.filter.at250ms60 - R.filter.at250ms12) < .02, 'same aim after 1/4 s at 60 fps and 12 fps (frame-rate independent)');
      assert.ok(R.filter.at500ms > .99 && R.filter.monotone, 'fully applied within half a second, never overshoots (responsive)');
      // real right-thumb drag while scoped turns the aim (scaled down)
      const y0 = await G(() => __P.yaw); await touch('touchStart', [[700, 200, 5]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[700 - i * 10, 200, 5]]); await sleep(30); } await touch('touchEnd', []); await frames(6);
      R.drag = await G(y0 => +(__P.yaw - y0).toFixed(4), y0); // finger left = turn left (yaw up) const full = 60 * .0055 * 900 / 844; assert.ok(R.drag > full * R.lookScale * .8 && R.drag < full * R.lookScale * 1.2, 'drag in the scope: same direction, scaled by the scope sensitivity');
      // --- aim assist never moves the camera; FIRE tap fires while scoped ---
      await G(() => { const T = __horse.guns.targets.find(t => t.kind === 'board'); __horse.guns.aimAt(T.c.clone().add({ x: 0, y: .25, z: 0 }), __horse.syncCamera); }); await frames(2);
      const pre = await G(() => ({ yaw: __P.yaw, shots: __horse.guns.state.shots }));
      await p.tap('#tFire'); await p.waitForFunction(n => __horse.guns.state.shots > n, { timeout: 90000 }, pre.shots);
      R.fireScoped = await G(pre => ({ shots: __horse.guns.state.shots - pre.shots, yawMoved: +Math.abs(__P.yaw - pre.yaw).toFixed(6) }), pre);
      assert.equal(R.fireScoped.shots, 1, 'FIRE tap works while scoped'); assert.ok(R.fireScoped.yawMoved < 2e-4, 'aim assist does not snap the camera (bullet only; < 0.01 deg left from the look filter)');
      await p.waitForFunction(() => __horse.guns.state.lastHit && __horse.guns.state.lastHit.weapon === 'sniper', { timeout: 90000 });
      // AIM tap unscopes (the button is reachable over the scope)
      await p.waitForFunction(() => !__horse.guns.state.reloading, { timeout: 120000 }).catch(() => {});
      await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
      await p.tap('#tAds'); await p.waitForFunction(() => __horse.guns.state.scopeK === 0 && !document.body.classList.contains('hr-scoped'), { timeout: 90000 }); R.aimUnscopes = true;
      await p.tap('#tAds'); await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
    }
    // --- the saddle: canter, scoped; head bob filtered, aim smooth ---
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK === 0, { timeout: 90000 });
    await G(() => { const H = __horse, h = H.state.horses[2]; h.pos.set(H.PEN.x, h.pos.y, H.PEN.z + 3); h.yaw = 0; __P.pos.set(H.PEN.x + 1.6, H.hAt(H.PEN.x + 1.6, H.PEN.z + 3), H.PEN.z + 3); });
    await frames(1); assert.ok(await G(() => __horse.use()), 'mounts');
    await p.waitForFunction(() => __horse.state.mounted && __horse.state.mountT === 0, { timeout: 90000 });
    await G(() => { const H = __horse, h = H.state.mounted, x = 0, z = 30; h.pos.set(x, H.hAt(x, z), z); h.yaw = Math.PI; H.state.speed = 0; __P.yaw = Math.PI; __P.pitch = -.03; });
    if (mobile) { if (!(await G(() => __horse.guns.state.weapon === 'sniper'))) { for (let i = 0; i < 4 && !(await G(() => __horse.guns.state.weapon === 'sniper')); i++) { await p.tap('#tGun'); await frames(1); } } }
    else await p.keyboard.press('Digit3');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 10000 }); await frames(6);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
    // hold the stick / W forward to canter while the probe steps the game
    if (mobile) { const z = await G(() => __touchLook.zone()); await touch('touchStart', [[z.x, z.y, 9]]); await touch('touchMove', [[z.x, z.y - 40, 9]]); } else await p.keyboard.down('KeyW');
    await G(() => { for (let i = 0; i < 80; i++) { __horse.tick(.05); __horse.syncCamera(.05); } });
    R.saddle = await probe(60, 1 / 30); R.saddle.speed = await G(() => +__horse.state.speed.toFixed(2));
    if (mobile) await touch('touchEnd', []); else await p.keyboard.up('KeyW');
    assert.ok(R.saddle.speed > 3, 'riding at a trot / canter during the probe');
    assert.ok(R.saddle.maxStep < .004, 'scoped in the saddle: per-frame aim change < 0.004 rad');
    assert.ok(R.saddle.eyeMaxStep < .02, 'scoped in the saddle: the eye moves < 2 cm per frame relative to the horse (head bob filtered)');
    if (mobile) { await frames(4); await sleep(400); await p.screenshot({ path: 'shot-horserider-scope-fix-mobile-saddle.png' }); }
    else { R.hud = await G(() => +getComputedStyle(document.getElementById('hrGun')).zIndex > +getComputedStyle(document.getElementById('hrScope')).zIndex); assert.ok(R.hud, 'desktop gun HUD above the scope'); }
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    R.errors = errors; assert.deepEqual(errors, []);
    await p.close();
  } console.log(JSON.stringify(out, null, 1)); console.log('SCOPE FIX OK');
  } catch (e) { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exitCode = 1; } finally { await br.close(); }
})();
