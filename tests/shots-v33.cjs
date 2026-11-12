// Run: node tests/shots-v33.cjs [base URL]. v33-towers screenshots (desktop + phone): fire lookout, upgrade shop,
// Golden Buffalo scope with in-scope points, kill leaderboard, the town, the HORSE RIDER jacket from behind, darts.
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'] });
  const errors = [];
  for (const tag of (process.argv[3] || 'desktop,mobile').split(',')) {
    const mob = tag === 'mobile', p = await br.newPage(); p.on('pageerror', e => errors.push(tag + ': ' + e));
    await p.setViewport(mob ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&solo=1&q=' + (mob ? 'low' : 'medium'), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__horse && __horse.state.models === 'real' && __horse.guns, { timeout: 900000 });
    const ev = (f, ...a) => p.evaluate(f, ...a), shot = async (name, wait = 9000) => { if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return; await sleep(wait); await ev(() => { __horse.hud(); const m = document.getElementById('msg'); if (m && /walk to the pen|looking sharp/.test(m.textContent)) m.style.visibility = 'hidden'; }); await p.screenshot({ path: `shot-horserider-v33-${tag}-${name}.png` }); console.log(tag, name); };
    await ev(() => { const H = __horse.state; sessionStorage.clear(); H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.guns.state.score = 12000; H.guns.state.kills = 37; H.env && (H.env.t = .45); });
    const look = (x, z, tx, ty, tz) => ev((x, z, tx, ty, tz) => { const H = __horse.state; H.fv.set(0, 0); const y = H.town2.floorAt(x, z, 1e9); __P.pos.set(x, y, z); __P.yaw = Math.atan2(-(tx - x), -(tz - z)); __P.pitch = Math.atan2(ty - y - 1.6, Math.hypot(tx - x, tz - z)); for (let i = 0; i < 10; i++) __sim(.05); }, x, z, tx, ty, tz);
    // 1) lookout No.1 from the snowfield
    const t1 = await ev(() => { const t = __horse.state.town2.towers.find(t => t.kind === 'armory'); return { cx: t.cx, cz: t.cz, y0: t.y0 }; });
    await look(t1.cx - 26, t1.cz + 30, t1.cx, t1.y0 + 7, t1.cz); await shot('tower');
    // 2) upgrade station shop on lookout No.2
    await ev(() => { const H = __horse.state, T = H.town2, t = T.towers.find(t => t.kind === 'station'); __P.pos.set(t.cx, t.y0 + 16, t.cz - .8); for (let i = 0; i < 6; i++) __sim(.05); H.cd = 0; __horse.use(); });
    await shot('shop', 5000); await ev(() => { const b = document.querySelector('#hrShop button[data-a="x"]'); b && b.click(); });
    // 3) Golden Buffalo scope: a long kill, points + hit marker inside the scope
    await ev(() => { const H = __horse.state, g = H.guns, Z = H.zombies, T = H.town2, t = T.towers.find(t => t.kind === 'armory'); __P.pos.set(t.cx + 3.1, t.y0 + 16, t.cz - .5); __P.yaw = -Math.PI / 2; /* out on the deck, looking over the rail */ for (let i = 0; i < 6; i++) __sim(.05);
      g.give('gold'); g.draw('gold'); for (let i = 0; i < 10; i++) __sim(.05); __coop.input.ads = true; for (let i = 0; i < 24; i++) __sim(.05);
      const x = t.cx + 90, z = t.cz - 3, zz = Z.spawn('walker', [x, z]); for (let i = 0; i < 4; i++) __sim(.05); g.aimAt(Z.headPos(zz, zz.pos.clone()), __coop.syncCamera); for (let i = 0; i < 3; i++) g.zoom(1); for (let i = 0; i < 6; i++) __sim(.05); g.aimAt(Z.headPos(zz, zz.pos.clone()), __coop.syncCamera); g.state.reloading = false; g.state.ammo.gold = 1; g.shoot(false); __sim(.05); __sim(.05); });
    await p.addStyleTag({ content: '#hrScope .pops b{animation-delay:-.25s!important;animation-play-state:paused!important}#hrScope .hx.on{animation-delay:-.1s!important;animation-play-state:paused!important}' }); // freeze the pop-ups for the still
    await ev(() => { const g = __horse.guns; g.scopePop && g.scopePop('-650', 'h'); g.scopePop && g.scopePop('HEADSHOT +15', 'k'); const hx = document.querySelector('#hrScope .hx'); if (hx) { hx.classList.remove('on'); void hx.offsetWidth; hx.classList.add('on', 'hd'); } });
    await shot('goldscope', 300);
    await ev(() => { __coop.input.ads = false; for (let i = 0; i < 10; i++) __sim(.05); __horse.guns.holster && __horse.guns.holster(); for (let i = 0; i < 10; i++) __sim(.05); });
    // 4) leaderboard (rolling kills, top right) in the meadow
    await ev(() => { const H = __horse.state; const h = H.horses[0]; __P.pos.set(h.pos.x + 6, h.pos.y, h.pos.z + 6); __P.yaw = 2.4; __P.pitch = -.05; H.guns.state.kills += 3; for (let i = 0; i < 6; i++) __sim(.05); });
    await shot('leaderboard');
    // 5) the town from the meadow, 6) jacket from behind on the boardwalk, 7) darts in the saloon
    const tn = await ev(() => { const s = __horse.state.town2.town, w = __horse.state.town2.toW; return { c: [s.cx, s.cz], y0: s.y0, far: w(s, -1, -30), front: w(s, 2.5, -2.2), dirt: w(s, 0, -6) }; });
    await look(tn.far[0], tn.far[1], tn.c[0], tn.y0 + 3, tn.c[1]); await shot('town');
    await ev(() => { const H = __horse.state, T = H.town2; if (!T.jacket) T.buyJacket(); T.wear = true; });
    await look(tn.front[0], tn.front[1], tn.dirt[0] * 2 - tn.front[0], tn.y0 + 1.4, tn.dirt[1] * 2 - tn.front[1]);
    await ev(tn => { __P.yaw = Math.atan2(-(tn.front[0] - tn.dirt[0]), -(tn.front[1] - tn.dirt[1])); __P.pitch = -.12; for (let i = 0; i < 6; i++) __sim(.05); }, tn); // face the store (camera sees the back)
    await shot('jacket');
    await ev(() => { const H = __horse.state, T = H.town2, s = T.town, [x, z] = T.toW(s, -2.6, 3.5); H.fv.set(0, 0); __P.pos.set(x, s.y0 + .45, z); for (let i = 0; i < 8; i++) __sim(.05); H.cd = 0; __horse.use(); const b = document.querySelector('#hrDarts button[data-a="ai"]'); b && b.click(); const me = H.me || 'P1'; T.netIn({ a: 'th', x: 4, y: 99 }, me); T.netIn({ a: 'th', x: -20, y: 60 }, me); });
    await shot('darts', 4000);
    await ev(() => { const T = __horse.state.town2; T.closeUI(); });
    // 8) saloon checkers vs the bartender, 9) drunk (six whiskeys: double vision, blur, tilt)
    await ev(() => { const H = __horse.state, T = H.town2, s = T.town, [x, z] = T.toW(s, -9, 1.5); H.fv.set(0, 0); __P.pos.set(x, s.y0 + .45, z); for (let i = 0; i < 8; i++) __sim(.05); H.cd = 0; __horse.use(); const b = document.querySelector('#hrCheck button[data-a="ai"]'); b && b.click();
      for (let k = 0; k < 3; k++) { const g = T.ck.G; if (!g || g.turn !== 0) break; const m = T.ckMoves(g)[(k * 3) % T.ckMoves(g).length]; T.ck.tap(m.f); T.ck.tap(m.t); for (let i = 0; i < 25; i++) __sim(.05); } T.ck.ui(); });
    await shot('bar-checkers', 4000);
    await ev(() => { const H = __horse.state, T = H.town2, s = T.town, [x, z] = T.toW(s, -7, 3.6), [bx, bz] = T.toW(s, -7, 7); T.closeUI(); H.fv.set(0, 0); __P.pos.set(x, s.y0 + .45, z); __P.yaw = Math.atan2(-(bx - x), -(bz - z)); __P.pitch = -.05; T.drunk = 6.5; for (let i = 0; i < 20; i++) __sim(.05); });
    await shot('drunk', 6000);
    await p.close();
  }
  console.log('errors', JSON.stringify(errors)); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
