// HORSE RIDER: solo open-landscape mode. Big rolling heightfield, scattered trees/rocks, a small fenced pen with
// procedural horses. Walk up to a horse, E / RIDE to mount, same action to dismount. Ridden horses use a
// third-person chase camera; on foot is first-person. Self-contained: no voxel grid, no zombies/co-op/voice.
import * as THREE from 'three';
import { mulberry } from './models.js';
const $ = id => document.getElementById(id);
const S = 800, EDGE = 360;                // map size (m) and walkable half-extent
const PEN = { x: 0, z: 0, hw: 13, hd: 9, gate: 2.6 }; // pen centre, half sizes, gate half-width (south side, +z)
const SPAWN = { x: 4, z: 34 };
const MOUNT_R = 2.8, COOLDOWN = .45;
const sstep = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
function rawH(x, z) {
  const hills = Math.sin(x * .011 + 1.3) * Math.cos(z * .009 - .4) * 9 + Math.sin(x * .023 + z * .017) * 4.5 + Math.sin(z * .041 - x * .013) * 1.8 + Math.sin(x * .09 + z * .07) * .35;
  const e = Math.max(Math.abs(x), Math.abs(z)); const mount = sstep(EDGE - 70, S / 2, e) * (38 + Math.sin(x * .05) * 8 + Math.cos(z * .045) * 8);
  return hills + mount;
}
const BASE = rawH(PEN.x, PEN.z);
export function hAt(x, z) { const d = Math.hypot(x - PEN.x, z - PEN.z); return BASE + (rawH(x, z) - BASE) * sstep(24, 60, d); }

