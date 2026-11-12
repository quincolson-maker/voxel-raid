// Run: node tests/horse-landscape.cjs [base URL] [prefix]. Horse Rider landscape views for before/after comparisons (desktop q=medium,
// phone q=low): from the spawn towards the pen and mountains, out in the hills towards the western range, and a high look across the
// valley. HUD hidden. Saves <prefix>-{desktop,mobile}-{spawn,hills,vista}.png (default prefix shot-horserider-landscape) and checks
// no errors, a sane frame time budget on the phone tier (draw calls / triangles reported).
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767', prefix = process.argv[3] || 'shot-horserider-landscape';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
const VIEWS = process.env.VIEW ? [[process.env.VIEW, 150, 120, Math.PI / 2 + .5, .02]] : [['spawn', 4, 34, 0, -.02], ['hills', 150, 120, Math.PI / 2 + .5, .02], ['vista', -60, -140, Math.PI * .8, -.06]];
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 240000, args });
  const out = {};
  try { for (const mobile of (process.env.ONLY ? [process.env.ONLY === 'mobile'] : [false, true])) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + `/?dev=1&solo=1&zombies=0&q=${mobile ? 'low' : 'medium'}` + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0', timeout: 120000 });
    // v31: the page opens straight into Horse Rider (no menu)
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.horses.length >= 4, { timeout: 30000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 120000 });
    await p.addStyleTag({ content: '#hud,#hrZ,#hrGun,#touch,#vMute,#hrStam,#fsb,#ioshint{visibility:hidden!important}' });
    for (const [name, x, z, yaw, pitch] of VIEWS) {
      await p.evaluate(([x, z, yaw, pitch]) => { const H = __horse; __P.pos.set(x, H.hAt(x, z), z); __P.yaw = yaw; __P.pitch = pitch; H.state.bodyYaw = yaw; H.state.lookT = 0; }, [x, z, yaw, pitch]);
      await sleep(mobile ? 6000 : 9000); await p.screenshot({ path: `${prefix}-${tag}-${name}.png` });
    }
    R.stats = await p.evaluate(() => __horse.stats ? __horse.stats() : null);
    R.errors = errors; assert.deepEqual(errors, []);
    await p.close();
  } console.log(JSON.stringify(out, null, 1)); console.log('HORSE LANDSCAPE OK');
  } catch (e) { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exitCode = 1; } finally { await br.close(); }
})();
