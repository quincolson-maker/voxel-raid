// HORSE RIDER: solo open-landscape mode. Big rolling PBR heightfield, conifer/broadleaf woods, rocks, wind-blown grass,
// a timber post-and-rail pen with a run-in shed, trough and hay. Horses and rider are realistic CC0 GLB models
// (assets/horses, see CREDITS.md): the static horse mesh is rigged at runtime (17-bone skeleton, weights by region)
// and animated procedurally (walk / canter / gallop / idle / graze); the rigged rider is posed seated on the saddle.
// Walk up to a horse, E / RIDE to mount, same action to dismount. Ridden horses use a third-person chase camera; on
// foot is first-person. If the models fail to load (or ?prochorse=1) the older procedural horse/rider are used.
import * as THREE from 'three';
import { GLTFLoader } from '../addons/loaders/GLTFLoader.js';
import { mergeGeometries } from '../addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from '../addons/utils/SkeletonUtils.js';
import { mulberry, conifer } from './models.js';
const $ = id => document.getElementById(id);
const S = 800, EDGE = 360;                // map size (m) and walkable half-extent
const PEN = { x: 0, z: 0, hw: 13, hd: 9, gate: 2.6 }; // pen centre, half sizes, gate half-width (south side, +z)
const SPAWN = { x: 4, z: 34 };
const clearing = (x, z, m = 0) => Math.abs(x - PEN.x) < 11 + m && z > PEN.z && z < PEN.z + 150; // open riding meadow south of the gate
const PATH = [SPAWN.x + 2, SPAWN.z + 30, PEN.x, PEN.z + PEN.hd]; // dirt track from the meadow to the pen gate
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
// ---- fallback: procedural horse, ~1.6 m at the withers, facing -z (same convention as the camera's forward) ----
export function makeHorse(coat, mane, saddle) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mc = std(coat, { r: .7 }), mm = std(mane, { r: .9 }), hoof = std(0x222018), sad = std(saddle, { r: .6 }), blanket = std(0x9a2f2a);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42, 1.25, 6, 12), mc); torso.rotation.x = Math.PI / 2; torso.position.set(0, 1.28, 0); torso.castShadow = true; body.add(torso);
  const neck = new THREE.Group(); neck.position.set(0, 1.45, -.78); body.add(neck);
  const nk = box(neck, .3, .85, .42, mc, 0, .32, -.12); nk.rotation.x = -.55;
  box(neck, .08, .75, .2, mm, 0, .4, .02).rotation.x = -.55;
  const head = new THREE.Group(); head.position.set(0, .68, -.42); neck.add(head);
  box(head, .26, .3, .62, mc, 0, 0, -.18).rotation.x = .35; box(head, .22, .22, .22, mc, 0, -.12, -.48);
  for (const s of [-1, 1]) { box(head, .06, .16, .06, mc, s * .09, .22, .04); box(head, .04, .04, .04, std(0x111111), s * .135, .04, -.14); }
  const tail = new THREE.Group(); tail.position.set(0, 1.42, .95); body.add(tail); box(tail, .12, .75, .14, mm, 0, -.33, .12).rotation.x = .35;
  box(body, .9, .04, .72, blanket, 0, 1.7, .05); box(body, .62, .12, .56, sad, 0, 1.76, .05); box(body, .12, .16, .1, sad, 0, 1.88, -.18);
  for (const s of [-1, 1]) box(body, .03, .42, .05, std(0x333333, { m: .6 }), s * .38, 1.5, .05);
  const legs = [];
  for (const [x, z] of [[-.22, -.62], [.22, -.62], [-.22, .62], [.22, .62]]) { const L = new THREE.Group(); L.position.set(x, 1.1, z); body.add(L);
    box(L, .17, .62, .2, mc, 0, -.3, 0); const low = new THREE.Group(); low.position.set(0, -.6, 0); L.add(low); box(low, .12, .46, .13, mc, 0, -.22, 0); box(low, .15, .1, .17, hoof, 0, -.48, -.01); L.userData.low = low; legs.push(L); }
  g.userData = { kind: 'proc', body, neck, head, tail, legs, phase: Math.random() * 6 };
  return g;
}
function makeProcRider(color) {
  const g = new THREE.Group(), cloth = std(color), skin = std(0xd2a27c), pants = std(0x3a3a44), hat = std(0x5a3b22);
  box(g, .42, .55, .26, cloth, 0, .35, 0); const h = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), skin); h.position.set(0, .76, 0); h.castShadow = true; g.add(h);
  box(g, .5, .04, .5, hat, 0, .87, 0); box(g, .26, .14, .26, hat, 0, .95, 0);
  for (const s of [-1, 1]) { const a = box(g, .1, .42, .12, cloth, s * .25, .42, -.12); a.rotation.x = .9; const l = box(g, .14, .5, .16, pants, s * .2, .02, -.05); l.rotation.x = .35; l.rotation.z = s * .25; }
  g.userData.kind = 'proc'; return g;
}
function procAnim(hz, dt, speed, graze) {
  const u = hz.userData, k = Math.min(1, Math.abs(speed) / 4); u.phase += dt * (2.2 + Math.abs(speed) * .9);
  const gallop = Math.abs(speed) > 9, a = (.25 + .35 * Math.min(1, Math.abs(speed) / 12)) * k;
  u.legs.forEach((L, i) => { const off = gallop ? [0, .5, 2.6, 3.1][i] : [0, Math.PI, Math.PI, 0][i]; const s = Math.sin(u.phase + off); L.rotation.x = s * a; L.userData.low.rotation.x = Math.max(0, -Math.cos(u.phase + off)) * a * 1.4; });
  u.body.position.y = Math.abs(Math.sin(u.phase)) * (gallop ? .12 : .04) * k; u.body.rotation.x = gallop ? Math.sin(u.phase) * .05 : 0;
  const gz = graze ? .95 : 0; u.neck.rotation.x += ((gz - Math.sin(u.phase) * .06 * k) - u.neck.rotation.x) * Math.min(1, dt * 3);
  u.tail.rotation.z = Math.sin(u.phase * .7) * .2; u.tail.rotation.x = -.2 - k * .5;
}

// ---------------- realistic horse: runtime rig ----------------
// Model space of horse.glb: faces +z, hooves on y=0, ~1.55 m at the withers, 2.4 m nose to tail.
const HB = [ // name, parent, rest position (model space)
  ['root', -1, 0, 0, 0], ['body', 0, 0, 1.15, -.2], ['neck', 1, 0, 1.32, .5], ['head', 2, 0, 1.78, .86], ['tail', 1, 0, 1.36, -1.0],
  ['FLu', 1, -.13, 1.02, .33], ['FLl', 5, -.13, .56, .28], ['FLh', 6, -.13, .2, .27],
  ['FRu', 1, .13, 1.02, .33], ['FRl', 8, .13, .56, .28], ['FRh', 9, .13, .2, .27],
  ['HLu', 1, -.13, 1.05, -.78], ['HLl', 11, -.13, .56, -.9], ['HLh', 12, -.14, .2, -.89],
  ['HRu', 1, .13, 1.05, -.78], ['HRl', 14, .13, .56, -.9], ['HRh', 15, .14, .2, -.89]];
const LEGS = [5, 8, 11, 14]; // FL, FR, HL, HR upper bones
function skinHorseGeometry(geo) { // per-vertex bone weights from body regions (legs, neck/head, tail, trunk)
  const p = geo.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), inf = []; const add = (b, w) => { if (w > 1e-3) inf.push([b, w]); };
    let wBody = 1; const ax = Math.abs(x);
    const wt = Math.max(sstep(-1.02, -1.1, z), y < .95 && ax < .07 ? sstep(-.97, -1.03, z) : 0);
    if (wt > 0) { add(4, wt); wBody = 1 - wt; }
    else { const front = z > .08 && z < .62 && y < 1.05, hind = z > -1.02 && z < -.5 && y < 1.15;
      if (front || hind) { let legW = 1 - (front ? sstep(.84, 1.04, y) : sstep(.9, 1.14, y)); if (y > .7) legW *= sstep(.02, .08, ax);
        const b0 = (front ? 5 : 11) + (x > 0 ? 3 : 0), wl = 1 - sstep(.5, .64, y), wh = 1 - sstep(.13, .26, y);
        add(b0, legW * (1 - wl)); add(b0 + 1, legW * wl * (1 - wh)); add(b0 + 2, legW * wl * wh); wBody = 1 - legW; }
      else { const wn = sstep(.32, .62, z) * sstep(1.0, 1.25, y); if (wn > 0) { const wh = sstep(.72, .9, z); add(3, wn * wh); add(2, wn * (1 - wh)); wBody = 1 - wn; } } }
    add(1, wBody); inf.sort((a, b) => b[1] - a[1]); let s = 0; for (let k = 0; k < Math.min(4, inf.length); k++) s += inf[k][1];
    for (let k = 0; k < 4; k++) { const e = inf[k]; si[i * 4 + k] = e ? e[0] : 0; sw[i * 4 + k] = e ? e[1] / s : 0; } }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return geo;
}
function makeBones() { const bones = HB.map(([nm]) => { const b = new THREE.Bone(); b.name = nm; return b; });
  HB.forEach(([, par, x, y, z], i) => { if (par < 0) bones[i].position.set(x, y, z); else { const q = HB[par]; bones[i].position.set(x - q[2], y - q[3], z - q[4]); bones[par].add(bones[i]); } }); return bones; }
