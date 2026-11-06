// Run: node tests/mw-shots.cjs [base]. Saves shot-mw-*.png (menu, classic, zombies, RPG-7, DMR scope; desktop + mobile).
const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 90000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = []; const shot = async (name, url, mobile, fn, wait = 2500) => { const p = await b.newPage(); p.on('pageerror', e => errors.push(name + ': ' + e.message));
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + url + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0' }); if (fn) await p.evaluate(fn); await sleep(wait); await p.screenshot({ path: 'shot-mw-' + name + '.png' }); await p.close(); };
  await shot('menu-desktop', '/?q=medium', false); await shot('menu-mobile', '/?q=low', true);
  await shot('attack-desktop', '/?auto=attack&build=0&q=medium&dev=1&light=overcast', false, () => { __sim(4); });
  await shot('defend-mobile', '/?auto=defend&build=3&q=low&dev=1', true, () => { __sim(6); });
  await shot('zombies-desktop', '/?auto=zombies&zbuild=0&q=medium&dev=1', false, () => { __sim(10); __zombies.state.maxHP = 1e6; __P.hp = 1e6; __zombies.dropPower(__P.pos.clone().setZ(__P.pos.z - 4), 'strike'); });
  await shot('zombies-mobile', '/?auto=zombies&zbuild=0&q=low&dev=1', true, () => { __sim(10); __zombies.state.maxHP = 1e6; __P.hp = 1e6; });
  await shot('zombies-build-desktop', '/?auto=zombies&q=medium&dev=1', false);
  await shot('rpg7-desktop', '/?auto=zombies&zbuild=0&q=medium&dev=1', false, () => { __coop.act.swap(); });
  await shot('rpg7-flight', '/?auto=zombies&zbuild=0&q=medium&dev=1', false, () => { __coop.launchRocket(__P.pos.clone().add(new __P.pos.constructor(.6, 1.4, -2.5)), new __P.pos.constructor(0, 0, -14), false); }, 350);
  await shot('dmr-scope', '/?auto=attack&build=0&q=medium&gun=dmr&dev=1', false, () => { __P.adsHeld = true; }, 2500);
  await shot('lowhp-killfeed', '/?auto=attack&build=0&q=medium&dev=1', false, () => { __P.hp = 20; for (let i = 0; i < 3; i++) document.getElementById('feed') && 0; });
  console.log(JSON.stringify(errors)); await b.close();
})();
