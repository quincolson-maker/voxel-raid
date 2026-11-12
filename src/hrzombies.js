// HORSE RIDER zombies: the dead come down out of the mountains at the edge of the map and head for the riders.
// Reused from the zombies mode: the walker / runner / brute kinds and their roles, groans, damage numbers and the
// host-authoritative co-op pattern (host simulates, clients mirror snapshots and send their hits to the host).
// New here: they are the game's rigged person (CC0 rider) re-dressed as the walking dead (tinted, hunched, arms out),
// they travel fast across open country and slow to their kind's pace near players, steer around trees / rocks, and
// the HORSE PEN is a safe zone: it is indestructible (nothing here ever damages the fence or gate) and no zombie may
// stand inside it, the gate gap included; they walk around it and crowd at the rails. Guns kill them (headshots x2.4).
import * as THREE from 'three';

export const ZKINDS = {
  walker: { hp: 100, spd: 1.35, dmg: 12, cd: 1.2, s: 1, reach: 1.25 },
  runner: { hp: 70, spd: 4.3, dmg: 9, cd: .9, s: .97, reach: 1.2 },
  brute: { hp: 320, spd: 1.15, dmg: 28, cd: 1.6, s: 1.28, reach: 1.5 },
};
export const ZSET = { travel: 6, near: 90, capDesktop: 42, capPhone: 18, startDelay: 10, waveSecs: 75, playerHp: 100, horseHp: 160, regenDelay: 5, regen: 7, respawn: 4,
  dmg: { revolver: 50, rifle: 70, sniper: 260, tommy: 34, gold: 650 }, head: 2.4, penMargin: 1.1 };
const KIND_LIST = ['walker', 'runner', 'brute'];