// coat recolouring of the bay texture: keep its shading detail, remap coat and points/mane to the target colours
function coatMaterial(base, coat) {
  const m = base.clone(); m.metalness = 0; m.roughness = .78; m.envMapIntensity = .8;
  if (!coat.c) return m;
  const uC = { value: new THREE.Color(coat.c) }, uM = { value: new THREE.Color(coat.m) };
  m.onBeforeCompile = sh => { sh.uniforms.uCoat = uC; sh.uniforms.uMane = uM;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCoat, uMane;').replace('#include <color_fragment>', `#include <color_fragment>
  { float l = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)); float t = smoothstep(.008, .035, l);
    diffuseColor.rgb = mix(uMane * clamp(l / .01, .45, 1.6), uCoat * clamp(l / .065, .35, 1.7), t); }`); };
  m.customProgramCacheKey = () => 'coat'; return m;
}
// curved sheet wrapped over the horse's back (model space): a = angle from the spine, z along the back
function drapeGeo(a0, a1, z0, z1, R, lift, na = 14, nz = 8) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= na; i++) { const a = a0 + (a1 - a0) * i / na, z = z0 + (z1 - z0) * j / nz, r = R + lift(z, a);
    pos.push(Math.sin(a) * r, 1.13 + Math.cos(a) * r, z); uv.push(i / na, j / nz); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const backLift = z => Math.max(0, z + .05) * .7; // withers rise towards the neck
let SADDLE = null;
function saddleParts(PB) {
  if (SADDLE) return SADDLE;
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a3219, roughness: .42, metalness: 0, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: .5, side: THREE.DoubleSide });
  const wool = new THREE.MeshStandardMaterial({ color: 0x7c2420, roughness: 1, side: THREE.DoubleSide, ...(PB && PB.hesco ? { map: PB.hesco.map, normalMap: PB.hesco.normalMap } : {}) });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: .3, metalness: 1 });
  const pad = drapeGeo(-1.3, 1.3, -.52, .1, .315, z => backLift(z) + .012);
  const seat = drapeGeo(-.95, .95, -.42, .02, .315, (z, a) => backLift(z) + .035 + sstep(-.3, -.42, z) * .09 * Math.cos(a * 1.4) + sstep(-.08, .02, z) * .1 * Math.cos(a * 1.6));
  const girth = drapeGeo(.9, Math.PI * 2 - .9, -.13, -.04, .3, () => .004, 16, 1);
  const leatherStrap = new THREE.BoxGeometry(.025, .4, .035).translate(0, -.2, 0), stirrup = new THREE.TorusGeometry(.065, .011, 6, 14);
  const rein = new THREE.CylinderGeometry(.007, .007, 1, 4, 1).translate(0, .5, 0).rotateX(Math.PI / 2);
  return (SADDLE = { leather, dark, wool, steel, pad, seat, girth, leatherStrap, stirrup, rein });
}
function makeSaddle(PB) { // returns a group in horse model space
  const s = saddleParts(PB), g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(s.pad, s.wool); add(s.seat, s.leather); add(s.girth, s.dark);
  for (const sx of [-1, 1]) { const st = add(s.leatherStrap, s.dark, sx * .325, 1.33, -.05); st.rotation.z = sx * .06; const r = add(s.stirrup, s.steel, sx * .35, .93, -.05); r.rotation.y = Math.PI / 2; }
  if (!s.merged) s.merged = mergeStatic(g); return s.merged.clone();
}
function poseLimbs(root, list) { // aim bone -> child at a direction given in the model's own space
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), dq = new THREE.Quaternion(), w = new THREE.Vector3();
  root.traverse(o => { if (o.isBone && !o.userData.rest) o.userData.rest = o.quaternion.clone(); });
  for (const [bn, cn, d] of list) { const b = root.getObjectByName(bn), c = root.getObjectByName(cn); if (!b || !c) continue; root.updateMatrixWorld(true);
    const cur = c.getWorldPosition(v2).sub(b.getWorldPosition(v1)).normalize(); w.set(...d).normalize().transformDirection(root.matrixWorld);
    dq.setFromUnitVectors(cur, w); b.getWorldQuaternion(q1); b.parent.getWorldQuaternion(q2); b.quaternion.copy(q2.invert().multiply(dq.multiply(q1))); }
  root.updateMatrixWorld(true);
}
// pose the rigged rider seated: aim each limb bone at a direction in the rider's own space (faces +z, left = +x)
function poseRider(root) {
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), dq = new THREE.Quaternion();
  const B = n => root.getObjectByName(n);
  const aim = (bn, cn, d) => { const b = B(bn), c = B(cn); if (!b || !c) return; root.updateMatrixWorld(true);
    const cur = c.getWorldPosition(v2).sub(b.getWorldPosition(v1)).normalize(); const want = new THREE.Vector3(...d).normalize().transformDirection(root.matrixWorld);
    dq.setFromUnitVectors(cur, want); b.getWorldQuaternion(q1); b.parent.getWorldQuaternion(q2); b.quaternion.copy(q2.invert().multiply(dq.multiply(q1))); };
  for (const [s, L] of [[1, 'Left'], [-1, 'Right']]) {
    aim(L + 'UpLeg', L + 'Leg', [s * .55, -.63, .55]); aim(L + 'Leg', L + 'Foot', [s * .08, -.98, -.12]); aim(L + 'Foot', L + 'ToeBase', [s * .12, -.25, 1]);
    aim(L + 'Arm', L + 'ForeArm', [s * .2, -.9, .3]); aim(L + 'ForeArm', L + 'Hand', [s * -.08, -.25, 1]); }
  aim('Spine02', 'Spine01', [0, 1, .08]); aim('neck', 'Head', [0, 1, .12]);
  root.updateMatrixWorld(true);
}
// merge the static meshes under a group into one mesh per material (fewer draw calls); keeps instanced/skinned meshes
function mergeStatic(root) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), by = new Map(), drop = [];
  root.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.geometry.index) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) return; const k = o.material.uuid; if (!by.has(k)) by.set(k, { m: o.material, gs: [] }); by.get(k).gs.push(g); drop.push(o); });
  for (const o of drop) o.parent.remove(o);
  for (const { m, gs } of by.values()) { const g = mergeGeometries(gs, false); if (!g) continue; const mesh = new THREE.Mesh(g, m); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); }
  return root;
}
function lerpAng(a, b, t) { return a + (b - a) * t; }
// procedural gaits for the rigged horse
const OFFS = { walk: [.25, .75, 0, .5], gallop: [.58, .48, .08, 0] };
function realAnim(hz, dt, speed, graze, t) {
  const u = hz.userData, B = u.bones, sp = Math.abs(speed), k = sstep(.05, 1.2, sp), gal = sstep(5, 10, sp);
  const stride = 1.6 + sstep(3, 9, sp) * 1.4 + sstep(10, 18, sp) * 1.6; u.phase = (u.phase + dt * (sp > .05 ? sp / stride : 0)) % 1;
  const A = (.3 + .22 * gal) * k;
  LEGS.forEach((b, i) => { const off = lerpAng(OFFS.walk[i], OFFS.gallop[i], gal), th = (u.phase + off) * Math.PI * 2, s = Math.sin(th), lift = Math.max(0, Math.cos(th));
    const hind = i > 1; B[b].rotation.x = -s * A * (hind ? .9 : 1); B[b + 1].rotation.x = lift * k * (hind ? .5 + .4 * gal : .8 + .6 * gal); B[b + 2].rotation.x = lift * k * (.5 + .3 * gal) - (hind ? lift * k * .2 : 0); });
  const th = u.phase * Math.PI * 2;
  B[1].position.y = u.bodyY + (gal > .5 ? Math.sin(th) * .055 : Math.abs(Math.sin(th * 2)) * .018) * k + Math.sin(t * 1.6 + u.seed) * .004;
  B[1].rotation.x = Math.sin(th + .6) * .045 * gal * k;
  const nx = graze ? 1.05 : (-.06 * gal + Math.sin(th * (gal > .5 ? 1 : 2) + 1) * .05 * k), hx = graze ? .42 : .06 * gal;
  B[2].rotation.x += (nx - B[2].rotation.x) * Math.min(1, dt * 2.5); B[3].rotation.x += (hx - B[3].rotation.x) * Math.min(1, dt * 2.5);
  B[2].rotation.y = graze ? Math.sin(t * .35 + u.seed) * .12 : Math.sin(t * .5 + u.seed) * .06 * (1 - k);
  B[4].rotation.x = .08 + .45 * gal * k + Math.sin(th) * .06 * k; B[4].rotation.z = Math.sin(t * 1.3 + u.seed) * .09 + Math.sin(th) * .05 * k;
}
// ---- world props ----
function vn2(x, z) { return Math.sin(x * 1.7 + z * .3) * .5 + Math.sin(z * 2.3 - x * .7) * .3 + Math.sin(x * 4.1 + z * 3.7) * .2; }
function broadleafGeo(detail, seed) { const r = mulberry(seed), parts = [], col = [];
  const n = detail ? 9 : 4; for (let i = 0; i < n; i++) { const a = r() * 6.28, d = i ? .6 + r() * 1.3 : 0, y = 4.4 + r() * 2.2 - d * .3, s = 1.35 + r() * .7 - d * .15;
    const g = new THREE.IcosahedronGeometry(s, detail); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const j = 1 + vn2(p.getX(k) * 2.6 + i, p.getZ(k) * 2.6 - i + p.getY(k)) * .2; p.setXYZ(k, p.getX(k) * j + Math.cos(a) * d, p.getY(k) * j * .82 + y, p.getZ(k) * j + Math.sin(a) * d); }
    parts.push(g); }
  const g = mergeG(parts); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = .55 + Math.min(.5, (p.getY(i) - 3.2) * .1) + Math.min(.15, Math.hypot(p.getX(i), p.getZ(i)) * .05); col.push(k, k, k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function mergeG(gs) { const pos = []; for (const g of gs) { const q = g.index ? g.toNonIndexed() : g; pos.push(...q.attributes.position.array); } const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return r; }
function farConifer() { const a = new THREE.ConeGeometry(2.6, 7, 8, 1).translate(0, 6.2, 0), b = new THREE.ConeGeometry(1.7, 5, 8, 1).translate(0, 10, 0); const g = mergeG([a, b]); const col = []; for (let i = 0; i < g.attributes.position.count; i++) col.push(.8, .8, .8); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function grassClump() { const r = mulberry(77), pos = [], col = [], nor = [];
  for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * .2, x = Math.cos(a) * d, z = Math.sin(a) * d, h = .2 + r() * .34, w = .014 + r() * .012, la = r() * 6.28, lean = .05 + r() * .14;
    const px = Math.cos(la + 1.57) * w, pz = Math.sin(la + 1.57) * w, lx = Math.cos(la) * lean, lz = Math.sin(la) * lean, dry = r() < .18 ? 1 : 0, v = .85 + r() * .3;
    const P0 = [x - px, 0, z - pz], P1 = [x + px, 0, z + pz], M0 = [x - px * .7 + lx * .35, h * .55, z - pz * .7 + lz * .35], M1 = [x + px * .7 + lx * .35, h * .55, z + pz * .7 + lz * .35], T = [x + lx, h, z + lz];
    const cb = [.13 * v, .19 * v, .06 * v], cm = dry ? [.42 * v, .4 * v, .2 * v] : [.28 * v, .42 * v, .14 * v], ct = dry ? [.66 * v, .6 * v, .36 * v] : [.5 * v, .64 * v, .3 * v];
    for (const [a1, b1, c1, ca, cb2, cc] of [[P0, P1, M0, cb, cb, cm], [P1, M1, M0, cb, cm, cm], [M0, M1, T, cm, cm, ct]]) { pos.push(...a1, ...b1, ...c1); col.push(...ca, ...cb2, ...cc); for (let k = 0; k < 3; k++) nor.push(lx * 2, 1, lz * 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.normalizeNormals(); return g; }
function softFoliage(g, cy, k = .75) { // blend flat face normals with normals radiating from the crown axis -> soft, leafy shading
  const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - cy(p.getY(i)), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
    const nx = n.getX(i) * (1 - k) + x / l * k, ny = n.getY(i) * (1 - k) + y / l * k + .15, nz = n.getZ(i) * (1 - k) + z / l * k, m = Math.hypot(nx, ny, nz) || 1; n.setXYZ(i, nx / m, ny / m, nz / m); } return g; }
function strawTex(spiral) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#b8964a'; x.fillRect(0, 0, 256, 256); const r = mulberry(spiral ? 3 : 9);
  for (let i = 0; i < 1800; i++) { const l = 60 + r() * 120, h = 30 + r() * 25; x.strokeStyle = `hsla(${h},${45 + r() * 25}%,${38 + r() * 35}%,.55)`; x.lineWidth = .6 + r() * 1.4; x.beginPath();
    if (spiral) { const rad = r() * 125, a = r() * 6.28; x.arc(128, 128, rad, a, a + .3 + r() * .6); } else { const px = r() * 256, py = r() * 256; x.moveTo(px, py); x.lineTo(px + l * .97, py + (r() - .5) * 14); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
function terrainMaterial(PB) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }); if (!PB || !PB.grass) { m.color.set(0x6b8a3a); return m; }
  const cl = t => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; return c; };
  m.map = cl(PB.grass.map); m.normalMap = cl(PB.grass.normalMap); m.normalScale.set(.8, .8);
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { tDirt: { value: PB.dirt.map }, tRock: { value: PB.rock.map }, uPen: { value: new THREE.Vector4(PEN.x, PEN.z, PEN.hw, PEN.hd) }, uPath: { value: new THREE.Vector4(...PATH) }, uBase: { value: BASE } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz; vWN=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform sampler2D tDirt, tRock; uniform vec4 uPen, uPath; uniform float uBase;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+1.),f.x),f.y);}`)
      .replace('#include <map_fragment>', `vec2 wuv=vWP.xz/2.5; vec3 g1=texture2D(map,wuv).rgb, g2=texture2D(map,wuv*.21+.37).rgb; float mv=vn(vWP.xz*.04)*.6+vn(vWP.xz*.19)*.4;
vec3 grass=mix(g1,g2,.4)*mix(.78,1.15,mv)*vec3(.82,1.22,.6); grass=mix(grass,grass*vec3(1.3,1.12,.72),smoothstep(.55,.82,vn(vWP.xz*.013))*.8);
vec3 dirt=texture2D(tDirt,vWP.xz/3.).rgb*vec3(.95,.9,.84); vec3 rock=texture2D(tRock,vWP.xz/6.).rgb; float slope=1.-vWN.y;
float pen=1.-smoothstep(-1.,1.3,max(abs(vWP.x-uPen.x)-uPen.z,abs(vWP.z-uPen.y)-uPen.w)+(vn(vWP.xz*.6)-.5)*1.6);
vec2 pd=vWP.xz-uPath.xy, ab=uPath.zw-uPath.xy; float hh=clamp(dot(pd,ab)/dot(ab,ab),0.,1.); float path=1.-smoothstep(.6,1.9,length(pd-ab*hh)+(vn(vWP.xz*.5)-.5)*1.3);
float worn=smoothstep(.68,.9,vn(vWP.xz*.08)*.7+vn(vWP.xz*.35)*.3); float dm=max(max(pen*.95,path*.85),worn*.65);
vec3 col=mix(grass,dirt,dm); col=mix(col,rock,smoothstep(.2,.38,slope)); col=mix(col,rock*1.05,smoothstep(uBase+26.,uBase+42.,vWP.y)*.75);
diffuseColor.rgb*=col;`); };
  return m;
}
const COATS = [{ n: 'Bay' }, { n: 'Chestnut', c: 0xa04a1c, m: 0x6a2c10 }, { n: 'Grey', c: 0xd8d2c8, m: 0x8e8882 }, { n: 'Black', c: 0x2e2826, m: 0x161312 }, { n: 'Palomino', c: 0xd9a656, m: 0xf1e3c2 }];
const PROC_COATS = [[0x6b4226, 0x241812, 0x4a2c18], [0xa04a1c, 0x6a2c10, 0x3a2a1c], [0xd8d2c8, 0x8e8882, 0x7a4a24], [0x2a2220, 0x111111, 0x7a4a24], [0xd9a656, 0xf0e2c0, 0x4a2c18]];
const MODEL_URL = { horse: 'assets/horses/horse.glb', far: 'assets/horses/horse_far.glb', rider: 'assets/horses/rider.glb' };
let ASSETS = null;
function deq(src) { // quantized (KHR_mesh_quantization) attributes -> float32 so the node transform can be baked in
  const g = new THREE.BufferGeometry(); g.setIndex(src.index);
  for (const [k, a] of Object.entries(src.attributes)) { const n = a.count, s = a.itemSize, f = new Float32Array(n * s), get = ['getX', 'getY', 'getZ', 'getW'];
    for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) f[i * s + c] = a[get[c]](i); g.setAttribute(k, new THREE.BufferAttribute(f, s)); }
  return g; }
