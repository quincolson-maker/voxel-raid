// Run: node tests/ui-shots.cjs [base] [tag]. Saves shot-ui-<tag>-*.png (menu + in-game; desktop, phone landscape, phone portrait)
// and prints the number of visible on-screen controls per screen. With tag "after" it also asserts the decluttered layout.
const puppeteer = require('puppeteer-core'), assert = require('assert');
const base = process.argv[2] || 'http://localhost:8767', tag = process.argv[3] || 'after'; const sleep = ms => new Promise(r => setTimeout(r, ms));
const VP = { desktop: { width: 1280, height: 720 }, land: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }, port: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const vis = () => [...document.querySelectorAll('#touch .tb, #touch button, #menu button, #menu input, #menu select, #fsb, #uiMore button')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]'); }).map(e => e.id || e.textContent.trim().slice(0, 12));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], R = {};
  const open = async (name, url, vp) => { const p = await b.newPage(); p.on('pageerror', e => errors.push(name + ': ' + e.message)); await p.setViewport(VP[vp]); await p.goto(base + url + (vp !== 'desktop' ? '&touch=1' : ''), { waitUntil: 'networkidle0' });
    if (vp === 'port') await p.evaluate(() => { const r = document.getElementById('rotskip'); r && r.click(); }); return p; };
  for (const vp of ['desktop', 'land', 'port']) {
    let p = await open('menu-' + vp, '/?q=low', vp); await sleep(800); R['menu-' + vp] = await p.evaluate(vis); await p.screenshot({ path: `shot-ui-${tag}-menu-${vp}.png` });
    if (tag === 'after') { await p.click('#zJoinOpen'); await sleep(200); R['menuJoin-' + vp] = await p.evaluate(vis); await p.screenshot({ path: `shot-ui-${tag}-menujoin-${vp}.png` });
      await p.click('#gear'); await sleep(200); R['menuGear-' + vp] = await p.evaluate(() => !document.getElementById('settings').hidden); }
    await p.close();
    p = await open('build-' + vp, '/?auto=zombies&zbuild=420&q=low&dev=1', vp); await p.evaluate(() => { __sim(1); }); await sleep(1500); R['build-' + vp] = await p.evaluate(vis); await p.screenshot({ path: `shot-ui-${tag}-build-${vp}.png` });
    await p.evaluate(() => { __zombies.skip(); __sim(12); __G.units.forEach(u => u.hp > 0 && __zombies.kill(u, false, false)); const s = __zombies.state.stations.find(s => s.name === 'M4A1') || __zombies.state.stations[0]; __P.pos.set(s.x + 1.2, 1, s.z + 1.2); __sim(.3); }); await sleep(1500);
    R['near-' + vp] = await p.evaluate(vis); await p.screenshot({ path: `shot-ui-${tag}-game-${vp}.png` });
    await p.evaluate(() => { __P.pos.set(48, 1, 70); __sim(.3); }); await sleep(1500); R['far-' + vp] = await p.evaluate(vis);
    if (tag === 'after' && vp !== 'desktop') { await p.tap('#tMore'); await sleep(300); R['more-' + vp] = await p.evaluate(vis); await p.screenshot({ path: `shot-ui-${tag}-more-${vp}.png` }); }
    if (tag === 'after' && vp === 'desktop') { R.helpHidden = await p.evaluate(() => document.getElementById('keys').hidden); await p.keyboard.press('KeyH'); await sleep(200); R.helpShown = await p.evaluate(() => !document.getElementById('keys').hidden); await p.screenshot({ path: `shot-ui-${tag}-help-desktop.png` }); }
    await p.close(); }
  for (const k in R) console.log(k.padEnd(14), Array.isArray(R[k]) ? R[k].length + '  ' + R[k].join(' ') : R[k]); console.log('errors', JSON.stringify(errors));
  if (tag === 'after') { const T = ['tFire', 'tAds', 'tJump', 'tReload', 'tSwap'];
    for (const vp of ['land', 'port']) { for (const id of T) assert.ok(R['far-' + vp].includes(id), vp + ' ' + id); assert.ok(R['far-' + vp].includes('tMore'));
      assert.ok(!R['far-' + vp].includes('tAct'), 'action hidden away from stations'); assert.ok(R['near-' + vp].includes('tAct'), 'action near station');
      for (const id of ['tPiece', 'tMat', 'tSkip']) { assert.ok(R['build-' + vp].includes(id), 'build ' + id); assert.ok(!R['far-' + vp].includes(id), 'no ' + id + ' in combat'); }
      assert.ok(R['far-' + vp].length <= 7, 'few buttons ' + R['far-' + vp].length); assert.ok(R['more-' + vp].length > R['far-' + vp].length); }
    assert.deepEqual(R['far-desktop'], []); assert.ok(R.helpHidden && R.helpShown);
    for (const vp of ['desktop', 'land', 'port']) { assert.deepEqual(R['menu-' + vp].filter(x => /^z|gear/.test(x)).sort(), ['gear', 'zHost', 'zJoinOpen', 'zombies']); assert.ok(R['menuJoin-' + vp].includes('zCode') && R['menuJoin-' + vp].includes('zJoin')); assert.ok(R['menuGear-' + vp]); }
    assert.deepEqual(errors, []); console.log('UI OK'); }
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
