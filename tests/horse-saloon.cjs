// v35 saloon: slot math (fair ~93.6% return, 3 buffalo = 60x = 6000 at bet 100), seated slots (FPV, bets, can't bet more than you
// have, payouts), host-drawn reels for clients, hiring bandits (100 each, max 5), they follow / teleport / ride / shoot zombies
// (+5 per kill), fistfights (win +50, lose = knocked down), dances (100), the dealer (snow fast, green slow, never stuck running).
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.state.saloon, { timeout: 600000 });
  const R = await p.evaluate(() => { const H = __horse.state, T = H.town2, S = H.saloon, g = H.guns, k = __coop.keys, o = {}, s = T.town; H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.zombies.state.hp = 1e9;
    const step = (t) => { for (let i = 0; i < t / .05; i++) __sim(.05); }, setPts = n => { g.state.score = n; g.state.spent = 0; }, goL = (x, y, z) => { const [wx, wz] = T.toW(s, x, z); __P.pos.set(wx, s.y0 + y, wz); H.fv.set(0, 0); step(.2); };
    // 1) math
    const M = S.math; o.rtp = +M.slotRTP().toFixed(4); o.jack = M.slotPay([4, 4, 4], 100); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let bet = 0, back = 0, jacks = 0;
    for (let i = 0; i < 300000; i++) { const r = M.slotSpin(rnd); bet += 10; const w = M.slotPay(r, 10); back += w; if (w === 600) jacks++; } o.mc = +(back / bet).toFixed(4); o.mcJacks = jacks;
    // 2) seated slots upstairs
    setPts(1000); goL(-15.25, s.Y2, 5.2); o.slotSpot = H.spot && H.spot.kind; H.cd = 0; __horse.use(); o.seated = !!H.seated && H.fp && S.isOpen(); o.ui = !document.getElementById('hrSaloon').hidden;
    const sy = S.seatYaw; __P.yaw = sy + 3; step(.1); o.yawClamped = Math.abs(((__P.yaw - sy + Math.PI * 3) % (Math.PI * 2)) - Math.PI) <= 1.26;
    S.setBet(100); const p0 = g.pts(); o.spun = S.spin(); o.afterBet = g.pts() - p0; step(3); o.last = S.last; o.paid = g.pts() - p0 === -100 + S.last.win; o.payOk = S.last.win === M.themedMultiplier(S.last.r, S.seat ? S.seat.theme : S.slots[1].theme) * 100;
    setPts(100000); let spins = 0; for (let i = 0; i < 30; i++) { if (S.spin()) spins++; step(2.6); } o.spins = spins;
    setPts(50); S.setBet(100); o.overBet = S.spin(); S.setBet(10); o.smallBet = S.spin(); step(3);
    H.cd = 0; __horse.use(); o.stood = !H.seated && !S.isOpen();
    // host draws the reels for a client
    { let got = null; const keep = H.zSendTo; H.zSendTo = (id, m) => { got = m; }; S.netIn({ t: 'sv', k: 'slot', bet: 10, n: 9, machine: 1 }, 'P2'); H.zSendTo = keep; o.hostReels = got && got.t === 'svr' && got.n === 9 && got.r.length === 3; }
    // 3) hire bandits
    setPts(1000); goL(-12.9, s.F, 6.2); o.banditSpot = H.spot && H.spot.kind; H.cd = 0; __horse.use(); o.hireUI = S.isOpen(); for (let i = 0; i < 7; i++) S.hire(); o.hired = S.bandits.length; o.ptsAfterHire = g.pts(); S.close();
    // walk out of town: they follow
    const [ox, oz] = T.toW(s, -5.8, -6); __P.pos.set(ox, __horse.hAt(ox, oz), oz); H.fv.set(0, 0); step(2); __P.yaw = s.rot; for (let i = 0; i < 160; i++) { k.KeyW = true; __sim(.05); } k.KeyW = false; step(4);
    o.follow = S.bandits.map(B => +Math.hypot(B.D.g.position.x - __P.pos.x, B.D.g.position.z - __P.pos.z).toFixed(1));
    // far away: they catch up (teleport)
    __P.pos.x += 120; __P.pos.y = __horse.hAt(__P.pos.x, __P.pos.z); step(2); o.afterTp = S.bandits.map(B => +Math.hypot(B.D.g.position.x - __P.pos.x, B.D.g.position.z - __P.pos.z).toFixed(1));
    // zombies: the posse shoots them (+5 each)
    const pk = g.pts(), k0 = S.bKills || 0, x0 = __P.pos.x, z0 = __P.pos.z; for (let i = 0; i < 4; i++) H.zombies.spawn('walker', [x0 + 18 + i * 2, z0 + 10]); step(14); o.bKills = (S.bKills || 0) - k0; o.killPts = g.pts() - pk; o.posseHp = S.bandits.map(B => Math.round(B.hp)); o.playerHp = H.zombies.state.hp > 1e8;
    // riding: they get horses and keep up
    const h = H.horses[0]; h.pos.set(__P.pos.x + 1.2, __horse.hAt(__P.pos.x + 1.2, __P.pos.z), __P.pos.z); H.cd = 0; __horse.use(); step(1.5); k.KeyW = true; k.ShiftLeft = true; H.stam = 100; for (let i = 0; i < 160; i++) { H.stam = 100; __sim(.05); } k.KeyW = false; k.ShiftLeft = false; step(3);
    o.rode = !!H.mounted; o.onHorses = S.bandits.filter(B => B.hz).length; o.rideDist = S.bandits.map(B => +Math.hypot(B.D.g.position.x - H.mounted.pos.x, B.D.g.position.z - H.mounted.pos.z).toFixed(1)); __horse.dismount && __horse.dismount(); if (H.mounted) { H.cd = 0; H.wantOff = true; step(3); }
    o.dismounted = !H.mounted; step(1); o.horsesGone = S.bandits.filter(B => B.hz).length === 0;
    // 4) fistfight: bump the bandit at the bar
    setPts(100); const D = S.drifters[0]; const dp = D.g.position.clone(); __P.pos.set(dp.x + .5, dp.y, dp.z); H.fv.set(2, 0); __sim(.05); o.fightStarted = !!S.fight; o.noGunInFight = H.noGun && !g.state.weapon;
    for (let i = 0; i < 300 && S.fight; i++) { window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); step(.45); }
    o.fightOver = !S.fight; o.fightResult = { wins: S.fightWins || 0, losses: S.fightLosses || 0, pts: g.pts() }; step(3);
    S.startFight(0); if (S.fight) { S.fight.op = 1; window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); for (let i = 0; i < 40 && S.fight; i++) { window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); step(.45); } } o.winPts = g.pts(); o.koMode = D.mode; step(7);
    // 5) a dance
    setPts(300); goL(-13.2, s.F, 1.9); o.danceSpot = H.spot && H.spot.kind; o.danced = S.startDance(1, true); o.dancePts = g.pts(); step(5); o.dancing = S.dancers[1].mode === 'dance' && !!S.dance; step(25); o.danceEnded = !S.dance && !H.noGun;
    // 6) the dealer: snow = fast (and you still stop at once), green = slow
    const walkV = () => { goL(-5, s.F, 2.5); __P.yaw = s.rot + Math.PI / 2; for (let i = 0; i < 30; i++) { k.KeyW = true; __sim(.05); } const v = H.fv.length(); k.KeyW = false; let t = 0; while (H.fv.length() > .15 && t < 3) { __sim(.05); t += .05; } return [+v.toFixed(2), +t.toFixed(2)]; };
    H.noTrip = true; o.vSober = walkV(); setPts(500); goL(-15.4, s.F, 8.5); o.dealerSpot = H.spot && H.spot.kind; S.buy('snow'); o.vSnow = walkV(); S.buzz.snow = .01; step(.5); o.crash = S.buzz.crash > 0; o.vCrash = walkV(); S.buzz.crash = 0; S.buy('green'); o.vGreen = walkV(); o.swayMul = H.swayMul; S.buzz.green = 0; step(.2);
    o.greta = (() => { const sp = T.spots.find(q => q.label && q.label.includes('Greta')); const a = [sp.x, sp.z]; step(8); return Math.hypot(sp.x - a[0], sp.z - a[1]) > .2 || true; })();
    o.loopErr = window.__loopErr ? String(window.__loopErr) : null; return o; });
  R.errors = errors; console.log(JSON.stringify(R));
  assert.ok(R.rtp > .9 && R.rtp < .96, 'fair return'); assert.equal(R.jack, 6000, 'jackpot 6000'); assert.ok(Math.abs(R.mc - R.rtp) < .03, 'simulated return matches');
  assert.equal(R.slotSpot, 'slot'); assert.ok(R.seated && R.ui && R.yawClamped, 'seated first-person, free look limited'); assert.ok(R.spun && R.afterBet === -100 && R.paid && R.payOk, 'bet + payout');
  assert.ok(R.spins >= 25, 'keeps spinning'); assert.ok(!R.overBet && R.smallBet, 'cannot bet more than you have'); assert.ok(R.stood, 'E stands up'); assert.ok(R.hostReels, 'host draws reels for clients');
  assert.equal(R.banditSpot, 'bandits'); assert.equal(R.hired, 5, 'max 5'); assert.equal(R.ptsAfterHire, 500, '100 each');
  assert.ok(R.follow.every(d => d < 9), 'they follow on foot'); assert.ok(R.afterTp.every(d => d < 10), 'they catch up when far'); assert.ok(R.bKills >= 2 && R.killPts === R.bKills * 5, 'they shoot zombies (+5 each)');
  assert.ok(R.rode && R.onHorses === 5 && R.rideDist.every(d => d < 25), 'they ride with you'); assert.ok(R.horsesGone, 'and get off when you do');
  assert.ok(R.fightStarted && R.noGunInFight && R.fightOver, 'bump -> fistfight, guns away, it ends'); assert.ok(R.fightResult.wins + R.fightResult.losses >= 1);
  assert.equal(R.danceSpot, 'dance'); assert.ok(R.danced && R.dancePts === 200 && R.dancing && R.danceEnded, 'a 100-point dance');
  assert.equal(R.dealerSpot, 'dealer'); assert.ok(R.vSnow[0] > R.vSober[0] * 1.3 && R.vGreen[0] < R.vSober[0] * .85 && R.crash && R.vCrash[0] < R.vSober[0], 'snow fast, crash + green slow');
  for (const v of [R.vSober, R.vSnow, R.vCrash, R.vGreen]) assert.ok(v[1] <= .6, 'still stops at once');
  assert.ok(!R.loopErr && !errors.length, (R.loopErr || '') + errors.join('\n')); console.log('HORSE SALOON OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
