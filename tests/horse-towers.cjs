// v33: fire lookouts (walk up four flights of stairs, take the Tommy gun + Golden Buffalo from the cab), the upgrade
// station shop (buy a gun, buy a tier), the town (saloon + general store) as a zombie safe zone, the HORSE RIDER jacket,
// drinks (worse with each, passing out), darts scoring (301) vs the bartender. Deterministic via window.__sim.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=960,540'] });
  const p = await br.newPage(); await p.setViewport({ width: 960, height: 540 }); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.guns && __horse.state.models === 'real', { timeout: 600000 });
  const R = await p.evaluate(() => { const H = __horse.state, T = H.town2, g = __horse.guns, k = __coop.keys, o = {}, step = s => { for (let i = 0; i < s * 20; i++) __sim(.05); };
    sessionStorage.clear(); H.zombies.clear(); H.zombies.state.spawnT = 1e9; o.places = H.places; o.towerY = T.towers.map(t => Math.round(t.y0)); o.snowLine = 355;
    // 1) climb lookout 1 on foot by its stairs
    const t1 = T.towers.find(t => t.kind === 'armory'), W = (x, z) => [t1.cx + x, t1.cz + z], A = 3.95, B = 5.05;
    let [sx, sz] = W(-4.6, A); __P.pos.set(sx, __horse.hAt(sx, sz), sz); H.fv.set(0, 0);
    const route = [[-3.4, A], [3.5, A], [3.6, B], [-3.5, B], [-3.6, A], [3.5, A], [3.6, B], [-3.5, B], [-3.4, 4.4], [-3.2, 2.6], [-3.1, 1.6], [-1.8, 1.6], [.6, -.4], [1.2, -.7]]; const trace = [];
    for (const [x, z] of route) { const [wx, wz] = W(x, z); for (let i = 0; i < 200; i++) { const dx = wx - __P.pos.x, dz = wz - __P.pos.z; if (Math.hypot(dx, dz) < .25) break; __P.yaw = Math.atan2(-dx, -dz); k.KeyW = true; k.AltLeft = true; __sim(.05); } trace.push(+(__P.pos.y - t1.y0).toFixed(2)); } k.KeyW = false; k.AltLeft = false; step(.3);
    o.climb = { trace, top: +(__P.pos.y - t1.y0).toFixed(2), spot: H.spot && H.spot.kind };
    H.cd = 0; o.tookTommy = __horse.use() && g.state.owned.tommy; step(.5); { const [x, z] = W(-1.4, -.9); __P.pos.x = x; __P.pos.z = z; } step(.3); H.cd = 0; o.goldSpot = H.spot && H.spot.kind; o.tookGold = __horse.use() && g.state.owned.gold; step(.5);
    // 2) lookout 2: the upgrade station (buy a tier, buy a gun)
    const t2 = T.towers.find(t => t.kind === 'station'); __P.pos.set(t2.cx, t2.y0 + 16, t2.cz - .8); step(.3); H.cd = 0; o.shopSpot = H.spot && H.spot.kind; g.state.owned.gold = false; g.state.score = 10000; g.state.spent = 0; o.shopOpened = __horse.use() && !document.getElementById('hrShop').hidden;
    const click = sel => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; };
    o.buyGold = click('#hrShop button[data-a="buy"][data-w="gold"]') && g.state.owned.gold; o.ptsAfterGold = g.pts(); o.upgrade = click('#hrShop button[data-a="up"][data-w="revolver"]') && g.tier('revolver') === 1; o.ptsAfterUp = g.pts(); o.mag = g.maxAmmo('revolver'); click('#hrShop button[data-a="x"]');
    // 3) town: safe zone, jacket, drinks, darts
    const tn = T.town, [ix, iz] = T.toW(tn, 5.5, 4.3); __P.pos.set(ix, tn.y0 + .45, iz); step(.4); o.storeSpot = H.spot && H.spot.kind; H.cd = 0; __horse.use(); o.jacket = click('#hrShop button[data-a="jacket"]') && T.jacket; click('#hrShop button[data-a="x"]');
    o.jacketParts = !!(H.person && H.person.W && H.person.W.m.userData.jacket && H.person.W.m.userData.jacket.length >= 5); o.netJacket = __horse.gunNet().jk;
    o.inSafe = H.zombies.inSafeZone(__P.pos.x, __P.pos.z); const hp0 = H.zombies.state.hp; const z1 = H.zombies.spawn('walker', [__P.pos.x + 1.2, __P.pos.z]); const zc = H.zombies.spawn('runner', [tn.cx, tn.cz]); step(6);
    o.zombieOut = !H.zombies.inTown(zc.pos.x, zc.pos.z) && !H.zombies.inTown(z1.pos.x, z1.pos.z); o.unhurt = H.zombies.state.hp === hp0; H.zombies.clear();
    const [bx, bz] = T.toW(tn, -7, 4.5); __P.pos.set(bx, tn.y0 + .45, bz); step(.4); o.barSpot = H.spot && H.spot.kind; const sw0 = T.dartSway();
    let lv = []; for (let i = 0; i < 6; i++) { H.cd = 0; __horse.use(); lv.push(+T.level().toFixed(2)); } o.levels = lv; step(.5); o.camTilt = +__cam.rotation.z.toFixed(3);
    // walking around drunk (level ~6): stumbles; more drinks -> passes out, wakes outside, still hungover
    { const s0 = H.stumbles || 0; for (let i = 0; i < 200; i++) { __P.yaw += .03; k.KeyW = true; __sim(.05); } k.KeyW = false; o.stumbles = (H.stumbles || 0) - s0; o.falls = H.falls || 0; }
    o.swayDrunk = +T.dartSway().toFixed(1); o.swaySober = +sw0.toFixed(1);
    H.fv.set(0, 0); __P.pos.set(bx, tn.y0 + .45, bz); step(.4); o.preLv = [T.level(), H.spot && H.spot.kind, H.fallT, H.guns.pts(), __P.pos.y - tn.y0, H.mounted, T.spots.filter(q => q.kind === "drink").map(q => [q.y - tn.y0, Math.hypot(__P.pos.x - q.x, __P.pos.z - q.z)]), H.uiOpen, T.passT]; for (let i = 0; i < 4; i++) { H.cd = 0; __horse.use(); } o.postLv = T.level(); step(.3); o.passed = T.passT > 0; step(6); o.woke = T.passT <= 0 && T.level() > 2.9 && T.level() < 3.3; o.wakeDist = +Math.hypot(__P.pos.x - bx, __P.pos.z - bz).toFixed(1);
    // darts scoring + a game against the bartender
    o.scores = [[0, 0], [0, 10], [0, 103], [0, 166], [0, 135], [0, 180], [135, 0], [-103, 0], [0, -103]].map(([x, y]) => T.dartScore(x, y).label);
    { const G = T.newGame('P1', 'P2'); G.s[0] = 40; G.start = 40; const r1 = T.applyDart(G, 60); const busted = G.s[0] === 40 && G.turn === 1; G.turn = 0; G.darts = 0; G.start = 40; G.s[0] = 40; const r2 = T.applyDart(G, 40); o.rules = { bust: r1 === 'bust' && busted, win: r2 === 'win' && G.win === 0 }; }
    const [dx, dz] = T.toW(tn, -2.6, 3.5); __P.pos.set(dx, tn.y0 + .45, dz); T.drunk = 0; step(.4); o.dartSpot = H.spot && H.spot.kind; H.cd = 0; __horse.use(); o.dartsOpen = !document.getElementById('hrDarts').hidden;
    click('#hrDarts button[data-a="ai"]'); const G = T.dart; for (let i = 0; i < 3; i++) T.netIn({ a: 'th', x: 0, y: 103 }, H.me || 'P1'); o.after3 = G.s[0]; step(5); o.aiScore = G.s[1]; o.turnBack = G.turn === 0; click('#hrDarts button[data-a="x"]'); o.dartsClosed = getComputedStyle(document.getElementById('hrDarts')).display === 'none' && !H.uiOpen;
    // checkers: rules, a full bartender-vs-bartender game, and a real game in the saloon
    { const E = () => { const G = T.ckNew('A', 'B'); G.B.fill(0); return G; }, ck = {};
      const G0 = T.ckNew('A', 'B'); ck.pieces = [G0.B.filter(v => v > 0).length, G0.B.filter(v => v < 0).length]; ck.open = T.ckMoves(G0).length;
      let G = E(); G.B[5 * 8 + 2] = 1; G.B[4 * 8 + 3] = -1; G.B[0 * 8 + 7] = -1; ck.forced = JSON.stringify(T.ckMoves(G).map(m => [m.f, m.t, m.cap])); ck.illegal = T.ckApply(G, { f: 42, t: 33 });
      G = E(); G.B[6 * 8 + 1] = 1; G.B[5 * 8 + 2] = -1; G.B[3 * 8 + 4] = -1; ck.j1 = T.ckApply(G, { f: 49, t: 35 }); ck.chainTurn = G.turn; ck.j2 = T.ckApply(G, { f: 35, t: 21 }); ck.winner = G.win;
      G = E(); G.B[1 * 8 + 2] = 1; G.B[7 * 8 + 0] = -1; T.ckApply(G, { f: 10, t: 1 }); ck.king = G.B[1];
      G = T.ckNew('A', 'B'); let n = 0; while (G.win === -1 && n++ < 500) { const mv = T.ckAI(G, .7); if (!mv) break; T.ckApply(G, mv); } ck.aiGame = { win: G.win, plies: G.n };
      const [cx, cz] = T.toW(tn, -9, 1.5); H.fv.set(0, 0); __P.pos.set(cx, tn.y0 + .45, cz); step(.4); ck.spot = H.spot && H.spot.kind; H.cd = 0; __horse.use(); ck.opened = T.ck.isOpen(); click('#hrCheck button[data-a="ai"]');
      const g = T.ck.G, m = T.ckMoves(g)[0]; T.ck.tap(m.f); T.ck.tap(m.t); ck.afterMine = g.turn; step(2.5); ck.bartenderMoved = g.turn === 0 && g.n >= 2; click('#hrCheck button[data-a="x"]'); ck.closed = !T.ck.isOpen() && !H.uiOpen && getComputedStyle(document.getElementById('hrCheck')).display === 'none' && getComputedStyle(document.getElementById('hrDarts')).display === 'none' && getComputedStyle(document.getElementById('hrShop')).display === 'none'; /* really gone from the screen */ o.ck = ck; }
    // drunk duration: three drinks still felt after 3 minutes
    { T.drunk = 3; step(185); o.after3min = +T.level().toFixed(2); T.drunk = 0; }
    o.loopErr = window.__loopErr ? String(window.__loopErr) : null; return o; });
  R.errors = errors; console.log(JSON.stringify(R, null, 1));
  assert.ok(R.towerY.every(y => y > R.snowLine), 'lookouts above the snow line');
  assert.ok(R.climb.top > 15.5, 'climbed the stairs to the cab'); assert.ok(R.tookTommy && R.tookGold, 'took the Tommy gun and the Golden Buffalo');
  assert.ok(R.shopOpened && R.buyGold && R.ptsAfterGold === 7000 && R.upgrade && R.ptsAfterUp === 6700 && R.mag > 6, 'upgrade station: buy a gun, buy a tier');
  assert.ok(R.jacket && R.jacketParts && R.netJacket === 1, 'jacket bought, worn and synced');
  assert.equal(R.inSafe, 'town'); assert.ok(R.zombieOut && R.unhurt, 'town is a zombie safe zone');
  assert.ok(R.levels[5] > R.levels[0] + 4, 'drinks stack'); assert.ok(R.stumbles > 0, 'drunk on foot stumbles'); assert.ok(R.swayDrunk > R.swaySober * 3, 'drunk darts aim sways more');
  assert.ok(R.passed && R.woke && R.wakeDist < 20, 'passes out and wakes nearby, hungover');
  assert.deepStrictEqual(R.scores, ['BULL', '25', 'T20', 'D20', '20', 'MISS', '6', 'T11', 'T3']); assert.ok(R.rules.bust && R.rules.win, '301 bust / finish');
  assert.ok(R.dartsOpen && R.after3 === 121 && R.aiScore < 301 && R.turnBack && R.dartsClosed, 'darts vs the bartender');
  const K = R.ck; assert.deepStrictEqual(K.pieces, [12, 12]); assert.equal(K.open, 7); assert.equal(K.forced, '[[42,28,35]]', 'captures are compulsory'); assert.equal(K.illegal, 'bad');
  assert.ok(K.j1 === 'jump' && K.chainTurn === 0 && K.j2 === 'win' && K.winner === 0, 'multi-jump keeps the turn, taking the last piece wins'); assert.equal(K.king, 2, 'crowned');
  assert.ok(K.aiGame.win !== -1, 'a full AI game finishes'); assert.ok(K.spot === 'checkers' && K.opened && K.afterMine === 1 && K.bartenderMoved && K.closed, 'checkers vs the bartender in the saloon');
  assert.ok(R.after3min > 0, 'three drinks last 3+ minutes');
  assert.ok(!R.loopErr && !errors.length, 'no errors');
  console.log('HORSE TOWERS OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
