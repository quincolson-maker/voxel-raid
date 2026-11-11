// Run: node tests/horse-zombies.cjs [base URL]. HORSE RIDER zombies (desktop + phone): the dead spawn at the foot of the
// mountains (map edge) and walk in towards the player, capped (6 on phones); all three guns kill them with real input
// (six-shooter headshot, lever-rifle body shots, Buffalo rifle through the scope), they hurt a player caught outside,
// and the horse pen is a safe zone: a crowd around it (gate included) never gets inside, the fence is never changed and
// the player / horse inside take no damage. Saves shot-horserider-zombies-*.png.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 180000, args });
  const out = {};
  try { for (const mobile of (process.env.ONLY ? [process.env.ONLY === 'mobile'] : [false, true])) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&q=low' + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0' });
    if (mobile) await p.tap('#horseBtn'); else await p.click('#horseBtn');
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.horses.length >= 4 && __horse.guns && __horse.state.zombies, { timeout: 20000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 90000 });
    const G = (f, a) => p.evaluate(f, a);
    const frames = async n => { const u = await G(() => __horse.guns.state.upd || 0); await p.waitForFunction(m => (__horse.guns.state.upd || 0) >= m, { timeout: 90000 }, u + n); };
    const fire = async () => { if (mobile) await p.tap('#tFire'); else { await p.mouse.down({ button: 'left' }); await sleep(80); await p.mouse.up({ button: 'left' }); } };
    // --- spawning at the mountains, heading in, capped ---
    R.spawn = await G(() => { const Z = __horse.state.zombies, S = Z.state, H = __horse.state; for (const o of H.horses) { o.tgt = null; o.wait = 1e9; }
      Z.clear(); __P.pos.set(40, __horse.hAt(40, 60), 60); S.spawnT = 0; let n = 0; for (let i = 0; i < 400 && Z.list.length < 4; i++) __sim(.25);
      const at = Z.list.map(o => o.from), edge = Math.min(...at.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))));
      const d0 = Z.list.map(o => Math.hypot(o.pos.x - __P.pos.x, o.pos.z - __P.pos.z)); __sim(12); const d1 = Z.list.map(o => Math.hypot(o.pos.x - __P.pos.x, o.pos.z - __P.pos.z));
      S.spawnT = 0; for (let i = 0; i < 200; i++) { S.spawnT = 0; __sim(.25); }
      return { n: at.length, at, minEdge: +edge.toFixed(1), closer: d1.slice(0, d0.length).every((d, i) => d < d0[i] - 20), d0: d0.map(Math.round), d1: d1.map(Math.round), cap: S.cap, alive: Z.list.filter(o => o.alive).length, kinds: [...new Set(Z.list.map(o => o.kind))] }; });
    assert.ok(R.spawn.n >= 4 && R.spawn.minEdge > 330, 'zombies spawn at the map edge (foot of the mountains)');
    assert.ok(R.spawn.closer, 'they come in towards the player');
    assert.equal(R.spawn.cap, mobile ? 6 : 14); assert.ok(R.spawn.alive <= R.spawn.cap, 'capped');
    // --- the pen: indestructible safe zone ---
    R.pen = await G(() => { const Z = __horse.state.zombies, S = Z.state, H = __horse.state, PEN = __horse.PEN; Z.clear(); S.spawnT = 1e9; S.hp = 100; S.dead = 0; S.hurtT = -99;
      const fence = JSON.stringify(H.fence), inside = H.horses.find(o => Math.abs(o.pos.x - PEN.x) < PEN.hw - 1 && Math.abs(o.pos.z - PEN.z) < PEN.hd - 1);
      if (inside) inside.hp = 160; __P.pos.set(PEN.x + 2, __horse.hAt(PEN.x + 2, PEN.z + 1), PEN.z + 1);
      const starts = [[0, PEN.hd + 8], [-2, PEN.hd + 12], [2, PEN.hd + 16], [PEN.hw + 8, 0], [-PEN.hw - 8, 3], [0, -PEN.hd - 10], [PEN.hw + 6, PEN.hd + 6], [-PEN.hw - 6, -PEN.hd - 6], [1, PEN.hd + 22], [-PEN.hw - 15, PEN.hd + 2]];
      for (const [i, [x, z]] of starts.entries()) Z.spawn(i % 3 === 1 ? 'runner' : i === 5 ? 'brute' : 'walker', [PEN.x + x, PEN.z + z]);
      let maxIn = 0, worst = null; for (let i = 0; i < 160; i++) { __sim(.25); for (const o of Z.list) if (o.alive) { const ix = PEN.hw - Math.abs(o.pos.x - PEN.x), iz = PEN.hd - Math.abs(o.pos.z - PEN.z), pen = Math.min(ix, iz); if (pen > maxIn) { maxIn = pen; worst = [o.kind, +o.pos.x.toFixed(2), +o.pos.z.toFixed(2)]; } } }
      const near = Z.list.filter(o => o.alive && Math.abs(o.pos.x - PEN.x) < PEN.hw + 4 && Math.abs(o.pos.z - PEN.z) < PEN.hd + 4).length;
      const gate = Z.list.filter(o => o.alive && Math.abs(o.pos.x - PEN.x) < PEN.gate + 1.5 && o.pos.z > PEN.z + PEN.hd && o.pos.z < PEN.z + PEN.hd + 4).length;
      return { n: Z.list.length, maxInside: +maxIn.toFixed(2), worst, near, atGate: gate, fenceSame: JSON.stringify(H.fence) === fence, hp: Math.round(S.hp), deaths: S.deaths, horseHp: inside ? Math.round(inside.hp) : null }; });
    assert.ok(R.pen.maxInside <= 0, 'no zombie ever gets inside the pen (gate included)'); assert.ok(R.pen.fenceSame, 'the fence and gate are never changed');
    assert.ok(R.pen.near >= 6, 'the dead crowd around the pen'); assert.equal(R.pen.hp, 100, 'the player inside is safe'); assert.equal(R.pen.deaths, 0);
    if (R.pen.horseHp != null) assert.equal(R.pen.horseHp, 160, 'a horse inside the pen is safe');
    // screenshots: the crowd at the pen from inside, and the dead coming across the meadow
    await G(() => { const PEN = __horse.PEN, L = __horse.state.zombies.list.filter(o => o.alive), x = PEN.x, z = PEN.z + 3; __P.pos.set(x, __horse.hAt(x, z), z); let bx = 0, bz = 0, bn = -1; for (const a of L) { const n = L.filter(b => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < 8).length; if (n > bn) { bn = n; bx = a.pos.x; bz = a.pos.z; } } const px = Math.max(PEN.x - PEN.hw + 1.2, Math.min(PEN.x + PEN.hw - 1.2, bx)) * .75 + PEN.x * .25, pz = Math.max(PEN.z - PEN.hd + 1.2, Math.min(PEN.z + PEN.hd - 1.2, bz)) * .75 + PEN.z * .25; __P.pos.set(px, __horse.hAt(px, pz), pz); __P.yaw = Math.atan2(-(bx - px), -(bz - pz)); __P.pitch = -.12; __horse.state.bodyYaw = __P.yaw; }); await frames(6); await sleep(500);
    await p.screenshot({ path: `shot-horserider-zombies-pen-${tag}.png` });
    await G(() => { const Z = __horse.state.zombies; Z.clear(); const x = 0, z = 40; __P.pos.set(x, __horse.hAt(x, z), z); __P.yaw = Math.PI; __P.pitch = -.02; __horse.state.bodyYaw = Math.PI;
      [['walker', -2, 5], ['runner', 2, 8], ['walker', 3.5, 4], ['brute', -4, 10], ['walker', 0, 16]].forEach(([k, dx, dz]) => { const o = Z.spawn(k, [x + dx, z + dz]); o.hold = true; o.yaw = 0; }); });
    if (mobile) { await p.tap('#tGun'); await p.waitForFunction(() => __horse.guns.state.weapon, { timeout: 5000 }); } else await p.keyboard.press('Digit2');
    await frames(10); await sleep(500); await p.screenshot({ path: `shot-horserider-zombies-${tag}.png` });
    await G(() => { __horse.guns.holster(); const Z = __horse.state.zombies; Z.clear(); });
    // --- the guns: south meadow, player at z=40 facing +z ---
    await G(() => { const Z = __horse.state.zombies; Z.clear(); Z.state.spawnT = 1e9; __P.pos.set(0, __horse.hAt(0, 40), 40); __P.yaw = Math.PI; __P.pitch = 0; });
    const shoot = async (w, kind, dist, part, n) => {
      const id = await G(([kind, dist]) => { const Z = __horse.state.zombies, o = Z.spawn(kind, [.3, 40 + dist]); o.hold = true; o.yaw = 0; return o.id; }, [kind, dist]);
      await frames(4); const res = [];
      for (let i = 0; i < n; i++) {
        await G(([id, part]) => { const Z = __horse.state.zombies, o = Z.list.find(q => q.id === id); const pt = part === 'head' ? Z.headPos(o, o.pos.clone()) : o.pos.clone().setY(o.pos.y + 1.1 * o.K.s); __horse.guns.aimAt(pt, __horse.syncCamera); }, [id, part]);
        await frames(2); const s0 = await G(() => __horse.guns.state.shots); await fire();
        await p.waitForFunction(n => __horse.guns.state.shots > n, { timeout: 90000 }, s0);
        await p.waitForFunction(() => __horse.guns.state.lastHit && __horse.guns.state.lastHit.weapon && (__horse.guns.state.lastHit._seen = (__horse.guns.state.lastHit._seen || 0) + 1) < 2 && __horse.guns.state.lastHit.kind, { timeout: 90000 });
        res.push(await G(id => { const h = __horse.guns.state.lastHit, o = __horse.state.zombies.list.find(q => q.id === id); return { kind: h.kind, target: h.target, head: h.head, w: h.weapon, zr: h.zr, hp: o ? Math.round(o.hp) : null, alive: o ? o.alive : false }; }, id));
        if (i < n - 1) await p.waitForFunction(() => __horse.guns.state.cocked !== false && !__horse.guns.state.cycling, { timeout: 90000 }).catch(() => {}), await frames(6);
      }
      return res; };
    // six-shooter: one headshot drops a walker
    if (mobile) await p.tap('#tGun'); else { await p.mouse.move(640, 420); await p.keyboard.press('Digit1'); }
    await p.waitForFunction(() => __horse.guns.state.weapon === 'revolver', { timeout: 5000 }); await frames(8);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.aimK > .9, { timeout: 90000 });
    R.revolver = await shoot('revolver', 'walker', 14, 'head', 1);
    assert.ok(R.revolver[0].kind === 'zombie' && R.revolver[0].head && !R.revolver[0].alive, 'six-shooter headshot kills a walker');
    await p.screenshot({ path: `shot-horserider-zombies-headshot-${tag}.png` });
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    // lever rifle: two body shots on a walker (70 + 70 > 100)
    if (mobile) await p.tap('#tGun'); else await p.keyboard.press('Digit2');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'rifle', { timeout: 5000 }); await frames(8);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.aimK > .9, { timeout: 90000 });
    R.rifle = await shoot('rifle', 'walker', 18, 'body', 2);
    assert.ok(R.rifle[0].kind === 'zombie' && !R.rifle[0].head && R.rifle[0].alive && R.rifle[0].hp === 30, 'rifle body shot: 70 damage');
    assert.ok(R.rifle[1].kind === 'zombie' && !R.rifle[1].alive, 'second rifle body shot kills');
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    // Buffalo rifle through the scope: a headshot drops a brute (320 hp)
    if (mobile) await p.tap('#tGun'); else await p.keyboard.press('Digit3');
    await p.waitForFunction(() => __horse.guns.state.weapon === 'sniper', { timeout: 5000 }); await frames(8);
    if (mobile) await p.tap('#tAds'); else await p.mouse.down({ button: 'right' });
    await p.waitForFunction(() => __horse.guns.state.scopeK > .95, { timeout: 90000 });
    R.sniper = await shoot('sniper', 'brute', 45, 'head', 1);
    assert.ok(R.sniper[0].kind === 'zombie' && R.sniper[0].target === 'brute' && R.sniper[0].head && !R.sniper[0].alive, 'Buffalo rifle headshot kills a brute');
    R.kills = await G(() => ({ kills: __horse.state.zombies.state.kills, heads: __horse.state.zombies.state.heads })); assert.ok(R.kills.kills >= 3 && R.kills.heads >= 2);
    if (mobile) await p.tap('#tAds'); else await p.mouse.up({ button: 'right' });
    if (mobile) await p.tap('#tGun'); else await p.keyboard.press('Digit3'); // holster (phones: cycle past the buffalo rifle)
    // --- zombies hurt a player caught outside ---
    R.hurt = await G(() => { const Z = __horse.state.zombies, S = Z.state; Z.clear(); S.hp = 100; const x = 30, z = 70; __P.pos.set(x, __horse.hAt(x, z), z); Z.spawn('walker', [x + 1, z]); __sim(3); return { hp: Math.round(S.hp), dead: S.dead > 0 }; });
    assert.ok(R.hurt.hp < 100, 'a zombie hurts a player on foot');
    R.hud = await G(() => { const e = document.getElementById('hrZ'); return e && getComputedStyle(e).display !== 'none' ? e.textContent : null; }); assert.ok(R.hud && /WAVE/.test(R.hud), 'zombie HUD');
    R.errors = errors; assert.deepEqual(errors, []);
    await p.close();
  } console.log(JSON.stringify(out, null, 1)); console.log('HORSE ZOMBIES OK');
  } catch (e) { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exitCode = 1; } finally { await br.close(); }
})();
