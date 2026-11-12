// Run: node tests/horse-guns.cjs [base URL]. HORSE RIDER cowboy guns (desktop + phone): draws the six-shooter with real
// input (1 / DRAW button), aims (RMB / AIM), shoots a bottle on foot with a real click / FIRE tap, reloads one round at a
// time (R / phone auto-reload), switches to the lever rifle (2 / button) and knocks a can over, then mounts a horse and
// hits a bullseye board from the saddle, checks the horseback yaw limit and holsters. Saves shot-horserider-guns-*.png.
// Buffalo rifle (key 3 / third DRAW tap): scope view (zoom + overlay), Shift holds breath (and no longer changes gait in the
// saddle), single shot with flight time onto 150-300 m steel, slow reload, scoped shot from the saddle. Saves shot-horserider-sniper-*.png.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args });
  const out = {};
  try { for (const mobile of (process.env.ONLY ? [process.env.ONLY === 'mobile'] : [false, true])) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&q=low&zombies=0' + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0', timeout: 180000 });
    // v31: the page opens straight into Horse Rider (no menu)
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.horses.length >= 4 && __horse.guns, { timeout: 20000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 90000 });
    const frames = async n => { const u = await p.evaluate(() => __horse.guns.state.upd || 0); await p.waitForFunction(m => (__horse.guns.state.upd || 0) >= m, { timeout: 90000 }, u + n); };
    const G = (f, ...a) => p.evaluate(f, ...a);
    const vis = sel => p.$eval(sel, e => getComputedStyle(e).display !== 'none' && !e.hidden && e.offsetHeight > 0).catch(() => false);
    R.targets = await G(() => { const t = __horse.guns.targets; return { bottle: t.filter(x => x.kind === 'bottle').length, can: t.filter(x => x.kind === 'can').length, board: t.filter(x => x.kind === 'board').length }; });
    assert.ok(R.targets.bottle >= 6 && R.targets.can >= 4 && R.targets.board >= 3, 'bottles, cans and boards on the range');
    if (mobile) { R.fireHiddenHolstered = !(await vis('#tFire')) && !(await vis('#tAds')); assert.ok(R.fireHiddenHolstered, 'no FIRE / AIM buttons while holstered'); assert.ok(await vis('#tGun'), 'DRAW button'); }
    // stand 12 m from the bottle rail, freeze the herd
    await G(() => { const H = __horse, T = H.guns.targets[2]; for (const o of H.state.horses) { o.tgt = null; o.wait = 1e9; } __P.pos.set(T.home.x + 12, H.hAt(T.home.x + 12, T.home.z + 1.5), T.home.z + 1.5); __P.yaw = Math.PI / 2; __P.pitch = 0; });
    // draw with real input
    if (mobile) await p.tap('#tGun'); else { await p.mouse.move(640, 420); await p.keyboard.press('Digit1'); }
    await p.waitForFunction(() => __horse.guns.state.weapon === 'revolver', { timeout: 5000 }); R.drawn = 'revolver';
    if (mobile) { await frames(1); R.buttons = { fire: await vis('#tFire'), aim: await vis('#tAds') }; assert.ok(R.buttons.fire && R.buttons.aim, 'FIRE + AIM appear with a gun out'); }
    await frames(8); // draw time
    await p.screenshot({ path: `shot-horserider-guns-revolver-hip-${tag}.png` });
    // aim (hold RMB / toggle AIM), settle the sights on bottle #3, fire with a real click / tap
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.aiming && __horse.guns.state.aimK > .9, { timeout: 90000 });
    await G(() => __horse.guns.aimAt(__horse.guns.targets[2].c, __horse.syncCamera));
    if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); }
    await p.waitForFunction(() => __horse.guns.state.shots >= 1, { timeout: 90000 }); await frames(1);
    R.footShot = await G(() => ({ hit: __horse.guns.state.lastHit, ammo: __horse.guns.state.ammo.revolver, hits: __horse.guns.state.hits }));
    assert.equal(R.footShot.hit.target, 'bottle', 'on-foot revolver shot breaks the bottle'); assert.equal(R.footShot.hit.mounted, false); assert.equal(R.footShot.ammo, 5);
    R.bottleBroken = await G(() => !__horse.guns.targets[2].alive); assert.ok(R.bottleBroken);
    await p.screenshot({ path: `shot-horserider-guns-revolver-bottle-${tag}.png` });
    // a second shot on the next bottle (thumb-cocked, no manual cock needed)
    await frames(8); await G(() => __horse.guns.aimAt(__horse.guns.targets[3].c, __horse.syncCamera));
    if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); }
    await p.waitForFunction(() => __horse.guns.state.shots >= 2, { timeout: 90000 }); R.ammoAfter2 = await G(() => __horse.guns.state.ammo.revolver); assert.equal(R.ammoAfter2, 4);
    // reload: one cartridge per cycle (R tap = one round; phone auto-reloads when idle and not aiming)
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    if (!mobile) { await p.keyboard.press('KeyR'); await p.waitForFunction(() => __horse.guns.state.reloading, { timeout: 30000 }); }
    else await p.waitForFunction(() => __horse.guns.state.reloading, { timeout: 120000 });
    R.reloadStarted = true;
    await p.waitForFunction(() => __horse.guns.state.ammo.revolver === 5, { timeout: 90000 }); R.oneRound = 5;
    if (!mobile) { await frames(6); R.tapIsOneRound = await G(() => __horse.guns.state.ammo.revolver); assert.equal(R.tapIsOneRound, 5, 'a tap of R loads exactly one round');
      await p.keyboard.down('KeyR'); await p.waitForFunction(() => __horse.guns.state.ammo.revolver === 6, { timeout: 120000 }); await p.keyboard.up('KeyR'); }
    else await p.waitForFunction(() => __horse.guns.state.ammo.revolver === 6, { timeout: 120000 });
    R.reloadedFull = 6;
    // lever rifle at the cans
    if (mobile) await p.tap('#tGun'); else await p.keyboard.press('Digit2');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'rifle', { timeout: 5000 });
    await G(() => { const H = __horse, T = H.guns.targets.find(t => t.kind === 'can'); __P.pos.set(T.home.x + 16, H.hAt(T.home.x + 16, T.home.z), T.home.z); __P.yaw = Math.PI / 2; });
    await frames(8);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.aiming && __horse.guns.state.aimK > .9, { timeout: 90000 });
    await G(() => __horse.guns.aimAt(__horse.guns.targets.find(t => t.kind === 'can').c, __horse.syncCamera));
    const s0 = await G(() => __horse.guns.state.shots);
    if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); }
    await p.waitForFunction(n => __horse.guns.state.shots > n, { timeout: 90000 }, s0);
    R.rifleShot = await G(() => ({ hit: __horse.guns.state.lastHit, ammo: __horse.guns.state.ammo.rifle, lever: __horse.guns.state.cycling }));
    assert.equal(R.rifleShot.hit.target, 'can', 'rifle knocks the can'); assert.equal(R.rifleShot.ammo, 9); assert.ok(R.rifleShot.lever, 'lever cycles after the shot');
    await frames(2); await p.screenshot({ path: `shot-horserider-guns-rifle-can-${tag}.png` });
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    // ---- buffalo rifle on foot: in hand, scope, hold breath, 300 m steel, slow single-shot reload ----
    const gongs = () => G(() => __horse.guns.targets.filter(t => t.kind === 'gong').map(t => t.d));
    R.gongs = await gongs(); assert.deepEqual(R.gongs, [150, 200, 245, 300], 'long-range steel at 150-300 m');
    if (mobile) await p.tap('#tGun'); else await p.keyboard.press('Digit3');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 5000 }); R.sniperDrawn = true;
    if (mobile) R.gunLabel = await p.$eval('#tGun', e => e.textContent); // next tap holsters
    await G(() => { const H = __horse, x = H.PEN.x - H.PEN.hw - 9, z = H.PEN.z + 1, g = H.guns.targets.filter(t => t.kind === 'gong')[3]; __P.pos.set(x, H.hAt(x, z), z); __P.yaw = Math.atan2(-(g.c.x - x), -(g.c.z - z)); __P.pitch = 0; });
    await frames(10); await G(() => { __horse.state.bodyYaw = __P.yaw; __P.yaw += 1.9; }); await frames(3);
    R.sniperVisible = await G(() => __horse.guns.models.sniper.group.visible); assert.ok(R.sniperVisible, 'buffalo rifle in hand');
    await p.screenshot({ path: `shot-horserider-sniper-inhand-${tag}.png` }); await G(() => { __P.yaw -= 1.9; }); await frames(2);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
    if (!mobile) await p.keyboard.down('ShiftLeft');
    await p.waitForFunction(() => __horse.guns.state.steady, { timeout: 90000 }); // Shift on desktop, automatic after a moment on phones
    await G(() => { const G = __horse.guns; G.aimAt(G.targets.filter(t => t.kind === 'gong')[3].c, __horse.syncCamera); }); await frames(2);
    R.scope = await G(() => ({ fov: +__cam.fov.toFixed(1), overlay: document.getElementById('hrScope').classList.contains('on'), cross: getComputedStyle(document.getElementById('hrCross')).display, gunHidden: !__horse.guns.models.sniper.group.visible, steady: __horse.guns.state.steady, lookScale: +(__P.lookScale || 1).toFixed(2) }));
    assert.ok(R.scope.fov <= 10.5 && R.scope.overlay && R.scope.cross === 'none' && R.scope.gunHidden && R.scope.lookScale < .3, 'scope zoom + overlay + reticle, slower look');
    await p.screenshot({ path: `shot-horserider-sniper-scope-${tag}.png` });
    R.preShot = await G(() => { const G = __horse.guns, c = __cam, d = c.getWorldDirection(c.position.clone()); const r = G.cast(c.position.clone(), d, 420); return { kind: r.kind, t: +r.t.toFixed(1), aiming: G.state.aiming, steady: G.state.steady, yaw: +__P.yaw.toFixed(4), pitch: +__P.pitch.toFixed(4), cd: d.toArray().map(v => +v.toFixed(4)) }; });
    const sh0 = await G(() => __horse.guns.state.shots);
    if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); }
    await p.waitForFunction(n => __horse.guns.state.shots > n, { timeout: 90000 }, sh0);
    R.inFlight = await G(() => __horse.guns.state.lastHit && __horse.guns.state.lastHit.weapon === 'sniper'); assert.ok(!R.inFlight, 'the bullet takes time to get there');
    await p.waitForFunction(() => __horse.guns.state.lastHit && __horse.guns.state.lastHit.weapon === 'sniper', { timeout: 90000 });
    R.longShot = await G(() => ({ hit: __horse.guns.state.lastHit, ammo: __horse.guns.state.ammo.sniper, dbg: __horse.guns.state.dbg }));
    assert.equal(R.longShot.hit.target, 'gong', '300 m steel hit'); assert.ok(R.longShot.hit.dist > 280); assert.equal(R.longShot.ammo, 0, 'single shot');
    await p.screenshot({ path: `shot-horserider-sniper-longrange-hit-${tag}.png` });
    R.gongSwing = await G(() => Math.abs(__horse.guns.targets.filter(t => t.kind === 'gong')[3].sw) > 0); assert.ok(R.gongSwing, 'the steel swings');
    if (!mobile) await p.keyboard.up('ShiftLeft');
    await p.waitForFunction(() => __horse.guns.state.reloading, { timeout: 90000 }); R.slowReload = await G(() => __horse.guns.settings.reloadSniper); assert.ok(R.slowReload >= 2);
    await p.waitForFunction(() => __horse.guns.state.ammo.sniper === 1 && !__horse.guns.state.reloading, { timeout: 120000 }); R.reloaded = true;
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK === 0, { timeout: 60000 });
    // back to the lever rifle for the saddle test (phone: holster -> six-shooter -> rifle)
    if (mobile) { for (let i = 0; i < 3; i++) { await p.tap('#tGun'); await frames(1); } } else await p.keyboard.press('Digit2');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'rifle', { timeout: 10000 });
    // mount a horse (gun goes away during the mount animation), ride it out to the boards, shoot from the saddle
    await G(() => { const H = __horse, h = H.state.horses[2]; h.pos.set(H.PEN.x, h.pos.y, H.PEN.z + 3); h.yaw = 0; __P.pos.set(H.PEN.x + 1.6, H.hAt(H.PEN.x + 1.6, H.PEN.z + 3), H.PEN.z + 3); });
    await frames(1); assert.ok(await G(() => __horse.use()), 'mounts');
    await p.waitForFunction(() => __horse.state.mounted && __horse.state.mountT === 0, { timeout: 90000 });
    await G(() => { const H = __horse, h = H.state.mounted, T = H.guns.targets.find(t => t.kind === 'board'); h.pos.set(T.c.x + 16, H.hAt(T.c.x + 16, T.c.z + 3), T.c.z + 3); h.yaw = Math.PI / 2; H.state.speed = 0; __P.yaw = Math.PI / 2; __P.pitch = 0; });
    await frames(6);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.aiming && __horse.guns.state.aimK > .9 && __horse.guns.state.weapon, { timeout: 90000 });
    await G(() => { const H = __horse; H.state.speed = 0; H.guns.aimAt(H.guns.targets.find(t => t.kind === 'board').c, H.syncCamera); });
    const s1 = await G(() => __horse.guns.state.shots);
    if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); }
    await p.waitForFunction(n => __horse.guns.state.shots > n, { timeout: 90000 }, s1);
    R.mountedShot = await G(() => ({ hit: __horse.guns.state.lastHit, score: __horse.guns.state.score }));
    assert.equal(R.mountedShot.hit.target, 'board', 'mounted shot hits the bullseye board'); assert.equal(R.mountedShot.hit.mounted, true);
    await frames(2); await p.screenshot({ path: `shot-horserider-guns-mounted-${tag}.png` });
    // ---- buffalo rifle from the saddle: scoped, more sway, Shift steadies instead of changing gait ----
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    if (mobile) await p.tap('#tGun'); else await p.keyboard.press('Digit3');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 5000 });
    await G(() => { const H = __horse, h = H.state.mounted, x = H.PEN.x - H.PEN.hw - 10, z = H.PEN.z + 1, g = H.guns.targets.filter(t => t.kind === 'gong')[0]; h.pos.set(x, H.hAt(x, z), z); h.yaw = Math.atan2(-(g.c.x - x), -(g.c.z - z)); H.state.speed = 0; __P.yaw = h.yaw - .25; __P.pitch = -.05; });
    await frames(8); await p.screenshot({ path: `shot-horserider-sniper-mounted-${tag}.png` });
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
    const cr0 = await G(() => __horse.state.cruise);
    if (!mobile) await p.keyboard.down('ShiftLeft');
    await p.waitForFunction(() => __horse.guns.state.steady, { timeout: 90000 });
    R.shiftGait = await p.evaluate(c0 => ({ c0, c: __horse.state.cruise, shiftT: __horse.state.shiftT, scoped: __horse.state.scoped }), cr0); R.shiftNoGait = R.shiftGait.c === R.shiftGait.c0 && !R.shiftGait.shiftT; assert.ok(R.shiftNoGait, 'Shift in the scope holds breath, not a gait change');
    await G(() => { const H = __horse; H.state.speed = 0; H.guns.aimAt(H.guns.targets.filter(t => t.kind === 'gong')[0].c, H.syncCamera); }); await frames(1);
    await p.screenshot({ path: `shot-horserider-sniper-mounted-scope-${tag}.png` });
    const sh1 = await G(() => __horse.guns.state.shots);
    if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); }
    await p.waitForFunction(n => __horse.guns.state.shots > n, { timeout: 90000 }, sh1);
    await p.waitForFunction(() => __horse.guns.state.lastHit.weapon === 'sniper' && __horse.guns.state.lastHit.mounted, { timeout: 90000 });
    R.mountedLong = await G(() => __horse.guns.state.lastHit); assert.equal(R.mountedLong.target, 'gong', 'scoped hit from the saddle'); assert.ok(R.mountedLong.dist > 140);
    if (!mobile) await p.keyboard.up('ShiftLeft');
    // v33: a full 360 from the saddle: straight back over the horse's rump fires and never hits your own horse; look up / down ~89 deg
    await frames(10); await G(() => { const H = __horse; __P.yaw = H.state.mounted.yaw + Math.PI; __P.pitch = -.05; H.guns.state.ammo.sniper = 1; H.guns.state.reloading = false; H.guns.state.cocked = true; }); await frames(3);
    R.behind = await G(() => { const g = __horse.guns, n = g.state.shots; const r = g.shoot(false); return { fired: r, shots: g.state.shots - n, blocked: g.state.blocked, aim: g.state.dbg && g.state.dbg.aim }; });
    assert.equal(R.behind.shots, 1, 'fires straight back from the saddle'); assert.ok(!R.behind.blocked); assert.notEqual(R.behind.aim, 'horse', 'never hits your own horse');
    for (const pt of [1.55, -1.55]) { await G(pt => { __P.pitch = pt; }, pt); await frames(2); const dy = await G(() => { const v = new __cam.position.constructor(); __cam.getWorldDirection(v); return v.y; }); R['look' + (pt > 0 ? 'Up' : 'Down')] = +dy.toFixed(3); assert.ok(Math.abs(dy) > .99, 'look ~89 deg ' + pt + ' got ' + dy); }
    await G(() => { __P.pitch = -.1; });
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    // holster
    if (mobile) { while (await G(() => !!__horse.guns.state.weapon)) await p.tap('#tGun'); await frames(1); R.holsteredButtons = { fire: await vis('#tFire'), aim: await vis('#tAds') }; assert.ok(!R.holsteredButtons.fire && !R.holsteredButtons.aim); }
    else { await p.keyboard.press('KeyX'); }
    await p.waitForFunction(() => !__horse.guns.state.weapon, { timeout: 5000 }); R.holstered = true;
    R.gunsHidden = await G(() => Object.values(__horse.guns.models).every(m => { m.group.updateMatrixWorld(); return true; })); await frames(2);
    R.gunsHidden = await G(() => Object.values(__horse.guns.models).every(m => !m.group.visible)); assert.ok(R.gunsHidden);
    R.errors = errors; assert.deepEqual(errors, []);
    await p.close();
  } } catch (e) { console.log(JSON.stringify(out, null, 1)); console.error('FAIL', e); await br.close(); process.exit(1); }
  console.log(JSON.stringify(out, null, 1)); console.log('HORSE GUNS OK'); await br.close();
})();
