// Run: node tests/touch-leftaim.cjs [base URL]. Phone controls (shared touch code, checked in HORSE RIDER): the joystick
// starts only in its zone around the resting stick; a drag that starts anywhere else on the left (not a button) aims, like the
// right half; move + aim with two thumbs at once; two aim drags never add up (newest steers, no jump when it lifts); left-thumb
// aim also works in the Buffalo Rifle scope (slower). Saves shot-horserider-leftaim-mobile*.png (one with ?touchzones=1 overlay).
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args });
  const R = {}, errors = [];
  try {
    const open = async q => { const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
      await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true });
      await p.goto(base + '/?dev=1&q=low&touch=1' + q, { waitUntil: 'networkidle0' }); await p.tap('#horseBtn');
      await p.waitForFunction(() => __G.mode === 'horse' && __horse.guns && __horse.state.models !== 'loading', { timeout: 90000 });
      await p.evaluate(() => { const H = __horse; for (const o of H.state.horses) { o.tgt = null; o.wait = 1e9; } const x = H.PEN.x - H.PEN.hw - 9, z = H.PEN.z + 1; __P.pos.set(x, H.hAt(x, z), z); __P.yaw = Math.PI / 2; __P.pitch = 0; });
      const cdp = await p.target().createCDPSession(); const T = {}; // id -> [x, y]
      const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(T).map(([id, [x, y]]) => ({ x, y, id: +id })) });
      const down = async (id, x, y) => { T[id] = [x, y]; await send('touchStart'); }, move = async (pts) => { for (const [id, x, y] of pts) T[id] = [x, y]; await send('touchMove'); };
      const up = async id => { delete T[id]; await cdp.send('Input.dispatchTouchEvent', { type: Object.keys(T).length ? 'touchEnd' : 'touchEnd', touchPoints: Object.entries(T).map(([i, [x, y]]) => ({ x, y, id: +i })) }); };
      const drag = async (pts, steps = 6) => { const from = pts.map(([id]) => T[id].slice()); for (let s = 1; s <= steps; s++) await move(pts.map(([id, dx, dy], i) => [id, from[i][0] + dx * s / steps, from[i][1] + dy * s / steps])); };
      return { p, down, move, up, drag, T };
    };
    const A = await open('&touchzones=1'), p = A.p, yaw = () => p.evaluate(() => __P.yaw), G = (f, a) => p.evaluate(f, a);
    R.zone = await G(() => __touchLook.zone()); const Z = R.zone;
    assert.ok(Z.r >= 110 && Z.r <= 170, 'thumb-sized joystick zone');
    const dead = [Math.round(844 * .3), Math.round(390 * .18)], right = [Math.round(844 * .72), Math.round(390 * .45)], stickPt = [Math.round(Z.x), Math.round(Z.y)];
    R.deadOutsideZone = await G(([x, y]) => !__touchLook.inZone(x, y), dead); assert.ok(R.deadOutsideZone);
    // 1) left dead space drag aims, does not move
    const pos0 = await G(() => __P.pos.toArray()); let y0 = await yaw();
    await A.down(1, ...dead); await A.drag([[1, 60, 0]]); R.leftLookActive = await G(() => __touchLook.active().length);
    const dLeft = Math.abs(await yaw() - y0); await A.up(1);
    const pos1 = await G(() => __P.pos.toArray()); R.leftAim = { dYaw: +dLeft.toFixed(4), moved: +Math.hypot(pos1[0] - pos0[0], pos1[2] - pos0[2]).toFixed(3) };
    assert.ok(dLeft > .05, 'left dead-space drag turns the camera'); assert.ok(R.leftAim.moved < .05, 'and does not walk'); assert.equal(R.leftLookActive, 1);
    // reference: the same drag on the right half
    y0 = await yaw(); await A.down(2, ...right); await A.drag([[2, 60, 0]]); const dRight = Math.abs(await yaw() - y0); await A.up(2);
    R.rightAim = +dRight.toFixed(4); assert.ok(Math.abs(dLeft - dRight) / dRight < .1, 'left aim = right aim speed');
    // 2) one thumb on the stick, the other aiming from the left dead space, at the same time
    y0 = await yaw(); const p0 = await G(() => __P.pos.toArray());
    await A.down(3, ...stickPt); await A.drag([[3, 0, -45]], 3); await A.down(4, ...dead);
    await A.drag([[4, 40, 0]]); await sleep(900); await p.screenshot({ path: 'shot-horserider-leftaim-mobile-zones.png' });
    await p.waitForFunction(p0 => Math.hypot(__P.pos.x - p0[0], __P.pos.z - p0[2]) > .3, { timeout: 60000 }, p0);
    R.moveAndAim = { dYaw: +Math.abs(await yaw() - y0).toFixed(4), stick: await G(() => document.getElementById('stick').classList.contains('active')), looks: await G(() => __touchLook.active().length) };
    assert.ok(R.moveAndAim.dYaw > .02 && R.moveAndAim.stick && R.moveAndAim.looks === 1, 'move with one thumb while aiming with the other');
    await A.up(4); await A.up(3); await sleep(300);
    // 3) two aim drags at once (left dead space + right half) moving together: no double speed
    y0 = await yaw(); await A.down(5, ...dead); await A.down(6, ...right); await A.drag([[5, 60, 0], [6, 60, 0]]);
    const dBoth = Math.abs(await yaw() - y0); R.twoLooks = +dBoth.toFixed(4); assert.ok(Math.abs(dBoth - dRight) / dRight < .1, 'two aim drags do not add up');
    // the newest (right) steers; the older (left) finger's movement meanwhile is ignored and it takes over without a jump
    y0 = await yaw(); await A.drag([[5, 50, 0]]); R.olderIgnored = +Math.abs(await yaw() - y0).toFixed(4); assert.ok(R.olderIgnored < 1e-6, 'older drag waits');
    await A.up(6); y0 = await yaw(); await A.drag([[5, 30, 0]]); R.takeOver = +Math.abs(await yaw() - y0).toFixed(4);
    assert.ok(R.takeOver > dRight / 2 * .6 && R.takeOver < dRight / 2 * 1.1, 'older drag takes over from where it is (no jump)'); await A.up(5);
    // 4) buttons on the left side still act as buttons (not aim)
    R.buttonsNotLook = await G(() => { const el = document.getElementById('vMute'); return !el || !el.closest('#joy'); }); assert.ok(R.buttonsNotLook);
    // 5) scope view: draw the Buffalo Rifle, AIM, aim with the left thumb (slower in the scope)
    for (let i = 0; i < 3; i++) { await p.tap('#tGun'); await sleep(150); } await p.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 10000 });
    await sleep(600); await p.tap('#tAds'); await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
    y0 = await yaw(); await A.down(7, ...dead); await A.drag([[7, 60, 0]]); const dScope = Math.abs(await yaw() - y0);
    R.scopeAim = { dYaw: +dScope.toFixed(4), ratio: +(dScope / dLeft).toFixed(3) }; assert.ok(dScope > 0 && R.scopeAim.ratio < .3, 'left-thumb aim in the scope, slowed down');
    await A.up(7); await p.tap('#tAds');
    // clean screenshots without the overlay
    const B = await open(''), q = B.p; const Zb = await q.evaluate(() => __touchLook.zone());
    await B.down(1, Math.round(Zb.x), Math.round(Zb.y)); await B.drag([[1, 0, -40]], 3); await B.down(2, ...dead); await B.drag([[2, 50, -10]]); await sleep(500);
    await q.screenshot({ path: 'shot-horserider-leftaim-mobile.png' }); await B.up(2); await B.up(1);
    for (let i = 0; i < 3; i++) { await q.tap('#tGun'); await sleep(150); } await q.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 10000 }); await sleep(600);
    await q.tap('#tAds'); await q.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 }); await B.down(3, ...dead); await B.drag([[3, 30, 0]]); await sleep(300);
    await q.screenshot({ path: 'shot-horserider-leftaim-mobile-scope.png' }); await B.up(3);
    R.errors = errors; assert.deepEqual(errors, []);
  } catch (e) { console.log(JSON.stringify(R, null, 1)); console.error('FAIL', e); await br.close(); process.exit(1); }
  console.log(JSON.stringify(R, null, 1)); console.log('TOUCH LEFT AIM OK'); await br.close();
})();
