// Hotfix (v36-usefix): every interactable shows an on-screen button on phones (the v35 saloon spots had none: slots, dancer,
// gunslingers, dealer), tapping it does the thing, and the button turns into STAND UP / CLOSE / STOP while you are in it.
// Saloon spots are reached by WALKING (keys: up the stairs to the second-floor slots, to the stage) with the desktop E prompt
// checked on the way; the desktop prompt is clickable too. Zombie groans / moans fade to silent (0.5 s) inside the saloon.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767', sleep = ms => new Promise(r => setTimeout(r, ms));
const boot = async (br, touch) => { const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  if (touch) await p.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); else await p.setViewport({ width: 1280, height: 720 });
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1' + (touch ? '&touch=1' : ''), { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.saloon && __booted, { timeout: 600000 });
  await p.evaluate(() => { const H = __horse.state, T = H.town2, s = T.town, k = __coop.keys; H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.zombies.state.hp = 1e9; H.guns.state.score = 5000; H.guns.state.spent = 0;
    window.__go = (lx, lz) => { const [wx, wz] = T.toW(s, lx, lz); for (let i = 0; i < 260; i++) { const dx = wx - __P.pos.x, dz = wz - __P.pos.z; if (Math.hypot(dx, dz) < .3) break; __P.yaw = Math.atan2(-dx, -dz); k.KeyW = true; __sim(.05); } k.KeyW = false; __sim(.2); };
    window.__tp = (x, y, z) => { __P.pos.set(x, y, z); H.fv.set(0, 0); __sim(.3); }; });
  return { p, errors }; };
