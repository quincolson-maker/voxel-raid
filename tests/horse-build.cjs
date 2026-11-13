// v35 woodcraft: the axe fells a tree in a few swings (logs into the inventory, a stump, it regrows), no chopping in town, build
// pieces cost wood, ghost + checks, walls stop the rider and zombies, removal refunds half, builds persist (reload), the host
// validates client pieces (caps, overlaps) and broadcasts them.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  const url = base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1'; await p.goto(url, { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.build, { timeout: 600000 });
  const R = await p.evaluate(() => { const H = __horse.state, B = H.build, k = __coop.keys, o = {}; H.zombies.clear(); H.zombies.state.spawnT = 1e9; H.zombies.state.hp = 1e9; localStorage.removeItem('hr_v35_build'); B.load(); B.wood = 0;
    const step = t => { for (let i = 0; i < t / .05; i++) __sim(.05); };
    // a lone tree away from town
    const S = H.town2.town; let ti = -1; for (let i = 0; i < H.trees.length; i++) { const t = H.trees[i]; if (t.ob && Math.hypot(t.x - S.cx, t.z - S.cz) > 80 && Math.hypot(t.x - S.cx, t.z - S.cz) < 400 && B.treesNear(t.x, t.z, 6).length === 1 && Math.abs(t.x) < 900) { ti = i; break; } }
    const t = H.trees[ti]; o.tree = ti; __P.pos.set(t.x + 1.6, __horse.hAt(t.x + 1.6, t.z), t.z); __P.yaw = Math.atan2(-(t.x - __P.pos.x), -(t.z - __P.pos.z)); H.fv.set(0, 0); step(.3);
    B.setTool('axe'); o.toolAxe = B.tool === 'axe' && H.tool === 'axe'; o.gunAway = !H.guns.state.weapon; let sw = 0; while (!t.cut && sw < 20) { if (B.swing()) sw++; step(.7); } o.swings = sw; o.cut = !!t.cut; o.wood = B.wood; o.stumpR = +t.ob[2].toFixed(2);
    step(6); o.fallDone = true; t.regrow = .1; step(2.5); o.regrown = !t.cut; o.felled = B.felled;
    // no chopping in town
    { const [x, z] = H.town2.toW(S, 3, -12); let tt = H.trees.map((q, i) => [q, i]).filter(([q]) => Math.hypot(q.x - S.cx, q.z - S.cz) < 30)[0]; o.townTree = !!tt; if (tt) { const q = tt[0]; __P.pos.set(q.x + 1.6, __horse.hAt(q.x + 1.6, q.z), q.z); __P.yaw = Math.atan2(-(q.x - __P.pos.x), -(q.z - __P.pos.z)); for (let i = 0; i < 10; i++) { B.swing(); step(.7); } o.townTreeCut = !!q.cut; } void x; void z; }
    B.setTool(null); o.toolOff = !H.tool;
    // build: a flat spot in the open
    B.wood = 100; let spot = null; for (let r = 60; r < 400 && !spot; r += 8) for (let a = 0; a < 6.28 && !spot; a += .4) { const x = S.cx + Math.cos(a) * r, z = S.cz + Math.sin(a) * r, gx = Math.floor(x / 4), gz = Math.floor(z / 4); const pr = { k: 'found', gx, gz, e: 0, o: 'P1', key: 'f' + gx + ',' + gz }; pr.y = 0; if (!B.check(pr) && !B.check({ ...pr, k: 'wall', e: 0, key: 'w?' }) && B.treesNear(gx * 4 + 2, gz * 4 + 2, 8).length === 0) spot = [gx, gz]; }
    o.spot = spot; const [gx, gz] = spot, cx = gx * 4 + 2, cz = gz * 4 + 2;
    // stand south of the cell looking north at it: B.target() gives this cell
    __P.pos.set(cx, __horse.hAt(cx, cz + 3.6) + .05, cz + 3.6); __P.yaw = 0; H.fv.set(0, 0); step(.2); B.setTool('build'); B.sel = 0; B.rot = 0; step(.1); const tg = B.target(); o.target = [tg.k, tg.gx === gx && tg.gz === gz]; o.ghost = !!B.ghost && B.ok;
    o.placedFound = B.place(); o.woodAfterFound = B.wood; o.dupe = B.place(); // already there
    // walls: north (0), east (1), west (3) from inside the cell; a door on the south
    __P.pos.set(cx, B.pieces[0].y + .05, cz); step(.2); const put = (k, e) => B.place({ k, gx, gz, e, o: 'P1', key: '', y: 0, ...(() => { const q = { k, gx, gz, e }; return { key: (window.__slotKey || ((k2, x, z, e2) => B.target() && null))(k, gx, gz, e) }; })() });
    const mk = (k, e) => { const q = { k, gx, gz, e, o: 'P1' }; q.key = B.target.call ? null : null; return q; }; void mk; void put;
    const doPlace = (k, e) => B.place({ k, gx, gz, e, o: 'P1', key: B.keyOf(k, gx, gz, e), y: B.baseOf(k, gx, gz, e) });
    o.walls = [doPlace('wall', 0), doPlace('win', 1), doPlace('wall', 3)]; __P.pos.set(cx, B.pieces[0].y + .05, cz - .5); step(.2); o.doorPlaced = doPlace('door', 2); o.roof = doPlace('roof', 0); o.porch = doPlace('porch', 2);
    o.pieces = B.pieces.map(q => q.k); o.woodLeft = B.wood; o.noWood = (B.wood = 2, doPlace('found', 1)); B.wood = 40;
    // walls stop the rider: walk north into the north wall from the inside
    __P.pos.set(cx, B.pieces[0].y + .05, cz); __P.yaw = 0; for (let i = 0; i < 60; i++) { k.KeyW = true; __sim(.05); } k.KeyW = false; step(.5); o.northStop = +(__P.pos.z - (cz - 2)).toFixed(2);
    // ... and out the door to the south
    __P.yaw = Math.PI; for (let i = 0; i < 80; i++) { k.KeyW = true; __sim(.05); } k.KeyW = false; step(.5); o.outDoor = +(__P.pos.z - (cz + 2)).toFixed(2);
    // zombies can't get through: one outside the north wall chasing a player inside
    __P.pos.set(cx, B.pieces[0].y + .05, cz); step(.2); H.zombies.state.spawnT = 1e9; H.zombies.spawn('walker', [cx, cz - 7]); const z0 = H.zombies.list[H.zombies.list.length - 1]; z0.pos.set(cx + .3, __horse.hAt(cx, cz - 7), cz - 7); let minIn = 9; for (let i = 0; i < 200; i++) { __sim(.05); if (z0.alive) minIn = Math.min(minIn, Math.abs(z0.pos.x - cx) < 1.9 && Math.abs(z0.pos.z - cz) < 1.9 ? 0 : 9); } o.zombieInside = minIn === 0; o.zombieZ = +(z0.pos.z - cz).toFixed(2); o.zombieD = +Math.hypot(z0.pos.x - cx, z0.pos.z - cz).toFixed(2); H.zombies.clear();
    // remove refunds half
    const w0 = B.wood; __P.pos.set(cx, __horse.hAt(cx, cz + 3.6) + .05, cz + 3.6); __P.yaw = 0; B.sel = 5; B.rot = 0; step(.1); const nb = B.pieces.length; o.removed = B.remove({ k: 'porch', gx, gz, e: 2, key: B.keyOf('porch', gx, gz, 2) }); o.refund = B.wood - w0; o.after = B.pieces.length === nb - 1;
    B.setTool(null); o.saved = JSON.parse(localStorage.getItem('hr_v35_build')).P.length; o.savedWood = +localStorage.getItem('hr_v35_build_wood');
    // host side: a client's request is validated (no overlap, caps) and broadcast
    { const sent = [], to = []; const ks = H.zSend, kt = H.zSendTo, kr = H.netRole; H.netRole = () => 'host'; H.zSend = m => sent.push(m); H.zSendTo = (id, m) => to.push([id, m]);
      B.netIn({ t: 'sv', k: 'bPut', n: 1, p: { k: 'found', gx: gx + 1, gz, e: 0 } }, 'P2'); B.netIn({ t: 'sv', k: 'bPut', n: 2, p: { k: 'found', gx: gx + 1, gz, e: 0 } }, 'P2'); B.netIn({ t: 'sv', k: 'bDel', key: B.keyOf('wall', gx, gz, 0) }, 'P2');
      o.hostAdd = sent.filter(m => m.k === 'bAdd').length; o.hostNo = to.filter(([id, m]) => m.k === 'bNo' && id === 'P2').length; o.notTheirs = !!B.pieces.find(q => q.key === B.keyOf('wall', gx, gz, 0)); o.owner = (B.pieces.find(q => q.gx === gx + 1) || {}).o;
      H.zSend = ks; H.zSendTo = kt; H.netRole = kr; }
    o.loopErr = window.__loopErr ? String(window.__loopErr) : null; return o; });
  // reload: the cabin is still there
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__horse && __horse.state.build, { timeout: 600000 });
  R.reloaded = await p.evaluate(() => __horse.state.build.pieces.length); R.errors = errors; console.log(JSON.stringify(R));
  assert.ok(R.toolAxe && R.gunAway, 'axe out, guns away'); assert.ok(R.cut && R.swings >= 3 && R.swings <= 8, 'a few swings fell it'); assert.ok(R.wood >= 3, 'logs'); assert.ok(R.regrown, 'regrows');
  if (R.townTree) assert.ok(!R.townTreeCut, 'no chopping in town'); assert.ok(R.toolOff);
  assert.ok(R.spot && R.ghost && R.target[1], 'ghost on the target cell'); assert.ok(R.placedFound && R.woodAfterFound === 96 && !R.dupe, 'foundation costs 4, no doubles');
  assert.deepEqual(R.walls, [true, true, true]); assert.ok(R.doorPlaced && R.roof && R.porch, 'door, roof, porch'); assert.ok(!R.noWood, 'needs wood');
  assert.ok(R.northStop > .1, 'wall stops the rider'); assert.ok(R.outDoor > 0, 'out through the door'); assert.ok(!R.zombieInside && R.zombieZ < -1.8 && R.zombieD < 4.5, 'zombies stay out');
  assert.ok(R.removed && R.refund === 1 && R.after, 'remove refunds half'); assert.ok(R.saved >= 6 && R.savedWood > 0, 'saved'); assert.ok(R.reloaded >= 6, 'persists across reloads');
  assert.equal(R.hostAdd, 1); assert.equal(R.hostNo, 1); assert.ok(R.notTheirs, "can't remove someone else's"); assert.equal(R.owner, 'P2');
  assert.ok(!R.loopErr && !errors.length, (R.loopErr || '') + errors.join('\n')); console.log('HORSE BUILD OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
