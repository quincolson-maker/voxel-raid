// Run: node tests/horse-open.cjs [base URL] [prefix]. v31: the link opens straight into Horse Rider (no mode menu) on desktop + phone.
// Saves <prefix>-desktop.png / <prefix>-mobile.png (default shot-horserider-open-*).
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767', prefix = process.argv[3] || 'shot-horserider-open';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|peer|lobby|Failed to load resource/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args });
  const out = {};
  try { for (const mobile of [false, true]) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/' + (mobile ? '?touch=1' : ''), { waitUntil: 'networkidle0', timeout: 180000 }); // a fresh load, no clicks
    R.mode = await p.evaluate(() => [__G.mode, __G.phase]); assert.deepEqual(R.mode, ['horse', 'ride'], 'lands in Horse Rider');
    R.noMenu = await p.evaluate(() => !document.getElementById('menu') && !document.getElementById('horseBtn') && !document.getElementById('zombies') && !document.getElementById('lobbyList'));
    assert.ok(R.noMenu, 'no mode picker / other modes in the page');
    R.horseMode = await p.evaluate(() => document.body.classList.contains('horse-mode') && document.getElementById('hud').style.display !== 'none'); assert.ok(R.horseMode);
    await p.waitForFunction(() => window.__P && __P.pos.lengthSq() > 0, { timeout: 120000 });
    await sleep(mobile ? 6000 : 8000);
    if (mobile) { R.touchUi = await p.evaluate(() => getComputedStyle(document.getElementById('touch')).display !== 'none' && getComputedStyle(document.getElementById('tGun')).display !== 'none'); assert.ok(R.touchUi, 'phone controls show'); }
    R.title = await p.title(); assert.match(R.title, /Horse Rider/);
    await p.screenshot({ path: `${prefix}-${tag}.png` });
    R.errors = errors; assert.deepEqual(errors, [], 'no page errors'); await p.close();
  } } finally { await br.close(); }
  console.log(JSON.stringify(out, null, 1)); console.log('HORSE OPEN OK');
})().catch(e => { console.error(e); process.exit(1); });