function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .85, metalness: o.m ?? 0, ...(o.map ? { map: o.map } : {}) }); }
function box(g, w, h, d, m, x, y, z) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; }
// Procedural horse, ~1.6 m at the withers, facing -z (same convention as the camera's forward).
export function makeHorse(coat, mane, saddle) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mc = std(coat, { r: .7 }), mm = std(mane, { r: .9 }), hoof = std(0x222018), sad = std(saddle, { r: .6 }), blanket = std(0x9a2f2a);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42, 1.25, 6, 12), mc); torso.rotation.x = Math.PI / 2; torso.position.set(0, 1.28, 0); torso.castShadow = true; body.add(torso);
  const neck = new THREE.Group(); neck.position.set(0, 1.45, -.78); body.add(neck);
  const nk = box(neck, .3, .85, .42, mc, 0, .32, -.12); nk.rotation.x = -.55;
  box(neck, .08, .75, .2, mm, 0, .4, .02).rotation.x = -.55;                 // mane
  const head = new THREE.Group(); head.position.set(0, .68, -.42); neck.add(head);
  box(head, .26, .3, .62, mc, 0, 0, -.18).rotation.x = .35;                     // head
  box(head, .22, .22, .22, mc, 0, -.12, -.48);                                  // muzzle
  for (const s of [-1, 1]) { box(head, .06, .16, .06, mc, s * .09, .22, .04); box(head, .04, .04, .04, std(0x111111), s * .135, .04, -.14); }
  const tail = new THREE.Group(); tail.position.set(0, 1.42, .95); body.add(tail); box(tail, .12, .75, .14, mm, 0, -.33, .12).rotation.x = .35;
  // saddle + blanket + stirrups make "rideable" readable at a glance
  box(body, .9, .04, .72, blanket, 0, 1.7, .05); box(body, .62, .12, .56, sad, 0, 1.76, .05); box(body, .12, .16, .1, sad, 0, 1.88, -.18);
  for (const s of [-1, 1]) box(body, .03, .42, .05, std(0x333333, { m: .6 }), s * .38, 1.5, .05);
  const legs = [];
  for (const [x, z] of [[-.22, -.62], [.22, -.62], [-.22, .62], [.22, .62]]) { const L = new THREE.Group(); L.position.set(x, 1.1, z); body.add(L);
    box(L, .17, .62, .2, mc, 0, -.3, 0); const low = new THREE.Group(); low.position.set(0, -.6, 0); L.add(low); box(low, .12, .46, .13, mc, 0, -.22, 0); box(low, .15, .1, .17, hoof, 0, -.48, -.01); L.userData.low = low; legs.push(L); }
  g.userData = { body, neck, head, tail, legs, phase: Math.random() * 6 };
  return g;
}
function makeRider(color) {
  const g = new THREE.Group(), cloth = std(color), skin = std(0xd2a27c), pants = std(0x3a3a44), hat = std(0x5a3b22);
  box(g, .42, .55, .26, cloth, 0, .35, 0); const h = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), skin); h.position.set(0, .76, 0); h.castShadow = true; g.add(h);
  box(g, .5, .04, .5, hat, 0, .87, 0); box(g, .26, .14, .26, hat, 0, .95, 0);
  for (const s of [-1, 1]) { const a = box(g, .1, .42, .12, cloth, s * .25, .42, -.12); a.rotation.x = .9; const l = box(g, .14, .5, .16, pants, s * .2, .02, -.05); l.rotation.x = .35; l.rotation.z = s * .25; }
  return g;
}
function horseAnim(hz, dt, speed, graze) {
  const u = hz.userData, k = Math.min(1, Math.abs(speed) / 4); u.phase += dt * (2.2 + Math.abs(speed) * .9);
  const gallop = Math.abs(speed) > 9, a = (.25 + .35 * Math.min(1, Math.abs(speed) / 12)) * k;
  u.legs.forEach((L, i) => { const off = gallop ? [0, .5, 2.6, 3.1][i] : [0, Math.PI, Math.PI, 0][i]; const s = Math.sin(u.phase + off); L.rotation.x = s * a; L.userData.low.rotation.x = Math.max(0, -Math.cos(u.phase + off)) * a * 1.4; });
  u.body.position.y = Math.abs(Math.sin(u.phase)) * (gallop ? .12 : .04) * k; u.body.rotation.x = gallop ? Math.sin(u.phase) * .05 : 0;
  const gz = graze ? .95 : 0; u.neck.rotation.x += ((gz - Math.sin(u.phase) * .06 * k) - u.neck.rotation.x) * Math.min(1, dt * 3);
  u.tail.rotation.z = Math.sin(u.phase * .7) * .2; u.tail.rotation.x = -.2 - k * .5;
}