function loadAssets() {
  if (ASSETS) return ASSETS; if (new URLSearchParams(location.search).has('prochorse')) return (ASSETS = Promise.reject(new Error('procedural horses requested')));
  const L = new GLTFLoader(); const mesh = sc => { let m = null; sc.traverse(o => { if (o.isMesh && !m) m = o; }); return m; };
  return (ASSETS = Promise.all([L.loadAsync(MODEL_URL.horse), L.loadAsync(MODEL_URL.far), L.loadAsync(MODEL_URL.rider)]).then(([h, f, r]) => {
    const near = mesh(h.scene), far = mesh(f.scene); near.updateWorldMatrix(true, false); far.updateWorldMatrix(true, false);
    const gN = deq(near.geometry).applyMatrix4(near.matrixWorld), gF = deq(far.geometry).applyMatrix4(far.matrixWorld);
    for (const g of [gN, gF]) { skinHorseGeometry(g); g.computeBoundingSphere(); }
    const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0 });
    const riderSrc = cloneSkinned(r.scene), clips = r.animations.map(c => { const k = c.clone(); k.tracks = k.tracks.filter(t => !/\.position$/.test(t.name)); return k; }); // no root motion
    return { riderSrc, clips, gN, gF, matN: COATS.map(c => coatMaterial(near.material, c)), matF: COATS.map(c => coatMaterial(farMat, c)), rider: r.scene };
  }));
}

