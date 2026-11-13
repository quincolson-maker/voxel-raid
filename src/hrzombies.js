// HORSE RIDER zombies: the dead come down out of the mountains at the edge of the map and head for the riders.
// Reused from the zombies mode: the walker / runner / brute kinds and their roles, groans, damage numbers and the
// host-authoritative co-op pattern (host simulates, clients mirror snapshots and send their hits to the host).
// New here: they are the game's rigged person (CC0 rider) re-dressed as the walking dead (tinted, hunched, arms out),
// they travel fast across open country and slow to their kind's pace near players, steer around trees / rocks, and
// the HORSE PEN is a safe zone: it is indestructible (nothing here ever damages the fence or gate) and no zombie may
// stand inside it, the gate gap included; they walk around it and crowd at the rails. Guns kill them (headshots x2.4).
import { PF } from './perf.js';
import * as THREE from 'three';

export const ZKINDS = {
  walker: { hp: 100, spd: 1.35, dmg: 12, cd: 1.2, s: 1, reach: 1.25 },
  runner: { hp: 70, spd: 4.3, dmg: 9, cd: .9, s: .97, reach: 1.2 },
  brute: { hp: 320, spd: 1.15, dmg: 28, cd: 1.6, s: 1.28, reach: 1.5 },
};
export const ZSET = { travel: 6, near: 90, capDesktop: 42, capPhone: 18, chaosDesktop: 420, chaosPhone: 180, chaosRows: 120, chaosRowR: 260, startDelay: 10, waveSecs: 75, playerHp: 100, horseHp: 160, regenDelay: 5, regen: 7, respawn: 4,
  dmg: { revolver: 50, rifle: 70, sniper: 260, tommy: 34, gold: 650 }, head: 2.4, penMargin: 1.1 };
const KIND_LIST = ['walker', 'runner', 'brute'];

