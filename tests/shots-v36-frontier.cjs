// v36 Frontier screenshots: new saloon (exterior, entrance, stage, bar, balcony), each slot seated, poker, blackjack (desktop + phone).
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767', only = process.argv[3] || 'desktop,mobile', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 1800000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const tag of only.split(',')) { const mobile = tag === 'mobile', p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    await p.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&solo=1&zombies=0&q=' + (mobile ? 'low' : 'medium') + (mobile ? '&touch=1' : ''), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__booted && window.__horse && __horse.state.saloon && __horse.state.models !== 'loading', { timeout: 900000 });
    await p.evaluate(() => { const H = __horse.state, T = H.town2, s = T.town; H.guns.state.score = 50000; H.guns.state.spent = 0; document.getElementById('keys').hidden = true;
      window.__view = (lx, ly, lz, tx, ty, tz) => { H.fp = true; const [x, z] = T.toW(s, lx, lz), [X, Z] = T.toW(s, tx, tz); __P.pos.set(x, s.y0 + ly, z); H.fv.set(0, 0); const dx = X - x, dz = Z - z; __P.yaw = Math.atan2(-dx, -dz); __P.pitch = Math.atan2((ty - ly) - 1.62, Math.hypot(dx, dz)); }; });
    const shot = async (name, fn, wait = 5000, arg) => { await p.evaluate(fn, arg); await sleep(wait); await p.screenshot({ path: `shot-v36-frontier-${name}-${tag}.png` }); console.log(tag, name); };
    const F = .45, Y2 = 4.05;
    await shot('exterior', () => { const H = __horse.state, T = H.town2, s = T.town; H.fp = false; const [x, z] = T.toW(s, -9, -16); __P.pos.set(x, __horse.hAt(x, z), z); const [X, Z] = T.toW(s, -9, 5); __P.yaw = Math.atan2(-(X - x), -(Z - z)); __P.pitch = .02; }, 9000);
    await shot('entrance', () => __view(-1.8, .45, 1.2, -14, 1.5, 6), 7000);
    await shot('stage', () => __view(-11.5, .45, 2.4, -16.5, 1.4, 1.9));
    await shot('bar', () => __view(-9.5, .45, 7.5, -4, 1.2, 3.5));
    await shot('balcony', () => __view(-12.2, 4.05, 9.2, -5, 1.0, 2));
    for (let i = 0; i < 3; i++) await shot('slot' + (i + 1), i => { const H = __horse.state, S = H.saloon; if (S.isOpen()) S.close(); const T = H.town2, s = T.town, M = S.slots[i], [x, z] = T.toW(s, -14.6, M.z); __P.pos.set(x, s.y0 + 4.05, z); H.fv.set(0, 0); __sim(.2); H.cd = 0; __horse.use(); S.setBet && S.setBet(50); S.spin && S.spin(); }, 6000, i);
    for (const k of ['poker', 'blackjack']) await shot(k, k => { const H = __horse.state, S = H.saloon; if (S.isOpen()) S.close(); if (H.seated && S.close) S.close(); const o = H.town2.spots.find(o => o.kind === k); __P.pos.set(o.x, o.y, o.z); H.fv.set(0, 0); __sim(.2); H.cd = 0; __horse.use(); }, 7000, k);
    await p.evaluate(() => { const S = __horse.state.saloon; if (S.isOpen()) S.close(); }); console.log(tag, 'errors', JSON.stringify(errs.slice(0, 8))); await p.close(); }
  await br.close(); })().catch(e => { console.error(e); process.exit(1); });
