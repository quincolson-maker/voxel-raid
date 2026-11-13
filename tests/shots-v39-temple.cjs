// Run: node tests/shots-v39-temple.cjs [port] [tag]. Screenshots of the Hollow Sun: the mountain face from the meadow, the sun
// seal, the descending hall, the mirror chamber, the chasm bridge, the sanctum gold and the hidden altar (puzzles solved through
// the action log). Box GPU (SwiftShader): for looking at, not for frame rates.
const puppeteer = require('puppeteer-core'); const port = process.argv[2] || 8773, tag = process.argv[3] || 'v39', sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// [name, u, v, eye height above floor, pitch, yaw offset, setup]
const VIEWS = [['meadow', 0, 75, 2, .02, 0], ['seal', 0, 14, 1.6, .12, 0], ['hall', 0, -3, 1.6, -.08, 0, 'open'], ['mirrors', -9, -14, 1.6, -.05, Math.PI / 2 + .3, 'mirrors'], ['chasm', 0, -22, 1.6, -.12, 0], ['sanctum', 0, -58.5, 1.6, -.1, 0, 'solve'], ['altar', -6, -64, 1.6, -.05, .6]];
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args }); const errs = [];
  for (const mobile of [false, true]) { const p = await br.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(`http://localhost:${port}/?dev=1&solo=1&prochorse=1&lobby=${mobile ? '&touch=1' : ''}`, { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__booted && __horse.state.temple && __horse.state.zombies, { timeout: 300000, polling: 300 }); await p.evaluate(() => { const Z = __horse.state.zombies; Z.state.spawnT = 1e9; Z.state.hp = 1e9; Z.clear(); }); await sleep(3000);
    for (const [name, u, v, eye, pitch, dyaw, setup] of VIEWS) {
      await p.evaluate(setup => { const T = __horse.state.temple, A = a => T.netIn ? null : null; const act = a => T.temple && (() => { const t = T.temple; })();
        if (setup === 'open') T._act(['e']); if (setup === 'mirrors') { for (const [i, n] of [[0, 2], [1, 5]]) for (let k = 0; k < n; k++) T._act(['m', i]); }
        if (setup === 'solve') { T._act(['m', 2]); for (const i of [0, 2, 1, 3]) T._act(['g', i]); T._act(['w', 12]); } }, setup || '');
      if (setup === 'open' || setup === 'solve') await sleep(14000);
      await p.evaluate((u, v, eye, pitch, dyaw) => { const H = __horse.state, S = H.temple.site, c = Math.cos(S.rot), s = Math.sin(S.rot), x = S.x + u * c + v * s, z = S.z - u * s + v * c;
        const yl = v < -4.5 ? Math.max(-9, v * .14) + (v < -56 ? 0 : 0) : 0; let y = S.y0 + yl; if (v < -4.5) y = H.temple.floorAt(x, z, S.y0 + yl + .3); else y = H.hAt(x, z);
        H.fp = true; __P.pos.set(x, y + Math.max(0, eye - 1.62), z); H.fv && H.fv.set(0, 0); __P.yaw = S.rot + dyaw; __P.pitch = pitch; }, u, v, eye, pitch, dyaw);
      await sleep(name === 'meadow' ? 9000 : 5000); await p.screenshot({ path: `shot-${tag}-temple-${name}-${mobile ? 'mobile' : 'desktop'}.png` });
      console.log(name, mobile ? 'mobile' : 'desktop', JSON.stringify(await p.evaluate(() => ({ under: __horse.state.temple.underP, y: +(__P.pos.y - __horse.state.temple.site.y0).toFixed(2), solved: __horse.state.temple.temple.state })))); }
    await p.close(); }
  console.log('errors', JSON.stringify(errs.slice(0, 5))); await br.close(); })();