export function createHorseRider(ctx) {
  const { scene, GX, P, keys, input, camera, sfx, msg, PBRS } = ctx;
  const H = { on: false, horses: [], mounted: null, cd: 0, prompt: '', obst: [], fence: [], speed: 0, t: 0, near: null, vy: 0, ground: true, riddenT: 0, mounts: 0 };
  const rnd = mulberry(42);
  function buildWorld() {
    const Q = GX.Q, seg = ctx.mobile || Q.trees < 100 ? 150 : 230;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv, col = [], c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = hAt(x, z); p.setY(i, y); uv.setXY(i, x / 3, z / 3);
      const hi = sstep(14, 40, y - BASE), n = Math.sin(x * .07) * Math.cos(z * .06) * .5 + .5; c.setHSL(.25 - hi * .15 + n * .03, .5 - hi * .3, .5 + n * .1 + hi * .1); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const gmap = PBRS && PBRS.grass && PBRS.grass.map; if (gmap) { const t = gmap.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.needsUpdate = true; gm.map = t; }
    const ground = new THREE.Mesh(geo, gm); ground.receiveShadow = true; scene.add(ground);
    // trees (trunk + two-cone crown), rocks: instanced, with simple circle collision
    const nT = Math.round(Q.trees * 3.2), up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .3, 3, 7).translate(0, 1.5, 0), std(0x5a3f2a), nT);
    const cg = new THREE.ConeGeometry(2.1, 4.2, 9).translate(0, 4.4, 0), cg2 = new THREE.ConeGeometry(1.5, 3, 9).translate(0, 6.4, 0);
    const crown = new THREE.InstancedMesh(cg, std(0x2f5a2c), nT), crown2 = new THREE.InstancedMesh(cg2, std(0x3a6a32), nT);
    let k = 0; for (let i = 0; i < nT * 6 && k < nT; i++) { const x = (rnd() - .5) * 2 * (EDGE + 20), z = (rnd() - .5) * 2 * (EDGE + 20);
      if (Math.hypot(x - PEN.x, z - PEN.z) < 34 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) continue; if (rnd() > .35 + .65 * (Math.sin(x * .02) * Math.cos(z * .025) * .5 + .5)) continue; // groves
      const s = .8 + rnd() * .7, y = hAt(x, z) - .1; m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rnd() * 6.28), new THREE.Vector3(s, s, s));
      trunk.setMatrixAt(k, m4); crown.setMatrixAt(k, m4); crown2.setMatrixAt(k, m4); H.obst.push([x, z, .35 * s]); k++; }
    for (const im of [trunk, crown, crown2]) { im.count = k; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); }
    const rg = new THREE.IcosahedronGeometry(1, 1); { const rp = rg.attributes.position; for (let i = 0; i < rp.count; i++) rp.setY(i, rp.getY(i) * .6); rg.computeVertexNormals(); }
    const nR = Math.round(Q.trees * 1.2), rock = new THREE.InstancedMesh(rg, std(0x8a8a84, { r: 1 }), nR); let r = 0;
    for (let i = 0; i < nR * 4 && r < nR; i++) { const x = (rnd() - .5) * 2 * EDGE, z = (rnd() - .5) * 2 * EDGE; if (Math.hypot(x - PEN.x, z - PEN.z) < 30 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8) continue;
      const s = .4 + rnd() * rnd() * 2.6; m4.compose(new THREE.Vector3(x, hAt(x, z) - s * .2, z), q.setFromEuler(new THREE.Euler(rnd() * .3, rnd() * 6, 0)), new THREE.Vector3(s * 1.3, s, s)); rock.setMatrixAt(r++, m4); if (s > .7) H.obst.push([x, z, s * 1.1]); }
    rock.count = r; rock.castShadow = rock.receiveShadow = true; rock.computeBoundingSphere(); scene.add(rock);
    // grass tufts around the pen
    const nG = Math.round(Q.grass * .8); if (nG) { const bg = new THREE.PlaneGeometry(.5, .45).translate(0, .22, 0), bg2 = bg.clone().rotateY(Math.PI / 2); const pos = [...bg.toNonIndexed().attributes.position.array, ...bg2.toNonIndexed().attributes.position.array];
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.computeVertexNormals();
      const tm = new THREE.MeshStandardMaterial({ color: 0x6f8f3a, side: THREE.DoubleSide, roughness: 1 }); const tufts = new THREE.InstancedMesh(tg, tm, nG); let n = 0;
      for (let i = 0; i < nG; i++) { const a = rnd() * 6.28, d = 4 + Math.sqrt(rnd()) * 110, x = PEN.x + Math.cos(a) * d, z = PEN.z + Math.sin(a) * d; const s = .6 + rnd() * .9;
        m4.compose(new THREE.Vector3(x, hAt(x, z), z), q.setFromAxisAngle(up, rnd() * 6.28), new THREE.Vector3(s, s, s)); tufts.setMatrixAt(n++, m4); }
      tufts.count = n; tufts.receiveShadow = true; tufts.computeBoundingSphere(); scene.add(tufts); }
    buildPen();
  }
  function buildPen() {
    const wood = std(0x7a5634), dark = std(0x5b3f26), y0 = BASE, { x: cx, z: cz, hw, hd, gate } = PEN;
    const corners = [[cx - hw, cz - hd], [cx + hw, cz - hd], [cx + hw, cz + hd], [cx - hw, cz + hd]];
    const sides = [[0, 1], [1, 2], [3, 2], [0, 3]]; // north, east, south (gate), west
    const g = new THREE.Group(); scene.add(g);
    sides.forEach(([a, b], si) => { const [x0, z0] = corners[a], [x1, z1] = corners[b];
      const segs = si === 2 ? [[x0, z0, cx - gate, z1], [cx + gate, z0, x1, z1]] : [[x0, z0, x1, z1]];
      for (const [ax, az, bx, bz] of segs) { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.2)); H.fence.push([ax, az, bx, bz]);
        for (let i = 0; i <= n; i++) box(g, .16, 1.45, .16, dark, ax + (bx - ax) * i / n, y0 + .7, az + (bz - az) * i / n);
        for (const ry of [.55, 1.15]) { const rail = box(g, L, .1, .07, wood, (ax + bx) / 2, y0 + ry, (az + bz) / 2); rail.rotation.y = -Math.atan2(bz - az, bx - ax); } } });
    // gate posts + sign, trough, hay
    for (const s of [-1, 1]) box(g, .22, 2.1, .22, dark, cx + s * gate, y0 + 1.05, cz + hd);
    box(g, gate * 2 + .3, .14, .14, dark, cx, y0 + 2.05, cz + hd);
    for (const back of [0, 1]) { const sign = signMesh('HORSE PEN'); sign.position.set(cx, y0 + 2.45, cz + hd + (back ? -.03 : .03)); if (back) sign.rotation.y = Math.PI; g.add(sign); }
    box(g, 2.2, .45, .7, std(0x6a6a70, { m: .5, r: .5 }), cx - hw + 2, y0 + .25, cz - hd + 1.5); box(g, 2, .05, .5, std(0x4a7da0, { r: .2 }), cx - hw + 2, y0 + .47, cz - hd + 1.5);
    for (const [x, z] of [[cx + hw - 1.8, cz - hd + 1.6], [cx + hw - 3.3, cz - hd + 1.6], [cx + hw - 2.5, cz - hd + 1.6]]) { const hb = box(g, 1.2, .7, .8, std(0xc9a64a, { r: 1 }), x, y0 + (z === cz - hd + 1.6 && x === cx + hw - 2.5 ? 1.05 : .35), z); hb.receiveShadow = true; }
    H.obst.push([cx - hw + 2, cz - hd + 1.5, 1.1], [cx + hw - 2.5, cz - hd + 1.6, 1.6]);
  }
  function signMesh(text) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#5b3f26'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#e8d2a0'; x.lineWidth = 8; x.strokeRect(6, 6, 500, 116);
    x.fillStyle = '#f3e3b8'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.fillText(text, 256, 86); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3, .75), new THREE.MeshStandardMaterial({ map: t })); return m; }
  const COATS = [[0x6b4226, 0x241812, 0x4a2c18], [0xe8e0d0, 0xb8b0a0, 0x3a2a1c], [0x2a2220, 0x111111, 0x7a4a24], [0xa8742e, 0xf0e2c0, 0x4a2c18], [0x8a8580, 0x3a3634, 0x5a3a20]];
  function spawnHorses() {
    COATS.forEach(([coat, mane, sad], i) => { const g = makeHorse(coat, mane, sad); const x = PEN.x - 8 + i * 4 + (rnd() - .5), z = PEN.z - 3 + (i % 2) * 5;
      g.position.set(x, BASE, z); g.rotation.y = rnd() * 6.28; scene.add(g);
      H.horses.push({ id: i, g, pos: g.position, yaw: g.rotation.y, speed: 0, tgt: null, wait: rnd() * 3, graze: rnd() < .5, inPen: true }); });
  }
  const rider = makeRider(0x2c5d8a); rider.visible = false;
  const inPen = (x, z, m = 0) => Math.abs(x - PEN.x) < PEN.hw - m && Math.abs(z - PEN.z) < PEN.hd - m;
  function segDist(px, pz, [ax, az, bx, bz]) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
  // blocked(x, z, r, skipHorse): fence, trees/rocks, other horses, map edge
  function blocked(x, z, r, skip) {
    if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) return true;
    for (const f of H.fence) if (segDist(x, z, f) < r + .1) return true;
    for (const [ox, oz, or] of H.obst) if (Math.abs(ox - x) < or + r && Math.abs(oz - z) < or + r && Math.hypot(ox - x, oz - z) < or + r) return true;
    for (const h of H.horses) if (h !== skip && h !== H.mounted && Math.hypot(h.pos.x - x, h.pos.z - z) < .75 + r) return true;
    return false;
  }
  function moveCircle(pos, dx, dz, r, skip) { // axis-separated slide
    let hit = false; if (!blocked(pos.x + dx, pos.z, r, skip)) pos.x += dx; else hit = true; if (!blocked(pos.x, pos.z + dz, r, skip)) pos.z += dz; else hit = true; return hit; }
  function nearestHorse() { let best = null, bd = MOUNT_R; for (const h of H.horses) { const d = Math.hypot(h.pos.x - P.pos.x, h.pos.z - P.pos.z); if (d < bd) { bd = d; best = h; } } return best; }
  function use() {
    if (!H.on || H.cd > 0) return false;
    if (H.mounted) return dismount();
    const h = nearestHorse(); if (!h) { msg('Walk up to a horse to ride it', 1.5); return false; }
    H.mounted = h; H.cd = COOLDOWN; H.speed = 0; h.speed = 0; h.tgt = null; h.graze = false; P.yaw = h.yaw; P.pitch = -.18; rider.visible = true; h.g.add(rider); rider.position.set(0, 1.72, .08);
    H.mounts++; sfx.ui && sfx.ui(); msg('Riding! W to go · Shift to gallop · E to get off', 2.5); return true;
  }
  function dismount() {
    const h = H.mounted; if (!h) return false; const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw), rx = -fz, rz = fx;
    const tries = [[-rx * 1.5, -rz * 1.5], [rx * 1.5, rz * 1.5], [-fx * 2.4, -fz * 2.4], [fx * 2.4, fz * 2.4], [-rx * 2.6, -rz * 2.6], [rx * 2.6, rz * 2.6]];
    let spot = null; for (const [ox, oz] of tries) { const x = h.pos.x + ox, z = h.pos.z + oz; if (!blocked(x, z, .35, h) && !(Math.abs(x) > EDGE || Math.abs(z) > EDGE)) { spot = [x, z]; break; } }
    if (!spot) spot = [h.pos.x - rx * 1.5, h.pos.z - rz * 1.5];
    P.pos.set(spot[0], hAt(spot[0], spot[1]), spot[1]); H.vy = 0; H.mounted = null; H.cd = COOLDOWN; h.speed = 0; h.wait = 4 + rnd() * 4; h.inPen = inPen(h.pos.x, h.pos.z, .5); h.graze = true;
    h.g.remove(rider); rider.visible = false; P.yaw = h.yaw; P.pitch = 0; sfx.ui && sfx.ui(); msg('Dismounted', 1.2); return true;
  }
  function init() {
    H.on = true; buildWorld(); spawnHorses(); P.spawn.set(SPAWN.x, hAt(SPAWN.x, SPAWN.z), SPAWN.z); P.pos.copy(P.spawn);
    P.yaw = Math.atan2(SPAWN.x - PEN.x, SPAWN.z - PEN.z); P.pitch = -.05; P.hp = 100;
    GX.setLighting('day', false); scene.fog.density = .0035; GX.followSun(P.pos);
    msg(ctx.mobile ? 'HORSE RIDER — walk to the pen, tap RIDE next to a horse' : 'HORSE RIDER — walk to the pen and press E next to a horse', 5);
  }
  // ---------------- per-frame ----------------
  const tmp = new THREE.Vector3();
  function tick(dt) {
    if (!H.on) return; H.t += dt; H.cd = Math.max(0, H.cd - dt);
    const h = H.mounted;
    let fwdIn = 0, sideIn = 0; if (keys.KeyW || keys.ArrowUp) fwdIn += 1; if (keys.KeyS || keys.ArrowDown) fwdIn -= 1; if (keys.KeyD || keys.ArrowRight) sideIn += 1; if (keys.KeyA || keys.ArrowLeft) sideIn -= 1;
    const stick = Math.min(1, Math.hypot(input.mx || 0, input.mz || 0)); if (stick > .05) { fwdIn = -input.mz; sideIn = input.mx; }
    const run = !!keys.ShiftLeft || !!keys.ShiftRight || (stick > .92 && fwdIn > .6);
    const jump = keys.Space || input.jump;
    if (h) {
      // reins: A/D (or stick sideways) turn; mouse/drag look also steers while moving forward
      P.yaw -= sideIn * dt * 1.9 * (H.speed < 0 ? -1 : 1);
      const target = fwdIn > 0 ? (run ? 18 : 10) * Math.min(1, fwdIn + .15) : fwdIn < 0 ? -2.5 : 0;
      H.speed += (target - H.speed) * Math.min(1, dt * (target > H.speed ? 1.6 : 2.6));
      let dy = P.yaw - h.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); h.yaw += dy * Math.min(1, dt * (Math.abs(H.speed) > .5 ? 4 : 1.2));
      const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
      const hit = moveCircle(h.pos, fx * H.speed * dt, fz * H.speed * dt, .8, h); if (hit) H.speed *= .4;
      // nose point must not poke through the fence
      const g0 = hAt(h.pos.x, h.pos.z); if (jump && H.ground) { H.vy = 6.2; H.ground = false; }
      H.vy -= 22 * dt; h.pos.y += H.vy * dt; if (h.pos.y <= g0) { h.pos.y = g0; H.vy = 0; H.ground = true; }
      h.g.rotation.y = h.yaw; const ahead = hAt(h.pos.x + fx, h.pos.z + fz), behind = hAt(h.pos.x - fx, h.pos.z - fz); h.g.rotation.x = Math.atan2(ahead - behind, 2) * .8;
      horseAnim(h.g, dt, H.ground ? H.speed : 3, false); P.pos.set(h.pos.x, h.pos.y + 1.1, h.pos.z); H.riddenT += dt;
      const ob = H.clop || 0; H.clop = ob + dt * Math.abs(H.speed) * .55; if (H.ground && Math.abs(H.speed) > 1 && Math.floor(ob) !== Math.floor(H.clop)) sfx.step && sfx.step(true);
    } else {
      const sp = run && fwdIn > 0 ? 7.2 : 4.6, f = tmp.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), rx = -f.z, rz = f.x;
      let mx = f.x * fwdIn + rx * sideIn, mz = f.z * fwdIn + rz * sideIn; const l = Math.hypot(mx, mz); if (l > 0) { const k = sp * (stick > .05 ? Math.min(1, stick) : 1) / l; mx *= k; mz *= k; }
      moveCircle(P.pos, mx * dt, mz * dt, .35, null);
      const g0 = hAt(P.pos.x, P.pos.z); if (jump && H.ground) { H.vy = 7; H.ground = false; }
      H.vy -= 22 * dt; P.pos.y += H.vy * dt; if (P.pos.y <= g0) { P.pos.y = g0; H.vy = 0; H.ground = true; }
      const ob = P.bob; P.bob += dt * l * (l ? sp / l : 0) * 1.6; if (H.ground && l && Math.floor(ob / Math.PI) !== Math.floor(P.bob / Math.PI)) sfx.step && sfx.step(false);
    }
    // free horses: wander inside the pen (or graze where they were left)
    for (const o of H.horses) { if (o === h) continue;
      if (o.tgt) { const dx = o.tgt[0] - o.pos.x, dz = o.tgt[1] - o.pos.z, d = Math.hypot(dx, dz);
        if (d < .4) { o.tgt = null; o.wait = 2 + rnd() * 5; o.graze = rnd() < .6; o.speed = 0; }
        else { const want = Math.atan2(-dx, -dz); let dy = want - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 2.5); o.speed += (1.3 - o.speed) * Math.min(1, dt * 2);
          if (moveCircle(o.pos, -Math.sin(o.yaw) * o.speed * dt, -Math.cos(o.yaw) * o.speed * dt, .8, o)) { o.tgt = null; o.wait = 1 + rnd() * 2; } } }
      else { o.speed *= Math.max(0, 1 - dt * 4); o.wait -= dt; if (o.wait <= 0) { if (o.inPen) o.tgt = [PEN.x + (rnd() - .5) * (PEN.hw * 2 - 4), PEN.z + (rnd() - .5) * (PEN.hd * 2 - 4)]; else { const a = rnd() * 6.28; o.tgt = [o.pos.x + Math.cos(a) * 3, o.pos.z + Math.sin(a) * 3]; } o.graze = false; } }
      o.pos.y = hAt(o.pos.x, o.pos.z); o.g.rotation.y = o.yaw; horseAnim(o.g, dt, o.speed, o.graze); }
    H.near = h ? null : nearestHorse();
    H.prompt = h ? (ctx.mobile ? 'Tap GET OFF to dismount' : '[E] Get off the horse') : H.near ? (ctx.mobile ? 'Tap RIDE to mount' : '[E] Ride horse') : '';
  }
  // third-person chase camera when riding; first-person eye height on foot
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  function syncCamera(dt) {
    const h = H.mounted;
    if (!h) { camera.position.set(P.pos.x, P.pos.y + 1.62 + (H.ground ? Math.abs(Math.cos(P.bob)) * .04 : 0), P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); H.camInit = false; return; }
    const pitch = Math.max(-.7, Math.min(.35, P.pitch)), dist = 3.9 + Math.min(1, Math.abs(H.speed) * .05);
    look.set(h.pos.x, h.pos.y + 2.3, h.pos.z);
    const want = new THREE.Vector3(look.x + Math.sin(P.yaw) * Math.cos(pitch) * dist, look.y - Math.sin(pitch) * dist + .6, look.z + Math.cos(P.yaw) * Math.cos(pitch) * dist);
    want.y = Math.max(want.y, hAt(want.x, want.z) + .6);
    if (!H.camInit || !dt) { camPos.copy(want); H.camInit = true; } else camPos.lerp(want, Math.min(1, dt * 10));
    camera.position.copy(camPos); camera.lookAt(look);
  }
  function hud() {
    const pr = $('hrPrompt'); if (pr) { pr.textContent = H.prompt; pr.hidden = !H.prompt; pr.classList.toggle('riding', !!H.mounted); }
    const d = Math.round(Math.hypot(P.pos.x - PEN.x, P.pos.z - PEN.z));
    $('mode').textContent = '🐎 HORSE RIDER'; $('timer').textContent = H.mounted ? Math.round(Math.abs(H.speed) * 3.6) + ' km/h' : ''; $('stars').textContent = '';
    $('sub').textContent = H.mounted ? (Math.abs(H.speed) > 12 ? 'Galloping' : Math.abs(H.speed) > 1 ? 'Riding' : 'Mounted') + (ctx.mobile ? ' · push the stick all the way to gallop' : ' · W ride · Shift gallop · A/D turn · Space jump') : d > 16 ? `Horse pen ${d} m away` : inPen(P.pos.x, P.pos.z) ? 'In the pen — walk up to a horse' : 'At the horse pen';
  }
  const touchLabel = () => H.mounted ? 'GET OFF' : H.near ? 'RIDE' : '';
  return { state: H, init, tick, syncCamera, hud, use, dismount, touchLabel, hAt, PEN, nearestHorse };
}
