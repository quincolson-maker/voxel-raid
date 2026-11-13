// v36 Frontier characters: each variant (and Classic) on foot facing the camera and mounted side-on with the Tommy out,
// plus the Tommy close-up (brass in the air, suppressor fitted). Saves shot-v36-char{cv}-{foot,ride}-{tag}.png, shot-v36-tommy-*.png.
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767', only = process.argv[3] || 'desktop', cvs = (process.argv[4] || '0,1,2,3,4').split(',').map(Number), sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 1800000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const tag of only.split(',')) { const mobile = tag === 'mobile', p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' || /character/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
    await p.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&solo=1&zombies=0&q=' + (mobile ? 'low' : 'medium') + (mobile ? '&touch=1' : ''), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__booted && window.__horse && __horse.state.models === 'real' && __horse.state.guns, { timeout: 900000 });
    await p.evaluate(() => { document.getElementById('keys').hidden = true; const H = __horse.state, g = H.guns; g.state.score = 9000; g.give('tommy'); window.__spot = () => { const x = -40, z = 30; __P.pos.set(x, __horse.hAt(x, z), z); H.fv.set(0, 0); }; });
    const snap = async name => { await sleep(mobile ? 7000 : 5000); await p.screenshot({ path: `shot-v36-${name}-${tag}.png` }); console.log(tag, name); };
    for (const cv of cvs) {
      await p.evaluate(cv => { const H = __horse.state; if (H.mounted) __horse.dismount(); __sim(2); H.setCharacter(cv); __spot(); H.fp = false; __P.yaw = 0; __P.pitch = -.15; __sim(.5); H.bodyYaw = Math.PI; }, cv);
      await snap(`char${cv}-foot`);
      await p.evaluate(() => { const H = __horse.state, h = H.horses[0]; h.pos.set(__P.pos.x + 1.2, __horse.hAt(__P.pos.x + 1.2, __P.pos.z), __P.pos.z); h.speed = 0; H.cd = 0; __horse.use(); __sim(3); H.guns.draw('tommy'); __sim(1.2); H.fp = false; __P.yaw = h.yaw + 1.5; __P.pitch = -.1; __sim(.1); });
      await snap(`char${cv}-ride`);
    }
    // Tommy close-up: first-person, brass in the air; then suppressor fitted
    await p.evaluate(() => { const H = __horse.state, g = H.guns; if (H.mounted) __horse.dismount(); __sim(2); __spot(); H.fp = true; __P.yaw = .6; __P.pitch = -.05; g.draw('tommy'); __sim(1.5); for (let i = 0; i < 4; i++) { g.shoot(); __sim(.1); } });
    await snap('tommy-brass');
    await p.evaluate(() => { const H = __horse.state, g = H.guns; g.state.spent = 0; g.state.score = 5000; if (!H.tommySup.state.owned) H.tommySup.buy(); else if (!H.tommySup.state.equipped) H.tommySup.toggle(); __sim(.6); g.shoot(); __sim(.08); });
    await snap('tommy-suppressed');
    await p.evaluate(() => { const H = __horse.state; H.fp = false; __P.yaw = 0; __sim(.3); H.bodyYaw = Math.PI * .5; });
    await snap('tommy-suppressed-3p');
    console.log(tag, 'errors', JSON.stringify(errs.slice(0, 8))); await p.close(); }
  await br.close(); })().catch(e => { console.error(e); process.exit(1); });