export function createHrZombies(c) {
  const { scene, H, P, hAt, PEN, EDGE, sfx, fx, mobile } = c, WALK = c.WALK || EDGE;
  const Q = new URLSearchParams(location.search);
  const Z = { on: Q.get('zombies') !== '0', list: [], byId: new Map(), val: new Map(), gotK: new Set(), gotQ: [], shotSeq: 0, wave: 1, waveT: 0, spawnT: ZSET.startDelay, nextId: 1, kills: 0, heads: 0, cap: mobile ? ZSET.capPhone : ZSET.capDesktop,
    hp: ZSET.playerHp, hurtT: -99, dead: 0, deaths: 0, flash: 0, t: 0, snapT: 0, role: c.role || (() => 'solo'), chaos: false, groanTok: 4 };
  // v37 CHAOS MODE: ten times the dead (420 on a desktop host, 180 on a phone host). The host's switch decides for everyone in
  // co-op (it rides in the snapshot); a client's own switch only matters once it hosts or plays solo.
  const capOf = on => on ? (mobile ? ZSET.chaosPhone : ZSET.chaosDesktop) : (mobile ? ZSET.capPhone : ZSET.capDesktop);
  Z.wantChaos = Q.get('chaos') === '1' || (Q.get('chaos') !== '0' && (() => { try { return localStorage.getItem('hr_chaos') === '1'; } catch (_) { return false; } })());
  function setChaos(on, save = true) { Z.wantChaos = !!on; if (save) try { localStorage.setItem('hr_chaos', on ? '1' : '0'); } catch (_) {} if (Z.role() !== 'client') applyChaos(Z.wantChaos); return Z.wantChaos; }
  function applyChaos(on) { on = !!on; if (on === Z.chaos && Z.cap === capOf(on)) return; const was = Z.chaos; Z.chaos = on; Z.cap = capOf(on);
    if (Z.role() !== 'client') { if (on && !was) { Z.spawnT = Math.min(Z.spawnT, .5); c.msg && c.msg('☠ CHAOS MODE — ' + Z.cap + ' of the dead are coming', 3); }
      if (!on && was) { // back to normal: the far extras crumble away (nearby ones keep coming, so nothing pops in front of you)
        const ps = players(), far = o => { let d = 1e9; for (const p of ps) d = Math.min(d, Math.hypot(p.x - o.pos.x, p.z - o.pos.z)); return d; };
        const alive = Z.list.filter(o => o.alive).map(o => [far(o), o]).sort((a, b) => b[0] - a[0]); let extra = alive.length - Z.cap;
        for (const [d, o] of alive) { if (extra <= 0) break; if (d > 60) { despawn(o); extra--; } } c.msg && c.msg('Chaos mode off', 2); } } }
  Z.cap = capOf(false);
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
  // v35: rotting skin in the shader (object-space noise: gray-green / bluish / olive mottling, bruises, wounds) on shared materials, 3 variants
  const ZV = [[.46, .56, .44], [.4, .48, .58], [.42, .54, .3]], ZGL = `float zh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float zn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(zh(i),zh(i+vec3(1,0,0)),f.x),mix(zh(i+vec3(0,1,0)),zh(i+vec3(1,1,0)),f.x),f.y),mix(mix(zh(i+vec3(0,0,1)),zh(i+vec3(1,0,1)),f.x),mix(zh(i+vec3(0,1,1)),zh(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
  const f2 = x => (+x).toFixed(3);
  function rotPatch(d, v, S) { d.onBeforeCompile = sh => { sh.vertexShader = 'varying vec3 vZp;\n' + sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n vZp = transformed;');
      sh.fragmentShader = 'varying vec3 vZp;\n' + ZGL + '\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
 { vec3 q = vZp * ${f2(S)}; vec3 c0 = diffuseColor.rgb; float l = dot(c0, vec3(.3,.59,.11)); vec3 tn = vec3(${ZV[v].map(f2).join(',')});
   vec3 c = mix(c0 * .62, tn * (.06 + l * .62), .5); float sk = smoothstep(.015, .07, c0.g - c0.b) * smoothstep(.04, .14, c0.r - c0.g); c = mix(c, tn * (.05 + l * .8), sk * .9); c *= .7 + .45 * zn(q * 22.);
   float br = smoothstep(.6, .82, zn(q * 5. + ${f2(v * 7.3 + 1)})); c = mix(c, vec3(.2,.11,.19) * (.7 + l), br * .75);
   float wd = smoothstep(.73, .86, zn(q * 11. + ${f2(v * 3.1 + 5)})); c = mix(c, vec3(.32,.02,.02), wd * .85);
   diffuseColor.rgb = c; }`); }; d.customProgramCacheKey = () => 'zrot' + v; }
  let ZS = 0; // object-space units -> metres for the noise
  function deadMat(m, v = 0) { const key = m.uuid + ':' + v; if (tints.has(key)) return tints.get(key); const d = m.clone(); if (d.color) d.color.multiply(new THREE.Color(.82, .88, .8)); if (d.emissive) d.emissive.setRGB(.02, .03, .02); d.roughness = Math.min(1, (d.roughness ?? .8) + .15); if ('metalness' in d) d.metalness = 0; rotPatch(d, v, ZS || 1); tints.set(key, d); return d; }
  // eyes, rags, a torn hat, ribs or a bare jaw on the bones (merged per bone: 2-4 extra draws, hidden far away)
  const ZM = { eye: new THREE.MeshBasicMaterial({ color: 0xeaff70, toneMapped: false }), sock: new THREE.MeshStandardMaterial({ color: 0x120a0a, roughness: 1 }), bone: new THREE.MeshStandardMaterial({ color: 0xd8cdb0, roughness: .7 }), gore: new THREE.MeshStandardMaterial({ color: 0x4a0a0a, roughness: .6 }),
    rag: [0x3a2c20, 0x2a3442, 0x4a3a24, 0x5a2a22].map(c2 => new THREE.MeshStandardMaterial({ color: c2, roughness: 1, side: THREE.DoubleSide })), hat: new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1, side: THREE.DoubleSide }) };
  let zvar = 0; const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _w = new THREE.Vector3();
  function stick(root, bone, mesh, x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) { // place a mesh given in model space (metres, +z forward) on a bone
    const u = root.userData.zU || 1; bone.getWorldPosition(_w); bone.getWorldQuaternion(_q); bone.getWorldScale(_s); _v.set(x * u, y * u, z * u); bone.worldToLocal(_v); mesh.position.copy(_v);
    mesh.quaternion.copy(_q.invert()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))); mesh.scale.setScalar(u * sc / _s.x); mesh.frustumCulled = false; bone.add(mesh); return mesh; }
  const mg = list => { const parts = list.map(([g, m4]) => { const n = g.index ? g.toNonIndexed() : g; n.applyMatrix4(m4); return n; }); let N = 0; for (const q of parts) N += q.attributes.position.count; const P2 = new Float32Array(N * 3), Nn = new Float32Array(N * 3); let o = 0;
    for (const q of parts) { P2.set(q.attributes.position.array, o * 3); Nn.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P2, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); return g; };
  const T4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const ZG = {}; const zg = (k, f) => ZG[k] || (ZG[k] = f());
  function dress(W, v, seed) { const Bn = W.m.userData.B; if (!Bn || !Bn.Head) return; W.m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(W.m), hgt = box.max.y - box.min.y || 1.75; W.m.userData.zU = hgt / 1.75; const u = W.m.userData.zU;
    const hp = new THREE.Vector3(); Bn.Head.getWorldPosition(hp); hp.divideScalar(u); const top = box.max.y / u, ey = top - .205 - hp.y, at = [];
    // eyes: dark sunken sockets with a faint glow deep inside
    at.push(stick(W.m, Bn.Head, new THREE.Mesh(zg('sock', () => mg([[new THREE.SphereGeometry(.024, 8, 6), T4(-.034, 0, 0, 0, 0, 0, 1, .8, .6)], [new THREE.SphereGeometry(.024, 8, 6), T4(.034, 0, 0, 0, 0, 0, 1, .8, .6)]])), ZM.sock), hp.x, hp.y + ey, hp.z + .108));
    at.push(stick(W.m, Bn.Head, new THREE.Mesh(zg('eye', () => mg([[new THREE.SphereGeometry(.017, 6, 5), T4(-.034, 0, 0)], [new THREE.SphereGeometry(.017, 6, 5), T4(.034, 0, 0)]])), ZM.eye), hp.x, hp.y + ey, hp.z + .115));
    const kind = seed % 4;
    if (kind === 0) at.push(stick(W.m, Bn.Head, new THREE.Mesh(zg('hat', () => mg([[new THREE.CylinderGeometry(.2, .21, .015, 14, 1, true), T4(0, 0, 0)], [new THREE.RingGeometry(.11, .2, 14, 1, 0, Math.PI * 1.6), T4(0, .005, 0, -Math.PI / 2)], [new THREE.CylinderGeometry(.095, .11, .12, 10, 1, true), T4(0, .065, 0)], [new THREE.CircleGeometry(.095, 10), T4(0, .125, 0, -Math.PI / 2)]])), ZM.hat), hp.x, top - .05, hp.z - .005, .18, 0, (seed & 1 ? 1 : -1) * .2));
    if (kind === 1 && Bn.Spine02) { const sp = new THREE.Vector3(); Bn.Spine02.getWorldPosition(sp); sp.divideScalar(u); // exposed ribs in a torn shirt
      at.push(stick(W.m, Bn.Spine02, new THREE.Mesh(zg('gore', () => new THREE.CircleGeometry(.085, 12)), ZM.gore), sp.x + .05, sp.y + .02, sp.z + .125, 0, 0, 0));
      at.push(stick(W.m, Bn.Spine02, new THREE.Mesh(zg('ribs', () => mg([0, 1, 2, 3].map(i => [new THREE.TorusGeometry(.065 - i * .004, .0065, 4, 10, Math.PI * .75), T4(0, .05 - i * .03, 0, 0, 0, Math.PI * 1.125)]).concat([[new THREE.BoxGeometry(.012, .13, .01), T4(0, .005, .004)]]))), ZM.bone), sp.x + .05, sp.y + .02, sp.z + .13)); }
    if (kind === 2) { at.push(stick(W.m, Bn.Head, new THREE.Mesh(zg('jaw', () => mg([[new THREE.BoxGeometry(.06, .016, .03), T4(0, 0, 0)], ...[-2, -1, 0, 1, 2].map(i => [new THREE.BoxGeometry(.008, .012, .006), T4(i * .011, .012, .012)])])), ZM.bone), hp.x + .018, hp.y + ey - .08, hp.z + .085));
      at.push(stick(W.m, Bn.Head, new THREE.Mesh(zg('cheek', () => new THREE.CircleGeometry(.028, 8)), ZM.gore), hp.x + .045, hp.y + ey - .055, hp.z + .088, 0, .5, 0)); }
    if (Bn.Hips) { const hq = new THREE.Vector3(); Bn.Hips.getWorldPosition(hq); hq.divideScalar(u); const rag = ZM.rag[seed % ZM.rag.length]; // tattered strips hanging off the belt
      at.push(stick(W.m, Bn.Hips, new THREE.Mesh(zg('rags', () => { const L = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, l = .16 + (i * 37 % 11) / 40; const g = new THREE.PlaneGeometry(.07, l); L.push([g, T4(Math.sin(a) * .16, -l / 2 - .02, Math.cos(a) * .12, .12, a, 0)]); } return mg(L); }), rag), hq.x, hq.y, hq.z)); }
    W.zAt = at; }

  function standIn() { const g = new THREE.Group(), sk = new THREE.MeshStandardMaterial({ color: 0x7d8c6a, roughness: .9 }), cl = new THREE.MeshStandardMaterial({ color: 0x3f4640, roughness: .95 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    add(new THREE.CylinderGeometry(.2, .17, .62, 8), cl, 0, 1.2, 0); add(new THREE.SphereGeometry(.13, 10, 8), sk, 0, 1.65, .03); for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(.07, .06, .85, 6), cl, s * .1, .45, 0); const a = add(new THREE.CylinderGeometry(.05, .045, .6, 6), sk, s * .26, 1.38, .26); a.rotation.x = Math.PI / 2; }
    return { m: g, update() {}, stand: true }; }
  function makeBody(kind) { const P0 = pool[kind].pop(); if (P0) return P0;
    const W = c.walker && c.walker(); if (!W) return standIn(); const v = kind === 'brute' ? 2 : zvar++ % 3;
    if (!ZS) W.m.traverse(o => { if (o.isMesh && !ZS) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; ZS = 1.75 / Math.max(1e-3, b.max.y - b.min.y, b.max.z - b.min.z); } });
    W.m.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => deadMat(m, v)) : deadMat(o.material, v); o.frustumCulled = false; } }); try { dress(W, v, (Z.nextId * 7 + zvar * 3) | 0); } catch (e) { W.zAt = []; } W.zv = v; return W; }

  // ---- spawning at the foot of the mountains ----
  function edgePoint(ang) { const dx = Math.cos(ang), dz = Math.sin(ang), k = (EDGE - 9) / Math.max(Math.abs(dx), Math.abs(dz)); return [dx * k, dz * k]; }
  // v34: spawn points near the players on valid ground (not steep, not water, not in the town / pen / a lookout / a rock)
  function goodGround(x, z) { if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > WALK - 6 || Math.abs(z) > WALK - 6) return false; if (inTown(x, z, 6) || inPenRect(x, z, 4)) return false;
    const T2 = H.town2; if (T2 && T2.towers) for (const t of T2.towers) if (T2.inFoot && T2.inFoot(t, x, z, 3)) return false; const F = H.F; if (F && F.waterDist && F.waterDist(x, z) < 3) return false;
    const h = hAt(x, z), gr = Math.max(Math.abs(hAt(x + 1.5, z) - h), Math.abs(hAt(x, z + 1.5) - h), Math.abs(hAt(x - 1.5, z) - h), Math.abs(hAt(x, z - 1.5) - h)) / 1.5; if (!(gr < .75)) return false;
    for (const [ox, oz, or] of (H.obstNear ? H.obstNear(x, z) : [])) if (Math.hypot(ox - x, oz - z) < or + .8) return false; return true; }
  function nearSpot() { const ps = players(); if (!ps.length) return null; for (let i = 0; i < 24; i++) { const q = ps[(rnd() * ps.length) | 0], a = rnd() * Math.PI * 2, d = 40 + rnd() * 50, x = q.x + Math.cos(a) * d, z = q.z + Math.sin(a) * d; if (goodGround(x, z) && ps.every(p => Math.hypot(p.x - x, p.z - z) > 35)) return [x, z]; } return null; }
  Z.goodGround = goodGround; Z.nearSpot = nearSpot;
  function relocate(o, why) { const at = nearSpot(); if (!at) return false; o.pos.set(at[0], hAt(at[0], at[1]), at[1]); o.yaw = Math.atan2(at[0] - PEN.x, at[1] - PEN.z); o.sp = 0; o.push = null; o.tgt = null; o.prog = null; o.stuckT = 0; o.farT = 0; o.tp = (o.tp || 0) + 1; Z.relocs = (Z.relocs || 0) + 1; Z.lastReloc = why; return true; }
  Z.relocate = relocate;
  function spawn(kind, at, id) {
    kind = ZKINDS[kind] ? kind : 'walker'; const K = ZKINDS[kind], B = makeBody(kind), g = new THREE.Group(); g.add(B.m); B.m.rotation.y = Math.PI; B.m.position.set(0, 0, 0); B.m.scale.setScalar(K.s); scene.add(g);
    let x, z; if (at) [x, z] = at; else if (!at && (() => { const ps = players(); return ps.length && ps.every(p => Math.max(Math.abs(p.x), Math.abs(p.z)) > EDGE - 20); })()) { // everyone is up in the mountains: they come down the slopes above you
      const ps = players(), q = ps[(rnd() * ps.length) | 0]; let best = null, bh = -1e9; for (let i = 0; i < 6; i++) { const a = rnd() * Math.PI * 2, d = 85 + rnd() * 45, px = Math.max(-WALK + 5, Math.min(WALK - 5, q.x + Math.cos(a) * d)), pz = Math.max(-WALK + 5, Math.min(WALK - 5, q.z + Math.sin(a) * d)), hh = hAt(px, pz); if (hh > bh) { bh = hh; best = [px, pz]; } } [x, z] = best; }
    else if ((at = nearSpot())) [x, z] = at; // v34: they come from 40-90 m around you, never stuck off at the world edge
    else { const ps = players(); let best = null, bd = 1e9; for (let i = 0; i < 4; i++) { const p = edgePoint(rnd() * Math.PI * 2), q = ps[(rnd() * ps.length) | 0] || { x: 0, z: 0 }, d = Math.hypot(p[0] - q.x, p[1] - q.z); if (d < bd) { bd = d; best = p; } } [x, z] = best; }
    const o = { id: id || Z.nextId++, kind, K, B, g, pos: g.position, yaw: Math.atan2(x - PEN.x, z - PEN.z), hp: K.hp, alive: true, deadT: 0, cd: 1, st: 0, groanT: 2 + rnd() * 6, flinch: 0, sp: 0, born: Z.t, tgt: null, net: null, anim: rnd() * 6 };
    o.pos.set(x, hAt(x, z), z); o.from = [+x.toFixed(1), +z.toFixed(1)]; Z.list.push(o); Z.byId.set(o.id, o); return o; }
  function despawn(o) { scene.remove(o.g); o.g.remove(o.B.m); if (!o.B.stand) { o.B.m.rotation.set(0, Math.PI, 0); o.B.m.position.set(0, 0, 0); pool[o.kind].push(o.B); } Z.list.splice(Z.list.indexOf(o), 1); if (Z.byId.get(o.id) === o) Z.byId.delete(o.id); }
  const pickKind = () => { const w = Z.wave, r = rnd(); if (w >= 3 && r < Math.min(.15, .04 * w)) return 'brute'; if (w >= 2 && r < Math.min(.5, .12 * w)) return 'runner'; return 'walker'; };

  // ---- who they go for: players on foot or riding (their horse), loose horses outside the pen ----
  // v37 perf: the player list is rebuilt once per tick (not per zombie), into persistent objects keyed by id, so a target a
  // zombie picked up to .5 s ago still follows that player's live position instead of a stale copy.
  const PL = [], PLO = new Map(); let plT = -1;
  const plSet = (id, me, x, y, z, horse) => { let q = PLO.get(id); if (!q) PLO.set(id, q = { id, me }); q.me = me; q.x = x; q.y = y; q.z = z; q.horse = horse; q.gone = false; PL.push(q); };
  function refreshPlayers() { for (const q of PL) q.gone = true; PL.length = 0; if (!Z.dead) { const h = H.mounted; plSet(H.me || 'P1', true, h ? h.pos.x : P.pos.x, h ? h.pos.y : P.pos.y, h ? h.pos.z : P.pos.z, h || null); }
    for (const r of (c.remotes ? c.remotes() : [])) if (r && r.s && !r.s.dd) { const h = r.s.m >= 0 ? H.horses[r.s.m] : null; plSet(r.id, false, h ? h.pos.x : r.s.x, h ? h.pos.y : r.s.y, h ? h.pos.z : r.s.z, h); }
    if (PLO.size > PL.length + 16) for (const [k, q] of PLO) if (q.gone) PLO.delete(k); plT = Z.t; }
  function players() { if (plT !== Z.t) refreshPlayers(); return PL; }
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
    if (o.hp <= 0) { kill(o, head, by); if (from && c.sendTo) { c.sendTo(from, { t: 'zk', h: head ? 1 : 0, b: Z.byBandit ? 1 : 0, z: o.id }); c.creditRemote && c.creditRemote(from, head); } } return true; }
  const zAt = (pos, fn, wet) => sfx.zAt ? sfx.zAt(pos, fn, wet) : sfx.at(pos, fn, wet); // zombie voices: their own (fadeable) bus
  function kill(o, head, by) { if (!o.alive) return; o.alive = false; o.hp = 0; o.st = 2; o.deadT = 0; o.fallDir = rnd() < .5 ? 1 : -1; if (by !== 'remote' && by !== 'bandit') { Z.kills++; if (head) Z.heads++; }
    if (sfx.at && sfx.ctx) zAt(o.pos, () => { sfx.tone('sawtooth', 120, 40, .22, .7); sfx.nz('lowpass', 300, 1, .25, .4); }, .3); }
  function onHit(o, w, head, p, dir, mul = 1) { // a local player's bullet hit this zombie
    const dmg = Math.round((ZSET.dmg[w] || 50) * (head ? ZSET.head : 1) * mul);
    if (fx) { fx.debris && fx.debris(p.x, p.y, p.z, 0x5a1410, head ? 10 : 6, .6); fx.number && fx.number(p, dmg, head); }
    if (Z.role() === 'client') { c.send && c.send({ t: 'zh', id: o.id, d: dmg, h: head ? 1 : 0, w, s: ++Z.shotSeq }); o.hp -= dmg; o.flinch = 1; if (o.hp <= 0) { kill(o, head, 'remote'); o.predT = performance.now(); } return { dmg, head, killed: !o.alive }; } // predicted: the host's snapshot can still bring it back
    damage(o, dmg, head, p, dir, 'me'); return { dmg, head, killed: !o.alive }; }

  // ---- per-frame ----
  const raised = [[.14, .08, 1], [.1, .06, 1]], FR = new THREE.Frustum(), PSM = new THREE.Matrix4(), SPH = new THREE.Sphere();
  function pose(o, dt, v, close = true) { const B = o.B; if (B.stand) { o.g.rotation.x = o.alive ? .12 : 0; return; }
    if (!o.alive) { B.update(dt, 0); return; } const run = o.kind === 'runner';
    B.update(dt * (run ? 1 : .75), run ? Math.max(v, 2.5) : Math.min(v, 1.4)); const root = B.m, Bn = root.userData.B; if (!Bn || !c.aimBone || !close) return; // bone posing (hunch, reach) only up close: cheap on phones
    const sw = Math.sin(o.anim * (run ? 7 : 3)) * .06; // hunched, head lolling, arms reaching forward (root space: +z forward, -x right)
    c.aimBone(root, Bn.Spine02, Bn.Spine01, [sw * .5, 1, .32]); c.aimBone(root, Bn.neck, Bn.Head, [.18 + sw, 1, .45]); o.twT = (o.twT ?? 1 + rnd() * 3) - dt; if (o.twT < .12) { Bn.Head.rotateZ(Math.sin(o.twT * 60) * .35); Bn.Head.rotateX(.15); if (o.twT <= 0) o.twT = 1.5 + rnd() * 4; } // head twitch
    if (!run || o.st === 1) for (const [s, L] of [[1, 'Left'], [-1, 'Right']]) { const r = raised[s > 0 ? 0 : 1]; c.aimBone(root, Bn[L + 'Arm'], Bn[L + 'ForeArm'], [s * r[0], r[1] + sw * s + (o.st === 1 ? Math.sin(o.anim * 9) * .3 : 0), r[2]]); c.aimBone(root, Bn[L + 'ForeArm'], Bn[L + 'Hand'], [s * .05, .02, 1]); } }
  function stepHost(o, dt) {
    if (o.hold) { o.sp = 0; o.st = 0; return; } // dev / tests: stand still
    const T = o.tgt = (o.retT = (o.retT || 0) - dt) <= 0 || !o.tgt || (o.tgt.kind === 'player' && o.tgt.p.gone) ? chooseTarget(o) : o.tgt; if (o.retT <= 0) o.retT = .5;
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
    if (H.build && H.build.pieces.length && H.build.zHit(o.pos.x, o.pos.z, .35)) { o.pos.x -= mx; o.pos.z -= mz; } // v35: cabin walls stop them
    pushOutOfPen(o.pos); if (H.town2 && H.town2.towers) for (const t of H.town2.towers) if (H.town2.inFoot(t, o.pos.x, o.pos.z, 0)) { o.pos.x -= mx * 1.5; o.pos.z -= mz * 1.5; } // lookouts are solid for them
    o.pos.x = Math.max(-WALK, Math.min(WALK, o.pos.x)); o.pos.z = Math.max(-WALK, Math.min(WALK, o.pos.z));
    // v34 stuck watchdog: no progress toward the target for 8 s (while not at a safe-zone edge), or far from every player -> come back near them
    let nd = 1e9; for (const p of players()) { const d = Math.hypot(p.x - o.pos.x, p.z - o.pos.z); if (d < nd) nd = d; }
    if (!o.prog || Z.t - o.prog.t > 1) { if (o.prog && !safe && dist > reach + .5 && o.prog.d - dist < .4) o.stuckT = (o.stuckT || 0) + (Z.t - o.prog.t); else if (o.prog) o.stuckT = 0; o.prog = { t: Z.t, d: dist }; }
    o.farT = nd > 140 ? (o.farT || 0) + dt : 0;
    if ((o.stuckT || 0) > 8 || nd > 250 || o.farT > 30) relocate(o, o.stuckT > 8 ? 'stuck' : 'far'); }
  // v37 perf: neighbours from a 1.2 m grid (reused buckets) instead of every pair; same push rule as before
  const SG = new Map(), SGK = [], SC = 1.2;
  function separate() { const L = Z.list; for (const k of SGK) SG.get(k).length = 0; SGK.length = 0;
    for (let i = 0; i < L.length; i++) { const a = L[i]; if (!a.alive) continue; const k = (Math.floor(a.pos.x / SC) + 2048) * 4096 + Math.floor(a.pos.z / SC) + 2048; let b = SG.get(k); if (!b) SG.set(k, b = []); if (!b.length) SGK.push(k); b.push(a); }
    for (let i = 0; i < L.length; i++) { const a = L[i]; if (!a.alive) continue; const cx = Math.floor(a.pos.x / SC) + 2048, cz = Math.floor(a.pos.z / SC) + 2048;
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) { const bk = SG.get(gx * 4096 + gz); if (!bk) continue;
        for (const b of bk) { if (b.id <= a.id) continue; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; if (dx > 1 || dx < -1 || dz > 1 || dz < -1) continue; const d = Math.hypot(dx, dz), r = .55 * (a.K.s + b.K.s) / 2;
          if (d < r && d > 1e-4) { const k = (r - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; pushOutOfPen(a.pos); pushOutOfPen(b.pos); } } } } }

  function tick(dt) {
    if (!Z.on || !H.on) return; Z.t += dt;
    { const q = !!(H.saloon && H.saloon.inside && H.saloon.inside()); if (q !== !!Z.quiet) { Z.quiet = q; sfx.zFade && sfx.zFade(q ? 0 : 1, .5); } } dt = Math.min(dt, .1); const host = Z.role() !== 'client'; // hotfix: zombie groans / moans fade out inside the saloon (0.5 s), back on leaving
    // the player: regen, death + respawn at the pen
    if (Z.dead > 0) { Z.dead -= dt; if (Z.dead <= 0) { Z.dead = 0; Z.hp = ZSET.playerHp; const x = PEN.x + 2, z = PEN.z - 2; P.pos.set(x, hAt(x, z), z); c.msg && c.msg('Safe inside the pen — the dead cannot get in', 2.5); } }
    else if (Z.t - Z.hurtT > ZSET.regenDelay && Z.hp < ZSET.playerHp) Z.hp = Math.min(ZSET.playerHp, Z.hp + ZSET.regen * dt);
    Z.flash = Math.max(0, Z.flash - dt * 1.4); H.dead = Z.dead > 0;
    for (const h of H.horses) { if (h.hp == null) h.hp = ZSET.horseHp; if (h.panic > 0) h.panic -= dt; if (h.hp < ZSET.horseHp && (inPenSafe(h.pos.x, h.pos.z) || (Z.t % 1 < dt && h.panic <= 0))) h.hp = Math.min(ZSET.horseHp, h.hp + (inPenSafe(h.pos.x, h.pos.z) ? 12 : 2) * dt); }
    if (host) { // waves: a steady trickle that thickens; capped (phones lower)
      if ((Z.waveT += dt) > ZSET.waveSecs) { Z.waveT = 0; Z.wave++; c.msg && c.msg(`Wave ${Z.wave} — more of the dead are coming down from the mountains`, 3); }
      let live = 0; for (const o of Z.list) if (o.alive) live++; Z.live = live; if (Z.wasRole === 'client') Z.spawnT = Math.min(Z.spawnT, 1); // just became the host: keep the horde coming
      Z.spawnT -= dt; if (Z.spawnT <= 0 && live < Z.cap) { Z.spawnT = Z.chaos ? (live < Z.cap * .5 ? .05 : .18) : live < Z.cap * .5 ? .4 : Math.min(1.2, Math.max(.75, (7 - Z.wave * .7) / 3) * (rnd() * .5 + .75)); spawn(pickKind()); } }
    Z.wasRole = Z.role();
    const cam = c.camera.position; c.camera.updateMatrixWorld(); PSM.multiplyMatrices(c.camera.projectionMatrix, c.camera.matrixWorldInverse); FR.setFromProjectionMatrix(PSM);
    const range = Z.chaos ? (mobile ? 140 : 220) : (mobile ? 220 : 320), shadowD = Z.chaos ? 28 : 50, poseNear = Z.chaos ? 50 : 90, eyeD = Z.chaos ? 110 : 1e9; Z.groanTok = Math.min(4, Z.groanTok + dt * 2.5); let drawn = 0;
    Z.frame = (Z.frame || 0) + 1; for (let li = Z.list.length - 1; li >= 0; li--) { const o = Z.list[li]; if (!o) continue; o.anim += dt; o.flinch = Math.max(0, o.flinch - dt * 2.5);
      if (!o.alive) { o.deadT += dt; const k = Math.min(1, o.deadT / .7); o.g.rotation.x = -k * 1.45 * (o.kind === 'brute' ? .95 : 1) ; o.g.rotation.z = k * .2 * o.fallDir; if (o.deadT > 4) o.pos.y -= dt * .6; if (o.deadT > 6.5) { despawn(o); continue; } pose(o, dt, 0); continue; }
      if (host) stepHost(o, dt); else if (o.net) { const n = o.net, k = Math.min(1, dt * 8); o.pos.x += (n.x - o.pos.x) * k; o.pos.z += (n.z - o.pos.z) * k; o.yaw += Math.atan2(Math.sin(n.yaw - o.yaw), Math.cos(n.yaw - o.yaw)) * k; o.st = n.st; o.sp = n.sp; }
      if (host && (!Number.isFinite(o.pos.x) || !Number.isFinite(o.pos.z) || !Number.isFinite(o.pos.y) || Math.abs(o.pos.x) > WALK + 1 || Math.abs(o.pos.z) > WALK + 1 || o.pos.y < hAt(o.pos.x, o.pos.z) - 1)) { if (!relocate(o, 'bad')) { o.pos.set(PEN.x + 30, hAt(PEN.x + 30, PEN.z + 30), PEN.z + 30); } } // NaN / under the map / outside the world
      o.pos.y = hAt(o.pos.x, o.pos.z); o.g.rotation.set(-o.flinch * .25, o.yaw, 0);
      const dc = Math.hypot(cam.x - o.pos.x, cam.z - o.pos.z); SPH.center.set(o.pos.x, o.pos.y + .9 * o.K.s, o.pos.z); SPH.radius = 1.3 * o.K.s;
      o.g.visible = dc < range && (dc < 6 || FR.intersectsSphere(SPH)); if (o.g.visible) drawn++; // v37: off-screen bodies are skipped (they were all drawn: skinned clones never cull)
      const cast = dc < shadowD; if (o.cast !== cast) { o.cast = cast; o.g.traverse(m => { if (m.isMesh) m.castShadow = cast; }); } // v37: only nearby dead cast shadows (all of them did, every frame)
      if (o.B.zAt && o.eyeOn !== dc < eyeD) { o.eyeOn = dc < eyeD; for (const m of o.B.zAt) if (m.material === ZM.eye) m.visible = o.eyeOn; }
      if (o.B.zAt && (o.zNear !== dc < 60)) { o.zNear = dc < 60; for (const m of o.B.zAt) if (m.material !== ZM.eye) m.visible = o.zNear; } // eyes glow at any range; the rest only up close
      const pk = dc < poseNear ? 1 : Z.chaos && dc > 120 ? 6 : 3; if (o.g.visible && (pk === 1 || (Z.frame + o.id) % pk === 0)) { Z.posedN = (Z.posedN || 0) + 1; PF.s('z.pose'); pose(o, dt * pk, o.sp, dc < (mobile ? 30 : Z.chaos ? 35 : 55)); PF.e('z.pose'); }
      if ((o.groanT -= dt) <= 0) { o.groanT = 4 + rnd() * 7; if (dc < 45 && Z.groanTok >= 1 && (Z.groanTok -= 1) >= 0 && sfx.groan && sfx.ctx) sfx.at ? zAt(o.pos, () => sfx.groan(), .3) : sfx.groan(); } }
    Z.drawn = drawn; PF.s('z.sep'); if (host) separate(); PF.e('z.sep');
    if (host && Z.chaos !== Z.wantChaos) applyChaos(Z.wantChaos); // e.g. just became the host
    if (Z.role() === 'host' && (Z.snapT -= dt) <= 0) { Z.snapT = .12; PF.s('z.snap'); sendSnaps(); PF.e('z.snap'); }
    hud(); }

  // ---- multiplayer: host snapshots, client mirror ----
  const row = o => [o.id, KIND_LIST.indexOf(o.kind), +o.pos.x.toFixed(1), +o.pos.z.toFixed(1), +o.yaw.toFixed(2), o.alive ? o.st : 2, Math.max(0, Math.round(o.hp)), +o.sp.toFixed(1)];
  // v37: small hordes go to everyone in one message (as before); a chaos horde goes per client: the nearest rows to that rider
  // (within chaosRowR m, at most chaosRows), so a client gets ~4 KB per snapshot instead of everything
  function sendSnaps() { const R = c.remotes ? c.remotes() : []; if (Z.list.length <= ZSET.chaosRows || !c.sendTo || !R.length) { c.send && c.send(snap()); return; }
    const L = Z.list, n = L.length, d2 = SD.length < n ? (SD = new Float64Array(n * 2)) : SD;
    for (const r of R) { if (!r || !r.id) continue; const s0 = r.s, ok = s0 && Number.isFinite(s0.x) && Number.isFinite(s0.z), x = ok ? s0.x : P.pos.x, z = ok ? s0.z : P.pos.z; IX.length = 0;
      for (let i = 0; i < n; i++) { const o = L[i], d = (o.pos.x - x) ** 2 + (o.pos.z - z) ** 2; if (d < ZSET.chaosRowR ** 2) { d2[i] = d; IX.push(i); } }
      IX.sort((a, b) => d2[a] - d2[b]); if (IX.length > ZSET.chaosRows) IX.length = ZSET.chaosRows;
      c.sendTo(r.id, { t: 'zs', w: Z.wave, c: Z.chaos ? 1 : 0, n: Z.live || 0, z: IX.map(i => row(L[i])) }); } }
  let SD = new Float64Array(0); const IX = [];
  function snap() { return { t: 'zs', w: Z.wave, c: Z.chaos ? 1 : 0, n: Z.live || 0, z: Z.list.map(o => [o.id, KIND_LIST.indexOf(o.kind), +o.pos.x.toFixed(1), +o.pos.z.toFixed(1), +o.yaw.toFixed(2), o.alive ? o.st : 2, Math.max(0, Math.round(o.hp)), +o.sp.toFixed(1)]) }; }
  function apply(m) { if (!m || !Array.isArray(m.z)) return; Z.wave = m.w | 0 || Z.wave; if (Z.role() === 'client') { Z.chaos = m.c === 1; Z.hostLive = Number.isFinite(m.n) ? m.n : null; } const seen = new Set(), now = performance.now(); Z.snapAt = now;
    for (const r of m.z.slice(0, 160)) { /* v37: up to 160 rows (the host sends at most 120 per client) */ if (!Array.isArray(r) || r.length < 8) continue; const [id, ki, x, z, yaw, st, hp, sp] = r; // v36: malformed / non-finite / out-of-world rows are skipped cheaply
      if (!Number.isFinite(id) || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(yaw) || !Number.isFinite(hp) || !Number.isFinite(sp) || Math.abs(x) > WALK + 5 || Math.abs(z) > WALK + 5 || !(st === 0 || st === 1 || st === 2)) { Z.badRows = (Z.badRows || 0) + 1; continue; } seen.add(id);
      let o = Z.byId.get(id); if (!o) { if (st === 2) continue; o = spawn(KIND_LIST[ki] || 'walker', [x, z], id); o.yaw = yaw; }
      if (!o.alive && st !== 2 && o.predT && now - o.predT > 900) revive(o, hp); // v36: my shot looked like a kill but the host says it is still up
      o.net = { x, z, yaw, st, sp }; if (st === 2 && o.alive) kill(o, false, 'remote'); else if (o.alive) o.hp = hp; }
    for (const o of [...Z.list]) if (!seen.has(o.id) && o.alive) despawn(o); }
  // v36: the host checks a client's hit: known weapon (or a hired gun), no more than that weapon's best (gold-tier, headshot)
  // damage, no faster than it can fire (token bucket), in range of where that rider is, and each shot counts once
  const W_GAP = { revolver: .14, rifle: .16, sniper: .7, tommy: .075, gold: .7, bandit: .12 }, W_RANGE = { revolver: 135, rifle: 260, sniper: 420, tommy: 170, gold: 3200, bandit: 140 };
  function reject(why) { Z.rejected = Z.rejected || {}; Z.rejected[why] = (Z.rejected[why] || 0) + 1; return false; }
  function remoteHit(m, from) { if (!m || !from || !Number.isFinite(m.id) || !Number.isFinite(m.d) || m.d < 0) return reject('malformed');
    const w = m.b ? 'bandit' : (ZSET.dmg[m.w] ? m.w : null); if (!w) return reject('weapon');
    let V = Z.val.get(from); if (!V) Z.val.set(from, V = { ids: new Set(), q: [], b: {} });
    if (Number.isFinite(m.s)) { const key = m.s + ':' + m.id; if (V.ids.has(key)) return reject('dupe'); V.ids.add(key); V.q.push(key); if (V.q.length > 256) V.ids.delete(V.q.shift()); }
    const now = performance.now() / 1000, gap = W_GAP[w] * .7 * .75, cap = w === 'bandit' || w === 'tommy' ? 8 : 4, B = V.b[w] || (V.b[w] = { tok: cap, t: now }); B.tok = Math.min(cap, B.tok + (now - B.t) / gap); B.t = now; if (B.tok < 1) return reject('rate'); B.tok -= 1;
    const o = Z.byId.get(m.id); if (!o) return reject('unknown');
    const R = (c.remotes ? c.remotes() : []).find(q => q.id === from); if (R && R.s && Number.isFinite(R.s.x) && Math.hypot(R.s.x - o.pos.x, R.s.z - o.pos.z) > W_RANGE[w] + 30) return reject('range');
    const max = w === 'bandit' ? 85 : ZSET.dmg[w] * (m.h ? ZSET.head : 1) * 2 + 1; if (m.d > max) reject('clamped');
    Z.byBandit = w === 'bandit'; const ok = damage(o, Math.min(max, m.d), !!m.h, null, null, 'remote', from); Z.byBandit = false; return ok; }
  function revive(o, hp) { o.alive = true; o.hp = Math.max(1, hp); o.deadT = 0; o.st = 0; o.predT = 0; o.g.rotation.set(0, o.yaw, 0); o.pos.y = hAt(o.pos.x, o.pos.z); Z.revived = (Z.revived || 0) + 1; }
  function confirmKill(m) { if (m && Number.isFinite(m.z)) { if (Z.gotK.has(m.z)) return false; Z.gotK.add(m.z); Z.gotQ.push(m.z); if (Z.gotQ.length > 512) Z.gotK.delete(Z.gotQ.shift()); } // v36: each kill pays once
    if (!(m && m.b)) { Z.kills++; if (m && m.h) Z.heads++; } return true; } // the host says my shot (or my hired gun) killed one
  function remoteHurt(m) { if (!m || !Number.isFinite(m.d)) return; hurtMe(Math.max(0, Math.min(60, m.d)), Math.max(0, Math.min(80, m.hz || 0))); }

  // ---- HUD: health, wave, kills; red hurt flash ----
  let el = null, fl = null;
  function hud() { if (!el) { el = document.createElement('div'); el.id = 'hrZ'; document.body.appendChild(el); fl = document.createElement('div'); fl.id = 'hrHurt'; document.body.appendChild(fl); }
    let live = 0; for (const o of Z.list) if (o.alive) live++; const h = H.mounted;
    const dsp = H.on && Z.on ? '' : 'none', fds = H.on ? '' : 'none', op = Z.dead > 0 ? '0.85' : (Z.flash * .7).toFixed(2);
    if (el.style.display !== dsp) el.style.display = dsp; if (fl.style.display !== fds) fl.style.display = fds; if (fl.__op !== op) { fl.__op = op; fl.style.opacity = op; }
    if (dsp) return;
    const hh = h ? Math.round(100 * (h.hp ?? ZSET.horseHp) / ZSET.horseHp) : null;
    const html = `<b class="hp"><i style="width:${Math.round(Z.hp)}%"></i></b>${hh != null ? `<b class="hp horse"><i style="width:${hh}%"></i></b>` : ''}<span>${Z.chaos ? '<b class="chaos">CHAOS</b> ' : ''}☠ WAVE ${Z.wave} · ${live} near · ${Z.kills} down${Z.heads ? ` (${Z.heads} ◉)` : ''}</span>${Z.dead > 0 ? '<em>OVERRUN</em>' : inTown(P.pos.x, P.pos.z) ? '<em class="safe">🛡 SAFE ZONE · TOWN</em>' : inPenSafe(P.pos.x, P.pos.z) && !h ? '<em class="safe">SAFE IN THE PEN</em>' : ''}`; if (html !== el.__h) { el.__h = html; el.innerHTML = html; } }
  const netState = () => ({ dd: Z.dead > 0 ? 1 : 0 });
  return { setChaos, get chaos() { return Z.chaos; }, get wantChaos() { return Z.wantChaos; }, state: Z, list: Z.list, settings: ZSET, kinds: ZKINDS, tick, spawn, damage, onHit, rayHit, assistPoints, headPos, snap, apply, remoteHit, remoteHurt, confirmKill, hurtMe, netState, inPenRect, inPenSafe, inSafeZone, inTown, despawn,
    clear() { for (const o of [...Z.list]) despawn(o); } };
}
