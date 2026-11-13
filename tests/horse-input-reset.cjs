// v36 input lifecycle (main.js dropInput, src/touch.js touchReset + buttons, src/hrguns.js resetInput): interrupting the app
// while moving, firing, aiming and with several fingers down releases everything (stick, look ownership, every button's
// pointer + pressed look, fire, queued shot, pending scoped look), and the next touch works at once.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true });
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&touch=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.guns && window.__touchReset, { timeout: 600000 });
  const R = await p.evaluate(async () => { const H = __horse.state, g = H.guns, inp = __coop.input, o = {}, $ = id => document.getElementById(id);
    H.zombies.clear(); H.zombies.state.spawnT = 1e9;
    const pe = (el, type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: id === 1 }));
    const fire = $('tFire'), r = fire.getBoundingClientRect(), fx = r.left + r.width / 2, fy = r.top + r.height / 2, joy = $('joy'), z = __touchLook.zone();
    g.draw('revolver'); for (let i = 0; i < 12; i++) __sim(.05);
    // several fingers: stick moving, FIRE held, a look drag
    pe(joy, 'pointerdown', 1, z.x, z.y); pe(joy, 'pointermove', 1, z.x + 40, z.y - 30); pe(fire, 'pointerdown', 2, fx, fy); pe($('look'), 'pointerdown', 3, innerWidth * .6, innerHeight * .4);
    o.before = { mx: inp.mx, fire: inp.fire, down: fire.classList.contains('down'), looks: __touchLook.active().length };
    // a queued shot + a pending scoped look, then the app goes away
    __P.lookPend = { x: .4, y: .1 }; const ammo0 = g.state.ammo.revolver; pe(fire, 'pointerdown', 4, fx, fy); // (second finger on FIRE is ignored but a tap queues a shot)
    dispatchEvent(new Event('blur')); const yaw0 = __P.yaw;
    o.after = { mx: inp.mx, mz: inp.mz, fire: inp.fire, down: fire.classList.contains('down'), looks: __touchLook.active().length, lookPend: __P.lookPend, drops: window.__inputDrops };
    for (let i = 0; i < 10; i++) __sim(.05); o.noQueuedShot = g.state.ammo.revolver === ammo0; o.noLookJump = Math.abs(__P.yaw - yaw0) < 1e-6;
    // the next touch works at once
    pe(fire, 'pointerdown', 7, fx, fy); o.nextFire = [inp.fire, fire.classList.contains('down')]; for (let i = 0; i < 3; i++) __sim(.05); o.shotAfter = g.state.ammo.revolver < ammo0; pe(fire, 'pointerup', 7, fx, fy); o.released = [inp.fire, fire.classList.contains('down')];
    pe(joy, 'pointerdown', 8, z.x, z.y); pe(joy, 'pointermove', 8, z.x, z.y - 45); o.nextStick = inp.mz < -.5; pe(joy, 'pointerup', 8, z.x, z.y - 45); o.stickUp = inp.mz === 0;
    // the same through visibilitychange (hidden) and pagehide
    pe(fire, 'pointerdown', 9, fx, fy); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); o.hidden = [inp.fire, fire.classList.contains('down')]; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    pe(fire, 'pointerdown', 10, fx, fy); dispatchEvent(new Event('pagehide')); o.pagehide = [inp.fire, fire.classList.contains('down')]; pe(fire, 'pointerdown', 11, fx, fy); o.again = inp.fire; pe(fire, 'pointerup', 11, fx, fy);
    // the ⋯ menu toggle look survives a finger lift (it is not a held button)
    const more = $('tMore'); if (more) { const m = more.getBoundingClientRect(); pe(more, 'pointerdown', 12, m.left + 5, m.top + 5); pe(more, 'pointerup', 12, m.left + 5, m.top + 5); __touchReset(); o.menu = [!$('uiMore').hidden, more.classList.contains('down')]; pe(more, 'pointerdown', 13, m.left + 5, m.top + 5); pe(more, 'pointerup', 13, m.left + 5, m.top + 5); }
    return o; });
  R.errors = errors; console.log(JSON.stringify(R));
  assert.ok(R.before.mx > 0 && R.before.fire && R.before.down && R.before.looks >= 1, 'setup: moving, firing, looking');
  assert.deepEqual([R.after.mx, R.after.mz, R.after.fire, R.after.down, R.after.looks, R.after.lookPend], [0, 0, false, false, 0, null], 'everything released');
  assert.ok(R.noQueuedShot, 'no queued shot after returning'); assert.ok(R.noLookJump, 'no delayed scoped look');
  assert.deepEqual(R.nextFire, [true, true], 'next FIRE touch works at once'); assert.ok(R.shotAfter, 'and fires'); assert.deepEqual(R.released, [false, false]);
  assert.ok(R.nextStick && R.stickUp, 'stick works at once'); assert.deepEqual(R.hidden, [false, false]); assert.deepEqual(R.pagehide, [false, false]); assert.ok(R.again);
  if (R.menu) assert.ok(R.menu[0], 'the menu stays open after a reset');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE INPUT RESET OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
