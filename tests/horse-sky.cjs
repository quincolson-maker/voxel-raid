// Run: node tests/horse-sky.cjs [base URL] [quality]. HORSE RIDER sky + terrain pass: physically based sky dome with IBL,
// aerial haze, CC0 PBR terrain with far mountains, GPU grass, scanned rocks. Checks the pieces exist on desktop + phone,
// rides a horse at golden hour and saves shot-horserider-sky-*.png. Prints draw calls / triangles per tier.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767', q = process.argv[3] || 'medium';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 180000, args });
  const out = {};
  try { for (const mobile of [false, true]) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + `/?dev=1&zombies=0&q=${q}` + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0', timeout: 120000 });
    // v31: the page opens straight into Horse Rider (no menu)
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.models !== 'loading', { timeout: 120000 }); await sleep(2500);
    R.sky = await p.evaluate(() => { const S = __horse.state.sky; return S && { el: +S.el.toFixed(1), env: !!S.env, dome: S.dome.visible, bgNull: __cam.parent.background === null, envSet: !!__cam.parent.environment, fog: __cam.parent.fog.isFog === true, far: __cam.far }; });
    assert.ok(R.sky && R.sky.env && R.sky.envSet && R.sky.bgNull && R.sky.fog, 'sky dome + sky IBL + sky-tied haze'); assert.ok(R.sky.el > 3 && R.sky.el < 20, 'golden-hour sun'); assert.ok(R.sky.far >= 5000, 'far plane reaches the mountains');
    R.terrain = await p.evaluate(() => { const T = __horse.state.terrain; T.far.geometry.computeBoundingBox(); return { inner: T.inner.geometry.index.count / 3, far: T.far.geometry.index.count / 3, peak: Math.round(T.far.geometry.boundingBox.max.y - T.BASE) }; });
    assert.ok(R.terrain.peak > 250, 'distant mountains'); R.grass = await p.evaluate(() => __horse.state.grassInfo); assert.ok(R.grass.tufts > 2000, 'GPU grass');
    R.rocks = await p.evaluate(() => (__horse.state.rockMeshes || []).reduce((n, m) => n + m.count, 0)); assert.ok(R.rocks > 10, 'rocks placed');
    const shot = async (n, x, z, dy, yaw, pitch) => { await p.evaluate((x, z, dy, yaw, pitch) => { const H = __horse; __P.pos.set(x, H.hAt(x, z) + dy, z); __P.yaw = yaw == null ? Math.atan2(x - H.PEN.x, z - H.PEN.z) : yaw; __P.pitch = pitch; H.state.fp = true; }, x, z, dy, yaw, pitch); await sleep(1500); await p.screenshot({ path: `shot-horserider-sky-${n}-${tag}.png` }); };
    await shot('vista', 4, 34, 2.5, Math.PI + .3, .02); await shot('mountains', 10, 80, 2, -.75 + Math.PI, .12);
    if (!mobile) { await shot('pen', 18, 40, 6, null, -.2); await shot('grass', 6, 50, 0, 2.3, -.3); }
    R.stats = await p.evaluate(() => __horse.stats());
    R.fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / 3).toFixed(1)); }; requestAnimationFrame(f); }));
    // golden-hour ride: mount a horse (dev shortcut next to it), gallop out of the pen gate towards the low sun
    await p.evaluate(() => { const H = __horse.state, h = H.horses[1]; H.fp = false; for (const o of H.horses) { o.tgt = null; o.wait = 1e9; } h.pos.set(__horse.PEN.x, __horse.hAt(0, 0), __horse.PEN.z + __horse.PEN.hd + 4); h.yaw = Math.PI;
      __P.pos.set(h.pos.x + 1.2, h.pos.y, h.pos.z); __P.yaw = Math.PI; }); await sleep(600);
    await p.evaluate(() => { __horse.state.cd = 0; __horse.use(); }); await p.evaluate(() => { for (let i = 0; i < 10 && !(__horse.state.mounted && __horse.state.mountT <= 0); i++) __sim(.25); }); assert.ok(await p.evaluate(() => !!__horse.state.mounted), 'mounted');
    await p.evaluate(() => { __P.yaw = Math.PI - .55; __horse.state.mounted.yaw = Math.PI; });
    if (mobile) { const c = await p.$eval('#joy', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); const cdp = await p.target().createCDPSession();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1] }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c[0], y: c[1] - 60 }] });
      await sleep(500); await p.evaluate(() => { for (let i = 0; i < 12 && __horse.state.speed <= 8; i++) __sim(.5); }); assert.ok(await p.evaluate(() => __horse.state.speed > 8), 'phone gallop'); await sleep(1500); R.ride = await p.evaluate(() => [+__horse.state.speed.toFixed(1), __horse.state.gait]); await p.screenshot({ path: `shot-horserider-sky-golden-ride-${tag}.png` });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await p.keyboard.down('KeyW'); await p.keyboard.down('ShiftLeft'); await sleep(500); await p.evaluate(() => { for (let i = 0; i < 16 && __horse.state.speed <= 12; i++) __sim(.5); }); assert.ok(await p.evaluate(() => __horse.state.speed > 12), 'gallop'); await sleep(1500);
      R.ride = await p.evaluate(() => [+__horse.state.speed.toFixed(1), __horse.state.gait]); await p.screenshot({ path: `shot-horserider-sky-golden-ride-${tag}.png` }); await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW'); }
    R.errors = errors; assert.deepEqual(errors, [], 'no page errors'); await p.close();
  } console.log(JSON.stringify(out, null, 1)); console.log('HORSE SKY OK');
  } finally { await br.close(); }
})().catch(e => { console.error(e); process.exit(1); });