export function createHorseRider(ctx) {
  const { scene, GX, P, keys, input, camera, sfx, msg, PBRS } = ctx;
  const H = { on: false, horses: [], mounted: null, cd: 0, prompt: '', obst: [], fence: [], speed: 0, t: 0, near: null, vy: 0, ground: true, riddenT: 0, mounts: 0, models: 'loading', trees: [], lodT: 0, ridden: new Map(), follow: false, online: '' };
  const rnd = mulberry(42), Q = GX.Q, mobile = !!ctx.mobile;
  const LOD_HORSE = mobile ? 9 : 14, LOD_TREE = mobile ? 55 : 85;
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), col = new THREE.Color();
  const pbr = (k, o = {}) => PBRS && PBRS[k] ? new THREE.MeshStandardMaterial({ map: PBRS[k].map, normalMap: PBRS[k].normalMap, roughness: 1, metalness: 0, ...o }) : std(o.color ?? 0x7a5634);
  function buildWorld() {
    const seg = mobile || Q.trees < 100 ? 160 : 240;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, hAt(x, z)); uv.setXY(i, x / 2.5, z / 2.5); }
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, terrainMaterial(PBRS)); ground.receiveShadow = true; scene.add(ground); H.ground3d = ground;
    buildTrees(); buildRocks(); buildGrass(); buildPen();
  }
  // woods: conifers + broadleaf trees, instanced, with a near (detailed) / far (low-poly) LOD swapped around the player
  function buildTrees() {
    const nT = Math.round(Q.trees * (mobile ? 2.2 : 3));
    for (let i = 0; i < nT * 8 && H.trees.length < nT; i++) { const x = (rnd() - .5) * 2 * (EDGE + 30), z = (rnd() - .5) * 2 * (EDGE + 30);
      if (Math.hypot(x - PEN.x, z - PEN.z) < 36 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12 || clearing(x, z, 4)) continue; if (rnd() > .3 + .7 * (Math.sin(x * .02) * Math.cos(z * .025) * .5 + .5)) continue;
      const y = hAt(x, z); if (y - BASE > 44) continue; const s = .75 + rnd() * .65, conif = rnd() < (y - BASE > 12 ? .85 : .55);
      H.trees.push({ x, y: y - .15, z, s, r: rnd() * 6.28, conif, hue: rnd() }); H.obst.push([x, z, (conif ? .4 : .45) * s]); }
    const bark = pbr('bark', { color: 0x9a8a7a }); if (bark.map) { bark.map = bark.map.clone(); bark.map.repeat.set(1, 3); bark.normalMap = bark.normalMap.clone(); bark.normalMap.repeat.set(1, 3); }
    const leaf = new THREE.MeshStandardMaterial({ roughness: .92, vertexColors: true }), needle = new THREE.MeshStandardMaterial({ roughness: .95, vertexColors: true });
    const nC = H.trees.filter(t => t.conif).length, nB = H.trees.length - nC;
    const mk = (g, m, n, shadow = true) => { const im = new THREE.InstancedMesh(g, m, Math.max(1, n)); im.count = 0; im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
    H.tm = { cTrunk: mk(new THREE.CylinderGeometry(.16, .36, 12, 7).translate(0, 6, 0), bark, nC), bTrunk: mk(new THREE.CylinderGeometry(.18, .34, 5.2, 7).translate(0, 2.6, 0), bark, nB),
      cNear: mk(softFoliage(conifer(), y => y, .6), needle, nC), cFar: mk(softFoliage(farConifer(), y => y, .6), needle, nC), bNear: mk(softFoliage(broadleafGeo(1, 11), () => 5, .8), leaf, nB), bFar: mk(softFoliage(broadleafGeo(0, 11), () => 5, .8), leaf, nB) };
    // trunks never change LOD: fill once
    let ic = 0, ib = 0; for (const t of H.trees) { m4.compose(v3.set(t.x, t.y, t.z), qq.setFromAxisAngle(up, t.r), sc3.set(t.s, t.s * (t.conif ? 1 : .9 + t.hue * .3), t.s)); if (t.conif) H.tm.cTrunk.setMatrixAt(ic++, m4); else H.tm.bTrunk.setMatrixAt(ib++, m4); }
    H.tm.cTrunk.count = ic; H.tm.bTrunk.count = ib; updateTreeLOD(true);
  }
  function updateTreeLOD(force) {
    const T = H.tm; if (!T) return; const px = P.pos.x, pz = P.pos.z; if (!force && H.lodAt && Math.hypot(px - H.lodAt[0], pz - H.lodAt[1]) < 8) return; H.lodAt = [px, pz];
    const n = { cNear: 0, cFar: 0, bNear: 0, bFar: 0 };
    for (const t of H.trees) { const near = Math.hypot(t.x - px, t.z - pz) < LOD_TREE, key = (t.conif ? 'c' : 'b') + (near ? 'Near' : 'Far'), im = T[key];
      m4.compose(v3.set(t.x, t.y, t.z), qq.setFromAxisAngle(up, t.r), sc3.set(t.s, t.s * (t.conif ? 1 : .9 + t.hue * .3), t.s)); im.setMatrixAt(n[key], m4);
      im.setColorAt(n[key]++, t.conif ? col.setHSL(.27 + t.hue * .06, .34 + t.hue * .1, .2 + t.hue * .06) : col.setHSL(.2 + t.hue * .09, .42 + t.hue * .15, .24 + t.hue * .08)); }
    for (const k in n) { const im = T[k]; im.count = n[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  function buildRocks() {
    const rg = new THREE.IcosahedronGeometry(1, 2); { const rp = rg.attributes.position; for (let i = 0; i < rp.count; i++) { v3.fromBufferAttribute(rp, i); const j = 1 + Math.sin(v3.x * 4.1 + v3.y * 2.3) * .12 + Math.sin(v3.z * 5.3 - v3.x * 1.7) * .08 + Math.sin(v3.y * 9 + v3.z * 7) * .03; rp.setXYZ(i, v3.x * j, v3.y * j * .62, v3.z * j); } rg.computeVertexNormals(); }
    const nR = Math.round(Q.trees * 1.1), rock = new THREE.InstancedMesh(rg, pbr('rock', { color: 0xb0aca4 }), nR); let r = 0;
    for (let i = 0; i < nR * 4 && r < nR; i++) { const x = (rnd() - .5) * 2 * EDGE, z = (rnd() - .5) * 2 * EDGE; if (Math.hypot(x - PEN.x, z - PEN.z) < 30 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8 || clearing(x, z, 3)) continue;
      const s = .35 + rnd() * rnd() * 2.6; m4.compose(v3.set(x, hAt(x, z) - s * .22, z), qq.setFromEuler(new THREE.Euler(rnd() * .3, rnd() * 6, rnd() * .2)), sc3.set(s * 1.3, s, s * (.8 + rnd() * .5))); rock.setMatrixAt(r++, m4); if (s > .7) H.obst.push([x, z, s * 1.1]); }
    rock.count = r; rock.castShadow = rock.receiveShadow = true; rock.computeBoundingSphere(); scene.add(rock);
  }
  // wind-blown grass clumps in a patch that follows the player (re-scattered when they move away)
  function buildGrass() {
    const n = Math.round((Q.grass || 600) * (mobile ? .7 : 1)); H.grassR = Math.max(16, Math.min(40, Math.sqrt(n / 2.2 / Math.PI)));
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9 });
    gm.onBeforeCompile = sh => { sh.uniforms.uT = { value: 0 }; gm.userData.sh = sh; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.); float w=sin(uT*1.7+ip.x*.35+ip.z*.27)*.5+sin(uT*3.1+ip.x*.9)*.2; transformed.x+=w*position.y*.22; transformed.z+=w*position.y*.1;`); };
    H.grass = new THREE.InstancedMesh(grassClump(), gm, n); H.grass.receiveShadow = true; H.grass.frustumCulled = false; scene.add(H.grass); scene.userData.grassMat = gm; scatterGrass();
  }
  function scatterGrass() {
    const G = H.grass; if (!G) return; const R = H.grassR, cx = P.pos.x, cz = P.pos.z, r = mulberry(((cx / 9) | 0) * 7919 + ((cz / 9) | 0)); let k = 0; H.grassAt = [cx, cz];
    for (let i = 0; i < G.instanceMatrix.count * 2 && k < G.instanceMatrix.count; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.abs(x - PEN.x) < PEN.hw - .6 && Math.abs(z - PEN.z) < PEN.hd - .6 && r() < .97) continue; // the pen floor is trodden dirt
      if (segDist(x, z, PATH) < 1.3 && r() < .9) continue; // trodden track to the gate
      const s = .6 + r() * .6; m4.compose(v3.set(x, hAt(x, z) - .02, z), qq.setFromAxisAngle(up, r() * 6.28), sc3.set(s, s * (.6 + r() * .9), s)); G.setMatrixAt(k, m4); G.setColorAt(k++, col.setHSL(.22 + r() * .05, .3 + r() * .2, .62 + r() * .14)); }
    G.count = k; G.instanceMatrix.needsUpdate = true; if (G.instanceColor) G.instanceColor.needsUpdate = true;
  }
  function buildPen() {
    const y0 = BASE, { x: cx, z: cz, hw, hd, gate } = PEN, g = new THREE.Group(); scene.add(g);
    const bark = pbr('bark', { color: 0x8a7c6c }), planks = pbr('timber', { color: 0xb09a84 }), iron = pbr('corrugated', { color: 0x9a9a98, metalness: .6, roughness: .6, side: THREE.DoubleSide });
    const corners = [[cx - hw, cz - hd], [cx + hw, cz - hd], [cx + hw, cz + hd], [cx - hw, cz + hd]], sides = [[0, 1], [1, 2], [3, 2], [0, 3]];
    const posts = [], rails = [];
    sides.forEach(([a, b], si) => { const [x0, z0] = corners[a], [x1, z1] = corners[b];
      const segs = si === 2 ? [[x0, z0, cx - gate, z1], [cx + gate, z0, x1, z1]] : [[x0, z0, x1, z1]];
      for (const [ax, az, bx, bz] of segs) { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.4)); H.fence.push([ax, az, bx, bz]);
        for (let i = 0; i <= n; i++) posts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n, rnd()]);
        for (let i = 0; i < n; i++) for (const ry of [.5, .95, 1.32]) { const t0 = i / n, t1 = (i + 1) / n; rails.push([ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, ry + (rnd() - .5) * .04]); } } });
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .1, 1.6, 8).translate(0, .8 - .05, 0), bark, posts.length);
    posts.forEach(([x, z, r], i) => { m4.compose(v3.set(x, y0, z), qq.setFromEuler(new THREE.Euler((r - .5) * .05, r * 6, (r - .5) * .04)), sc3.set(1, .95 + r * .1, 1)); pm.setMatrixAt(i, m4); });
    const rm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.05, .055, 1, 7).rotateZ(Math.PI / 2), bark, rails.length);
    rails.forEach(([ax, az, bx, bz, ry], i) => { const L = Math.hypot(bx - ax, bz - az) + .18; m4.compose(v3.set((ax + bx) / 2, y0 + ry, (az + bz) / 2), qq.setFromAxisAngle(up, -Math.atan2(bz - az, bx - ax)), sc3.set(L, 1, 1)); rm.setMatrixAt(i, m4); });
    for (const im of [pm, rm]) { im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); g.add(im); }
    const cyl = (r0, r1, h, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 10), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    // gate: tall posts, cross beam, sign, an opened gate leaf swung back along the outside of the fence
    for (const s of [-1, 1]) cyl(.12, .14, 2.5, bark, cx + s * gate, y0 + 1.2, cz + hd);
    cyl(.09, .09, gate * 2 + .5, bark, cx, y0 + 2.36, cz + hd, 0, Math.PI / 2);
    for (const back of [0, 1]) { const sign = signMesh('HORSE PEN'); sign.position.set(cx, y0 + 2.8, cz + hd + (back ? -.04 : .04)); if (back) sign.rotation.y = Math.PI; g.add(sign); }
    { const leaf = new THREE.Group(); leaf.position.set(cx + gate + .15, y0, cz + hd + .3); g.add(leaf); const L = 2.3;
      for (const ry of [.35, .8, 1.2]) box(leaf, L, .1, .045, planks, L / 2, ry, 0); for (const lx of [.06, L - .06]) box(leaf, .1, 1.3, .06, planks, lx, .72, 0); const br = box(leaf, Math.hypot(L, .85), .09, .04, planks, L / 2, .78, 0); br.rotation.z = Math.atan2(.85, L);
      H.fence.push([cx + gate + .15, cz + hd + .3, cx + gate + .15 + L, cz + hd + .3]); }
    // run-in shed behind the north fence (timber walls, corrugated roof)
    { const sx = cx - 4, sz = cz - hd - 3.2, W = 7.5, D = 3.6, hB = 2.5, hF = 3.1, sh = new THREE.Group(); sh.position.set(sx, y0, sz); g.add(sh);
      box(sh, W, hB, .12, planks, 0, hB / 2, -D / 2); for (const s of [-1, 1]) box(sh, .12, hB, D, planks, s * W / 2, hB / 2, 0);
      for (const s of [-1, 1]) cyl(.1, .1, hF, bark, sx + s * (W / 2 - .1), y0 + hF / 2, sz + D / 2 - .1);
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(W + .8, Math.hypot(D + .8, hF - hB)), iron); roof.rotation.x = -Math.PI / 2 + Math.atan2(hF - hB, D + .8); roof.position.set(0, (hB + hF) / 2 + .08, 0); roof.castShadow = roof.receiveShadow = true; sh.add(roof);
      if (iron.map) { iron.map = iron.map.clone(); iron.map.repeat.set(3, 2); }
      H.fence.push([sx - W / 2, sz - D / 2, sx + W / 2, sz - D / 2], [sx - W / 2, sz - D / 2, sx - W / 2, sz + D / 2], [sx + W / 2, sz - D / 2, sx + W / 2, sz + D / 2]);
      const hb = makeBale(true); hb.position.set(sx + 2, y0 + .45, sz - .4); sh.parent.add(hb); }
    // water trough: plank box with a still water surface
    { const tx = cx - hw + 2.2, tz = cz - hd + 1.5, tr = new THREE.Group(); tr.position.set(tx, y0, tz); g.add(tr);
      box(tr, 2.4, .08, .8, planks, 0, .12, 0); for (const s of [-1, 1]) { box(tr, 2.4, .62, .07, planks, 0, .42, s * .37); box(tr, .07, .62, .8, planks, s * 1.17, .42, 0); }
      for (const s of [-1, 1]) for (const t of [-1, 1]) box(tr, .1, .2, .1, planks, s * 1.05, .06, t * .3);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(2.26, .66), new THREE.MeshStandardMaterial({ color: 0x24404a, roughness: .04, metalness: .1, transparent: true, opacity: .88 })); water.rotation.x = -Math.PI / 2; water.position.y = .62; tr.add(water); }
    // hay: two round bales and a small square-bale stack
    { const hx = cx + hw - 2.6, hz = cz - hd + 1.7; for (const [dx, dz, ry] of [[-.9, 0, .2], [.9, .2, -.15]]) { const b = makeBale(false); b.position.set(hx + dx, y0 + .62, hz + dz); b.rotation.y = ry; g.add(b); } }
    { const hx = cx - hw + 2.4, hz = cz + hd - 2.2; for (const [dx, dy, dz] of [[0, 0, 0], [1.05, 0, 0], [.5, .45, 0]]) { const b = makeBale(true); b.position.set(hx + dx, y0 + .23 + dy, hz + dz); g.add(b); } H.obst.push([hx + .5, hz, 1.2]); }
    H.obst.push([cx - hw + 2.2, cz - hd + 1.5, 1.2], [cx + hw - 2.6, cz - hd + 1.7, 1.8]);
    mergeStatic(g);
  }
  let BALE = null;
  function makeBale(square) {
    if (!BALE) { const side = strawTex(false), end = strawTex(true); BALE = { side: new THREE.MeshStandardMaterial({ map: side, roughness: 1, color: 0xd8c08a }), end: new THREE.MeshStandardMaterial({ map: end, roughness: 1, color: 0xd8c08a }), sq: new THREE.MeshStandardMaterial({ map: side, roughness: 1, color: 0xe0cc96 }) };
      if (PBRS && PBRS.hesco) for (const m of Object.values(BALE)) { m.normalMap = PBRS.hesco.normalMap; m.normalScale.set(1.6, 1.6); }
      BALE.rg = new THREE.CylinderGeometry(.62, .62, 1.2, 20, 1).rotateZ(Math.PI / 2); BALE.sg = new THREE.BoxGeometry(1, .45, .5); }
    const m = square ? new THREE.Mesh(BALE.sg, BALE.sq) : new THREE.Mesh(BALE.rg, [BALE.side, BALE.end, BALE.end]); m.castShadow = m.receiveShadow = true; return m;
  }
  function signMesh(text) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#6b4a2e'); gr.addColorStop(1, '#4a3220'); x.fillStyle = gr; x.fillRect(0, 0, 512, 128);
    x.globalAlpha = .18; for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#2a1a0e' : '#8a6a48'; x.fillRect(0, Math.random() * 128, 512, 1 + Math.random() * 2); } x.globalAlpha = 1;
    x.strokeStyle = '#2a1a0e'; x.lineWidth = 6; x.strokeRect(4, 4, 504, 120); x.fillStyle = '#f0dcb0'; x.font = 'bold 66px Georgia, serif'; x.textAlign = 'center'; x.fillText(text, 256, 88); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), new THREE.MeshStandardMaterial({ map: t, roughness: .8 })); m.castShadow = true; return m; }
  // ---- horses ----
  function makeRealHorse(A, ci) {
    const g = new THREE.Group(), mdl = new THREE.Group(); mdl.rotation.y = Math.PI; g.add(mdl); // model faces +z; game forward is -z
    const bones = makeBones(); mdl.add(bones[0]); g.updateMatrixWorld(true);
    const sk = new THREE.Skeleton(bones), near = new THREE.SkinnedMesh(A.gN, A.matN[ci]), far = new THREE.SkinnedMesh(A.gF, A.matF[ci]);
    for (const m of [near, far]) { mdl.add(m); m.bind(sk); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    far.visible = false; const sad = makeSaddle(PBRS); mdl.add(sad); g.updateMatrixWorld(true); bones[1].attach(sad); // follow the trunk bone
    g.userData = { kind: 'real', bones, near, far, mdl, phase: rnd(), seed: rnd() * 10, bodyY: bones[1].position.y, coat: COATS[ci].n };
    return g;
  }
  function spawnHorses() {
    PROC_COATS.forEach(([coat, mane, sad], i) => { const g = makeHorse(coat, mane, sad); const x = PEN.x - 8 + i * 4 + (rnd() - .5), z = PEN.z - 3 + (i % 2) * 5;
      g.position.set(x, BASE, z); g.rotation.y = rnd() * 6.28; scene.add(g);
      H.horses.push({ id: i, g, pos: g.position, yaw: g.rotation.y, speed: 0, tgt: null, wait: rnd() * 3, graze: rnd() < .5, inPen: true, coat: COATS[i].n }); });
  }
  let rider = makeProcRider(0x2c5d8a); rider.visible = false;
  const reins = [];
  function dress(A) { // swap the procedural stand-ins for the realistic rigged models (keeps positions/state)
    for (const h of H.horses) { const ng = makeRealHorse(A, h.id); ng.position.copy(h.pos); ng.rotation.y = h.yaw; scene.remove(h.g); scene.add(ng); h.g = ng; h.pos = ng.position; }
    const r = A.rider; r.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.metalness = 0; o.material.envMapIntensity = .8; } } });
    poseRider(r); const hips = r.getObjectByName('Hips'); const hp = hips ? hips.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0);
    const wrap = new THREE.Group(); wrap.add(r); r.position.set(-hp.x, -hp.y, -hp.z); wrap.userData = { kind: 'real', model: r };
    const was = H.mounted; if (was) detachRider(was); rider = wrap; rider.visible = false; if (was) attachRider(was);
    const sp = saddleParts(PBRS); for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(sp.rein, sp.dark); m.visible = false; m.castShadow = false; scene.add(m); reins.push(m); }
    H.models = 'real'; H.assets = A; for (const av of avatars) av.rebuild();
  }
  function attachRider(h) { rider.visible = true;
    if (h.g.userData.kind === 'real' && rider.userData.kind === 'real') { h.g.userData.bones[1].add(rider); rider.position.set(0, .45, .04); rider.rotation.set(0, 0, 0); }
    else { h.g.add(rider); rider.position.set(0, h.g.userData.kind === 'real' ? 1.45 : 1.72, .08); } }
  function detachRider() { if (rider.parent) rider.parent.remove(rider); rider.visible = false; for (const r of reins) r.visible = false; }
  const mouth = [new THREE.Vector3(-.075, -.2, .3), new THREE.Vector3(.075, -.2, .3)], wA = new THREE.Vector3(), wB = new THREE.Vector3();
  function updateReins() { const h = H.mounted; if (!h || h.g.userData.kind !== 'real' || rider.userData.kind !== 'real' || !reins.length) return;
    h.g.updateMatrixWorld(true); const head = h.g.userData.bones[3], md = rider.userData.model;
    ['LeftHand', 'RightHand'].forEach((n, i) => { const hand = md.getObjectByName(n); if (!hand) return; wA.copy(mouth[i]).applyMatrix4(head.matrixWorld); hand.getWorldPosition(wB);
      const r = reins[i], L = wB.distanceTo(wA); r.visible = L > .05 && L < 3; if (!r.visible) return; r.position.copy(wB); r.lookAt(wA); r.scale.set(1, 1, L); }); }
  const inPen = (x, z, m = 0) => Math.abs(x - PEN.x) < PEN.hw - m && Math.abs(z - PEN.z) < PEN.hd - m;
  function segDist(px, pz, [ax, az, bx, bz]) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
  // blocked(x, z, r, skipHorse): fence/walls, trees/rocks/props, other horses, map edge
  function blocked(x, z, r, skip) {
    if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) return true;
    for (const f of H.fence) if (segDist(x, z, f) < r + .1) return true;
    for (const [ox, oz, or] of H.obst) if (Math.abs(ox - x) < or + r && Math.abs(oz - z) < or + r && Math.hypot(ox - x, oz - z) < or + r) return true;
    for (const h of H.horses) if (h !== skip && h !== H.mounted && Math.hypot(h.pos.x - x, h.pos.z - z) < .75 + r) return true;
    return false;
  }
  function moveCircle(pos, dx, dz, r, skip) { let hit = false; if (!blocked(pos.x + dx, pos.z, r, skip)) pos.x += dx; else hit = true; if (!blocked(pos.x, pos.z + dz, r, skip)) pos.z += dz; else hit = true; return hit; }
  function nearestHorse() { let best = null, bd = MOUNT_R; for (const h of H.horses) { if (H.ridden.has(h)) continue; const d = Math.hypot(h.pos.x - P.pos.x, h.pos.z - P.pos.z); if (d < bd) { bd = d; best = h; } } return best; }
  function use() {
    if (!H.on || H.cd > 0) return false;
    if (H.mounted) return dismount();
    const h = nearestHorse(); if (!h) { msg('Walk up to a horse to ride it', 1.5); return false; }
    H.mounted = h; H.cd = COOLDOWN; H.speed = 0; h.speed = 0; h.tgt = null; h.graze = false; P.yaw = h.yaw; P.pitch = -.18; attachRider(h);
    H.mounts++; sfx.ui && sfx.ui(); msg(mobile ? 'Riding! Push the stick to go · all the way to gallop' : 'Riding! W to go · Shift to gallop · E to get off', 2.5); return true;
  }
  function dismount() {
    const h = H.mounted; if (!h) return false; const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw), rx = -fz, rz = fx;
    const tries = [[-rx * 1.5, -rz * 1.5], [rx * 1.5, rz * 1.5], [-fx * 2.4, -fz * 2.4], [fx * 2.4, fz * 2.4], [-rx * 2.6, -rz * 2.6], [rx * 2.6, rz * 2.6]];
    let spot = null; for (const [ox, oz] of tries) { const x = h.pos.x + ox, z = h.pos.z + oz; if (!blocked(x, z, .35, h) && !(Math.abs(x) > EDGE || Math.abs(z) > EDGE)) { spot = [x, z]; break; } }
    if (!spot) spot = [h.pos.x - rx * 1.5, h.pos.z - rz * 1.5];
    P.pos.set(spot[0], hAt(spot[0], spot[1]), spot[1]); H.vy = 0; H.mounted = null; H.cd = COOLDOWN; h.speed = 0; h.wait = 4 + rnd() * 4; h.inPen = inPen(h.pos.x, h.pos.z, .5); h.graze = true;
    if (H.follow) h.net = { x: h.pos.x, z: h.pos.z, yaw: h.yaw, sp: 0, gr: 1 };
    detachRider(h); P.yaw = h.yaw; P.pitch = 0; sfx.ui && sfx.ui(); msg('Dismounted', 1.2); return true;
  }
  function init() {
    H.on = true; P.spawn.set(SPAWN.x, hAt(SPAWN.x, SPAWN.z), SPAWN.z); P.pos.copy(P.spawn); buildWorld(); spawnHorses();
    P.yaw = Math.atan2(SPAWN.x - PEN.x, SPAWN.z - PEN.z); P.pitch = -.05; P.hp = 100;
    GX.setLighting('day', false); scene.fog.density = .0026; GX.followSun(P.pos);
    loadAssets().then(dress).catch(e => { H.models = 'proc'; if (!/requested/.test(e && e.message)) console.warn('horse models failed, using procedural horses', e); });
    msg(mobile ? 'HORSE RIDER — walk to the pen, tap RIDE next to a horse' : 'HORSE RIDER — walk to the pen and press E next to a horse', 5);
  }
  const anim = (o, dt, sp, graze) => o.g.userData.kind === 'real' ? realAnim(o.g, dt, sp, graze, H.t) : procAnim(o.g, dt, sp, graze);
  function lod(o) { const u = o.g.userData; if (u.kind !== 'real') return; const near = o === H.mounted || camera.position.distanceTo(o.pos) < LOD_HORSE; u.near.visible = near; u.far.visible = !near; }
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
      P.yaw -= sideIn * dt * 1.9 * (H.speed < 0 ? -1 : 1);
      const target = fwdIn > 0 ? (run ? 18 : 10) * Math.min(1, fwdIn + .15) : fwdIn < 0 ? -2.5 : 0;
      H.speed += (target - H.speed) * Math.min(1, dt * (target > H.speed ? 1.6 : 2.6));
      let dy = P.yaw - h.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); h.yaw += dy * Math.min(1, dt * (Math.abs(H.speed) > .5 ? 4 : 1.2));
      const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
      const hit = moveCircle(h.pos, fx * H.speed * dt, fz * H.speed * dt, .8, h); if (hit) H.speed *= .4;
      const g0 = hAt(h.pos.x, h.pos.z); if (jump && H.ground) { H.vy = 6.2; H.ground = false; }
      H.vy -= 22 * dt; h.pos.y += H.vy * dt; if (h.pos.y <= g0) { h.pos.y = g0; H.vy = 0; H.ground = true; }
      h.g.rotation.y = h.yaw; const ahead = hAt(h.pos.x + fx, h.pos.z + fz), behind = hAt(h.pos.x - fx, h.pos.z - fz); h.g.rotation.x = Math.atan2(ahead - behind, 2) * .8;
      anim(h, dt, H.ground ? H.speed : 3, false); P.pos.set(h.pos.x, h.pos.y + 1.1, h.pos.z); H.riddenT += dt;
      const ob = H.clop || 0; H.clop = ob + dt * Math.abs(H.speed) * .55; if (H.ground && Math.abs(H.speed) > 1 && Math.floor(ob) !== Math.floor(H.clop)) sfx.step && sfx.step(true);
    } else {
      const sp = run && fwdIn > 0 ? 7.2 : 4.6, f = tmp.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), rx = -f.z, rz = f.x;
      let mx = f.x * fwdIn + rx * sideIn, mz = f.z * fwdIn + rz * sideIn; const l = Math.hypot(mx, mz); if (l > 0) { const k = sp * (stick > .05 ? Math.min(1, stick) : 1) / l; mx *= k; mz *= k; }
      moveCircle(P.pos, mx * dt, mz * dt, .35, null);
      const g0 = hAt(P.pos.x, P.pos.z); if (jump && H.ground) { H.vy = 7; H.ground = false; }
      H.vy -= 22 * dt; P.pos.y += H.vy * dt; if (P.pos.y <= g0) { P.pos.y = g0; H.vy = 0; H.ground = true; }
      const ob = P.bob; P.bob += dt * l * (l ? sp / l : 0) * 1.6; if (H.ground && l && Math.floor(ob / Math.PI) !== Math.floor(P.bob / Math.PI)) sfx.step && sfx.step(false);
    }
    for (const o of H.horses) { if (o === h) continue;
      if (H.ridden.has(o) || (H.follow && o.net)) { netHorse(o, dt); continue; } // ridden by another player / herd mirrored from the host
      if (o.tgt) { const dx = o.tgt[0] - o.pos.x, dz = o.tgt[1] - o.pos.z, d = Math.hypot(dx, dz);
        if (d < .4) { o.tgt = null; o.wait = 2 + rnd() * 5; o.graze = rnd() < .6; o.speed = 0; }
        else { const want = Math.atan2(-dx, -dz); let dy = want - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 2.5); o.speed += (1.3 - o.speed) * Math.min(1, dt * 2);
          if (moveCircle(o.pos, -Math.sin(o.yaw) * o.speed * dt, -Math.cos(o.yaw) * o.speed * dt, .8, o)) { o.tgt = null; o.wait = 1 + rnd() * 2; } } }
      else { o.speed *= Math.max(0, 1 - dt * 4); o.wait -= dt; if (o.wait <= 0) { if (o.inPen) o.tgt = [PEN.x + (rnd() - .5) * (PEN.hw * 2 - 4), PEN.z + (rnd() - .5) * (PEN.hd * 2 - 4)]; else { const a = rnd() * 6.28; o.tgt = [o.pos.x + Math.cos(a) * 3, o.pos.z + Math.sin(a) * 3]; } o.graze = false; } }
      o.pos.y = hAt(o.pos.x, o.pos.z); o.g.rotation.y = o.yaw; o.g.rotation.x = 0; anim(o, dt, o.speed, o.graze); }
    for (const o of H.horses) lod(o);
    if (H.grass && Math.hypot(P.pos.x - H.grassAt[0], P.pos.z - H.grassAt[1]) > H.grassR * .35) scatterGrass();
    updateTreeLOD(false);
    H.near = h ? null : nearestHorse();
    H.prompt = h ? (mobile ? 'Tap GET OFF to dismount' : '[E] Get off the horse') : H.near ? (mobile ? 'Tap RIDE to mount' : '[E] Ride horse') : '';
  }
  // third-person chase camera when riding; first-person eye height on foot
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  function syncCamera(dt) {
    const h = H.mounted;
    if (!h) { if (camera.fov !== 75) { camera.fov = 75; camera.updateProjectionMatrix(); } camera.position.set(P.pos.x, P.pos.y + 1.62 + (H.ground ? Math.abs(Math.cos(P.bob)) * .04 : 0), P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); H.camInit = false; return; }
    const sp = Math.abs(H.speed), pitch = Math.max(-.7, Math.min(.35, P.pitch)), dist = 4.3 + Math.min(1.4, sp * .075);
    look.set(h.pos.x, h.pos.y + 2.05, h.pos.z);
    const want = new THREE.Vector3(look.x + Math.sin(P.yaw) * Math.cos(pitch) * dist, look.y - Math.sin(pitch) * dist + .55, look.z + Math.cos(P.yaw) * Math.cos(pitch) * dist);
    want.y = Math.max(want.y, hAt(want.x, want.z) + .6);
    if (!H.camInit || !dt) { camPos.copy(want); H.camInit = true; } else camPos.lerp(want, Math.min(1, dt * 8));
    camera.position.copy(camPos); camera.lookAt(look);
    const fov = 72 + sstep(8, 18, sp) * 8; if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, (dt || 1) * 3); camera.updateProjectionMatrix(); }
    updateReins();
  }
  function hud() {
    const pr = $('hrPrompt'); if (pr) { pr.textContent = H.prompt; pr.hidden = !H.prompt; pr.classList.toggle('riding', !!H.mounted); }
    const d = Math.round(Math.hypot(P.pos.x - PEN.x, P.pos.z - PEN.z)), hz = H.mounted;
    $('mode').textContent = '🐎 HORSE RIDER'; $('timer').textContent = hz ? Math.round(Math.abs(H.speed) * 3.6) + ' km/h' : ''; $('stars').textContent = H.online || '';
    $('sub').textContent = hz ? (Math.abs(H.speed) > 12 ? 'Galloping' : Math.abs(H.speed) > 1 ? 'Riding' : 'Mounted') + (hz.coat ? ' ' + hz.coat : '') + (mobile ? ' · push the stick all the way to gallop' : ' · W ride · Shift gallop · A/D turn · Space jump')
      : H.models === 'loading' && d < 40 ? 'Horses arriving…' : d > 16 ? `Horse pen ${d} m away` : inPen(P.pos.x, P.pos.z) ? 'In the pen — walk up to a horse' : 'At the horse pen';
  }
  // ---- multiplayer hooks (src/horsenet.js): remote riders, herd mirroring ----
  function netHorse(o, dt) { const n = o.net; if (!n) { anim(o, dt, 0, false); return; } const k = Math.min(1, dt * 8);
    if (Math.hypot(n.x - o.pos.x, n.z - o.pos.z) > 12) { o.pos.x = n.x; o.pos.z = n.z; } else { o.pos.x += (n.x - o.pos.x) * k; o.pos.z += (n.z - o.pos.z) * k; }
    let dy = n.yaw - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * k; o.speed = n.sp; o.graze = !!n.gr;
    o.pos.y = H.ridden.has(o) && n.y != null ? o.pos.y + (n.y - o.pos.y) * k : hAt(o.pos.x, o.pos.z); o.g.rotation.y = o.yaw; anim(o, dt, n.sp, o.graze); }
  const herd = () => H.horses.filter(o => o !== H.mounted && !H.ridden.has(o)).map(o => [o.id, +o.pos.x.toFixed(2), +o.pos.z.toFixed(2), +o.yaw.toFixed(3), +o.speed.toFixed(2), o.graze ? 1 : 0]);
  function applyHerd(arr) { H.follow = true; for (const [id, x, z, yaw, sp, gr] of arr) { const o = H.horses[id]; if (!o || o === H.mounted || H.ridden.has(o)) continue; o.net = { x, z, yaw, sp, gr }; } }
  function release(o) { if (!H.ridden.has(o)) return; H.ridden.delete(o); o.speed = 0; o.wait = 4 + rnd() * 4; o.tgt = null; o.inPen = inPen(o.pos.x, o.pos.z, .5); o.graze = true; if (!H.follow) o.net = null; }
  function seat(h, obj) { if (h.g.userData.kind === 'real' && obj.userData.kind === 'real') { h.g.userData.bones[1].add(obj); obj.position.set(0, .45, .04); } else { h.g.add(obj); obj.position.set(0, h.g.userData.kind === 'real' ? 1.45 : 1.72, .08); } obj.rotation.set(0, 0, 0); obj.visible = true; }
  const avatars = new Set();
  function nameTag(text, color) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(10,12,14,.6)'; x.beginPath(); x.roundRect(8, 8, 240, 48, 22); x.fill();
    x.fillStyle = color; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 43); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false, toneMapped: false })); sp.scale.set(1.2, .3, 1); sp.renderOrder = 9; return sp; }
  const STAND = [['LeftArm', 'LeftForeArm', [.16, -1, .02]], ['LeftForeArm', 'LeftHand', [.06, -1, .12]], ['RightArm', 'RightForeArm', [-.16, -1, .02]], ['RightForeArm', 'RightHand', [-.06, -1, .12]]];
  // remote player: a walker (rider model + walk/run clips) on foot, a seated copy on the horse they ride
  function avatar(id, color) {
    const av = { id, g: new THREE.Group(), horse: null, walker: null, sitter: null, mixer: null, last: null, tag: nameTag(id, color), v: 0 };
    scene.add(av.g); av.g.add(av.tag); av.tag.position.y = 2.15;
    av.rebuild = () => { if (av.walker) av.g.remove(av.walker); if (av.sitter && av.sitter.parent) av.sitter.parent.remove(av.sitter); const A = H.assets;
      if (A && A.riderSrc) { const w = cloneSkinned(A.riderSrc), st = cloneSkinned(A.riderSrc); for (const r of [w, st]) r.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        w.rotation.y = Math.PI; av.mixer = new THREE.AnimationMixer(w); const clip = n => A.clips.find(c => new RegExp(n, 'i').test(c.name)); av.walk = clip('walk') && av.mixer.clipAction(clip('walk')); av.run = clip('run') && av.mixer.clipAction(clip('run'));
        poseLimbs(w, STAND); poseRider(st); const hp = st.getObjectByName('Hips').getWorldPosition(new THREE.Vector3()); const wrap = new THREE.Group(); wrap.add(st); st.position.set(-hp.x, -hp.y, -hp.z); wrap.userData = { kind: 'real', model: st };
        av.walker = w; av.sitter = wrap; }
      else { av.walker = makeProcRider(color); av.walker.position.y = .55; av.walker.rotation.y = Math.PI; av.sitter = makeProcRider(color); av.mixer = null; }
      av.g.add(av.walker); av.sitter.visible = false; if (av.horse) seat(av.horse, av.sitter); };
    av.update = (dt, s) => { if (!s) return; const was = av.horse, h = s.m >= 0 ? H.horses[s.m] : null;
      if (was && was !== h) { release(was); if (av.sitter.parent) av.sitter.parent.remove(av.sitter); av.horse = null; }
      if (h) { if (h === H.mounted) { if (String(av.id) < String(H.me || 'P9')) dismount(); else return; } // two riders grabbed one horse: lower id keeps it
        if (!av.horse) { av.horse = h; H.ridden.set(h, av.id); seat(h, av.sitter); } h.net = { x: s.x, y: s.y, z: s.z, yaw: s.hy, sp: s.sp };
        av.walker.visible = false; av.g.position.set(h.pos.x, h.pos.y + 1.1, h.pos.z); av.tag.position.y = 1.55; return; }
      av.walker.visible = true; av.tag.position.y = 2.15; const p = av.g.position, d = Math.hypot(s.x - p.x, s.z - p.z), k = Math.min(1, dt * 10);
      if (d > 8) p.set(s.x, s.y, s.z); else { p.x += (s.x - p.x) * k; p.y += (s.y - p.y) * k; p.z += (s.z - p.z) * k; }
      let dy = s.yw - av.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); av.g.rotation.y += dy * k;
      av.v += ((s.sp || 0) - av.v) * Math.min(1, dt * 6);
      if (av.mixer) { const moving = av.v > .4, act = av.v > 5.8 && av.run ? av.run : av.walk;
        if (moving && act) { for (const a of [av.walk, av.run]) if (a && a !== act && a.isRunning()) a.stop(); if (!act.isRunning()) act.play(); act.timeScale = act === av.run ? av.v / 7 : av.v / 4.6; av.mixer.update(dt); }
        else if (av.walk && (av.walk.isRunning() || (av.run && av.run.isRunning()))) { av.mixer.stopAllAction(); av.walker.traverse(o => { if (o.isBone && o.userData.rest) o.quaternion.copy(o.userData.rest); }); poseLimbs(av.walker, STAND); } } };
    av.dispose = () => { if (av.horse) release(av.horse); if (av.sitter && av.sitter.parent) av.sitter.parent.remove(av.sitter); scene.remove(av.g); avatars.delete(av); };
    av.rebuild(); avatars.add(av); return av;
  }
  const touchLabel = () => H.mounted ? 'GET OFF' : H.near ? 'RIDE' : '';
  const stats = () => { const i = GX.renderer.info; i.autoReset = false; i.reset(); GX.renderer.render(scene, camera); i.autoReset = true; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; };
  return { state: H, init, tick, syncCamera, hud, use, dismount, touchLabel, hAt, PEN, nearestHorse, stats, herd, applyHerd, avatar };
}
