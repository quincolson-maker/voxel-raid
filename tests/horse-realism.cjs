// Run: node tests/horse-realism.cjs [base URL] [prefix]. Horse Rider realism (v32) screenshots + perf on desktop (q=medium) and phone (q=low):
// spawn vista, on a mountain trail looking down at the valley, close-up of ground + trees. Saves <prefix>-<desktop|mobile>-<vista|trail|closeup>.png
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767', prefix = process.argv[3] || 'shot-horserider-v32';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args });
  const out = {};
  try { for (const mobile of (process.env.ONLY ? [process.env.ONLY === 'mobile'] : [false, true])) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + `/?dev=1&solo=1&zombies=0&q=${mobile ? 'low' : 'medium'}` + (mobile ? '&touch=1' : ''), { waitUntil: 'load', timeout: 180000 });
    await p.waitForFunction(() => window.__G && __G.mode === 'horse' && __horse.state.horses.length >= 4, { timeout: 120000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 180000 });
    await p.addStyleTag({ content: '#hud,#hrZ,#hrGun,#touch,#vMute,#hrStam,#fsb,#ioshint,#hrPrompt,#msg,#hrCross{visibility:hidden!important}' });
    const shot = async (name, ms) => { await p.evaluate(() => __coop.syncCamera(0)); await sleep(ms); await p.screenshot({ path: `${prefix}-${tag}-${name}.png` }); return p.evaluate(() => __horse.stats()); };
    // 1) spawn vista (where a fresh load lands), looking out over the pen to the mountains
    await p.evaluate(() => { __P.pitch = -.06; });
    R.vista = await shot('vista', mobile ? 7000 : 10000);
    // 2) mountain trail, ~60 % up the highest trail, looking back down to the valley
    await p.evaluate(() => { const H = __horse, F = H.state.F; let b = 0; F.trails.forEach((t, i) => { if (t.top[2] > F.trails[b].top[2]) b = i; }); const pts = F.trails[b].pts, i = Math.floor(pts.length * .6), [x, z] = pts[i], [bx, bz] = pts[Math.max(0, i - 40)];
      __P.pos.set(x, H.hAt(x, z), z); __P.yaw = Math.atan2(-(bx - x), -(bz - z)); __P.pitch = -.16; H.state.bodyYaw = __P.yaw; H.state.lookT = 0; });
    R.trail = await shot('trail', mobile ? 9000 : 13000);
    // 3) close-up of the ground and a valley conifer
    R.tree = await p.evaluate(() => { const H = __horse, S = H.state; let best = null, bd = 1e9; for (const t of S.trees) { if (!t.conif || Math.abs(t.x) > 300 || Math.abs(t.z) > 300) continue; const d = Math.hypot(t.x - 30, t.z - 60); if (d < bd) { bd = d; best = t; } }
      const a = 2.2, x = best.x + Math.sin(a) * 17, z = best.z + Math.cos(a) * 17; __P.pos.set(x, H.hAt(x, z), z); __P.yaw = a + .22; __P.pitch = -.05; S.bodyYaw = __P.yaw; S.lookT = 0; return [+best.x.toFixed(1), +best.z.toFixed(1)]; });
    R.closeup = await shot('closeup', mobile ? 7000 : 10000);
    R.errors = errors; assert.deepEqual(errors, [], 'no page errors'); await p.close();
  } } finally { await br.close(); }
  console.log(JSON.stringify(out, null, 1)); console.log('HORSE REALISM OK');
})().catch(e => { console.error(e); process.exit(1); });
