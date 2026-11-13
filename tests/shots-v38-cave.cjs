// Run: node tests/shots-v38-cave.cjs [port] [tag]. Screenshots of Bandit Falls: the falls from the meadow, the mouth, the hall,
// the stage, the vault. Box GPU (SwiftShader): for looking at, not for frame rates.
const puppeteer = require('puppeteer-core'); const port = process.argv[2] || 8771, tag = process.argv[3] || 'v38', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const VIEWS = [['meadow', 0, 70, 3, -.02], ['mouth', 0, 16, 1.7, .02], ['hall', 0, -14, 1.7, -.05], ['stage', 6, -26, 1.7, -.06, -.5], ['vault', 0, -40, 1.7, -.04]];
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args }); const errs = [];
  for (const mobile of [false, true]) { const p = await br.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(`http://localhost:${port}/?dev=1&solo=1&prochorse=1&lobby=${mobile ? '&touch=1' : ''}`, { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__booted && __horse.state.cave && __horse.state.zombies, { timeout: 300000, polling: 300 }); await p.evaluate(() => { const Z = __horse.state.zombies; Z.state.spawnT = 1e9; Z.state.hp = 1e9; Z.clear(); }); await sleep(3000);
    for (const [name, u, v, eye, pitch, dyaw = 0] of VIEWS) {
      await p.evaluate((u, v, eye, pitch, dyaw) => { const H = __horse.state, S = H.cave.site, c = Math.cos(S.rot), s = Math.sin(S.rot), x = S.x + u * c + v * s, z = S.z - u * s + v * c;
        H.fp = true; __P.pos.set(x, H.cave.floorAt(x, z, S.y0 + 2, H.hAt ? H.hAt(x, z) : S.y0), z); if (eye > 2) __P.pos.y += eye - 1.62; H.fv && H.fv.set(0, 0); __P.yaw = S.rot + dyaw; __P.pitch = pitch; }, u, v, eye, pitch, dyaw);
      await sleep(name === 'meadow' ? 9000 : 5000); await p.screenshot({ path: `shot-${tag}-cave-${name}-${mobile ? 'mobile' : 'desktop'}.png` }); console.log(name, mobile ? 'mobile' : 'desktop'); }
    await p.close(); }
  console.log('errors', JSON.stringify(errs.slice(0, 5))); await br.close(); })();
