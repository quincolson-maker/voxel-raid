// Run: node tests/shots-v34.cjs [base URL]. v34 USFS fire lookout: outside, the stair entry, inside the cab (desktop + phone).
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  const errors = [];
  for (const tag of (process.argv[3] || 'desktop,mobile').split(',')) {
    const mob = tag === 'mobile', p = await br.newPage(); p.on('pageerror', e => errors.push(tag + ': ' + e));
    await p.setViewport(mob ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&solo=1&q=' + (mob ? 'low' : 'medium'), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__horse && __horse.state.models === 'real' && __horse.guns, { timeout: 900000 });
    const ev = (f, ...a) => p.evaluate(f, ...a), shot = async (name, wait = 9000) => { if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return; await sleep(wait); await ev(() => { __horse.hud(); const m = document.getElementById('msg'); if (m && /walk to the pen|looking sharp/.test(m.textContent)) m.style.visibility = 'hidden'; }); await p.screenshot({ path: `shot-horserider-v34-${tag}-${name}.png` }); console.log(tag, name); };
    await ev(() => { const H = __horse.state; sessionStorage.clear(); localStorage.removeItem('hr_v33'); localStorage.removeItem('hr_v33_town'); H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.guns.state.score = 12000; H.guns.state.kills = 37; H.env && (H.env.t = .45); });
    const look = (lx, lz, ly, tx, ty, tz) => ev((lx, lz, ly, tx, ty, tz) => { const H = __horse.state, T = H.town2, t = T.towers.find(t => t.kind === 'armory'); const [x, z] = T.toW(t, lx, lz), [wx, wz] = T.toW(t, tx, tz);
      H.fv.set(0, 0); const y = ly == null ? __horse.hAt(x, z) : T.floorAt(x, z, t.y0 + ly + .3); __P.pos.set(x, y, z); __P.yaw = Math.atan2(-(wx - x), -(wz - z)); __P.pitch = Math.atan2(t.y0 + ty - y - 1.6, Math.hypot(wx - x, wz - z)); for (let i = 0; i < 4; i++) __sim(.05); }, lx, lz, ly, tx, ty, tz);
    const A = 4.6; await look(-24, 16, null, 0, 8, 0); await shot('tower-outside');
    await look(-5.6, A, null, 3, 3.2, A); await shot('tower-stairs');
    await look(-.2, 1.7, 16, .2, 16.9, -2.4); await shot('tower-cab');
    await p.close();
  }
  console.log('errors', JSON.stringify(errors)); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