export function createHrZombies(c) {
  const { scene, H, P, hAt, PEN, EDGE, sfx, fx, mobile } = c, WALK = c.WALK || EDGE;
  const Q = new URLSearchParams(location.search);
  const Z = { on: Q.get('zombies') !== '0', list: [], wave: 1, waveT: 0, spawnT: ZSET.startDelay, nextId: 1, kills: 0, heads: 0, cap: mobile ? ZSET.capPhone : ZSET.capDesktop,
    hp: ZSET.playerHp, hurtT: -99, dead: 0, deaths: 0, flash: 0, t: 0, snapT: 0, role: c.role || (() => 'solo') };
  const pool = { walker: [], runner: [], brute: [] }, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const rnd = Math.random;
  // pen rectangle the dead may never enter (fence + gate gap + a little margin)
  const RX = PEN.hw + ZSET.penMargin, RZ = PEN.hd + ZSET.penMargin;
  const inPenRect = (x, z, m = 0) => Math.abs(x - PEN.x) < RX + m && Math.abs(z - PEN.z) < RZ + m;
  const inTown = (x, z, m = 0) => { for (const q of (H.safeRects || [])) if (Math.abs(x - q.x) < q.hw + m && Math.abs(z - q.z) < q.hd + m) return q; return null; }; // v33: the town is a safe zone too
  const inPenSafe = (x, z) => (Math.abs(x - PEN.x) < PEN.hw + .2 && Math.abs(z - PEN.z) < PEN.hd + .4) || !!inTown(x, z); // targets standing inside are out of reach
  const inSafeZone = (x, z) => inTown(x, z) ? 'town' : Math.abs(x - PEN.x) < PEN.hw + .2 && Math.abs(z - PEN.z) < PEN.hd + .4 ? 'pen' : '';
  function pushOutOfPen(p) { const q = inTown(p.x, p.z, .6); if (q) { const dx = p.x - q.x, dz = p.z - q.z, ox = q.hw + .6 - Math.abs(dx), oz = q.hd + .6 - Math.abs(dz); if (ox < oz) p.x = q.x + Math.sign(dx || 1) * (q.hw + .61); else p.z = q.z + Math.sign(dz || 1) * (q.hd + .61); return true; } // they turn away at the town's edge
    if (!inPenRect(p.x, p.z)) return false; const dx = p.x - PEN.x, dz = p.z - PEN.z, ox = RX - Math.abs(dx), oz = RZ - Math.abs(dz);
    if (ox < oz) p.x = PEN.x + Math.sign(dx || 1) * (RX + .01); else p.z = PEN.z + Math.sign(dz || 1) * (RZ + .01); return true; }
  function segHitsPen(ax, az, bx, bz) { // does the straight walk from a to b cross the pen rectangle?
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5); for (let i = 1; i < n; i++) { const t = i / n; if (inPenRect(ax + (bx - ax) * t, az + (bz - az) * t, -.05)) return true; } return false; }
  function penDetour(z, tx, tz) { if (!segHitsPen(z.pos.x, z.pos.z, tx, tz)) return null; let best = null, bd = 1e9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = PEN.x + sx * (RX + 2.6), cz = PEN.z + sz * (RZ + 2.6); if (segHitsPen(z.pos.x, z.pos.z, cx, cz)) continue;
      const d = Math.hypot(cx - z.pos.x, cz - z.pos.z) + Math.hypot(tx - cx, tz - cz); if (d < bd) { bd = d; best = [cx, cz]; } } return best; }

  // ---- looks: the rigged person, re-dressed as the walking dead (shared tinted materials), or a simple stand-in ----
  const tints = new Map();
  function deadMat(m) { if (tints.has(m.uuid)) return tints.get(m.uuid); const d = m.clone(); if (d.color) d.color.multiply(new THREE.Color(.42, .56, .38)); if (d.emissive) d.emissive.setRGB(.025, .04, .02); d.roughness = Math.min(1, (d.roughness ?? .8) + .15); if ('metalness' in d) d.metalness = 0; tints.set(m.uuid, d); return d; }
  function standIn() { const g = new THREE.Group(), sk = new THREE.MeshStandardMaterial({ color: 0x7d8c6a, roughness: .9 }), cl = new THREE.MeshStandardMaterial({ color: 0x3f4640, roughness: .95 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    add(new THREE.CylinderGeometry(.2, .17, .62, 8), cl, 0, 1.2, 0); add(new THREE.SphereGeometry(.13, 10, 8), sk, 0, 1.65, .03); for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(.07, .06, .85, 6), cl, s * .1, .45, 0); const a = add(new THREE.CylinderGeometry(.05, .045, .6, 6), sk, s * .26, 1.38, .26); a.rotation.x = Math.PI / 2; }
    return { m: g, update() {}, stand: true }; }
  function makeBody(kind) { const P0 = pool[kind].pop(); if (P0) return P0;
    const W = c.walker && c.walker(); if (!W) return standIn();
    W.m.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(deadMat) : deadMat(o.material); o.frustumCulled = false; } }); return W; }

  // ---- spawning at the foot of the mountains ----
  function edgePoint(ang) { const dx = Math.cos(ang), dz = Math.sin(ang), k = (EDGE - 9) / Math.max(Math.abs(dx), Math.abs(dz)); return [dx * k, dz * k]; }
  function spawn(kind, at, id) {
    kind = ZKINDS[kind] ? kind : 'walker'; const K = ZKINDS[kind], B = makeBody(kind), g = new THREE.Group(); g.add(B.m); B.m.rotation.y = Math.PI; B.m.position.set(0, 0, 0); B.m.scale.setScalar(K.s); scene.add(g);
    let x, z; if (at) [x, z] = at; else if (!at && (() => { const ps = players(); return ps.length && ps.every(p => Math.max(Math.abs(p.x), Math.abs(p.z)) > EDGE - 20); })()) { // everyone is up in the mountains: they come down the slopes above you
      const ps = players(), q = ps[(rnd() * ps.length) | 0]; let best = null, bh = -1e9; for (let i = 0; i < 6; i++) { const a = rnd() * Math.PI * 2, d = 85 + rnd() * 45, px = Math.max(-WALK + 5, Math.min(WALK - 5, q.x + Math.cos(a) * d)), pz = Math.max(-WALK + 5, Math.min(WALK - 5, q.z + Math.sin(a) * d)), hh = hAt(px, pz); if (hh > bh) { bh = hh; best = [px, pz]; } } [x, z] = best; }
    else { const ps = players(); let best = null, bd = 1e9; for (let i = 0; i < 4; i++) { const p = edgePoint(rnd() * Math.PI * 2), q = ps[(rnd() * ps.length) | 0] || { x: 0, z: 0 }, d = Math.hypot(p[0] - q.x, p[1] - q.z); if (d < bd) { bd = d; best = p; } } [x, z] = best; }
    const o = { id: id || Z.nextId++, kind, K, B, g, pos: g.position, yaw: Math.atan2(x - PEN.x, z - PEN.z), hp: K.hp, alive: true, deadT: 0, cd: 1, st: 0, groanT: 2 + rnd() * 6, flinch: 0, sp: 0, born: Z.t, tgt: null, net: null, anim: rnd() * 6 };
    o.pos.set(x, hAt(x, z), z); o.from = [+x.toFixed(1), +z.toFixed(1)]; Z.list.push(o); return o; }
  function despawn(o) { scene.remove(o.g); o.g.remove(o.B.m); if (!o.B.stand) { o.B.m.rotation.set(0, Math.PI, 0); o.B.m.position.set(0, 0, 0); pool[o.kind].push(o.B); } Z.list.splice(Z.list.indexOf(o), 1); }
  const pickKind = () => { const w = Z.wave, r = rnd(); if (w >= 3 && r < Math.min(.15, .04 * w)) return 'brute'; if (w >= 2 && r < Math.min(.5, .12 * w)) return 'runner'; return 'walker'; };

  // ---- who they go for: players on foot or riding (their horse), loose horses outside the pen ----
  function players() { const out = []; if (!Z.dead) { const h = H.mounted; out.push({ id: H.me || 'P1', me: true, x: h ? h.pos.x : P.pos.x, y: h ? h.pos.y : P.pos.y, z: h ? h.pos.z : P.pos.z, horse: h || null }); }
    for (const r of (c.remotes ? c.remotes() : [])) if (r && r.s && !r.s.dd) { const h = r.s.m >= 0 ? H.horses[r.s.m] : null; out.push({ id: r.id, me: false, x: h ? h.pos.x : r.s.x, y: h ? h.pos.y : r.s.y, z: h ? h.pos.z : r.s.z, horse: h }); }
    return out; }
  function chooseTarget(o) { let best = null, bd = 1e9;
    for (const p of players()) { const up = (p.y ?? o.pos.y) - o.pos.y > 2.6, sf = inPenSafe(p.x, p.z) || up, d = Math.hypot(p.x - o.pos.x, p.z - o.pos.z) + (sf ? 40 : 0); if (d < bd) { bd = d; best = { kind: 'player', p, x: p.x, z: p.z, safe: sf, up }; } }
    for (const h of H.horses) { if (H.ridden && H.ridden.has(h)) continue; if (h === H.mounted || inPenSafe(h.pos.x, h.pos.z)) continue; const d = Math.hypot(h.pos.x - o.pos.x, h.pos.z - o.pos.z) * 1.3; if (d < bd) { bd = d; best = { kind: 'horse', h, x: h.pos.x, z: h.pos.z, safe: false }; } }
    return best; }

  // ---- damage to players and horses ----
  function hurtMe(d, horseD) {
    if (Z.dead > 0) return; const h = H.mounted;
    if (h && horseD) { h.hp = (h.hp ?? ZSET.horseHp) - horseD; if (h.hp <= 0) horsePanic(h); }
    Z.hp -= d; Z.hurtT = Z.t; Z.flash = Math.min(1, Z.flash + d / 25); if (sfx.hurt && sfx.ctx) sfx.hurt();
    if (Z.hp <= 0) { Z.hp = 0; Z.dead = ZSET.respawn; Z.deaths++; if (H.mounted && c.dismount) c.dismount(); c.msg && c.msg('You were overrun — back at the pen in a moment', ZSET.respawn); } }
  function horsePanic(h) { h.hp = 0; h.panic = 8; if (h === H.mounted && c.dismount) { c.dismount(); c.msg && c.msg('Your horse bolted for the pen!', 2.5); }
    h.inPen = true; h.wait = 0; const gz = PEN.z + PEN.hd + 4, inside = [PEN.x + (rnd() - .5) * 6, PEN.z + (rnd() - .5) * 4]; // round to the gate (south side), then inside
    if (inPenSafe(h.pos.x, h.pos.z)) { h.tgt = inside; h.path = []; return; } const path = [];
    if (h.pos.z < PEN.z + PEN.hd + 1) path.push([PEN.x + Math.sign(h.pos.x - PEN.x || 1) * (PEN.hw + 4), gz]); path.push([PEN.x, gz], [PEN.x, PEN.z + PEN.hd - 2], inside); h.tgt = path.shift(); h.path = path; }
  function hurtHorse(h, d) { h.hp = (h.hp ?? ZSET.horseHp) - d; if (h.hp <= 0) horsePanic(h); if (sfx.at && sfx.ctx) sfx.at(h.pos, () => sfx.tone('sawtooth', 520, 260, .14, .35), .3); }

  // ---- shots (from hrguns): hit tests against the dead, then damage ----
  const HEAD = new THREE.Vector3();
  function headPos(o, out = HEAD) { const B = o.B.m.userData && o.B.m.userData.B; if (B && B.Head) { B.Head.getWorldPosition(out); out.y += .07 * o.K.s; } else out.set(o.pos.x, o.pos.y + 1.66 * o.K.s, o.pos.z); return out; }
  function rayHit(ro, d, maxT, rs, rc) { let best = null;
    for (const o of Z.list) { if (!o.alive) continue; if (Math.abs(o.pos.x - ro.x) > maxT + 2 || Math.abs(o.pos.z - ro.z) > maxT + 2) continue;
      const hp = headPos(o, tmp), th = rs(ro, d, hp, .15 * o.K.s); if (th > 0 && th < maxT && (!best || th < best.t)) best = { t: th, Z: o, head: true };
      const tb = rc(ro, d, o.pos.x, o.pos.z, .3 * o.K.s, o.pos.y, o.pos.y + 1.5 * o.K.s); if (tb > 0 && tb < maxT && (!best || tb < best.t - .05)) best = { t: tb, Z: o, head: false }; }
    return best; }
  function assistPoints() { const out = []; for (const o of Z.list) if (o.alive) { out.push({ c: headPos(o, new THREE.Vector3()), z: o }); out.push({ c: new THREE.Vector3(o.pos.x, o.pos.y + 1.15 * o.K.s, o.pos.z), z: o }); } return out; }
  function damage(o, dmg, head, p, dir, by, from) { if (!o || !o.alive) return false; o.hp -= dmg; o.flinch = Math.min(1, o.flinch + (head ? .8 : .45)); if (dir) o.push = [dir.x * (dmg > 150 ? 2.5 : .8), dir.z * (dmg > 150 ? 2.5 : .8)];
    if (o.hp <= 0) { kill(o, head, by); if (from && c.sendTo) { c.sendTo(from, { t: 'zk', h: head ? 1 : 0 }); c.creditRemote && c.creditRemote(from, head); } } return true; }
  function kill(o, head, by) { if (!o.alive) return; o.alive = false; o.hp = 0; o.st = 2; o.deadT = 0; o.fallDir = rnd() < .5 ? 1 : -1; if (by !== 'remote') { Z.kills++; if (head) Z.heads++; }
    if (sfx.at && sfx.ctx) sfx.at(o.pos, () => { sfx.tone('sawtooth', 120, 40, .22, .7); sfx.nz('lowpass', 300, 1, .25, .4); }, .3); }
  function onHit(o, w, head, p, dir, mul = 1) { // a local player's bullet hit this zombie
    const dmg = Math.round((ZSET.dmg[w] || 50) * (head ? ZSET.head : 1) * mul);
    if (fx) { fx.debris && fx.debris(p.x, p.y, p.z, 0x5a1410, head ? 10 : 6, .6); fx.number && fx.number(p, dmg, head); }
    if (Z.role() === 'client') { c.send && c.send({ t: 'zh', id: o.id, d: dmg, h: head ? 1 : 0 }); o.hp -= dmg; o.flinch = 1; if (o.hp <= 0) kill(o, head, 'remote'); return { dmg, head, killed: !o.alive }; }
    damage(o, dmg, head, p, dir, 'me'); return { dmg, head, killed: !o.alive }; }

  // ---- per-frame ----
  const raised = [[.14, .08, 1], [.1, .06, 1]];
  function pose(o, dt, v, close = true) { const B = o.B; if (B.stand) { o.g.rotation.x = o.alive ? .12 : 0; return; }
    if (!o.alive) { B.update(dt, 0); return; } const run = o.kind === 'runner';
    B.update(dt * (run ? 1 : .75), run ? Math.max(v, 2.5) : Math.min(v, 1.4)); const root = B.m, Bn = root.userData.B; if (!Bn || !c.aimBone || !close) return; // bone posing (hunch, reach) only up close: cheap on phones
    const sw = Math.sin(o.anim * (run ? 7 : 3)) * .06; // hunched, head lolling, arms reaching forward (root space: +z forward, -x right)
    c.aimBone(root, Bn.Spine02, Bn.Spine01, [sw * .5, 1, .32]); c.aimBone(root, Bn.neck, Bn.Head, [.18 + sw, 1, .45]);
    if (!run || o.st === 1) for (const [s, L] of [[1, 'Left'], [-1, 'Right']]) { const r = raised[s > 0 ? 0 : 1]; c.aimBone(root, Bn[L + 'Arm'], Bn[L + 'ForeArm'], [s * r[0], r[1] + sw * s + (o.st === 1 ? Math.sin(o.anim * 9) * .3 : 0), r[2]]); c.aimBone(root, Bn[L + 'ForeArm'], Bn[L + 'Hand'], [s * .05, .02, 1]); } }
  function stepHost(o, dt) {
    if (o.hold) { o.sp = 0; o.st = 0; return; } // dev / tests: stand still
    const T = o.tgt = (o.retT = (o.retT || 0) - dt) <= 0 || !o.tgt ? chooseTarget(o) : o.tgt; if (o.retT <= 0) o.retT = .5;
    let tx = T ? (T.kind === 'horse' ? T.h.pos.x : T.p.x) : PEN.x, tz = T ? (T.kind === 'horse' ? T.h.pos.z : T.p.z) : PEN.z;
    const dist = Math.hypot(tx - o.pos.x, tz - o.pos.z), reach = o.K.reach + (T && (T.kind === 'horse' || T.p.horse) ? .8 : 0), safe = T && (T.kind === 'horse' ? inPenSafe(tx, tz) : inPenSafe(T.p.x, T.p.z) || ((T.p.y ?? o.pos.y) - o.pos.y > 2.6));
    o.cd -= dt;
    if (T && dist < reach && !safe) { o.st = 1; o.sp = 0; const want = Math.atan2(-(tx - o.pos.x), -(tz - o.pos.z)); o.yaw += Math.atan2(Math.sin(want - o.yaw), Math.cos(want - o.yaw)) * Math.min(1, dt * 8);
      if (o.cd <= 0) { o.cd = o.K.cd; const d = o.K.dmg;
        if (T.kind === 'horse') hurtHorse(T.h, d); else if (T.p.me) hurtMe(T.p.horse ? d * .4 : d, T.p.horse ? d : 0); else c.sendTo && c.sendTo(T.p.id, { t: 'zd', d: T.p.horse ? Math.round(d * .4) : d, hz: T.p.horse ? d : 0 }); } return; }
    o.st = 0;
    if (safe && inTown(tx, tz)) { const q = inTown(tx, tz); tx = o.pos.x + Math.sign(o.pos.x - q.x || 1) * 0; tz = o.pos.z; } // prey in town: they mill around outside the edge
    else if (safe && T && T.up) { /* prey up a lookout: crowd at the foot */ }
    else if (safe) { const dx = tx - PEN.x, dz = tz - PEN.z, ox = PEN.hw - Math.abs(dx), oz = PEN.hd - Math.abs(dz); // prey inside the pen: press up against the rails nearest to it
      if (ox < oz) tx = PEN.x + Math.sign(dx || 1) * (RX + .35); else tz = PEN.z + Math.sign(dz || 1) * (RZ + .35); }
    const det = penDetour(o, tx, tz); if (det) [tx, tz] = det;
    const far = dist > ZSET.near, spd = Math.max(o.K.spd, far ? ZSET.travel : 0) * (1 - o.flinch * .6), dx = tx - o.pos.x, dz = tz - o.pos.z, l = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(-dx, -dz); o.yaw += Math.atan2(Math.sin(want - o.yaw), Math.cos(want - o.yaw)) * Math.min(1, dt * 4);
    o.sp += (spd - o.sp) * Math.min(1, dt * 3); let mx = -Math.sin(o.yaw) * o.sp * dt, mz = -Math.cos(o.yaw) * o.sp * dt;
    if (o.push) { mx += o.push[0] * dt * 4; mz += o.push[1] * dt * 4; o.push[0] *= 1 - dt * 6; o.push[1] *= 1 - dt * 6; if (Math.abs(o.push[0]) + Math.abs(o.push[1]) < .02) o.push = null; }
    if (safe && Math.hypot(tx - o.pos.x, tz - o.pos.z) < 1.2) { mx *= .2; mz *= .2; } // pressed up against the rails, groaning
    o.pos.x += mx; o.pos.z += mz;
    for (const [ox, oz, or] of (H.obstNear ? H.obstNear(o.pos.x, o.pos.z) : H.obst)) { const ddx = o.pos.x - ox, ddz = o.pos.z - oz; if (Math.abs(ddx) > or + .4 || Math.abs(ddz) > or + .4) continue; const dd = Math.hypot(ddx, ddz), rr = or + .35; if (dd < rr && dd > 1e-4) { o.pos.x = ox + ddx / dd * rr; o.pos.z = oz + ddz / dd * rr; } }
    pushOutOfPen(o.pos); o.pos.x = Math.max(-WALK, Math.min(WALK, o.pos.x)); o.pos.z = Math.max(-WALK, Math.min(WALK, o.pos.z)); }
  function separate() { const L = Z.list; for (let i = 0; i < L.length; i++) { const a = L[i]; if (!a.alive) continue; for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (!b.alive) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), r = .55 * (a.K.s + b.K.s) / 2; if (d < r && d > 1e-4) { const k = (r - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; pushOutOfPen(a.pos); pushOutOfPen(b.pos); } } } }

  function tick(dt) {
    if (!Z.on || !H.on) return; Z.t += dt; dt = Math.min(dt, .1); const host = Z.role() !== 'client';
    // the player: regen, death + respawn at the pen
    if (Z.dead > 0) { Z.dead -= dt; if (Z.dead <= 0) { Z.dead = 0; Z.hp = ZSET.playerHp; const x = PEN.x + 2, z = PEN.z - 2; P.pos.set(x, hAt(x, z), z); c.msg && c.msg('Safe inside the pen — the dead cannot get in', 2.5); } }
    else if (Z.t - Z.hurtT > ZSET.regenDelay && Z.hp < ZSET.playerHp) Z.hp = Math.min(ZSET.playerHp, Z.hp + ZSET.regen * dt);
    Z.flash = Math.max(0, Z.flash - dt * 1.4); H.dead = Z.dead > 0;
    for (const h of H.horses) { if (h.hp == null) h.hp = ZSET.horseHp; if (h.panic > 0) h.panic -= dt; if (h.hp < ZSET.horseHp && (inPenSafe(h.pos.x, h.pos.z) || (Z.t % 1 < dt && h.panic <= 0))) h.hp = Math.min(ZSET.horseHp, h.hp + (inPenSafe(h.pos.x, h.pos.z) ? 12 : 2) * dt); }
    if (host) { // waves: a steady trickle that thickens; capped (phones lower)
      if ((Z.waveT += dt) > ZSET.waveSecs) { Z.waveT = 0; Z.wave++; c.msg && c.msg(`Wave ${Z.wave} — more of the dead are coming down from the mountains`, 3); }
      const live = Z.list.filter(o => o.alive).length; Z.spawnT -= dt; if (Z.spawnT <= 0 && live < Z.cap) { Z.spawnT = Math.max(.75, (7 - Z.wave * .7) / 3) * (rnd() * .5 + .75); spawn(pickKind()); } }
    const cam = c.camera.position;
    for (const o of [...Z.list]) { o.anim += dt; o.flinch = Math.max(0, o.flinch - dt * 2.5);
      if (!o.alive) { o.deadT += dt; const k = Math.min(1, o.deadT / .7); o.g.rotation.x = -k * 1.45 * (o.kind === 'brute' ? .95 : 1) ; o.g.rotation.z = k * .2 * o.fallDir; if (o.deadT > 4) o.pos.y -= dt * .6; if (o.deadT > 6.5) { despawn(o); continue; } pose(o, dt, 0); continue; }
      if (host) stepHost(o, dt); else if (o.net) { const n = o.net, k = Math.min(1, dt * 8); o.pos.x += (n.x - o.pos.x) * k; o.pos.z += (n.z - o.pos.z) * k; o.yaw += Math.atan2(Math.sin(n.yaw - o.yaw), Math.cos(n.yaw - o.yaw)) * k; o.st = n.st; o.sp = n.sp; }
      o.pos.y = hAt(o.pos.x, o.pos.z); o.g.rotation.set(-o.flinch * .25, o.yaw, 0);
      const dc = Math.hypot(cam.x - o.pos.x, cam.z - o.pos.z); o.g.visible = dc < (mobile ? 220 : 320);
      if (o.g.visible && (dc < 90 || ((Z.t * 10 + o.id) | 0) % 3 === 0)) pose(o, dc < 90 ? dt : dt * 3, o.sp, dc < (mobile ? 30 : 55));
      if ((o.groanT -= dt) <= 0) { o.groanT = 4 + rnd() * 7; if (dc < 45 && sfx.groan && sfx.ctx) sfx.at ? sfx.at(o.pos, () => sfx.groan(), .3) : sfx.groan(); } }
    if (host) separate();
    if (Z.role() === 'host' && (Z.snapT -= dt) <= 0) { Z.snapT = .12; c.send && c.send(snap()); }
    hud(); }

  // ---- multiplayer: host snapshots, client mirror ----
  function snap() { return { t: 'zs', w: Z.wave, z: Z.list.map(o => [o.id, KIND_LIST.indexOf(o.kind), +o.pos.x.toFixed(1), +o.pos.z.toFixed(1), +o.yaw.toFixed(2), o.alive ? o.st : 2, Math.max(0, Math.round(o.hp)), +o.sp.toFixed(1)]) }; }
  function apply(m) { if (!m || !Array.isArray(m.z)) return; Z.wave = m.w | 0 || Z.wave; const seen = new Set();
    for (const r of m.z.slice(0, 64)) { if (!Array.isArray(r) || r.length < 8 || !r.slice(2, 5).every(Number.isFinite)) continue; const [id, ki, x, z, yaw, st, hp, sp] = r; seen.add(id);
      let o = Z.list.find(q => q.id === id); if (!o) { if (st === 2) continue; o = spawn(KIND_LIST[ki] || 'walker', [x, z], id); o.yaw = yaw; }
      o.net = { x, z, yaw, st, sp }; if (st === 2 && o.alive) kill(o, false, 'remote'); else if (o.alive) o.hp = hp; }
    for (const o of [...Z.list]) if (!seen.has(o.id) && o.alive) despawn(o); }
  function remoteHit(m, from) { if (!m || !Number.isFinite(m.id) || !Number.isFinite(m.d)) return; const o = Z.list.find(q => q.id === m.id); if (!o) return; damage(o, Math.max(0, Math.min(2000, m.d)), !!m.h, null, null, 'remote', from); }
  function confirmKill(m) { Z.kills++; if (m && m.h) Z.heads++; } // the host says my shot killed one
  function remoteHurt(m) { if (!m || !Number.isFinite(m.d)) return; hurtMe(Math.max(0, Math.min(60, m.d)), Math.max(0, Math.min(80, m.hz || 0))); }

  // ---- HUD: health, wave, kills; red hurt flash ----
  let el = null, fl = null;
  function hud() { if (!el) { el = document.createElement('div'); el.id = 'hrZ'; document.body.appendChild(el); fl = document.createElement('div'); fl.id = 'hrHurt'; document.body.appendChild(fl); }
    const live = Z.list.filter(o => o.alive).length, h = H.mounted;
    el.style.display = H.on && Z.on ? '' : 'none'; fl.style.display = H.on ? '' : 'none'; fl.style.opacity = Z.dead > 0 ? .85 : (Z.flash * .7).toFixed(2);
    const hh = h ? Math.round(100 * (h.hp ?? ZSET.horseHp) / ZSET.horseHp) : null;
    el.innerHTML = `<b class="hp"><i style="width:${Math.round(Z.hp)}%"></i></b>${hh != null ? `<b class="hp horse"><i style="width:${hh}%"></i></b>` : ''}<span>☠ WAVE ${Z.wave} · ${live} near · ${Z.kills} down${Z.heads ? ` (${Z.heads} ◉)` : ''}</span>${Z.dead > 0 ? '<em>OVERRUN</em>' : inTown(P.pos.x, P.pos.z) ? '<em class="safe">🛡 SAFE ZONE · TOWN</em>' : inPenSafe(P.pos.x, P.pos.z) && !h ? '<em class="safe">SAFE IN THE PEN</em>' : ''}`; }
  const netState = () => ({ dd: Z.dead > 0 ? 1 : 0 });
  return { state: Z, list: Z.list, settings: ZSET, kinds: ZKINDS, tick, spawn, damage, onHit, rayHit, assistPoints, headPos, snap, apply, remoteHit, remoteHurt, confirmKill, hurtMe, netState, inPenRect, inPenSafe, inSafeZone, inTown, despawn,
    clear() { for (const o of [...Z.list]) despawn(o); } };
}