const frames = p => sleep(260); // the touch button refreshes every 100 ms
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const R = { touch: {}, desk: {} };
  { const { p, errors } = await boot(br, true);
    const btn = async () => { await frames(p); return p.evaluate(() => { const a = document.getElementById('tAct'), r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, top = document.elementFromPoint(cx, cy);
      return { shown: !a.hidden && r.width > 30 && r.height > 30 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, label: a.textContent, onTop: !!top && (top === a || a.contains(top)), cx, cy, prompt: __horse.state.prompt, spot: __horse.state.spot && __horse.state.spot.kind }; }); };
    const tap = async b => { await p.evaluate(() => { __horse.state.cd = 0; }); await p.touchscreen.tap(b.cx, b.cy); await frames(p); };
    const st = () => p.evaluate(() => { const H = __horse.state, S = H.saloon; return { seated: !!H.seated, open: S.isOpen(), ui: !!H.uiOpen, dance: !!S.dance, ctx: !!(window.__sfx || {}).ctx }; });
    const closeAll = () => p.evaluate(() => { const H = __horse.state; if (H.saloon.isOpen()) H.saloon.close(); if (H.saloon.dance) H.saloon.endDance(); const x = [...document.querySelectorAll('[data-a="x"]')].find(e => e.offsetParent); if (x) x.click(); H.cd = 0; __sim(.2); });
    const tryOne = async (name, place, check) => { await place(); const b = await btn(); await tap(b); const after = await st(); const b2 = await btn(); R.touch[name] = { ...b, cx: undefined, cy: undefined, after, ok: check(after), then: b2.label, thenOnTop: b2.onTop };
      if (b2.shown && b2.onTop && /STAND UP|CLOSE|STOP/.test(b2.label)) await tap(b2); else { const x = await p.evaluate(() => { const e = [...document.querySelectorAll('[data-a="x"]')].find(e => e.offsetParent); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); if (x) { await p.touchscreen.tap(x[0], x[1]); await frames(p); } }
      R.touch[name].closed = await st(); await closeAll(); };
    const at = (lx, y, lz) => () => p.evaluate((lx, y, lz) => { const T = __horse.state.town2, s = T.town, [x, z] = T.toW(s, lx, lz); __tp(x, s.y0 + y, z); }, lx, y, lz);
    const walk = pts => () => p.evaluate(pts => { const T = __horse.state.town2, s = T.town, [x, z] = T.toW(s, -8, 1.5); __tp(x, T.floorAt(x, z, 1e9), z); for (const [a, b] of pts) __go(a, b); }, pts);
    await tryOne('dance (stage)', walk([[-13.2, 2.4]]), a => a.open);
    await tryOne('bandits', walk([[-12.4, 2.4], [-12.4, 5.7], [-12.9, 6.0]]), a => a.open);
    await tryOne('dealer', walk([[-12.4, 2.4], [-12.4, 5.7], [-12.4, 7.6], [-13.6, 8.6], [-15.0, 8.6]]), a => a.open);
    await tryOne('slot (2nd floor)', walk([[-10.95, 2.3], [-10.95, 8.9], [-12.3, 8.6], [-14.6, 5.2]]), a => a.seated);
    R.touch.slotY = await p.evaluate(() => +(__P.pos.y - __horse.state.town2.town.y0).toFixed(2));
    await tryOne('beer (Greta)', walk([[-6, 4.0]]), a => true); R.touch['beer (Greta)'].drunk = await p.evaluate(() => __horse.state.town2.level());
    const T = await p.evaluate(() => __horse.state.town2.spots.map((o, i) => ({ i, kind: o.kind, x: o.x, y: o.y, z: o.z })));
    for (const o of T.filter(o => ['checkers', 'darts', 'store', 'shop', 'tommy', 'gold'].includes(o.kind))) await tryOne(o.kind, () => p.evaluate(o => __tp(o.x, o.y, o.z), o), a => a.ui || a.open || true);
    R.touch.owned = await p.evaluate(() => ({ ...__horse.state.guns.state.owned }));
    // zombie voices fade inside the saloon
    await walk([[-8, 3]])(); await sleep(900); R.fadeIn = await p.evaluate(() => { const f = window.__sfx; return { inside: __horse.state.saloon.inside(), target: f && f.zTarget, gain: f && f.zDry ? +f.zDry.gain.value.toFixed(2) : null, ctx: f && f.ctx && f.ctx.state }; });
    await p.evaluate(() => { const T = __horse.state.town2, s = T.town, [x, z] = T.toW(s, -6, -8); __tp(x, T.floorAt(x, z, 1e9), z); }); await sleep(900);
    R.fadeOut = await p.evaluate(() => { const f = window.__sfx; return { inside: __horse.state.saloon.inside(), target: f && f.zTarget, gain: f && f.zDry ? +f.zDry.gain.value.toFixed(2) : null }; });
    R.touch.errors = errors; await p.close(); }
  { const { p, errors } = await boot(br, false);
    await p.evaluate(() => { const T = __horse.state.town2, s = T.town, [x, z] = T.toW(s, -8, 1.5); __tp(x, T.floorAt(x, z, 1e9), z); __go(-13.2, 2.4); }); await frames(p);
    const b = await p.evaluate(() => { const e = document.getElementById('hrPrompt'), r = e.getBoundingClientRect(); return { text: e.textContent, use: e.classList.contains('use'), cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
    await p.evaluate(() => { __horse.state.cd = 0; }); await p.mouse.click(b.cx, b.cy); await frames(p); R.desk = { ...b, cx: undefined, cy: undefined, opened: await p.evaluate(() => __horse.state.saloon.isOpen()), errors }; await p.close(); }
  console.log(JSON.stringify(R, null, 1)); await br.close();
  for (const [k, v] of Object.entries(R.touch)) if (v && v.label !== undefined) { assert.ok(v.shown && v.onTop, k + ': button on screen + tappable'); assert.ok(v.label && v.label !== 'USE' || k === 'x', k + ': labelled'); assert.ok(v.ok, k + ': tap did it'); assert.ok(!/Tap  /.test(v.prompt), k + ': hint names the button'); }
  assert.ok(/SIT & PLAY/.test(R.touch['slot (2nd floor)'].label) && R.touch.slotY > 3.5, 'slots: SIT & PLAY upstairs'); assert.ok(/PAY DANCER\s*100/.test(R.touch['dance (stage)'].label), 'PAY DANCER 100');
  assert.ok(/STAND UP/.test(R.touch['slot (2nd floor)'].then) && !R.touch['slot (2nd floor)'].closed.seated, 'stands up (EXIT)'); assert.ok(!R.touch['dance (stage)'].closed.open, 'dance panel EXIT');
  assert.ok(R.touch.owned.tommy && R.touch.owned.gold, 'tower guns taken by tap');
  assert.ok(R.desk.use && /^\[E\] Pay a dancer/.test(R.desk.text) && R.desk.opened, 'desktop: E prompt at the stage, clickable');
  assert.ok(R.fadeIn.inside && R.fadeIn.target === 0 && !R.fadeOut.inside && R.fadeOut.target === 1, 'zombie voices fade in the saloon');
  if (R.fadeIn.ctx === 'running') assert.ok(R.fadeIn.gain <= .02 && R.fadeOut.gain >= .98, 'gain ramped');
  assert.equal(R.touch.errors.length + R.desk.errors.length, 0, 'no page errors');
  console.log('HORSE USE BUTTONS OK'); })().catch(e => { console.error(e); process.exit(1); });
