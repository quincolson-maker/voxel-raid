// Original solo survival mode. Shared low-poly geometry, bounded actor/drop pools.
import * as THREE from 'three';
import { mat, makeGun, WEAPONS } from './models.js';
const $ = id => document.getElementById(id);
const geo = new THREE.BoxGeometry(1, 1, 1);
function cube(parent, size, pos, material) { const m = new THREE.Mesh(geo, material); m.scale.set(...size); m.position.set(...pos); parent.add(m); m.castShadow = true; m.receiveShadow = true; return m; }
function label(parent, text, color, y = 3.5) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#0b1019'; x.fillRect(0, 0, 512, 128); x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(3, 3, 506, 122);
  x.fillStyle = color; x.font = 'bold 31px sans-serif'; x.textAlign = 'center'; x.fillText(text, 256, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false, toneMapped: false })); s.position.y = y; s.scale.set(4, 1, 1); parent.add(s);
}
function zombieModel() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(0x8a9c79), cloth = mat(0x4b5555), wound = mat(0x62352f), eye = mat(0xff9933, { e: 0xff6611, ei: 3 });
  cube(body, [.48, .6, .29], [0, 1.17, 0], cloth); cube(body, [.27, .29, .26], [0, 1.69, 0], skin);
  cube(body, [.22, .08, .02], [0, 1.59, -.14], wound);
  for (const x of [-.075, .075]) cube(body, [.045, .04, .025], [x, 1.73, -.145], eye);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * .31, 1.4, 0); body.add(a); cube(a, [.12, .55, .12], [0, -.24, 0], skin); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * .13, .87, 0); body.add(l); cube(l, [.18, .79, .19], [0, -.4, 0], cloth); legs.push(l);
  }
  root.userData = { body, arms, legs }; return root;
}
export function createZombies(ctx) {
  const { G, P, scene, GX, sfx, fx, setB, get, solid, buildChunk, dirty, astar, rebuildGrid, costD, hurt, msg, equip } = ctx;
  const Z = { round: 0, points: 500, earned: 0, kills: 0, heads: 0, pending: 0, spawnT: 0, breakT: 6, lastHurt: -99, maxHP: 100, perks: {}, timers: {}, stations: [], drops: [], pool: [], opened: false, best: Number(localStorage.getItem('vr_zombies_best')) || 0 };
  const cap = ctx.mobile ? 16 : 28;
  const active = () => G.units.filter(u => u.hp > 0);
  function bounds(x, z) { return x >= 28 && x < (Z.opened ? 68 : 52) && z >= 28 && z < 68; }
  function wall(x, z) { for (let y = 1; y < 5; y++) setB(x, y, z, 3); }
  function station(kind, name, cost, x, z, color, gun) {
    const m = new THREE.Group(); m.position.set(x, 1, z); scene.add(m);
    cube(m, [1.5, 2.3, .8], [0, 1.15, 0], mat(color, { m: .4 }));
    cube(m, [1.2, .5, .83], [0, 1.7, 0], mat(color, { e: color, ei: .8 }));
    if (gun) { const w = makeGun(gun); w.scale.setScalar(1.8); w.position.set(0, 1.2, -.6); w.rotation.y = Math.PI / 2; m.add(w); }
    label(m, name + ' · ' + cost, '#' + color.toString(16).padStart(6, '0'));
    Z.stations.push({ kind, name, cost, x, z, m, gun });
  }
  function init() {
    G.phase = 'zbreak'; G.shield = false; P.team = 'def'; P.hp = 100; P.dead = 0;
    P.spawn.set(40, 1, 52); P.pos.copy(P.spawn); P.yaw = 0;
    P.slots = ['pistol', 'pistol']; P.ammoOf = {}; P.reserve = { pistol: 90 }; P.w = -1; equip(0);
    document.body.classList.add('zombie-mode'); $('zHud').hidden = false;
    $('tBuild').textContent = 'USE'; $('tPiece').style.display = $('tMat').style.display = 'none';
    for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) setB(x, 0, z, 1);
    for (let x = 27; x <= 68; x++) { wall(x, 27); wall(x, 68); }
    for (let z = 28; z < 68; z++) { wall(27, z); wall(68, z); if (z < 46 || z > 50) wall(52, z); }
    for (let z = 46; z <= 50; z++) for (let y = 1; y <= 4; y++) setB(52, y, z, 4);
    // Floor and cracked floor markings; all collision remains in the voxel grid.
    cube(scene, [42, .12, 42], [48, .94, 48], new THREE.MeshStandardMaterial({ map: ctx.PBRS.concrete.map, color: 0x67716b, roughness: .9 }));
    for (let z = 32; z < 66; z += 8) for (const x of [30, 49, 65]) cube(scene, [.12, .02, 3], [x, 1.01, z], mat(0x9c8b42));
    // Low, vaultable cover rather than camping-proof high platforms.
    for (const [x, z] of [[36, 39], [44, 59], [60, 38], [60, 59]]) for (let a = 0; a < 3; a++) setB(x + a, 1, z, 8);
    station('weapon', 'CARBINE', 500, 30, 48, 0x80c9ee, 'carbine');
    station('weapon', 'SHOTGUN', 750, 38, 30, 0xe4ad61, 'shotgun');
    station('ammo', 'AMMO CACHE', 350, 46, 65, 0x8ad8a5);
    station('door', 'OPEN EAST WING', 1000, 50, 48, 0xe1bf62);
    station('box', 'MYSTERY BOX', 950, 64, 48, 0xbc8bdf);
    station('health', 'IRON HEART', 2000, 58, 65, 0xe86c64);
    station('reload', 'QUICK HANDS', 1500, 58, 30, 0x73c4e8);
    const title = new THREE.Group(); title.position.set(40, 1, 28); scene.add(title); label(title, 'DEAD SIGNAL / OUTPOST 07', '#df8c70', 5);
    for (const x of [31, 49, 64]) for (const z of [32, 63]) {
      cube(scene, [.12, 4, .12], [x, 3, z], mat(0x272d33)); cube(scene, [.45, .12, .45], [x, 5, z], mat(0xffaa66, { e: 0xffaa66, ei: 3 }));
    }
    if (!ctx.mobile) { for (const x of [34, 61]) { const l = new THREE.PointLight(0xffaa70, 16, 24, 2); l.position.set(x, 4, 48); scene.add(l); } }
    GX.setLighting('night', false); scene.background = new THREE.Color(0x0c1721); scene.fog.color.set(0x15242b); scene.fog.density = .027;
    // HDRI may finish loading after a quick menu selection: keep the sky dark.
    scene.userData.zombieNight = true;
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) buildChunk(a, b); dirty.clear(); rebuildGrid();
    msg('DEAD SIGNAL — survive. E / USE to buy supplies.', 5);
  }
  function award(n) { n *= Z.timers.double > 0 ? 2 : 1; Z.points += n; Z.earned += n; }
  function nextRound() { Z.round++; Z.pending = 5 + Z.round * 3; Z.spawnT = 0; G.phase = 'zombies'; msg('ROUND ' + Z.round + (Z.round % 5 === 0 ? ' — BRUTE INCOMING' : ''), 3); sfx.horn(); }
  function spawn() {
    let u = Z.pool.pop();
    if (!u) { const m = zombieModel(); u = { m, pos: new THREE.Vector3(), d: {}, team: 'att', zombie: true }; }
    const brute = Z.round % 5 === 0 && Z.pending === 5 + Z.round * 3;
    u.kind = brute ? 'brute' : Z.round >= 3 && Z.pending % 4 === 0 ? 'runner' : 'walker';
    u.d = { n: u.kind.toUpperCase(), s: brute ? 1.4 : 1, spd: Math.min(4.4, 1 + Z.round * .12) * (u.kind === 'runner' ? 1.6 : brute ? .7 : 1) };
    u.hp = (65 + Z.round * 23) * (brute ? 4 : 1); u.deadT = 0; u.flinch = 0; u.cd = 1; u.repath = Math.random(); u.path = null; u.pi = 0; u.groan = 2 + Math.random() * 8; u.age = Math.random() * 6;
    let x, z; for (let i = 0; i < 40; i++) { x = 29.5 + Math.random() * (Z.opened ? 36 : 20); z = 29.5 + Math.random() * 36; if (!solid(x, 1, z) && Math.hypot(x - P.pos.x, z - P.pos.z) > 14) break; }
    u.pos.set(x, 1, z); u.m.position.copy(u.pos); u.m.scale.setScalar(u.d.s); const r = u.m.userData; r.body.rotation.set(0, 0, 0); r.body.position.set(0, 0, 0); scene.add(u.m); G.units.push(u); Z.pending--;
  }
  function kill(u, head = false, drop = true) {
    if (u.deadT) return; u.hp = 0; u.deadT = 1.6; Z.kills++; if (head) Z.heads++; award(head ? 100 : 60);
    if (drop && Math.random() < .12 && Z.drops.length < 4) dropPower(u.pos);
  }
  function damage(u, amount, head) { award(10); u.flinch = .22; u.hp -= Z.timers.insta > 0 ? 1e9 : amount * (head ? 1.5 : 1); if (u.hp <= 0) kill(u, head); }
  const powerNames = { ammo: 'MAX AMMO', insta: 'INSTA-KILL', double: 'DOUBLE POINTS', nuke: 'NUKE' };
  function dropPower(pos, kind) { kind ||= Object.keys(powerNames)[Math.floor(Math.random() * 4)]; const m = new THREE.Group(); m.position.copy(pos); cube(m, [.55, .55, .55], [0, .5, 0], mat(0x91ff8c, { e: 0x54ff64, ei: 1.5 })); label(m, powerNames[kind], '#aaffaa', 1.4); scene.add(m); Z.drops.push({ m, kind, life: 24 }); }
  function refill() { for (const k of P.slots) { P.ammoOf[k] = WEAPONS[k].mag; P.reserve[k] = WEAPONS[k].mag * 5; } P.ammo = P.mag; P.reload = 0; }
  function power(kind) { msg(powerNames[kind], 3); sfx.horn(); if (kind === 'ammo') refill(); else if (kind === 'nuke') { for (const u of active()) kill(u, false, false); fx.explosion(P.pos.clone().setY(3), 3); sfx.boom(.7); } else Z.timers[kind] = 30; }
  function nearest() { let best, dist = 3.4; for (const s of Z.stations) { if (s.used || (!Z.opened && s.x > 52)) continue; const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z); if (d < dist) { best = s; dist = d; } } return best; }
  function buy() {
    if (G.over) return false; const s = nearest(); if (!s) { msg('Approach a glowing supply station', 1.5); return false; }
    if (Z.points < s.cost) { msg('Need ' + s.cost + ' points', 1.5); return false; }
    if ((s.kind === 'health' || s.kind === 'reload') && Z.perks[s.kind]) { msg('Perk already active', 1); return false; }
    Z.points -= s.cost;
    if (s.kind === 'door') { Z.opened = true; s.used = true; s.m.visible = false; for (let z = 46; z <= 50; z++) for (let y = 1; y <= 4; y++) setB(52, y, z, 0); rebuildGrid(); }
    else if (s.kind === 'weapon' || s.kind === 'box') {
      const gun = s.gun || ['carbine', 'smg9', 'shotgun', 'dmr', 'lmg'][Math.floor(Math.random() * 5)];
      let slot = P.slots.indexOf(gun); if (slot < 0) { slot = P.w; P.slots[slot] = gun; }
      P.ammoOf[gun] = WEAPONS[gun].mag; P.reserve[gun] = WEAPONS[gun].mag * 5; P.w = -1; equip(slot); msg(WEAPONS[gun].name + ' acquired!', 2);
    } else if (s.kind === 'ammo') refill();
    else { Z.perks[s.kind] = true; if (s.kind === 'health') { Z.maxHP = 180; P.hp = 180; } }
    sfx.ui(); return true;
  }
  function over() {
    G.over = true; G.phase = 'over'; P.dead = 999; if (document.pointerLockElement) document.exitPointerLock();
    const survived = Math.max(0, Z.round - 1); Z.best = Math.max(Z.best, survived); localStorage.setItem('vr_zombies_best', Z.best);
    $('end').style.display = ''; $('endT').textContent = 'SIGNAL LOST';
    $('endS').textContent = `Rounds survived: ${survived} · Reached round ${Z.round}\nKills: ${Z.kills} · Headshots: ${Z.heads}\nPoints earned: ${Z.earned} · Unspent: ${Z.points}\nBest survival: ${Z.best} rounds`;
  }
  function tick(dt) {
    if (G.over) return;
    for (const k in Z.timers) Z.timers[k] = Math.max(0, Z.timers[k] - dt);
    if (P.hp <= 0) { over(); return; }
    if (G.t - Z.lastHurt > 5) P.hp = Math.min(Z.maxHP, P.hp + dt * 12);
    const live = active(); if (!Z.pending && !live.length) { if (G.phase !== 'zbreak') { G.phase = 'zbreak'; Z.breakT = 9; msg('ROUND CLEARED — resupply', 3); } }
    if (G.phase === 'zbreak' || !Z.round) { Z.breakT -= dt; if (Z.breakT <= 0) nextRound(); }
    else { Z.spawnT -= dt; if (Z.pending && live.length < cap && G.units.length < cap + 6 && Z.spawnT <= 0) { spawn(); Z.spawnT = Math.max(.35, 1.2 - Z.round * .04); } }
    G.units = G.units.filter(u => {
      const r = u.m.userData;
      if (u.hp <= 0) { u.deadT -= dt; r.body.rotation.x = Math.min(1.55, r.body.rotation.x + dt * 3); r.body.position.y = Math.max(-.5, r.body.position.y - dt * .5); if (u.deadT <= 0) { scene.remove(u.m); Z.pool.push(u); return false; } return true; }
      u.cd -= dt; u.repath -= dt; u.flinch = Math.max(0, u.flinch - dt); u.groan -= dt;
      if (u.groan <= 0) { u.groan = 5 + Math.random() * 8; sfx.at(u.pos, () => sfx.groan()); }
      const dist = u.pos.distanceTo(P.pos); const dx = P.pos.x - u.pos.x, dz = P.pos.z - u.pos.z;
      u.m.rotation.y = Math.atan2(-dx, -dz);
      if (Math.hypot(dx, dz) < 1.45 * u.d.s && Math.abs(P.pos.y - u.pos.y) < 2.4 && u.cd <= 0) { u.cd = 1.05; Z.lastHurt = G.t; hurt(P, u.kind === 'brute' ? 45 : 24); }
      if (dist > 1.15 && !u.flinch) {
        if (u.repath <= 0) { u.path = astar(u.pos.x, u.pos.z, P.pos.x, P.pos.z, costD, 0); u.pi = 0; u.repath = 1.8 + Math.random(); }
        let tx = P.pos.x, tz = P.pos.z; if (u.path?.length && u.pi < u.path.length) { [tx, tz] = u.path[u.pi]; if (Math.hypot(tx - u.pos.x, tz - u.pos.z) < .45) u.pi++; }
        const len = Math.hypot(tx - u.pos.x, tz - u.pos.z) || 1, speed = u.d.spd * dt;
        const nx = u.pos.x + (tx - u.pos.x) / len * speed, nz = u.pos.z + (tz - u.pos.z) / len * speed;
        if (bounds(nx, u.pos.z) && !solid(nx, 1, u.pos.z) && !solid(nx, 2, u.pos.z)) u.pos.x = nx;
        if (bounds(u.pos.x, nz) && !solid(u.pos.x, 1, nz) && !solid(u.pos.x, 2, nz)) u.pos.z = nz;
        for (const o of live) if (o !== u) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, dd = Math.hypot(dx, dz); if (dd > .001 && dd < .6) { const x = u.pos.x + dx / dd * dt, z = u.pos.z + dz / dd * dt; if (bounds(x,z) && !solid(x,1,z)) { u.pos.x = x; u.pos.z = z; } } }
      }
      u.age += dt * (u.kind === 'runner' ? 10 : 5); r.body.rotation.x = .14 - u.flinch * 1.2; r.body.rotation.z = Math.sin(u.age) * .065;
      r.arms.forEach((a,i) => a.rotation.x = -1.15 + Math.sin(u.age + i) * .18 - (u.cd > .8 ? .6 : 0));
      r.legs.forEach((l,i) => l.rotation.x = Math.sin(u.age + i * Math.PI) * .4); u.m.position.copy(u.pos); return true;
    });
    Z.drops = Z.drops.filter(d => { d.life -= dt; d.m.rotation.y += dt; if (d.m.position.distanceTo(P.pos) < 1.8) { power(d.kind); d.life = 0; } if (d.life <= 0) { scene.remove(d.m); d.m.traverse(o => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); return false; } return true; });
    if (P.hp <= 0) over();
  }
  function hud() {
    $('mode').textContent = 'DEAD SIGNAL'; $('timer').textContent = G.phase === 'zbreak' || !Z.round ? 'Next: ' + Math.ceil(Z.breakT) : 'ENDLESS'; $('stars').textContent = '';
    $('sub').textContent = `${active().length + Z.pending} hostiles remaining · ${Z.kills} kills · ${Z.heads} headshots`;
    $('dbar').style.width = '0'; $('hp').style.width = Math.max(0,P.hp / Z.maxHP * 100) + '%';
    $('ammo').textContent = WEAPONS[P.slots[P.w]].name + '  ' + (P.reload > 0 ? 'Reloading…' : `${P.ammo} / ${P.reserve[P.slots[P.w]] || 0}`);
    $('res').textContent = `${Math.ceil(P.hp)} HP · ${Z.perks.health ? 'IRON HEART · ' : ''}${Z.perks.reload ? 'QUICK HANDS' : ''}`;
    $('right').textContent = `${Z.points} POINTS\nBest: ${Z.best} rounds`; $('hotbar').textContent = '';
    $('zRound').textContent = Z.round <= 4 ? 'Ⅰ'.repeat(Z.round) || '—' : Z.round;
    $('zPowers').textContent = Object.entries(Z.timers).filter(([,v]) => v > 0).map(([k,v]) => powerNames[k] + ' ' + Math.ceil(v) + 's').join(' · ');
    const s = nearest(); $('zUse').textContent = s ? `[E / USE] ${s.name} — ${s.cost} pts` : 'E / USE: buy at glowing stations';
    $('tSkip').style.display = 'none';
  }
  return { state: Z, init, tick, hud, damage, buy, over, refill, power, dropPower, kill, nextRound };
}
