// Run: node tests/gun-shots.cjs [base]. Hip + ADS viewmodel shots of every weapon -> shot-guns-<gun>-<hip|ads>.png
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 90000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = []; const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('requestfailed', r => errs.push('reqfail ' + r.url()));
  await p.setViewport({ width: 1100, height: 620 }); await p.goto(base + '/?auto=attack&build=0&q=medium&dev=1&light=day', { waitUntil: 'networkidle0' }); await p.evaluate(() => { __coop.act.skip(); __sim(.2); });
  for (const g of ['carbine', 'smg9', 'shotgun', 'dmr', 'lmg', 'pistol', 'rpg']) {
    await p.evaluate(g => { __P.slots = [g, g === 'rpg' ? 'pistol' : 'rpg']; __P.hp = 1e6; __P.pitch = 0; }, g); await p.evaluate(() => { __coop.act.swap(); }); await p.evaluate(() => { __coop.act.swap(); });
    await sleep(1500); const real = await p.evaluate(() => document.querySelector('#ammo').textContent);
    await p.evaluate(() => { __P.adsHeld = false; }); await sleep(1200); await p.screenshot({ path: `shot-guns-${g}-hip.png` });
    await p.evaluate(() => { __P.adsHeld = true; }); await sleep(900); await p.screenshot({ path: `shot-guns-${g}-ads.png` }); await p.evaluate(() => { __P.adsHeld = false; });
    console.log(g, real);
  }
  console.log('errors', JSON.stringify(errs)); await b.close(); })();
