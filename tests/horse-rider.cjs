// Run: node tests/horse-rider.cjs [base URL]. Boots HORSE RIDER from the menu (desktop + phone), walks to a horse
// with real keys / joystick input, mounts (E / RIDE), rides (faster than walking, chase camera), checks the
// cooldown, dismounts, and that the pen fence blocks a ridden horse. Saves shot-horserider-beauty-*.png.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 90000, args });
  const out = {};
  try { for (const mobile of [false, true]) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&q=low' + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0' });
    assert.ok(await p.$eval('#horseBtn', e => e.offsetHeight > 0 && /HORSE RIDER/.test(e.textContent)));
    await p.screenshot({ path: `shot-horserider-beauty-menu-${tag}.png` });
    if (mobile) await p.tap('#horseBtn'); else await p.click('#horseBtn');
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.horses.length >= 4, { timeout: 15000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 60000 });
    R.models = await p.evaluate(() => __horse.state.models); if (!/prochorse/.test(base)) assert.equal(R.models, 'real', 'realistic GLB horses + rider loaded');
    R.coats = await p.evaluate(() => __horse.state.horses.map(h => h.g.userData.kind === 'real' ? h.g.userData.coat : 'proc'));
    R.horses = await p.evaluate(() => __horse.state.horses.length); assert.equal(R.horses, 5, 'five horses');
    R.inPen = await p.evaluate(() => __horse.state.horses.filter(h => Math.abs(h.pos.x - __horse.PEN.x) < __horse.PEN.hw && Math.abs(h.pos.z - __horse.PEN.z) < __horse.PEN.hd).length);
    assert.ok(R.inPen >= 4, 'horses start in the pen');
    R.weaponHidden = await p.evaluate(() => !document.querySelector('#tFire') || getComputedStyle(document.querySelector('#tFire')).display === 'none');
    // landscape overview with the pen: stand on a rise looking at it
    await p.evaluate(() => { const H = __horse; __P.pos.set(18, H.hAt(18, 40), 40); __P.yaw = Math.atan2(18 - H.PEN.x, 40 - H.PEN.z); __P.pitch = -.2; __P.pos.y += 6; });
    await sleep(900); await p.screenshot({ path: `shot-horserider-beauty-landscape-${tag}.png` });
    // walk with real input toward a horse; freeze the herd so the walk target holds still
    await p.evaluate(() => { const H = __horse.state, h = H.horses[2]; for (const o of H.horses) { o.tgt = null; o.wait = 1e9; } h.pos.set(__horse.PEN.x, h.pos.y, __horse.PEN.z + 3); h.yaw = 0;
      __P.pos.set(__horse.PEN.x, __horse.hAt(__horse.PEN.x, __horse.PEN.z + 16), __horse.PEN.z + 16); __P.yaw = 0; __P.pitch = -.12; });
    assert.equal(await p.evaluate(() => __horse.state.prompt), '', 'no prompt when far away');
    const t0 = await p.evaluate(() => __P.pos.z);
    if (mobile) { await p.evaluate(() => { window.__in = window.__in || null; }); }
    // desktop: hold W; phone: drive the joystick with a real touch drag
    if (mobile) { const c = await p.$eval('#joy', e => { const r = e.getBoundingClientRect(); return [r.left + r.width * .3, r.top + r.height * .7]; });
      const cdp = await p.target().createCDPSession(); const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await tp('touchStart', c[0], c[1]); await tp('touchMove', c[0], c[1] - 30); await p.waitForFunction(() => !!__horse.state.near, { timeout: 15000 }); await tp('touchEnd'); R.cdp = cdp; }
    else { await p.keyboard.down('KeyW'); await p.waitForFunction(() => !!__horse.state.near, { timeout: 15000 }); await p.keyboard.up('KeyW'); }
    R.walked = +(t0 - await p.evaluate(() => __P.pos.z)).toFixed(2); assert.ok(R.walked > 5);
    R.prompt = await p.evaluate(() => __horse.state.prompt); assert.match(R.prompt, /RIDE|Ride/);
    if (mobile) { await sleep(250); R.actLabel = await p.$eval('#tAct', e => e.hidden ? '' : e.textContent); assert.equal(R.actLabel, 'RIDE'); }
    await sleep(300); await p.screenshot({ path: `shot-horserider-beauty-approach-${tag}.png` });
    // mount
    if (mobile) await p.tap('#tAct'); else await p.keyboard.press('KeyE');
    await p.waitForFunction(() => !!__horse.state.mounted, { timeout: 3000 }); R.mounted = true;
    // cooldown: an immediate second press must not flip it back
    await p.evaluate(() => __horse.use()); assert.ok(await p.evaluate(() => !!__horse.state.mounted), 'cooldown blocks instant dismount'); R.cooldown = true;
    // ride out of the gate (south, +z => yaw 0 faces -z, so turn around) with real input
    await p.evaluate(() => { __P.yaw = Math.PI; __horse.state.mounted.yaw = Math.PI; __horse.state.mounted.pos.x = __horse.PEN.x; }); await sleep(300);
    const s0 = await p.evaluate(() => [__P.pos.x, __P.pos.z]);
    if (mobile) { const c = await p.$eval('#joy', e => { const r = e.getBoundingClientRect(); return [r.left + r.width * .3, r.top + r.height * .7]; }); const tp = (type, x, y) => R.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await tp('touchStart', c[0], c[1]); await tp('touchMove', c[0], c[1] - 80); await p.waitForFunction(() => __horse.state.speed > 12 && __horse.state.riddenT > 1, { timeout: 30000 }); const rT = await p.evaluate(() => __horse.state.riddenT); await p.waitForFunction(t => __horse.state.riddenT > t + 1.5, { timeout: 60000 }, rT); await p.screenshot({ path: `shot-horserider-beauty-riding-${tag}.png` }); await p.waitForFunction(t => __horse.state.riddenT > t + 3, { timeout: 60000 }, rT); await tp('touchEnd'); delete R.cdp; }
    else { await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await p.waitForFunction(() => __horse.state.speed > 12, { timeout: 30000 }); const rT = await p.evaluate(() => __horse.state.riddenT); await p.waitForFunction(t => __horse.state.riddenT > t + 1.5, { timeout: 60000 }, rT); await p.screenshot({ path: `shot-horserider-beauty-riding-${tag}.png` }); await p.waitForFunction(t => __horse.state.riddenT > t + 3, { timeout: 60000 }, rT); await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft'); }
    const s1 = await p.evaluate(() => [__P.pos.x, __P.pos.z, __horse.state.speed]);
    R.rideDist = +Math.hypot(s1[0] - s0[0], s1[1] - s0[1]).toFixed(1); R.topSpeedKmh = Math.round(s1[2] * 3.6);
    assert.ok(R.rideDist > 25, 'riding covers ground: ' + R.rideDist); assert.ok(s1[2] > 7.5, 'faster than sprinting on foot');
    R.riderOnSaddle = await p.evaluate(() => { const h = __horse.state.mounted, r = h.g.getObjectByProperty('isSkinnedMesh', true); let rid = null; h.g.traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.skeleton.getBoneByName('Hips')) rid = o; }); return !!rid; });
    assert.ok(R.riderOnSaddle, 'rigged rider sits on the ridden horse');
    R.perf = await p.evaluate(() => __horse.stats());
    R.camThirdPerson = await p.evaluate(() => { const h = __horse.state.mounted; const c = __horse.state; return +Math.hypot(window.__cam.position.x - h.pos.x, window.__cam.position.z - h.pos.z).toFixed(1); });
    assert.ok(R.camThirdPerson > 3, 'chase camera is behind the horse');
    R.hud = await p.$eval('#sub', e => e.textContent);
    // dismount
    await sleep(500);
    if (mobile) { await p.waitForFunction(() => !document.getElementById('tAct').hidden && document.getElementById('tAct').textContent === 'GET OFF'); await p.tap('#tAct'); } else await p.keyboard.press('KeyE');
    await p.waitForFunction(() => !__horse.state.mounted, { timeout: 3000 });
    R.dismount = await p.evaluate(() => { const h = __horse.state.horses[2]; return { gap: +Math.hypot(h.pos.x - __P.pos.x, h.pos.z - __P.pos.z).toFixed(2), onGround: Math.abs(__P.pos.y - __horse.hAt(__P.pos.x, __P.pos.z)) < .05 }; });
    assert.ok(R.dismount.gap > .9 && R.dismount.gap < 3.2 && R.dismount.onGround);
    // remount right away after cooldown, ride into the fence: it must stop us
    await p.waitForFunction(() => __horse.state.cd === 0); assert.ok(await p.evaluate(() => __horse.use()), 'can remount next to the horse');
    R.fence = await p.evaluate(() => { const H = __horse, h = H.state.mounted; h.pos.set(H.PEN.x + 6, h.pos.y, H.PEN.z); __P.yaw = -Math.PI / 2; h.yaw = __P.yaw; H.state.speed = 0; return 0; });
    await p.keyboard.down('KeyW'); { const t = await p.evaluate(() => __horse.state.riddenT); await p.waitForFunction(t => __horse.state.riddenT > t + 4, { timeout: 60000 }, t); } await p.keyboard.up('KeyW');
    R.fenceX = await p.evaluate(() => +__horse.state.mounted.pos.x.toFixed(2)); assert.ok(R.fenceX < await p.evaluate(() => __horse.PEN.x + __horse.PEN.hw), 'fence stops the horse');
    await sleep(500); await p.evaluate(() => __horse.dismount());
    R.errors = errors; assert.deepEqual(errors, []); await p.close();
  } } finally { await br.close(); }
  console.log(JSON.stringify(out, null, 1)); console.log('HORSE RIDER OK');
})().catch(e => { console.error(e); process.exit(1); });
