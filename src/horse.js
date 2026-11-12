// HORSE RIDER: solo open-landscape mode. Big rolling PBR heightfield, conifer/broadleaf woods, rocks, wind-blown grass,
// a timber post-and-rail pen with a run-in shed, trough and hay. Horses and rider are realistic CC0 GLB models
// (assets/horses, see CREDITS.md): the static horse mesh is rigged at runtime (17-bone skeleton, weights by region)
// and animated procedurally (walk / canter / gallop / idle / graze); the rigged rider is posed seated on the saddle.
// Walk up to a horse, E / RIDE to mount (animated), same action reins in and steps down. RDR-style riding: four gaits with
// weighty acceleration, stamina, camera-relative steering, free look, lean into turns, obstacle avoidance, hoof dust.
// On foot the same rigged person is shown in third person (idle / walk / run blend; C toggles first person). If the models fail to load (or ?prochorse=1) the older procedural horse/rider are used.
import * as THREE from 'three';
import { GLTFLoader } from '../addons/loaders/GLTFLoader.js';
import { mergeGeometries } from '../addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from '../addons/utils/SkeletonUtils.js';
import { mulberry, conifer, conifCards, broadleafCards, cardMaterial, needleTexture, leafTexture, TREE_WIND } from './hrtrees.js';
import { ShaderPass } from '../addons/postprocessing/ShaderPass.js';
import { createGuns } from './hrguns.js';
import { createHrZombies } from './hrzombies.js';
import { createFlora } from './hrflora.js';
import { buildFeatures, buildMask, createChunks, createWater } from './hrterrain.js';
import { makeRawH, trailSegments, segDist as segD, createSky, terrainMaterial as terrainMat2, loadTerrainTextures, buildTerrain, createGrass, loadRockModels } from './hrworld.js';
const $ = id => document.getElementById(id);
const S = 800, EDGE = 360;                // meadow half-extent (the mountains start around here)
const WALK = 1050, CHUNK = 125, CH_LIM = 10, MASK_HALF = 1200; // v30: rideable half-extent (up into the mountains), detail-chunk size / limit, world-mask extent
const PEN = { x: 0, z: 0, hw: 13, hd: 9, gate: 2.6 }; // pen centre, half sizes, gate half-width (south side, +z)
const SPAWN = { x: 4, z: 34 };
const clearing = (x, z, m = 0) => Math.abs(x - PEN.x) < 11 + m && z > PEN.z && z < PEN.z + 150; // open riding meadow south of the gate
const MOUNT_R = 2.8, COOLDOWN = .45;
const sstep = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
const rawH = makeRawH(EDGE);
const RANGE = { x: PEN.x - PEN.hw - 8, z: PEN.z + 1, lane: [-Math.cos(.7), Math.sin(.7)] }; // shooting range west of the pen; the long-range lane (steel at 150-300 m) runs off south-west where the ground stays in view
const inLane = (x, z, m) => { const ex = x - RANGE.x + 1, ez = z - RANGE.z, t = ex * RANGE.lane[0] + ez * RANGE.lane[1]; return t > 20 && t < 312 + m && Math.abs(ex * RANGE.lane[1] - ez * RANGE.lane[0]) < 13 + m; };
const inRange = (x, z, m = 0) => (x < RANGE.x + 3 + m && x > RANGE.x - 66 - m && Math.abs(z - RANGE.z) < 9 + m) || inLane(x, z, m);
const SEG = trailSegments(PEN, SPAWN), trailDist = (x, z) => { let d = 1e9; for (const g of SEG) d = Math.min(d, segD(x, z, g)); return d; };
const BASE = rawH(PEN.x, PEN.z);
function h0(x, z) { const d = Math.hypot(x - PEN.x, z - PEN.z); return BASE + (rawH(x, z) - BASE) * sstep(24, 60, d); }
// mountain trails, ponds and the creek are carved into the height field (deterministic, same for every player): src/hrterrain.js
let FEAT = null; const featAvoid = (x, z) => (Math.abs(x - PEN.x) < 75 && Math.abs(z - PEN.z) < 75) || clearing(x, z, 12) || inRange(x, z, 14) || trailDist(x, z) < 10;
export function features() { return FEAT || (FEAT = buildFeatures(h0, { BASE, WALK, avoid: featAvoid })); }
export function hAt(x, z) { return (FEAT || features()).carve(x, z, h0(x, z)); }

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
function coatMaterial(base, coat, hq) {
  let m = base.clone(); m.metalness = 0; m.roughness = .72; m.envMapIntensity = .85;
  if (hq && base.map) { // velvet-like coat sheen on capable devices
    const pm = new THREE.MeshPhysicalMaterial({ map: base.map, normalMap: base.normalMap, roughnessMap: base.metalnessMap || base.roughnessMap, roughness: .72, metalness: 0, envMapIntensity: .85, side: base.side,
      sheen: .45, sheenRoughness: .55, sheenColor: new THREE.Color(coat.c ? coat.c : 0xb07040).multiplyScalar(.9) });
    if (base.normalMap) pm.normalScale.copy(base.normalScale); m = pm; }
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
// ---- rider / on-foot person: rest pose, procedural seated + mounting pose, idle clip, walker ----
const TAU = Math.PI * 2, RV1 = new THREE.Vector3(), RV2 = new THREE.Vector3(), RV3 = new THREE.Vector3(), RQ1 = new THREE.Quaternion(), RQ2 = new THREE.Quaternion(), RQ3 = new THREE.Quaternion();
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function saveRest(root) { const B = {}; root.traverse(o => { if (o.isBone) { o.userData.rest = o.quaternion.clone(); B[o.name] = o; } }); root.userData.B = B; return root; }
function aimBone(root, b, c, d) { if (!b || !c) return; root.updateMatrixWorld(true);
  const cur = c.getWorldPosition(RV2).sub(b.getWorldPosition(RV1)).normalize(), want = RV3.set(d[0], d[1], d[2]).normalize().transformDirection(root.matrixWorld);
  RQ3.setFromUnitVectors(cur, want); b.getWorldQuaternion(RQ1); b.parent.getWorldQuaternion(RQ2); b.quaternion.copy(RQ2.invert().multiply(RQ3.multiply(RQ1))); }
function twistBone(root, b, ang) { if (!b || !ang) return; root.updateMatrixWorld(true); RV3.set(0, 1, 0).transformDirection(root.matrixWorld); RQ3.setFromAxisAngle(RV3, ang);
  b.getWorldQuaternion(RQ1); b.parent.getWorldQuaternion(RQ2); b.quaternion.copy(RQ2.invert().multiply(RQ3.multiply(RQ1))); }
// o: sit 0..1 (standing -> seated), side (+1 mounts from the horse's left), swing 0..1 (far leg over the saddle), k (gait amount),
// ph (horse stride phase), trot / gal weights, lean (forward), roll (into turns), look (head yaw), rein (hands lift)
function riderPose(root, o) {
  const B = root.userData.B; if (!B) return; for (const n in B) B[n].quaternion.copy(B[n].userData.rest);
  const sit = o.sit ?? 1, ms = o.side || 1, gal = o.gal || 0, k = o.k || 0, ph = (o.ph || 0) * TAU, lean = o.lean || 0, roll = o.roll || 0;
  aimBone(root, B.Spine02, B.Spine01, [roll * .7, 1, .08 * sit + lean]); aimBone(root, B.neck, B.Head, [roll * .3, 1, .12 + .05 * sit - lean * .6]);
  for (const [s, L] of [[1, 'Left'], [-1, 'Right']]) {
    const far = s === -ms, sw = far ? Math.sin(Math.PI * Math.min(1, Math.max(0, o.swing ?? 0))) : 0, kick = Math.sin(ph + (s > 0 ? 0 : Math.PI)) * .07 * k;
    let up = mix3([s * .07, -1, .03], [s * (.55 - .07 * gal), -.63 - .14 * gal, .55 - .12 * gal + kick * .4], sit); if (sw) up = mix3(up, [s * 1.1, -.05, -.45], sw);
    aimBone(root, B[L + 'UpLeg'], B[L + 'Leg'], up);
    aimBone(root, B[L + 'Leg'], B[L + 'Foot'], mix3([s * .02, -1, -.03], [s * .09, -.98, -.1 - .08 * gal + kick], sit));
    aimBone(root, B[L + 'Foot'], B[L + 'ToeBase'], mix3([s * .05, -.2, 1], [s * .14, -.3, 1], sit));
    const reach = sit * (1 - (o.grab || 0)); // while mounting the hands go to the saddle horn
    aimBone(root, B[L + 'Arm'], B[L + 'ForeArm'], mix3([s * .16, -1, .02], [s * .2, -.88 + .12 * gal, .3 + .3 * gal + (o.rein || 0) * .4], Math.max(reach, o.grab || 0)));
    aimBone(root, B[L + 'ForeArm'], B[L + 'Hand'], mix3([s * .06, -1, .12], [s * -.1, -.22 + (o.rein || 0) + .1 * gal, 1], Math.max(reach, o.grab || 0)));
  }
  twistBone(root, B.Head, o.look || 0); twistBone(root, B.neck, (o.look || 0) * .5);
}
const STAND = [['LeftArm', 'LeftForeArm', [.16, -1, .02]], ['LeftForeArm', 'LeftHand', [.06, -1, .12]], ['RightArm', 'RightForeArm', [-.16, -1, .02]], ['RightForeArm', 'RightHand', [-.06, -1, .12]]];
// an idle clip built from the model's own rest pose: arms relaxed at the sides, slow breathing and a gentle weight shift
function makeIdleClip(root) {
  const B = root.userData.B, names = Object.keys(B), keys = [];
  const pose = (breath, shift) => { for (const n of names) B[n].quaternion.copy(B[n].userData.rest);
    aimBone(root, B.Spine02, B.Spine01, [shift * .03, 1, .02 + breath * .025]); aimBone(root, B.neck, B.Head, [-shift * .02, 1, .1 - breath * .02]);
    for (const [s, L] of [[1, 'Left'], [-1, 'Right']]) { aimBone(root, B[L + 'Arm'], B[L + 'ForeArm'], [s * (.16 + breath * .02), -1, .02 + breath * .03]); aimBone(root, B[L + 'ForeArm'], B[L + 'Hand'], [s * .06, -1, .14 + breath * .04]);
      aimBone(root, B[L + 'UpLeg'], B[L + 'Leg'], [s * .07 + shift * .03, -1, .02]); aimBone(root, B[L + 'Leg'], B[L + 'Foot'], [s * .02 + shift * .02, -1, -.02]); }
    return names.map(n => B[n].quaternion.toArray()); };
  const T = [0, 1.6, 3.2, 4.8, 6.4], P = [pose(0, 0), pose(1, .5), pose(0, 1), pose(1, .5), pose(0, 0)];
  for (const n of names) B[n].quaternion.copy(B[n].userData.rest);
  const tracks = names.map((n, i) => new THREE.QuaternionKeyframeTrack(n + '.quaternion', T, P.flatMap(f => f[i])));
  return new THREE.AnimationClip('idle', T[T.length - 1], tracks);
}
// a walking person: idle / walk / run blended by ground speed with shared stride timing (no foot sliding at matched speeds)
const WALK_V = 1.55, RUN_V = 3.9;
function makeWalker(src, clips) {
  const m = saveRest(cloneSkinned(src)); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(m), clip = n => clips.find(c => new RegExp(n, 'i').test(c.name));
  const A = { idle: mixer.clipAction(makeIdleClip(m)), walk: clip('walk') && mixer.clipAction(clip('walk')), run: clip('run') && mixer.clipAction(clip('run')) };
  const W = { m, mixer, A, v: 0, on: false,
    start() { if (W.on) return; W.on = true; for (const a of Object.values(A)) if (a) { a.reset(); a.play(); a.setEffectiveWeight(0); } A.idle.setEffectiveWeight(1); A.idle.time = Math.random() * 6; },
    stop() { if (!W.on) return; W.on = false; mixer.stopAllAction(); },
    update(dt, v) { W.start(); W.v += (v - W.v) * Math.min(1, dt * 8); const sp = W.v, wi = 1 - sstep(.12, 1.1, sp), rf = sstep(2.1, 3.8, sp);
      if (A.walk) A.walk.setEffectiveWeight((1 - wi) * (A.run ? 1 - rf : 1)); if (A.run) A.run.setEffectiveWeight((1 - wi) * (A.walk ? rf : 1)); A.idle.setEffectiveWeight(Math.max(wi, A.walk || A.run ? 0 : 1));
      const ts = Math.max(.35, sp / (WALK_V + (RUN_V - WALK_V) * rf)); for (const a of [A.walk, A.run]) if (a) a.setEffectiveTimeScale(ts); if (A.walk && A.run) A.run.time = A.walk.time % A.run.getClip().duration;
      mixer.update(dt); } };
  return W;
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
// procedural gaits for the rigged horse: walk (4-beat), trot (diagonal), canter (3-beat), gallop (4-beat transverse),
// blended by speed. Each leg runs a stance/swing cycle (hoof planted then lifted + folded) with gait-specific duty factor.
const GAITS = [ // v: speed centre (m/s); off: footfall phase per leg [FL, FR, HL, HR]; duty: stance share; stride: metres per cycle
  { v: 1.6, off: [.25, .75, 0, .5], duty: .63, stride: 1.75, A: .27, bob: .012, bn: 2, pitch: 0, nod: .07, nn: 2 },
  { v: 5, off: [0, .5, .5, 0], duty: .45, stride: 2.7, A: .34, bob: .032, bn: 2, pitch: .012, nod: .035, nn: 2 },
  { v: 10, off: [.33, .66, 0, .33], duty: .4, stride: 3.4, A: .43, bob: .05, bn: 1, pitch: .05, nod: .09, nn: 1 },
  { v: 17, off: [.42, .52, 0, .1], duty: .32, stride: 4.7, A: .54, bob: .06, bn: 1, pitch: .065, nod: .07, nn: 1 }];
function gaitMix(sp) { if (sp <= GAITS[0].v) return GAITS[0]; for (let i = 0; i < GAITS.length - 1; i++) { const a = GAITS[i], b = GAITS[i + 1]; if (sp <= b.v) { const t = sstep(a.v + (b.v - a.v) * .35, b.v - (b.v - a.v) * .15, sp), o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((x, j) => x + (b[k][j] - x) * t) : a[k] + (b[k] - a[k]) * t; o.bn = t < .5 ? a.bn : b.bn; o.nn = t < .5 ? a.nn : b.nn; return o; } } return GAITS[GAITS.length - 1]; }
function realAnim(hz, dt, speed, graze, t) {
  const u = hz.userData, B = u.bones, sp = Math.abs(speed), k = sstep(.05, 1.1, sp), G = gaitMix(sp), gal = sstep(8, 15, sp), TAU = Math.PI * 2;
  u.phase = (u.phase + dt * (sp > .05 ? sp / G.stride : 0)) % 1; const ph = u.phase;
  LEGS.forEach((b, i) => { const hind = i > 1; let c = (ph + G.off[i]) % 1; if (c < 0) c += 1; let ang, lift;
    if (c < G.duty) { const s = c / G.duty; ang = G.A * (1 - 2 * s); lift = 0; } else { const s = (c - G.duty) / (1 - G.duty), e = s * s * (3 - 2 * s); ang = -G.A + 2 * G.A * e; lift = Math.sin(Math.PI * s); }
    const A = ang * k * (hind ? .92 : 1), L = lift * k;
    B[b].rotation.x = -A + (hind ? .03 : -.02) * k;
    if (hind) { B[b + 1].rotation.x = -L * (.55 + .35 * gal) + Math.max(0, -A) * .25; B[b + 2].rotation.x = L * (.9 + .4 * gal) - Math.max(0, A) * .15; }
    else { B[b + 1].rotation.x = L * (1.0 + .7 * gal); B[b + 2].rotation.x = L * (.75 + .45 * gal) - Math.max(0, -A) * .2; } });
  // trunk: bounce + pitch, a slow breath when standing
  const bobT = G.bn === 2 ? Math.abs(Math.cos(ph * TAU)) : (Math.sin(ph * TAU) * .5 + .5), breath = Math.sin(t * 1.4 + u.seed) * .004 * (1 - k);
  B[1].position.y = u.bodyY - G.bob * k * (1 - bobT) + breath; B[1].rotation.x = Math.sin(ph * TAU + .9) * G.pitch * k; B[1].rotation.z = Math.sin(ph * TAU) * .015 * k * (1 - gal);
  // neck / head: nod in time with the gait, stretch forward in the gallop; graze with the head down; idle looks around
  u.look = u.look ?? 0; u.lookT = (u.lookT ?? 2) - dt; if (u.lookT <= 0) { u.lookT = 2.5 + Math.random() * 5; u.look = (Math.random() - .5) * .5; }
  u.tossT = (u.tossT ?? 6 + Math.random() * 10) - dt * (k < .2 ? 1 : 0); if (u.tossT <= 0) { u.tossT = 8 + Math.random() * 14; if (!graze) u.toss = 1; } // idle head toss now and then
  const ts = u.toss > 0 ? Math.sin(Math.PI * (1 - u.toss)) : 0; if (u.toss > 0) u.toss = Math.max(0, u.toss - dt * 1.5);
  const nod = Math.sin(ph * TAU * G.nn + 1.2) * G.nod * k - ts * .55;
  const nx = graze ? 1.05 : (-.1 * gal + nod + (1 - k) * .03), hx = graze ? .42 : .05 + .08 * gal - nod * .4 + ts * .35, ny = graze ? Math.sin(t * .35 + u.seed) * .12 : u.look * (1 - k);
  const r = Math.min(1, dt * (ts ? 7 : 3)); B[2].rotation.x += (nx - B[2].rotation.x) * r; B[3].rotation.x += (hx - B[3].rotation.x) * r; B[2].rotation.y += (ny - B[2].rotation.y) * Math.min(1, dt * 1.5); B[3].rotation.y = B[2].rotation.y * .6;
  // tail: carried higher with speed, swings with the stride, occasional swish at rest
  u.swT = (u.swT ?? 3) - dt; if (u.swT <= 0) { u.swT = 2 + Math.random() * 6; u.sw = 1; } u.sw = Math.max(0, (u.sw || 0) - dt * 1.3);
  B[4].rotation.x = .06 + .5 * gal * k + .12 * k + Math.sin(ph * TAU * G.bn) * .05 * k; B[4].rotation.z = Math.sin(t * 1.1 + u.seed) * .05 + Math.sin(ph * TAU) * .06 * k + Math.sin(u.sw * 9) * u.sw * .45;
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
// leaf clumps: world-space noise breaks up the flat crowns, darker deep inside, a little sun shining through the edges
function foliage(m, f) { m.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFW = (modelMatrix * vec4(transformed, 1.)).xyz;\n#ifdef USE_INSTANCING\nvFW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;\n#endif');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW; float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } float fn(vec3 p){ vec3 i = floor(p), q = fract(p); q = q * q * (3. - 2. * q); return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), q.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), q.x), q.y), mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), q.x), mix(fh(i + vec3(0,1,1)), fh(i + 1.), q.x), q.y), q.z); }')
    .replace('#include <color_fragment>', `#include <color_fragment>\n float lc = fn(vFW * ${f.toFixed(1)}) * .65 + fn(vFW * ${(f * 3.1).toFixed(1)}) * .35; diffuseColor.rgb *= mix(.55, 1.12, lc) * mix(vec3(1.), vec3(.86, 1.02, .8), fn(vFW * .21));`); };
  return m; }
function softFoliage(g, cy, k = .75) { // blend flat face normals with normals radiating from the crown axis -> soft, leafy shading
  const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - cy(p.getY(i)), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
    const nx = n.getX(i) * (1 - k) + x / l * k, ny = n.getY(i) * (1 - k) + y / l * k + .15, nz = n.getZ(i) * (1 - k) + z / l * k, m = Math.hypot(nx, ny, nz) || 1; n.setXYZ(i, nx / m, ny / m, nz / m); } return g; }
function strawTex(spiral) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#b8964a'; x.fillRect(0, 0, 256, 256); const r = mulberry(spiral ? 3 : 9);
  for (let i = 0; i < 1800; i++) { const l = 60 + r() * 120, h = 30 + r() * 25; x.strokeStyle = `hsla(${h},${45 + r() * 25}%,${38 + r() * 35}%,.55)`; x.lineWidth = .6 + r() * 1.4; x.beginPath();
    if (spiral) { const rad = r() * 125, a = r() * 6.28; x.arc(128, 128, rad, a, a + .3 + r() * .6); } else { const px = r() * 256, py = r() * 256; x.moveTo(px, py); x.lineTo(px + l * .97, py + (r() - .5) * 14); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
// colour grade (after tone mapping): warm highlights / cool shadows, a touch of contrast and saturation, soft vignette
const GRADE = { uniforms: { tDiffuse: { value: null }, uAmt: { value: 1 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt; varying vec2 vUv;
void main(){ vec4 c=texture2D(tDiffuse,vUv); vec3 x=c.rgb; float l=dot(x,vec3(.2126,.7152,.0722));
 x=mix(vec3(l),x,1.+.1*uAmt); x+=mix(vec3(-.014,.0,.018),vec3(.03,.01,-.025),smoothstep(.1,.8,l))*uAmt;
 x=mix(x,x*x*(3.-2.*x),.18*uAmt); vec2 d=vUv-.5; x*=1.-dot(d,d)*.28*uAmt; gl_FragColor=vec4(clamp(x,0.,1.),c.a); }` };
const COATS = [{ n: 'Bay' }, { n: 'Chestnut', c: 0xa04a1c, m: 0x6a2c10 }, { n: 'Grey', c: 0xd8d2c8, m: 0x8e8882 }, { n: 'Black', c: 0x2e2826, m: 0x161312 }, { n: 'Palomino', c: 0xd9a656, m: 0xf1e3c2 }];
const PROC_COATS = [[0x6b4226, 0x241812, 0x4a2c18], [0xa04a1c, 0x6a2c10, 0x3a2a1c], [0xd8d2c8, 0x8e8882, 0x7a4a24], [0x2a2220, 0x111111, 0x7a4a24], [0xd9a656, 0xf0e2c0, 0x4a2c18]];
const MODEL_URL = { horse: 'assets/horses/horse.glb', mid: 'assets/horses/horse_mid.glb', far: 'assets/horses/horse_far.glb', rider: 'assets/horses/rider.glb', riderHQ: 'assets/horses/rider_hq.glb' };
let ASSETS = null;
function deq(src) { // quantized (KHR_mesh_quantization) attributes -> float32 so the node transform can be baked in
  const g = new THREE.BufferGeometry(); g.setIndex(src.index);
  for (const [k, a] of Object.entries(src.attributes)) { const n = a.count, s = a.itemSize, f = new Float32Array(n * s), get = ['getX', 'getY', 'getZ', 'getW'];
    for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) f[i * s + c] = a[get[c]](i); g.setAttribute(k, new THREE.BufferAttribute(f, s)); }
  return g; }
function loadAssets(hq) {
  if (ASSETS) return ASSETS; if (new URLSearchParams(location.search).has('prochorse')) return (ASSETS = Promise.reject(new Error('procedural horses requested')));
  const L = new GLTFLoader(); const mesh = sc => { let m = null; sc.traverse(o => { if (o.isMesh && !m) m = o; }); return m; };
  return (ASSETS = Promise.all([L.loadAsync(hq ? MODEL_URL.horse : MODEL_URL.mid), L.loadAsync(MODEL_URL.far), L.loadAsync(hq ? MODEL_URL.riderHQ : MODEL_URL.rider)]).then(([h, f, r]) => {
    const near = mesh(h.scene), far = mesh(f.scene); near.updateWorldMatrix(true, false); far.updateWorldMatrix(true, false);
    const gN = deq(near.geometry).applyMatrix4(near.matrixWorld), gF = deq(far.geometry).applyMatrix4(far.matrixWorld);
    for (const g of [gN, gF]) { skinHorseGeometry(g); g.computeBoundingSphere(); }
    const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0 });
    r.scene.traverse(o => { if (o.isMesh && o.material) { o.material.metalness = 0; o.material.envMapIntensity = .8; } });
    const riderSrc = cloneSkinned(r.scene), clips = r.animations.map(c => { const k = c.clone(); k.tracks = k.tracks.filter(t => !/\.position$/.test(t.name)); return k; }); // no root motion
    return { riderSrc, clips, gN, gF, matN: COATS.map(c => coatMaterial(near.material, c, hq)), matF: COATS.map(c => coatMaterial(farMat, c)), rider: r.scene };
  }));
}

export function createHorseRider(ctx) {
  const { scene, GX, P, keys, input, camera, sfx, msg, PBRS } = ctx; let guns = null, zombies = null;
  const H = { on: false, horses: [], mounted: null, cd: 0, prompt: '', obst: [], fence: [], speed: 0, t: 0, near: null, vy: 0, ground: true, riddenT: 0, mounts: 0, models: 'loading', trees: [], lodT: 0, ridden: new Map(), follow: false, online: '',
    stam: 100, winded: 0, cruise: 2, shiftT: 0, yawRate: 0, roll: 0, pitchK: 0, mountT: 0, dismT: 0, wantOff: false, side: 1, lookT: 9, recenter: false, shake: 0, fv: new THREE.Vector2(), bodyYaw: 0, fp: false, gait: 'Standing', zoom: 1 };
  const rnd = mulberry(42), Q = GX.Q, mobile = !!ctx.mobile;
  const LOD_HORSE = mobile ? 9 : 14, LOD_TREE = mobile ? 70 : 125;
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), col = new THREE.Color();
  const pbr = (k, o = {}) => PBRS && PBRS[k] ? new THREE.MeshStandardMaterial({ map: PBRS[k].map, normalMap: PBRS[k].normalMap, roughness: 1, metalness: 0, ...o }) : std(o.color ?? 0x7a5634);
  const HQ = !mobile && Q.shadow > 0; // desktop medium / high / ultra: full sky + terrain detail
  function buildWorld() {
    const F = H.F = features(); H.mask = buildMask(F, MASK_HALF, mobile ? 1024 : 2048);
    const T = loadTerrainTextures(GX.renderer, HQ), XO = { mask: H.mask, maskHalf: MASK_HALF, chunkU: { value: new THREE.Vector4(0, 0, -1, 0) }, CH: CHUNK, LIM: CH_LIM };
    const mat = terrainMat2(T, PEN, SEG, BASE, HQ, XO), holeMat = terrainMat2(T, PEN, SEG, BASE, HQ, { ...XO, hole: true });
    // coarse inner square + far ring everywhere, streamed detail chunks (1.6-3.1 m grid) in a square around the player
    const seg = Q.shadow >= 2048 && !mobile ? 200 : HQ ? 180 : mobile ? 100 : 150;
    H.terrain = buildTerrain(scene, mat, hAt, 500, seg, HQ ? 110 : 72, HQ ? 448 : 256, holeMat); H.ground3d = H.terrain.inner;
    H.chunks = createChunks(scene, mat, hAt, { CH: CHUNK, seg: Q.shadow >= 2048 && !mobile ? 80 : HQ ? 64 : mobile ? 40 : 50, K: mobile ? 1 : 2, lim: CH_LIM, U: XO.chunkU }); H.chunks.update(P.pos.x, P.pos.z, true);
    H.water = createWater(scene, F, hAt, { mobile });
    buildTrees(); buildRocks(); buildLogs(); buildFlora(); buildGrass(); buildPen(); buildTrailMarks();
    if (mobile) for (const im of H.rockMeshes || []) if (im.count > 100) im.castShadow = false; // v32: big scattered rock sets do not cast on phones
  }
  // woods: conifers + broadleaf trees, instanced, with a near (detailed) / far (low-poly) LOD swapped around the player
  function buildTrees() {
    const nT = Math.round(Q.trees * (mobile ? 2.2 : 3));
    for (let i = 0; i < nT * 8 && H.trees.length < nT; i++) { const x = (rnd() - .5) * 2 * (EDGE + 30), z = (rnd() - .5) * 2 * (EDGE + 30);
      if (Math.hypot(x - PEN.x, z - PEN.z) < 36 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12 || clearing(x, z, 4) || trailDist(x, z) < 3.5 || inRange(x, z, 4)) continue; if (rnd() > .3 + .7 * (Math.sin(x * .02) * Math.cos(z * .025) * .5 + .5)) continue;
      const y = hAt(x, z); if (y - BASE > 44) continue; const s = .75 + rnd() * .65, conif = rnd() < (y - BASE > 12 ? .85 : .55);
      const tr = rnd() * 6.28, hue = rnd(); if (FEAT.trailDist(x, z) < 4.2 || FEAT.waterDist(x, z) < 3.5) continue; H.trees.push({ x, y: y - .15, z, s, r: tr, conif, hue }); H.obst.push([x, z, (conif ? .4 : .45) * s, 11 * s]); }
    { // v30: pine forests up the mountain slopes you can ride among (collision inside the rideable square), thinning out to the tree line
      const r2 = mulberry(77), n2 = (x, z) => Math.sin(x * .013 + Math.cos(z * .009) * 2) * Math.cos(z * .011 - Math.sin(x * .007) * 1.7), nM = mobile ? 1300 : HQ ? 4800 : 3000; let c = 0;
      for (let i = 0; i < nM * 14 && c < nM; i++) { const a = r2() * TAU, d = EDGE + 8 + Math.pow(r2(), 1.25) * (1420 - EDGE), x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.max(Math.abs(x), Math.abs(z)) < EDGE + 25 || FEAT.trailDist(x, z) < 4.2 || FEAT.waterDist(x, z) < 3.5) continue; const y = hAt(x, z), hh = y - BASE, sl = Math.hypot(hAt(x + 1.5, z) - y, hAt(x, z + 1.5) - y) / 1.5;
        if (sl > .85 || hh > 215 + n2(x, z) * 40 || hh < -10 || n2(x * 1.7, z * 1.7) < -.4 + Math.min(.5, hh / 420)) continue;
        const s = (.8 + r2() * .85) * (1 - Math.min(.35, Math.max(0, hh - 120) / 300)); H.trees.push({ x, y: y - .25, z, s, r: r2() * 6.28, conif: r2() < .94, hue: r2() }); c++;
        if (Math.max(Math.abs(x), Math.abs(z)) < WALK + 8) H.obst.push([x, z, .4 * s, 11 * s]); } H.mountainTrees = c; }
    const bark = pbr('bark', { color: 0x9a8a7a }); if (bark.map) { bark.map = bark.map.clone(); bark.map.repeat.set(1, 3); bark.normalMap = bark.normalMap.clone(); bark.normalMap.repeat.set(1, 3); }
    const leaf = foliage(new THREE.MeshStandardMaterial({ roughness: .92, vertexColors: true, color: 0x9aa07c }), 2.2), needle = foliage(new THREE.MeshStandardMaterial({ roughness: .95, vertexColors: true, color: 0x7f9478 }), 3.4);
    const nC = H.trees.filter(t => t.conif).length, nB = H.trees.length - nC;
    const mk = (g, m, n, shadow = true) => { const im = new THREE.InstancedMesh(g, m, Math.max(1, n)); im.count = 0; im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
    H.tm = { cTrunk: mk(new THREE.CylinderGeometry(.16, .36, 12, 7).translate(0, 6, 0), bark, nC), bTrunk: mk(new THREE.CylinderGeometry(.18, .34, 5.2, 7).translate(0, 2.6, 0), bark, nB),
      cNear: mk(conifCards(mobile ? 11 : 16), cardMaterial(needleTexture(), 0xffffff, 3.4), nC), /* v32: branch cards */ cFar: mk(softFoliage(farConifer(), y => y, .6), needle, nC, false), bNear: mk(broadleafCards(11, mobile ? 8 : 12), cardMaterial(leafTexture(), 0xffffff, 2.2), nB), bFar: mk(softFoliage(broadleafGeo(0, 11), () => 5, .8), leaf, nB, false) }; // far LOD is never inside the shadow box
    // trunks never change LOD: fill once
    let ic = 0, ib = 0; for (const t of H.trees) { m4.compose(v3.set(t.x, t.y, t.z), qq.setFromAxisAngle(up, t.r), sc3.set(t.s, t.s * (t.conif ? 1 : .9 + t.hue * .3), t.s)); if (t.conif) H.tm.cTrunk.setMatrixAt(ic++, m4); else H.tm.bTrunk.setMatrixAt(ib++, m4); }
    H.tm.cTrunk.count = ic; H.tm.bTrunk.count = ib; if (mobile) H.tm.cTrunk.castShadow = H.tm.bTrunk.castShadow = false; // v32: phones only shadow the near crowns (the trunk instances cover the whole map) updateTreeLOD(true);
  }
  function updateTreeLOD(force) {
    const T = H.tm; if (!T) return; const px = P.pos.x, pz = P.pos.z; if (!force && H.lodAt && Math.hypot(px - H.lodAt[0], pz - H.lodAt[1]) < 8) return; H.lodAt = [px, pz];
    const n = { cNear: 0, cFar: 0, bNear: 0, bFar: 0 };
    for (const t of H.trees) { const near = Math.hypot(t.x - px, t.z - pz) < LOD_TREE, key = (t.conif ? 'c' : 'b') + (near ? 'Near' : 'Far'), im = T[key];
      m4.compose(v3.set(t.x, t.y, t.z), qq.setFromAxisAngle(up, t.r), sc3.set(t.s, t.s * (t.conif ? 1 : .9 + t.hue * .3), t.s)); im.setMatrixAt(n[key], m4);
      im.setColorAt(n[key]++, near ? (t.conif ? col.setHSL(.29 + t.hue * .06, .2 + t.hue * .1, .46 + t.hue * .1) : col.setHSL(.2 + t.hue * .08, .28 + t.hue * .12, .52 + t.hue * .1)) : t.conif ? col.setHSL(.27 + t.hue * .06, .34 + t.hue * .1, .2 + t.hue * .06) : col.setHSL(.2 + t.hue * .09, .42 + t.hue * .15, .24 + t.hue * .08)); }
    for (const k in n) { const im = T[k]; im.count = n[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  // sagebrush, bunchgrass, cacti and the far woods on the mountain slopes (src/hrflora.js)
  function buildFlora() {
    const needle = foliage(new THREE.MeshStandardMaterial({ roughness: .95, vertexColors: true, color: 0x7f9478 }), 3.4);
    H.flora = createFlora(scene, { hAt, BASE, EDGE, mobile, HQ, farTree: null, needle, obst: H.obst,
      avoid: (x, z) => Math.abs(x - PEN.x) < PEN.hw + 22 && Math.abs(z - PEN.z) < PEN.hd + 22 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8 || clearing(x, z, 3) || trailDist(x, z) < 2.6 || inRange(x, z, 3) || FEAT.trailDist(x, z) < 3.2 || FEAT.waterDist(x, z) < 2.5 });
  }
  // CC0 scanned boulders (Poly Haven), instanced in three shapes; icosahedron stand-ins if the models fail to load
  function buildRocks() {
    const nR = Math.round(Q.trees * (mobile || !HQ ? .35 : .7)), list = [];
    for (let i = 0; i < nR * 4 && list.length < nR; i++) { const x = (rnd() - .5) * 2 * EDGE, z = (rnd() - .5) * 2 * EDGE; if (Math.hypot(x - PEN.x, z - PEN.z) < 30 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8 || clearing(x, z, 3) || trailDist(x, z) < 3 || inRange(x, z, 2)) continue;
      const s = .45 + rnd() * rnd() * 3.2, k = rnd() < .45 ? 0 : rnd() < .5 ? 1 : 2; if (FEAT.trailDist(x, z) < 3.6 + s || FEAT.waterDist(x, z) < 2 + s) continue; list.push({ x, z, s, k, ry: rnd() * 6.28, tilt: (rnd() - .5) * .25 }); if (s > .8) H.obst.push([x, z, s * .62, s * 1.3]); }
    { // v30: rocky outcrops and boulder fields on the mountain slopes, boulders along the trails
      const r3 = mulberry(91), nO = mobile ? 90 : HQ ? 340 : 200, nB = mobile ? 70 : HQ ? 260 : 160; let c = 0;
      for (let i = 0; i < nO * 20 && c < nO; i++) { const a = r3() * TAU, d = EDGE - 30 + r3() * 1000, x = Math.cos(a) * d, z = Math.sin(a) * d; if (FEAT.trailDist(x, z) < 7 || FEAT.waterDist(x, z) < 4 || featAvoid(x, z)) continue;
        const y = hAt(x, z), sl = Math.hypot(hAt(x + 3, z) - y, hAt(x, z + 3) - y) / 3; if (sl < .4 || y - BASE > 330) continue; const s = 1.6 + r3() * r3() * 5.5, k = (r3() * 3) | 0;
        list.push({ x, z, s, k, ry: r3() * 6.28, tilt: (r3() - .5) * .6, sink: .3, lp: 1 }); c++; if (Math.max(Math.abs(x), Math.abs(z)) < WALK + 8) H.obst.push([x, z, s * .62, s * 1.3]);
        if (r3() < .5) for (let m = 0; m < 3; m++) { const bx = x + (r3() - .5) * s * 4, bz = z + (r3() - .5) * s * 4, bs = .4 + r3() * 1.2; if (FEAT.trailDist(bx, bz) < 4) continue; list.push({ x: bx, z: bz, s: bs, k: (r3() * 3) | 0, ry: r3() * 6.28, tilt: (r3() - .5) * .4, lp: 2 }); if (bs > .8 && Math.max(Math.abs(bx), Math.abs(bz)) < WALK + 8) H.obst.push([bx, bz, bs * .62, bs * 1.3]); } }
      for (const t of FEAT.trails) for (let i = 0; i < nB / FEAT.trails.length; i++) { const p = t.pts[(r3() * t.pts.length) | 0], q = t.pts[Math.min(t.pts.length - 1, t.pts.indexOf(p) + 1)], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, sd = r3() < .5 ? -1 : 1, off = 3.6 + r3() * 3;
        const x = p[0] - dz / l * off * sd, z = p[1] + dx / l * off * sd, s = .35 + r3() * r3() * 1.1; if (FEAT.trailDist(x, z) < 3.4) continue; list.push({ x, z, s, k: (r3() * 3) | 0, ry: r3() * 6.28, tilt: (r3() - .5) * .3, lp: 2 }); if (s > .8) H.obst.push([x, z, s * .62, s * 1.3]); } }
    // low-poly procedural rocks for the thousand-odd mountain outcrops / boulders (the scanned boulders stay in the meadows: ~1.8k tris each)
    const lowRock = (det, seed) => { const g = new THREE.IcosahedronGeometry(.5, det), p = g.attributes.position, rr = mulberry(seed); const ph = [rr() * 6, rr() * 6, rr() * 6];
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + .22 * Math.sin(x * 7 + ph[0]) * Math.cos(z * 6 + ph[1]) + .12 * Math.sin(y * 9 + ph[2]); p.setXYZ(i, x * n, Math.max(-.12, y * n * .78), z * n); }
      g.translate(0, .14, 0); g.computeVertexNormals(); return g; };
    const triRock = m => { m.onBeforeCompile = sh => { // v32: world-space triplanar albedo (no UV seams on the low-poly rocks) + moss/lichen on top faces, darker crevices
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = vec4(transformed, 1.);\n#ifdef USE_INSTANCING\n wp = instanceMatrix * wp;\n#endif\n vRW = (modelMatrix * wp).xyz; vRN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;').replace('#include <map_fragment>', `#ifdef USE_MAP
 vec3 w3 = pow(abs(vRN), vec3(4.)); w3 /= w3.x + w3.y + w3.z; vec3 p3 = vRW / 1.7; vec4 tc = texture2D(map, p3.zy) * w3.x + texture2D(map, p3.xz) * w3.y + texture2D(map, p3.xy) * w3.z;
 float up = smoothstep(.55, .9, vRN.y); float lich = fract(sin(dot(floor(vRW * 3.), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
 vec3 rc = tc.rgb * mix(.85, 1.08, fract(sin(dot(floor(vRW.xz * .05), vec2(12.9, 78.2))) * 437.5)); rc = mix(rc, rc * vec3(.62, .78, .45), up * .55); rc = mix(rc, vec3(.62, .6, .46), step(.985, lich) * (1. - up) * .5);
 diffuseColor.rgb *= rc;
#endif`); }; return m; };
    const placeLow = mat => { const rm = triRock(mat.clone()); rm.normalScale && rm.normalScale.set(1.2, 1.2); for (const [lp, det] of [[1, 2], [2, 1]]) { const L = list.filter(r => r.lp === lp); if (!L.length) continue; const im = new THREE.InstancedMesh(lowRock(det, 7 + lp), rm, L.length);
      L.forEach((r, i) => { m4.compose(v3.set(r.x, hAt(r.x, r.z) - r.s * (r.sink || .12), r.z), qq.setFromEuler(new THREE.Euler(r.tilt, r.ry, r.tilt * .6)), sc3.set(r.s * 1.5, r.s * (.8 + (i % 5) * .12), r.s * 1.5)); im.setMatrixAt(i, m4); });
      im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); (H.rockMeshes = H.rockMeshes || []).push(im); } list.splice(0, list.length, ...list.filter(r => !r.lp)); };
    const place = shapes => { placeLow(shapes[0].mat); for (let k = 0; k < shapes.length; k++) { const L = list.filter(r => r.k % shapes.length === k), im = new THREE.InstancedMesh(shapes[k].geo, shapes[k].mat, Math.max(1, L.length));
      L.forEach((r, i) => { m4.compose(v3.set(r.x, hAt(r.x, r.z) - r.s * (r.sink || .12), r.z), qq.setFromEuler(new THREE.Euler(r.tilt, r.ry, r.tilt * .6)), sc3.set(r.s * 1.5, r.s * (shapes[k].h ? 1.5 : .7), r.s * 1.5)); im.setMatrixAt(i, m4); });
      im.count = L.length; im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); (H.rockMeshes = H.rockMeshes || []).push(im); }
      // small stones scattered through the grass (no collision, no shadow casting)
      const nP = mobile ? 260 : HQ ? 1100 : 600, S = 2, pg = [new THREE.IcosahedronGeometry(.5, 1).translate(0, .25, 0), new THREE.DodecahedronGeometry(.5, 0).translate(0, .22, 0)]; // low-poly stand-ins (the scanned boulders are far too dense to scatter by the thousand)
      const pm = shapes[0].mat.clone(); if (pm.color) pm.color.multiplyScalar(.55); const ims = pg.map(g => { const im = new THREE.InstancedMesh(g, pm, Math.ceil(nP / S)); im.count = 0; im.receiveShadow = true; scene.add(im); return im; });
      for (let i = 0; i < nP * 3 && ims.reduce((n, m) => n + m.count, 0) < nP; i++) { const x = (rnd() - .5) * 2 * EDGE, z = (rnd() - .5) * 2 * EDGE; if (Math.hypot(x - PEN.x, z - PEN.z) < 18 || trailDist(x, z) < 1.5 || inRange(x, z, 1)) continue;
        const im = ims[i % S]; if (im.count >= Math.ceil(nP / S) || FEAT.waterDist(x, z) < 1.5) continue; const s = .12 + rnd() * rnd() * .45; m4.compose(v3.set(x, hAt(x, z) - s * .25, z), qq.setFromEuler(new THREE.Euler(rnd() * .6, rnd() * 6.28, rnd() * .6)), sc3.set(s, s * (.5 + rnd() * .6), s)); im.setMatrixAt(im.count++, m4); }
      for (const im of ims) { im.computeBoundingSphere(); im.instanceMatrix.needsUpdate = true; } H.pebbles = ims.reduce((n, m) => n + m.count, 0); };
    loadRockModels().then(place).catch(e => { console.warn('rock models failed', e); const rg = new THREE.IcosahedronGeometry(.5, 2); rg.translate(0, .3, 0); place([{ geo: rg, mat: pbr('rock', { color: 0xb0aca4 }), h: 0 }]); });
  }
  // v30: fallen logs in the woods (meadow edges and mountain forests); they block like a low wall
  function buildLogs() {
    const r4 = mulberry(133), n = mobile ? 60 : HQ ? 200 : 130, L = [], src = H.trees.filter(t => t.conif);
    for (let i = 0; i < n * 8 && L.length < n && src.length; i++) { const t = src[(r4() * src.length) | 0], a = r4() * TAU, d = 2.5 + r4() * 5, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, len = 3.5 + r4() * 5.5, yaw = r4() * TAU, cx = Math.cos(yaw), cz = Math.sin(yaw);
      const ax = x - cx * len / 2, az = z - cz * len / 2, bx = x + cx * len / 2, bz = z + cz * len / 2; if ([[ax, az], [x, z], [bx, bz]].some(([px, pz]) => featAvoid(px, pz) || FEAT.trailDist(px, pz) < 4 || FEAT.waterDist(px, pz) < 3 || trailDist(px, pz) < 4 || Math.max(Math.abs(px), Math.abs(pz)) > WALK)) continue;
      const ya = hAt(ax, az), yb = hAt(bx, bz); if (Math.abs(ya - yb) / len > .6) continue; L.push({ x, z, len, yaw, ya, yb, s: .75 + r4() * .55 }); }
    const bark = pbr('bark', { color: 0x7d6e60 }); if (bark.map) { bark.map = bark.map.clone(); bark.map.repeat.set(3, 1); bark.normalMap = bark.normalMap.clone(); bark.normalMap.repeat.set(3, 1); }
    const geo = new THREE.CylinderGeometry(.24, .3, 1, 9, 1).rotateZ(Math.PI / 2), end = new THREE.CircleGeometry(.27, 9), im = new THREE.InstancedMesh(geo, bark, Math.max(1, L.length));
    L.forEach((g, i) => { m4.compose(v3.set(g.x, (g.ya + g.yb) / 2 + .2 * g.s, g.z), qq.setFromEuler(new THREE.Euler(0, -g.yaw, Math.atan2(g.yb - g.ya, g.len), 'YXZ')), sc3.set(g.len, g.s, g.s)); im.setMatrixAt(i, m4);
      for (let k = 0; k <= Math.ceil(g.len / 1.1); k++) { const f = k / Math.ceil(g.len / 1.1) - .5; H.obst.push([g.x + Math.cos(g.yaw) * g.len * f, g.z + Math.sin(g.yaw) * g.len * f, .34 * g.s, .55 * g.s]); } });
    im.count = L.length; im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); H.logs = L.length; void end;
  }
  // v30: a signpost at each mountain trailhead and a stone cairn on each summit
  function buildTrailMarks() {
    const bark = pbr('bark', { color: 0x8a7c6c }), stone = pbr('rock', { color: 0xa49e94 }), r5 = mulberry(171);
    H.marks = []; for (const t of FEAT.trails) { const [hx, hz] = t.head, p1 = t.pts[Math.min(8, t.pts.length - 1)], dx = p1[0] - hx, dz = p1[1] - hz, l = Math.hypot(dx, dz) || 1, sx = hx - dz / l * 3.6, sz = hz + dx / l * 3.6, y = hAt(sx, sz);
      const mg = new THREE.Group(); mg.userData.at = [sx, sz]; scene.add(mg); H.marks.push(mg);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 2.6, 8), bark); post.position.set(sx, y + 1.25, sz); post.castShadow = true; mg.add(post);
      const sign = signMesh('MOUNTAIN TRAIL'); sign.scale.setScalar(.7); sign.position.set(sx, y + 2.2, sz); sign.rotation.y = Math.atan2(-hx, -hz); mg.add(sign); const sb = sign.clone(); sb.rotation.y += Math.PI; sb.position.addScaledVector(new THREE.Vector3(Math.sin(sign.rotation.y), 0, Math.cos(sign.rotation.y)), -.03); mg.add(sb);
      H.obst.push([sx, sz, .25, 2.6]);
      const [tx, tz, ty] = t.top, g = new THREE.Group(); g.position.set(tx + 2.5, hAt(tx + 2.5, tz), tz); g.userData.at = [tx, tz]; scene.add(g); H.marks.push(g); let yy = 0;
      for (let k = 0; k < 6; k++) { const rs = .55 - k * .07, st = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), stone); st.scale.set(1, .55, 1); st.position.set((r5() - .5) * .12, yy + rs * .45, (r5() - .5) * .12); st.rotation.y = r5() * 6; st.castShadow = st.receiveShadow = true; g.add(st); yy += rs * .75; }
      H.obst.push([tx + 2.5, tz, .6, 1.8]); void ty; }
  }
  // GPU grass: tufts on a camera-following grid (count / radius from the quality tier), sways in the wind, wildflowers, fades out by distance
  function buildGrass() {
    const tufts = Math.round(Math.min(60000, Math.max(3000, (Q.grass || 600) * 4.5)) * (mobile ? .5 : 1.15)), N = Math.round(Math.sqrt(tufts)); // v30: denser near the player on desktop
    const R = Math.min(52, Math.max(18, 9 + Math.sqrt(N * N) * .19));
    H.grassG = createGrass(scene, H.terrain, PEN, SEG, { N, R, blades: mobile ? 4 : HQ ? 9 : 7, hAt, mask: H.mask, maskHalf: MASK_HALF, mobile }); H.grassInfo = { tufts: N * N, radius: +R.toFixed(1), tris: H.grassG.tris };
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
    const g = new THREE.Group(), mdl = new THREE.Group(); g.rotation.order = 'YXZ'; mdl.rotation.y = Math.PI; g.add(mdl); // model faces +z; game forward is -z
    const bones = makeBones(); mdl.add(bones[0]); g.updateMatrixWorld(true);
    const sk = new THREE.Skeleton(bones), near = new THREE.SkinnedMesh(A.gN, A.matN[ci]), far = new THREE.SkinnedMesh(A.gF, A.matF[ci]);
    for (const m of [near, far]) { mdl.add(m); m.bind(sk); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    far.visible = false; const sad = makeSaddle(PBRS); mdl.add(sad); g.updateMatrixWorld(true); bones[1].attach(sad); // follow the trunk bone
    g.userData = { kind: 'real', bones, near, far, mdl, phase: rnd(), seed: rnd() * 10, bodyY: bones[1].position.y, coat: COATS[ci].n };
    return g;
  }
  function spawnHorses() {
    PROC_COATS.forEach(([coat, mane, sad], i) => { const g = makeHorse(coat, mane, sad); const x = PEN.x - 8 + i * 4 + (rnd() - .5), z = PEN.z - 3 + (i % 2) * 5;
      g.position.set(x, BASE, z); g.rotation.order = 'YXZ'; g.rotation.y = rnd() * 6.28; scene.add(g);
      H.horses.push({ id: i, g, pos: g.position, yaw: g.rotation.y, speed: 0, tgt: null, wait: rnd() * 3, graze: rnd() < .5, inPen: true, coat: COATS[i].n }); });
  }
  let rider = makeProcRider(0x2c5d8a); rider.visible = false; // seated rider: the procedural stand-in until the rigged person loads
  const reins = [], me = { W: null, body: new THREE.Group(), seat: new THREE.Vector3(0, .45, .04) }; me.body.visible = false; scene.add(me.body);
  H.person = me;
  function dress(A) { // swap the procedural stand-ins for the realistic rigged models (keeps positions/state)
    for (const h of H.horses) { const ng = makeRealHorse(A, h.id); ng.position.copy(h.pos); ng.rotation.y = h.yaw; scene.remove(h.g); scene.add(ng); h.g = ng; h.pos = ng.position; }
    const was = H.mounted; if (was) detachRider(was);
    const W = makeWalker(A.riderSrc, A.clips), m = W.m; m.updateMatrixWorld(true);
    const hp = m.userData.B.Hips ? m.userData.B.Hips.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0);
    me.seat.set(0, .45, .04).sub(hp); me.W = W; m.userData.kind = 'real'; rider = m;
    if (was) attachRider(was); else toFoot();
    const sp = saddleParts(PBRS); for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(sp.rein, sp.dark); r.visible = false; r.castShadow = false; scene.add(r); reins.push(r); }
    H.models = 'real'; H.assets = A; for (const av of avatars) av.rebuild();
  }
  const real = () => rider.userData.kind === 'real';
  function toFoot() { if (!real()) return; me.body.add(rider); rider.position.set(0, 0, 0); rider.rotation.set(0, Math.PI, 0); rider.visible = true; me.body.visible = !H.fp; }
  function attachRider(h) { rider.visible = true;
    if (h.g.userData.kind === 'real' && real()) { me.W.stop(); h.g.userData.bones[1].add(rider); rider.position.copy(me.seat); rider.rotation.set(0, 0, 0); me.body.visible = false; }
    else { h.g.add(rider); rider.position.set(0, h.g.userData.kind === 'real' ? 1.45 : 1.72, .08); } }
  function detachRider() { if (rider.parent) rider.parent.remove(rider); for (const r of reins) r.visible = false; if (real()) toFoot(); else rider.visible = false; }
  const mouth = [new THREE.Vector3(-.075, -.2, .3), new THREE.Vector3(.075, -.2, .3)], wA = new THREE.Vector3(), wB = new THREE.Vector3();
  function updateReins() { const h = H.mounted; if (!h || h.g.userData.kind !== 'real' || !real() || !reins.length) return;
    h.g.updateMatrixWorld(true); const head = h.g.userData.bones[3], Bn = rider.userData.B, grab = H.mountT > 0 || H.dismT > 0;
    ['LeftHand', 'RightHand'].forEach((n, i) => { const hand = Bn[n], r = reins[i]; if (!hand || grab) { r.visible = false; return; } wA.copy(mouth[i]).applyMatrix4(head.matrixWorld); hand.getWorldPosition(wB);
      const L = wB.distanceTo(wA); r.visible = L > .05 && L < 3; if (!r.visible) return; r.position.copy(wB); r.lookAt(wA); r.scale.set(1, 1, L); }); }
  // mounting / dismounting: the rider steps into the stirrup on one side, swings the far leg over and settles (p: 0 standing -> 1 seated)
  const MOUNT_T = .95, DISM_T = .7, mv0 = new THREE.Vector3(), mv1 = new THREE.Vector3();
  function mountPose(h, p) { if (!real() || h.g.userData.kind !== 'real') return; const s = H.side, gy = -(h.g.userData.bodyY + .02);
    const a = sstep(0, .3, p), b = sstep(.22, .85, p), c = sstep(.7, 1, p);
    mv0.set(s * .85, gy, .05).lerp(mv1.set(s * .62, gy + .42, .02), a); mv0.lerp(me.seat, b); mv0.y += Math.sin(Math.PI * b) * .14;
    rider.position.copy(mv0); rider.rotation.set(0, (s > 0 ? -Math.PI / 2 : Math.PI / 2) * (1 - b), 0);
    riderPose(rider, { sit: Math.min(1, a * .3 + b * .55 + c * .15), side: s, swing: b, grab: a * (1 - c) }); }
  const inPen = (x, z, m = 0) => Math.abs(x - PEN.x) < PEN.hw - m && Math.abs(z - PEN.z) < PEN.hd - m;
  function segDist(px, pz, [ax, az, bx, bz]) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
  // blocked(x, z, r, skipHorse): fence/walls, trees/rocks/props, other horses, map edge
  // obstacle buckets (8 m cells, rebuilt whenever obstacles are added): thousands of mountain trees stay cheap to collide with
  const OG = { n: -1, m: new Map() }, OC = 8, NONE = [], okey = (i, j) => (i + 512) * 1024 + j + 512;
  function obstNear(x, z) { if (OG.n !== H.obst.length) { OG.m.clear(); for (const o of H.obst) { const rr = o[2] + 1.1; for (let i = Math.floor((o[0] - rr) / OC); i <= Math.floor((o[0] + rr) / OC); i++) for (let j = Math.floor((o[1] - rr) / OC); j <= Math.floor((o[1] + rr) / OC); j++) { const k = okey(i, j); let L = OG.m.get(k); if (!L) OG.m.set(k, L = []); L.push(o); } } OG.n = H.obst.length; }
    return OG.m.get(okey(Math.floor(x / OC), Math.floor(z / OC))) || NONE; }
  H.obstNear = obstNear;
  function blocked(x, z, r, skip) {
    if (Math.abs(x) > WALK || Math.abs(z) > WALK) return true;
    for (const f of H.fence) if (segDist(x, z, f) < r + .1) return true;
    for (const [ox, oz, or] of obstNear(x, z)) if (Math.abs(ox - x) < or + r && Math.abs(oz - z) < or + r && Math.hypot(ox - x, oz - z) < or + r) return true;
    for (const h of H.horses) if (h !== skip && h !== H.mounted && Math.hypot(h.pos.x - x, h.pos.z - z) < .75 + r) return true;
    return false;
  }
  // too steep to climb: keep only the along-the-contour part of the step (slide along the bank), else stay put. true = it was too steep
  function slopeGate(pos, ox, oz, gy0, maxG, r, skip) { const dx = pos.x - ox, dz = pos.z - oz, mv = Math.hypot(dx, dz); if (mv < 1e-4 || (hAt(ox + dx / mv * 1.2, oz + dz / mv * 1.2) - gy0) / 1.2 <= maxG) return false; // grade over the next 1.2 m (ignores tiny kinks)
    let gx = hAt(ox + .7, oz) - hAt(ox - .7, oz), gz = hAt(ox, oz + .7) - hAt(ox, oz - .7); const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl; const upc = dx * gx + dz * gz, tx = ox + dx - upc * gx, tz = oz + dz - upc * gz, m = Math.hypot(tx - ox, tz - oz);
    if (m > 1e-4 && (hAt(ox + (tx - ox) / m * 1.2, oz + (tz - oz) / m * 1.2) - gy0) / 1.2 <= maxG && !blocked(tx, tz, r, skip)) { pos.x = tx; pos.z = tz; } else { pos.x = ox; pos.z = oz; } return true; }
  function moveCircle(pos, dx, dz, r, skip) { let hit = false; if (!blocked(pos.x + dx, pos.z, r, skip)) pos.x += dx; else hit = true; if (!blocked(pos.x, pos.z + dz, r, skip)) pos.z += dz; else hit = true; return hit; }
  function nearestHorse() { let best = null, bd = MOUNT_R; for (const h of H.horses) { if (H.ridden.has(h)) continue; const d = Math.hypot(h.pos.x - P.pos.x, h.pos.z - P.pos.z); if (d < bd) { bd = d; best = h; } } return best; }
  function use() {
    if (!H.on || H.cd > 0) return false;
    if (H.mounted) { if (H.mountT > 0 || H.dismT > 0) return false; H.wantOff = true; H.cd = COOLDOWN; return true; } // rein in, then step down
    const h = nearestHorse(); if (!h) { msg('Walk up to a horse to ride it', 1.5); return false; }
    const rx = Math.cos(h.yaw), rz = -Math.sin(h.yaw); H.side = (P.pos.x - h.pos.x) * rx + (P.pos.z - h.pos.z) * rz > 0 ? -1 : 1; // mount from the side you stand on (+1 = horse's left)
    H.mounted = h; H.cd = COOLDOWN; H.speed = 0; H.yawRate = 0; H.roll = 0; H.wantOff = false; H.dismT = 0; H.mountT = real() && h.g.userData.kind === 'real' ? MOUNT_T : 0;
    h.speed = 0; h.tgt = null; h.graze = false; P.yaw = h.yaw; P.pitch = -.15; H.lookT = 9; H.swLast = P.swX || 0; H.recenter = false; attachRider(h); if (H.mountT) mountPose(h, 0);
    H.mounts++; sfx.ui && sfx.ui(); msg(mobile ? 'Riding! Push the stick to go · all the way to gallop' : 'Riding! W go · tap Shift to speed up a gait · hold Shift to gallop · C slow down · E get off', 3); return true;
  }
  function dismount() { // immediate (net conflicts, tests); the E / GET OFF path animates first via H.wantOff
    const h = H.mounted; if (!h) return false; const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw), rx = -fz, rz = fx, sd = H.side || 1;
    const tries = [[-rx * 1.5 * sd, -rz * 1.5 * sd], [rx * 1.5 * sd, rz * 1.5 * sd], [-fx * 2.4, -fz * 2.4], [fx * 2.4, fz * 2.4], [-rx * 2.6, -rz * 2.6], [rx * 2.6, rz * 2.6]];
    let spot = null; for (const [ox, oz] of tries) { const x = h.pos.x + ox, z = h.pos.z + oz; if (!blocked(x, z, .35, h)) { spot = [x, z]; break; } }
    if (!spot) spot = [h.pos.x - rx * 1.5, h.pos.z - rz * 1.5];
    P.pos.set(spot[0], hAt(spot[0], spot[1]), spot[1]); H.vy = 0; H.mounted = null; H.cd = COOLDOWN; H.wantOff = false; H.dismT = 0; H.mountT = 0; H.speed = 0; H.roll = 0;
    h.speed = 0; h.wait = 4 + rnd() * 4; h.inPen = inPen(h.pos.x, h.pos.z, .5); h.graze = true; h.g.rotation.z = 0;
    if (H.follow) h.net = { x: h.pos.x, z: h.pos.z, yaw: h.yaw, sp: 0, gr: 1 };
    detachRider(h); H.bodyYaw = Math.atan2(h.pos.x - P.pos.x, h.pos.z - P.pos.z) + Math.PI; H.fv.set(0, 0); P.yaw = h.yaw; P.pitch = -.1; sfx.ui && sfx.ui(); msg('Dismounted', 1.2); return true;
  }

  // ---------------- sky, sun, aerial haze, shadows, grade (Horse Rider only; leaving the mode reloads the page) ----------------
  const QS = new URLSearchParams(location.search), SUN_FIX = QS.has('sun'), SUN0 = SUN_FIX ? +QS.get('sun') : 11, SUN_AZ = -.75;
  let sky = null, fog = null; const sunTmp = new THREE.Vector3(), lm = new THREE.Matrix4(), lmi = new THREE.Matrix4(), O3 = new THREE.Vector3(), fwd3 = new THREE.Vector3(), fogTmp = new THREE.Color();
  const sunEl = () => SUN_FIX ? SUN0 : SUN0 + 4.5 * Math.sin(H.t / 190); // golden hour, the sun drifts slowly (~20 min cycle)
  const aces = x => { x *= GX.renderer.toneMappingExposure / .6; return Math.min(1, Math.max(0, x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14))); };
  function setupSky() {
    scene.userData.ownSky = true; scene.background = null; camera.near = .12; camera.far = 6000; camera.updateProjectionMatrix();
    sky = H.sky = createSky(GX.renderer, scene, { hq: HQ, mobile });
    fog = scene.fog = new THREE.Fog(0xc8c0b0, mobile ? .00052 : .00042, 0); // near = haze density, far = packed sun direction (see gfx.js fog chunk)
    GX.renderer.toneMappingExposure = .82; GX.hemi.groundColor.set(0x3e3a2c);
    const sn = GX.sun, sc = sn.shadow.camera, SR = mobile ? 24 : Q.shadow >= 4096 ? (Q.pr >= 2 ? 72 : 58) : Q.shadow >= 2048 ? 46 : 32; // v32: phones get a small soft shadow box, desktop high/ultra a 4K one
    if (sn.castShadow) { sc.left = sc.bottom = -SR; sc.right = sc.top = SR; sc.near = 1; sc.far = 420; sc.updateProjectionMatrix(); sn.shadow.bias = -.0005; sn.shadow.normalBias = .05; sn.shadow.radius = 2; }
    // shadow box follows what the camera sees (shifted forward) and snaps to whole shadow texels -> no shimmer while riding
    const tx = 2 * SR / Math.max(1, Q.shadow || 1024);
    GX.followSun = () => { camera.getWorldDirection(fwd3); fwd3.y = 0; fwd3.normalize(); sunTmp.copy(camera.position).addScaledVector(fwd3, SR * .45); sunTmp.y = hAt(sunTmp.x, sunTmp.z);
      lm.lookAt(sky.sunDir, O3, up); lmi.copy(lm).transpose(); sunTmp.applyMatrix4(lmi); sunTmp.x = Math.round(sunTmp.x / tx) * tx; sunTmp.y = Math.round(sunTmp.y / tx) * tx; sunTmp.applyMatrix4(lm);
      sn.position.copy(sunTmp).addScaledVector(sky.sunDir, 200); sn.target.position.copy(sunTmp); sn.target.updateMatrixWorld(); };
    GX.setLens(false); // the shared cinematic lens pass desaturates; Horse Rider uses its own grade below
    if (GX.composer) { const ps = GX.composer.passes; for (const p of ps) if (p.strength != null && p.radius != null) { p.strength = .24; p.radius = .5; p.threshold = .88; }
      const li = ps.indexOf(GX.lens && GX.lens()); H.grade = new ShaderPass(GRADE); GX.composer.insertPass(H.grade, li >= 0 ? li : ps.length); }
    envTick(0, true);
  }
  function envTick(dt, force) {
    if (!sky) return; const el = sunEl(); sky.setSun(el, SUN_AZ);
    const env = sky.update(dt || 0, camera, force);
    if (env) { scene.environment = env; scene.environmentIntensity = 1; GX.hemi.color.copy(sky.zenith);
      fog.color.copy(sky.horizon).lerp(sky.sunSide, .25); if (!GX.composer) { fogTmp.copy(fog.color); fog.color.setRGB(aces(fogTmp.r), aces(fogTmp.g), aces(fogTmp.b), THREE.SRGBColorSpace); } }
    if (scene.background) scene.background = null;
    const day = sstep(-1, 9, el); GX.sunDir.copy(sky.sunDir); GX.sun.color.copy(sky.sunCol); GX.sun.intensity = 3.6 * day; GX.hemi.intensity = .1 + .08 * day;
    fog.far = Math.floor((((SUN_AZ % TAU) + TAU) % TAU) * 100) + Math.min(.999, Math.max(0, sky.sunDir.y));
    if (H.grassG) H.grassG.update(dt || 0, camera, sky.sunDir, sky.sunCol, .55 + .45 * Math.sin(H.t * .21) * Math.sin(H.t * .053 + 1));
  }
  function init() {
    H.on = true; P.spawn.set(SPAWN.x, hAt(SPAWN.x, SPAWN.z), SPAWN.z); P.pos.copy(P.spawn); buildWorld(); spawnHorses();
    P.yaw = Math.atan2(SPAWN.x - PEN.x, SPAWN.z - PEN.z); P.pitch = -.05; P.hp = 100;
    GX.setLighting('day', false); setupSky();
    guns = H.guns = createGuns({ scene, camera, P, H, hAt, sfx, fx: ctx.fx, msg, mobile, input, keys, renderer: GX.renderer, rig: () => real() ? rider : null, aimBone, twistBone, RANGE, BASE, dev: new URLSearchParams(location.search).has('dev'), send: m => H.netShot && H.netShot(m), zombies: () => zombies });
    zombies = H.zombies = createHrZombies({ scene, camera, P, H, hAt, PEN, EDGE, WALK, sfx, fx: ctx.fx, mobile, msg, aimBone, dismount, walker: () => H.assets && H.assets.riderSrc ? makeWalker(H.assets.riderSrc, H.assets.clips) : null,
      remotes: () => H.netRemotes ? H.netRemotes() : [], send: m => H.zSend && H.zSend(m), sendTo: (id, m) => H.zSendTo && H.zSendTo(id, m), role: () => H.netRole ? H.netRole() : 'solo' });
    if (mobile) { const a = document.getElementById('tAds'); if (a) a.textContent = 'AIM'; }
    loadAssets(!mobile && Q.shadow > 0).then(dress).catch(e => { H.models = 'proc'; if (!/requested/.test(e && e.message)) console.warn('horse models failed, using procedural horses', e); });
    msg(mobile ? 'HORSE RIDER — walk to the pen, tap RIDE next to a horse' : 'HORSE RIDER — walk to the pen and press E next to a horse', 5);
  }
  const anim = (o, dt, sp, graze) => o.g.userData.kind === 'real' ? realAnim(o.g, dt, sp, graze, H.t) : procAnim(o.g, dt, sp, graze);
  function lod(o) { const u = o.g.userData; if (u.kind !== 'real') return; const near = o === H.mounted || camera.position.distanceTo(o.pos) < LOD_HORSE; u.near.visible = near; u.far.visible = !near; }
  // ---------------- per-frame ----------------
  const tmp = new THREE.Vector3(), lerp = (a, b, t) => a + (b - a) * t, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const GAIT_SP = [0, 1.7, 4.4, 9, 15.5], SPRINT = 18.5, GAIT_N = ['Standing', 'Walk', 'Trot', 'Canter', 'Gallop'];
  const gaitName = sp => sp < -.2 ? 'Backing up' : sp < .3 ? 'Standing' : sp < 3 ? 'Walk' : sp < 6.6 ? 'Trot' : sp < 12.3 ? 'Canter' : 'Gallop';
  const MAX_GRADE = 1.1; // steeper than ~48 degrees: the horse won't climb it (trails and gentler spurs go up)
  function aheadBlocked(h, yaw, L) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); for (const t of [.5, 1]) { const x = h.pos.x + fx * L * t, z = h.pos.z + fz * L * t; if (blocked(x, z, .7, h) || (hAt(x, z) - h.pos.y) / (L * t) > MAX_GRADE) return true; } return false; }
  // stick magnitude -> speed through the four gaits (analog in between)
  function stickSpeed(m) { const K = [[.1, 0], [.3, GAIT_SP[1]], [.55, GAIT_SP[2]], [.8, GAIT_SP[3]], [.93, GAIT_SP[4]], [1, SPRINT]]; if (m <= K[0][0]) return 0;
    for (let i = 1; i < K.length; i++) if (m <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (m - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); return SPRINT; }
  function ride(h, dt, fwdIn, sideIn, stick, jump) {
    const hu = h.g.userData; H.riddenT += dt;
    const sw = P.swX || 0; if (sw !== H.swLast) { H.swLast = sw; if (H.riddenT > .2) { H.lookT = 0; H.recenter = true; } } else H.lookT += dt; // camera moved by mouse / drag => free look
    const free = H.lookT < .9;
    if (H.mountT > 0) { H.mountT = Math.max(0, H.mountT - dt); mountPose(h, 1 - H.mountT / MOUNT_T); }
    const busy = H.mountT > 0 || H.dismT > 0 || H.wantOff;
    // gait selection (keyboard): tap Shift = one gait up, hold Shift = gallop flat out (stamina), C = one gait down
    if ((keys.ShiftLeft || keys.ShiftRight) && !H.scoped) H.shiftT += dt; else H.shiftT = 0; // in the scope Shift holds your breath instead
    const ref = free || H.recenter ? h.yaw : P.yaw; // steering is camera-relative; while looking around it is relative to the horse
    let target = 0, want = null, brake = false;
    if (!busy) {
      if (stick > .08) { target = stickSpeed(Math.min(1, stick)); want = ref - Math.atan2(input.mx, -input.mz); }
      else if (fwdIn > 0) { target = H.shiftT >= .3 ? SPRINT : GAIT_SP[H.cruise]; want = ref - Math.atan2(sideIn, 1) ; }
      else if (fwdIn < 0) { brake = true; target = Math.abs(H.speed) < .7 ? -1.7 : 0; }
      else if (sideIn) { target = Math.max(GAIT_SP[1], Math.min(H.speed, GAIT_SP[H.cruise])); want = ref - Math.atan2(sideIn, .25); }
      if (Math.abs(H.speed) < .3 && fwdIn <= 0 && stick <= .08) H.cruise = Math.min(H.cruise, 2);
    } else brake = true;
    if (want != null && Math.abs(wrapA(want - h.yaw)) > 2.2 && H.speed > 5) target = Math.min(target, GAIT_SP[2]); // swinging round: slow first
    // stamina: galloping drains it; a winded horse drops to a canter until it recovers
    if (target > 12.5 && H.speed > 11) { H.stam = Math.max(0, H.stam - dt * (target > 16 ? 7.5 : 4)); if (H.stam <= 0) { H.winded = 5; msg('Your horse is winded — ease off', 1.6); } }
    else H.stam = Math.min(100, H.stam + dt * (H.speed < 9.5 ? 12 : 4));
    if (H.winded > 0) { H.winded -= dt; target = Math.min(target, GAIT_SP[3]); if (H.cruise > 3) H.cruise = 3; }
    // slopes: the steeper the climb the slower (trails stay a canter), picking its way down steep ground; galloping uphill tires it faster
    { const fx0 = -Math.sin(h.yaw), fz0 = -Math.cos(h.yaw), dir = H.speed < -.1 ? -1 : 1, gF = (hAt(h.pos.x + fx0 * 2.5 * dir, h.pos.z + fz0 * 2.5 * dir) - hAt(h.pos.x, h.pos.z)) / 2.5; H.grade = gF;
      const cap = gF > .32 ? (gF < .62 ? lerp(SPRINT, 9, (gF - .32) / .3) : lerp(9, 1.7, sstep(.62, MAX_GRADE, gF))) : gF < -.7 ? lerp(9.5, 1.7, sstep(.7, 1.35, -gF)) : 1e9;
      if (Math.abs(target) > cap) target = Math.sign(target) * cap; if (gF > .25 && H.speed > 9) H.stam = Math.max(0, H.stam - dt * gF * 6); }
    // obstacle sense: look ahead along the heading, swing round trees / rocks / posts, refuse (rein in) at a wall of fence
    let avoid = 0; if (H.speed > 1.2 && target > 0) { const L = 1.4 + H.speed * .45;
      if (aheadBlocked(h, h.yaw, L)) { let best = null; const goal = want == null ? h.yaw : want;
        for (const a of [.35, -.35, .7, -.7, 1.1, -1.1]) if (!aheadBlocked(h, h.yaw + a, L)) { const sc = Math.abs(wrapA(h.yaw + a - goal)); if (!best || sc < best[1]) best = [a, sc]; }
        if (best) avoid = best[0]; else { target = 0; brake = true; if (H.speed > 7 && !(hu.toss > 0)) hu.toss = 1; } } }
    // speed: weighty, linear acceleration per gait; firm but not instant braking
    const acc = target > H.speed ? (H.speed < 0 ? 5 : H.speed < 4.5 ? 3.2 : H.speed < 9.5 ? 3.4 : 2.3) : brake ? (H.speed > 0 ? 9 : 4) : 4.4;
    const prev = H.speed; H.speed += Math.sign(target - H.speed) * Math.min(Math.abs(target - H.speed), acc * dt);
    const decel = (prev - H.speed) / Math.max(dt, 1e-3);
    // turning: eased yaw rate that tightens at low speed; carving at a gallop scrubs a little speed
    const maxR = Math.abs(H.speed) < .5 ? 1.5 : lerp(2.3, .95, sstep(2, 17, H.speed));
    let wantR = 0; if (H.speed < -.1) wantR = -sideIn * .9; else if (avoid) wantR = Math.max(-maxR, Math.min(maxR, avoid * 3.2)); else if (want != null) wantR = Math.max(-maxR, Math.min(maxR, wrapA(want - h.yaw) * 2.6));
    H.yawRate += (wantR - H.yawRate) * Math.min(1, dt * 5); h.yaw += H.yawRate * dt;
    if (Math.abs(H.yawRate) > .8 && H.speed > 8) H.speed -= (Math.abs(H.yawRate) - .8) * dt * 2;
    const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
    const ox0 = h.pos.x, oz0 = h.pos.z, gy0 = hAt(ox0, oz0); let hit = moveCircle(h.pos, fx * H.speed * dt, fz * H.speed * dt, .8, h);
    if (slopeGate(h.pos, ox0, oz0, gy0, MAX_GRADE, .8, h)) { H.steepHits = (H.steepHits || 0) + 1; H.speed *= .96; }
    if (hit) { if (Math.abs(H.speed) > 5) { hu.toss = 1; H.shake = .6; sfx.step && sfx.step(true); } H.speed *= Math.abs(H.speed) > 5 ? .3 : .6; }
    const g0 = hAt(h.pos.x, h.pos.z); if (jump && H.ground && !busy && H.speed > -.5) { H.vy = 6.2; H.ground = false; }
    H.vy -= 22 * dt; h.pos.y += H.vy * dt; if (h.pos.y <= g0) { if (!H.ground && H.vy < -5) H.shake = Math.max(H.shake, .25); h.pos.y = g0; H.vy = 0; H.ground = true; }
    // body: lean into turns, pitch with the slope, sit back on the haunches when braking hard
    const lean = Math.max(-.2, Math.min(.2, H.yawRate * Math.max(0, H.speed) * .02)); H.roll += (lean - H.roll) * Math.min(1, dt * 4);
    H.pitchK += ((decel > 4 && H.speed > 2 ? .07 : 0) - H.pitchK) * Math.min(1, dt * 5);
    const ahead = hAt(h.pos.x + fx, h.pos.z + fz), behind = hAt(h.pos.x - fx, h.pos.z - fz);
    h.g.rotation.set(Math.atan2(ahead - behind, 2) * .8 + H.pitchK, h.yaw, H.roll);
    anim(h, dt, H.ground ? H.speed : 3, false); P.pos.set(h.pos.x, h.pos.y + 1.1, h.pos.z);
    const ob = H.clop || 0; H.clop = ob + dt * Math.abs(H.speed) * .55; if (H.ground && Math.abs(H.speed) > 1 && Math.floor(ob) !== Math.floor(H.clop)) sfx.step && sfx.step(true);
    // camera follow: swing back behind the horse unless the player is looking around
    if (!free) { const d = wrapA(h.yaw - P.yaw); if (Math.abs(H.speed) > .4 || H.recenter) P.yaw += d * Math.min(1, dt * (H.recenter ? 2.6 : 1.2 + Math.abs(H.speed) * .1)); if (Math.abs(d) < .12) H.recenter = false;
      if (Math.abs(H.speed) > .4) P.pitch += (-.1 - P.pitch) * Math.min(1, dt * 1.2); }
    // rider: seated pose that posts the trot, stands in the stirrups at the gallop, leans into turns and looks where the camera looks
    if (!H.mountT && !H.dismT && real() && hu.kind === 'real') { const sp = Math.max(0, H.speed), trot = sstep(2.6, 4, sp) * (1 - sstep(6.5, 8.5, sp)), gal = sstep(10, 15.5, sp), ph = hu.phase;
      riderPose(rider, { sit: 1, side: H.side, k: sstep(.3, 2, sp), ph, gal, lean: .04 + .32 * gal + Math.max(0, decel) * -.004 + Math.min(0, decel) * -.01, roll: H.roll * 1.4, look: Math.max(-1.1, Math.min(1.1, wrapA(P.yaw - h.yaw))) * .55, rein: Math.sin(ph * TAU * (gal > .5 ? 1 : 2)) * .05 * sstep(.3, 2, sp) });
      rider.position.set(me.seat.x, me.seat.y + trot * Math.abs(Math.sin(ph * TAU)) * .05 + gal * (.05 + Math.sin(ph * TAU) * .015), me.seat.z); rider.rotation.set(0, 0, 0); }
    // E / GET OFF: rein in, then step down on the mounting side
    if (H.wantOff && !H.dismT && Math.abs(H.speed) < 2.2) { H.dismT = real() && hu.kind === 'real' ? DISM_T : 1e-3; H.speed = Math.min(H.speed, 1); }
    if (H.dismT > 0) { H.speed *= Math.max(0, 1 - dt * 6); H.dismT -= dt; mountPose(h, Math.max(0, H.dismT / DISM_T)); if (H.dismT <= 0) dismount(); }
    dustEmit(h, dt);
  }
  function walk(dt, fwdIn, sideIn, stick, run, jump) {
    if ((H.aimK || 0) > .5) { run = false; stick = Math.min(stick, .45); } // aiming: walk, don't run
    const slow = !!keys.AltLeft, sp = stick > .05 ? (stick < .5 ? 1.8 * stick / .5 : run ? 7.2 : lerp(1.8, 4.6, Math.min(1, (stick - .5) / .4))) : run && fwdIn > 0 ? 7.2 : slow ? 1.8 : 4.6;
    const f = tmp.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), rx = -f.z, rz = f.x;
    let mx = f.x * fwdIn + rx * sideIn, mz = f.z * fwdIn + rz * sideIn; const l = Math.hypot(mx, mz); if (l > 0) { mx *= sp / l; mz *= sp / l; }
    H.fv.x += (mx - H.fv.x) * Math.min(1, dt * 9); H.fv.y += (mz - H.fv.y) * Math.min(1, dt * 9); // momentum: ease into and out of a run
    const v = H.fv.length(), ox0 = P.pos.x, oz0 = P.pos.z, gy0 = hAt(ox0, oz0); moveCircle(P.pos, H.fv.x * dt, H.fv.y * dt, .35, null);
    if (slopeGate(P.pos, ox0, oz0, gy0, 1.3, .35, null)) H.fv.multiplyScalar(.9); // scrambling up: only up to ~52 degrees
    const g0 = hAt(P.pos.x, P.pos.z); if (jump && H.ground) { H.vy = 7; H.ground = false; }
    H.vy -= 22 * dt; P.pos.y += H.vy * dt; if (P.pos.y <= g0) { P.pos.y = g0; H.vy = 0; H.ground = true; }
    const ob = P.bob; P.bob += dt * v * 1.6; if (H.ground && v > .5 && Math.floor(ob / Math.PI) !== Math.floor(P.bob / Math.PI)) sfx.step && sfx.step(false);
    if (H.gunFace != null) H.bodyYaw += wrapA(H.gunFace - H.bodyYaw) * Math.min(1, dt * 14); else if (v > .3) { const wy = Math.atan2(-H.fv.x, -H.fv.y); H.bodyYaw += wrapA(wy - H.bodyYaw) * Math.min(1, dt * 10); }
    if (real()) { me.body.position.copy(P.pos); me.body.rotation.y = H.bodyYaw; me.body.visible = !H.fp; if (me.W) me.W.update(dt, H.ground ? v : Math.max(v, 1)); }
  }
  // discrete key presses (no auto-repeat): Shift = one gait up while riding, C = one gait down / on foot toggles first person
  addEventListener('keydown', e => { if (!H.on || e.repeat || !document.body.classList.contains('horse-mode')) return;
    if (H.mounted) { if (/^Shift/.test(e.code) && !H.scoped) H.cruise = Math.min(4, H.cruise + 1); else if (e.code === 'KeyC') H.cruise = Math.max(1, H.cruise - 1); }
    else if (e.code === 'KeyC') { H.fp = !H.fp; msg(H.fp ? 'First-person view (C to switch back)' : 'Third-person view', 1.2); } });
  addEventListener('wheel', e => { if (!H.on || !document.body.classList.contains('horse-mode')) return; H.zoom = Math.max(.5, Math.min(1.5, H.zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); }, { passive: true }); // camera zoom
  function tick(dt) {
    if (!H.on) return; H.t += dt; TREE_WIND.value += dt; H.cd = Math.max(0, H.cd - dt); H.shake = Math.max(0, H.shake - dt * 1.6);
    const h = H.mounted;
    let fwdIn = 0, sideIn = 0; if (keys.KeyW || keys.ArrowUp) fwdIn += 1; if (keys.KeyS || keys.ArrowDown) fwdIn -= 1; if (keys.KeyD || keys.ArrowRight) sideIn += 1; if (keys.KeyA || keys.ArrowLeft) sideIn -= 1;
    const stick = Math.min(1, Math.hypot(input.mx || 0, input.mz || 0)); if (stick > .05) { fwdIn = -input.mz; sideIn = input.mx; }
    const run = !!keys.ShiftLeft || !!keys.ShiftRight || (stick > .92 && fwdIn > .6);
    const jump = keys.Space || input.jump;
    if (H.dead) { H.fv.x = H.fv.y = 0; } else if (h) ride(h, dt, stick > .05 ? 0 : fwdIn, stick > .05 ? 0 : sideIn, stick, jump); else walk(dt, fwdIn, sideIn, stick, run, jump);
    for (const o of H.horses) { if (o === h) continue;
      if (H.ridden.has(o) || (H.follow && o.net)) { netHorse(o, dt); if (H.ridden.has(o)) dustEmit(o, dt); continue; } // ridden by another player / herd mirrored from the host
      if (o.tgt) { const dx = o.tgt[0] - o.pos.x, dz = o.tgt[1] - o.pos.z, d = Math.hypot(dx, dz);
        if (d < .4 && o.path && o.path.length) o.tgt = o.path.shift(); else if (d < .4) { o.tgt = null; o.wait = 2 + rnd() * 5; o.graze = rnd() < .6; o.speed = 0; }
        else { const want = Math.atan2(-dx, -dz); let dy = want - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 2.5); o.speed += ((o.panic > 0 ? 7 : 1.3) - o.speed) * Math.min(1, dt * 2);
          if (moveCircle(o.pos, -Math.sin(o.yaw) * o.speed * dt, -Math.cos(o.yaw) * o.speed * dt, .8, o)) { if (o.path && o.path.length) o.tgt = o.path.shift(); else { o.tgt = null; o.wait = 1 + rnd() * 2; } } } }
      else { o.speed *= Math.max(0, 1 - dt * 4); o.wait -= dt; if (o.wait <= 0) { if (o.inPen) o.tgt = [PEN.x + (rnd() - .5) * (PEN.hw * 2 - 4), PEN.z + (rnd() - .5) * (PEN.hd * 2 - 4)]; else { const a = rnd() * 6.28; o.tgt = [o.pos.x + Math.cos(a) * 3, o.pos.z + Math.sin(a) * 3]; } o.graze = false; } }
      o.pos.y = hAt(o.pos.x, o.pos.z); o.g.rotation.set(0, o.yaw, 0); anim(o, dt, o.speed, o.graze); }
    for (const o of H.horses) lod(o);
    dustTick(dt);
    updateTreeLOD(false);
    if (H.chunks) H.chunks.update(P.pos.x, P.pos.z); if (H.water) H.water.update(dt);
    if (H.marks && ((H.markT = (H.markT || 0) + dt) > .5)) { H.markT = 0; for (const g of H.marks) g.visible = Math.hypot(g.userData.at[0] - P.pos.x, g.userData.at[1] - P.pos.z) < 220; } // signposts / cairns only drawn nearby
    if (guns) guns.update(dt);
    if (zombies) zombies.tick(dt);
    H.near = h ? null : nearestHorse(); H.gait = h ? gaitName(H.speed) : '';
    H.prompt = h ? (H.mountT > 0 ? 'Mounting…' : H.wantOff || H.dismT > 0 ? 'Getting off…' : mobile ? 'Tap GET OFF to dismount' : '[E] Get off the horse') : H.near ? (mobile ? 'Tap RIDE to mount' : '[E] Ride horse') : '';
  }
  // hoof dust: a small pool of soft points kicked up behind the hooves at speed
  const DN = mobile ? 40 : 90, dust = { p: new Float32Array(DN * 3), a: new Float32Array(DN), sz: new Float32Array(DN), v: new Float32Array(DN * 3), life: new Float32Array(DN), i: 0, acc: 0, pts: null };
  function dustInit() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dust.p, 3)); g.setAttribute('aA', new THREE.BufferAttribute(dust.a, 1)); g.setAttribute('aS', new THREE.BufferAttribute(dust.sz, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: new THREE.Color(0xa89878) }, uH: { value: 400 } },
      vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float uH; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aS*uH/max(.5,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d)*4.; if(r>1.) discard; gl_FragColor=vec4(uC, vA*(1.-r)*(1.-r)*.55); }' });
    dust.pts = new THREE.Points(g, m); dust.pts.frustumCulled = false; dust.pts.renderOrder = 2; scene.add(dust.pts); }
  function dustEmit(o, dt) { const sp = Math.abs(o === H.mounted ? H.speed : o.speed || 0); if (sp < 5.5 || (o === H.mounted && !H.ground)) return; if (!dust.pts) dustInit();
    dust.acc += dt * sp * (mobile ? 1.6 : 3); const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw), dirt = inPen(o.pos.x, o.pos.z) || trailDist(o.pos.x, o.pos.z) < 2 ? 1.6 : 1;
    while (dust.acc > 1) { dust.acc -= 1; const i = dust.i = (dust.i + 1) % DN, side = (rnd() - .5) * .7, back = .2 + rnd() * 1.1;
      dust.p[i * 3] = o.pos.x - fx * back - fz * side; dust.p[i * 3 + 2] = o.pos.z - fz * back + fx * side; dust.p[i * 3 + 1] = hAt(dust.p[i * 3], dust.p[i * 3 + 2]) + .08;
      dust.v[i * 3] = -fx * sp * .12 + (rnd() - .5) * .6; dust.v[i * 3 + 1] = .35 + rnd() * .7; dust.v[i * 3 + 2] = -fz * sp * .12 + (rnd() - .5) * .6; dust.life[i] = 1; dust.sz[i] = (.25 + rnd() * .2) * dirt; } }
  function dustTick(dt) { if (!dust.pts) return; let any = false; dust.pts.material.uniforms.uH.value = GX.renderer.domElement.height * .5;
    for (let i = 0; i < DN; i++) { if (dust.life[i] <= 0) { dust.a[i] = 0; continue; } any = true; dust.life[i] -= dt * .8; const l = Math.max(0, dust.life[i]);
      for (let k = 0; k < 3; k++) { dust.p[i * 3 + k] += dust.v[i * 3 + k] * dt; dust.v[i * 3 + k] *= 1 - dt * 1.5; } dust.sz[i] += dt * .9; dust.a[i] = l * l * Math.min(1, (1 - l) * 8); }
    const g = dust.pts.geometry; g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aS.needsUpdate = true; dust.pts.visible = any; }
  // cameras: over-the-shoulder third person on foot (C toggles first person), cinematic chase camera when riding
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), lookOff = new THREE.Vector3(), lastLook = new THREE.Vector3(); let lastMode = null;
  function camClear(from, to) { // pull the camera in front of tree trunks / rocks between it and the subject
    const dx = to.x - from.x, dz = to.z - from.z; for (let t = .3; t <= 1.001; t += .175) { const x = from.x + dx * t, z = from.z + dz * t;
      for (const [ox, oz, or] of obstNear(x, z)) if (Math.abs(ox - x) < or + .35 && Math.abs(oz - z) < or + .35 && Math.hypot(ox - x, oz - z) < or + .3) { to.x = from.x + dx * (t - .2); to.z = from.z + dz * (t - .2); to.y = from.y + (to.y - from.y) * (t - .2); return; } } }
  function syncCamera(dt) { if (H.fovSave) { camera.fov = H.fovSave; H.fovSave = 0; camera.updateProjectionMatrix(); } camRig(dt); if (guns) guns.scopeCam(dt); } // the scope takes over after the rig
  function camRig(dt) {
    const h = H.mounted;
    if (!h && (H.fp || !real())) { if (camera.fov !== 75) { camera.fov = 75; camera.updateProjectionMatrix(); } camera.position.set(P.pos.x, P.pos.y + 1.62 + (H.ground ? Math.abs(Math.cos(P.bob)) * .04 : 0), P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); H.camInit = false; return; }
    let fov, k;
    const ak = H.aimK || 0;
    if (!h) { const pitch = Math.max(-.85, Math.min(.6, P.pitch)), dist = 2.75 * Math.min(1.3, H.zoom) * (1 - .45 * ak), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw), v = H.fv.length();
      look.set(P.pos.x + rx * (.5 + .1 * ak), P.pos.y + 1.58 + .04 * ak, P.pos.z + rz * (.5 + .1 * ak));
      want.set(look.x + Math.sin(P.yaw) * Math.cos(pitch) * dist, look.y - Math.sin(pitch) * dist + .12, look.z + Math.cos(P.yaw) * Math.cos(pitch) * dist);
      fov = 68 + sstep(4.8, 7.2, v) * 5 - 16 * ak; k = 14; }
    else { const sp = Math.abs(H.speed), pitch = Math.max(-.7, Math.min(.35, P.pitch)), dist = (4.2 + sstep(3, 18, sp) * .6) * H.zoom * (1 - .4 * ak), ph = h.g.userData.phase || 0;
      look.set(h.pos.x + Math.cos(P.yaw) * .6 * ak, h.pos.y + 2.05 + .25 * ak + Math.sin(ph * TAU) * .03 * sstep(10, 16, sp), h.pos.z - Math.sin(P.yaw) * .6 * ak);
      want.set(look.x + Math.sin(P.yaw) * Math.cos(pitch) * dist, look.y - Math.sin(pitch) * dist + .3, look.z + Math.cos(P.yaw) * Math.cos(pitch) * dist);
      fov = 70 + sstep(8, 18, sp) * 5 - 14 * ak; k = 9; }
    const mode = h ? 'ride' : 'foot'; if (H.camInit && lastMode && mode !== lastMode) lookOff.add(lastLook).sub(look); lastMode = mode; lookOff.multiplyScalar(1 - Math.min(1, (dt || 1) * 3.5));
    look.add(lookOff); want.add(lookOff); lastLook.copy(look).sub(lookOff);
    camClear(look, want); want.y = Math.max(want.y, hAt(want.x, want.z) + .5);
    want.sub(look); if (!H.camInit || !dt) { camPos.copy(want); H.camInit = true; } else camPos.lerp(want, Math.min(1, dt * k)); // smooth the offset, not the position: no lag at a gallop
    camera.position.copy(look).add(camPos); camera.position.y = Math.max(camera.position.y, hAt(camera.position.x, camera.position.z) + .4); if (H.shake > 0) camera.position.add(tmp.set((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(H.shake * .12)); camera.lookAt(look);
    if (h) camera.rotateZ(H.roll * .3);
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, (dt || 1) * 3); camera.updateProjectionMatrix(); }
    updateReins();
  }
  let stamEl = null;
  function hud() {
    if (guns) guns.hud();
    const pr = $('hrPrompt'); if (pr) { pr.textContent = H.prompt; pr.hidden = !H.prompt; pr.classList.toggle('riding', !!H.mounted); }
    const d = Math.round(Math.hypot(P.pos.x - PEN.x, P.pos.z - PEN.z)), hz = H.mounted;
    $('mode').textContent = '🐎 HORSE RIDER'; $('timer').textContent = hz ? Math.round(Math.abs(H.speed) * 3.6) + ' km/h' : ''; $('stars').textContent = H.online || '';
    const alt = Math.round(P.pos.y - BASE - (hz ? 1.1 : 0)), altS = alt > 25 ? ' · ⛰ ' + alt + ' m' : '';
    $('sub').textContent = hz ? H.gait + altS + (hz.coat ? ' · ' + hz.coat : '') + (H.winded > 0 ? ' · winded' : '') + (mobile ? ' · push the stick further to speed up' : ' · W ride · tap Shift faster · hold Shift gallop · C slower · A/D steer')
      : H.models === 'loading' && d < 40 ? 'Horses arriving…' : d > 16 ? `Horse pen ${d} m away${altS}` : inPen(P.pos.x, P.pos.z) ? 'In the pen — walk up to a horse' : 'At the horse pen';
    if (!stamEl) { stamEl = document.createElement('div'); stamEl.id = 'hrStam'; stamEl.innerHTML = '<i></i>'; document.body.appendChild(stamEl); }
    const show = !!hz && (H.stam < 99 || Math.abs(H.speed) > 12); stamEl.style.opacity = show ? 1 : 0; stamEl.firstChild.style.width = H.stam.toFixed(0) + '%'; stamEl.classList.toggle('low', H.stam < 25 || H.winded > 0);
  }
  // ---- multiplayer hooks (src/horsenet.js): remote riders, herd mirroring ----
  function netHorse(o, dt) { const n = o.net; if (!n) { anim(o, dt, 0, false); return; } const k = Math.min(1, dt * 8);
    if (Math.hypot(n.x - o.pos.x, n.z - o.pos.z) > 12) { o.pos.x = n.x; o.pos.z = n.z; } else { o.pos.x += (n.x - o.pos.x) * k; o.pos.z += (n.z - o.pos.z) * k; }
    let dy = n.yaw - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * k; o.speed = n.sp; o.graze = !!n.gr;
    o.pos.y = H.ridden.has(o) && n.y != null ? o.pos.y + (n.y - o.pos.y) * k : hAt(o.pos.x, o.pos.z); o.g.rotation.y = o.yaw; anim(o, dt, n.sp, o.graze); }
  const herd = () => H.horses.filter(o => o !== H.mounted && !H.ridden.has(o)).map(o => [o.id, +o.pos.x.toFixed(2), +o.pos.z.toFixed(2), +o.yaw.toFixed(3), +o.speed.toFixed(2), o.graze ? 1 : 0]);
  function applyHerd(arr) { H.follow = true; for (const [id, x, z, yaw, sp, gr] of arr) { const o = H.horses[id]; if (!o || o === H.mounted || H.ridden.has(o)) continue; o.net = { x, z, yaw, sp, gr }; } }
  function release(o) { if (!H.ridden.has(o)) return; H.ridden.delete(o); o.speed = 0; o.wait = 4 + rnd() * 4; o.tgt = null; o.inPen = inPen(o.pos.x, o.pos.z, .5); o.graze = true; if (!H.follow) o.net = null; }
  function seat(h, obj) { if (h.g.userData.kind === 'real' && obj.userData.kind === 'real') { h.g.userData.bones[1].add(obj); obj.position.copy(me.seat); } else { h.g.add(obj); obj.position.set(0, h.g.userData.kind === 'real' ? 1.45 : 1.72, .08); } obj.rotation.set(0, 0, 0); obj.visible = true; }
  const avatars = new Set();
  function nameTag(text, color) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(10,12,14,.6)'; x.beginPath(); x.roundRect(8, 8, 240, 48, 22); x.fill();
    x.fillStyle = color; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(text, 128, 43); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false, toneMapped: false })); sp.scale.set(1.2, .3, 1); sp.renderOrder = 9; return sp; }
  // remote player: the same rigged person (idle / walk / run blend) on foot, a seated copy with the live riding pose on the horse they ride
  function avatar(id, color) {
    const av = { id, g: new THREE.Group(), horse: null, walker: null, sitter: null, W: null, tag: nameTag(id, color), v: 0 };
    scene.add(av.g); av.g.add(av.tag); av.tag.position.y = 2.15;
    av.rebuild = () => { if (av.walker) av.g.remove(av.walker); if (av.sitter && av.sitter.parent) av.sitter.parent.remove(av.sitter); const A = H.assets;
      if (A && A.riderSrc) { av.W = makeWalker(A.riderSrc, A.clips); av.walker = av.W.m; av.walker.rotation.y = Math.PI;
        const st = saveRest(cloneSkinned(A.riderSrc)); st.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); st.userData.kind = 'real'; riderPose(st, { sit: 1 }); av.sitter = st; }
      else { av.walker = makeProcRider(color); av.walker.position.y = .55; av.walker.rotation.y = Math.PI; av.sitter = makeProcRider(color); av.W = null; }
      av.g.add(av.walker); av.sitter.visible = false; if (av.horse) seat(av.horse, av.sitter); };
    av.update = (dt, s) => { if (!s) return; const was = av.horse, h = s.m >= 0 ? H.horses[s.m] : null;
      if (was && was !== h) { release(was); if (av.sitter.parent) av.sitter.parent.remove(av.sitter); av.horse = null; }
      if (h) { if (h === H.mounted) { if (String(av.id) < String(H.me || 'P9')) dismount(); else return; } // two riders grabbed one horse: lower id keeps it
        if (!av.horse) { av.horse = h; H.ridden.set(h, av.id); seat(h, av.sitter); } h.net = { x: s.x, y: s.y, z: s.z, yaw: s.hy, sp: s.sp };
        if (av.sitter.userData.B && h.g.userData.kind === 'real') { const sp = Math.max(0, s.sp || 0), gal = sstep(10, 15.5, sp), trot = sstep(2.6, 4, sp) * (1 - sstep(6.5, 8.5, sp)), ph = h.g.userData.phase;
          riderPose(av.sitter, { sit: 1, k: sstep(.3, 2, sp), ph, gal, lean: .04 + .32 * gal, rein: Math.sin(ph * TAU * (gal > .5 ? 1 : 2)) * .05 * sstep(.3, 2, sp) });
          av.sitter.position.set(me.seat.x, me.seat.y + trot * Math.abs(Math.sin(ph * TAU)) * .05 + gal * .05, me.seat.z); }
        av.walker.visible = false; av.g.position.set(h.pos.x, h.pos.y + 1.1, h.pos.z); av.tag.position.y = 1.55; return; }
      av.walker.visible = true; av.tag.position.y = 2.15; const p = av.g.position, d = Math.hypot(s.x - p.x, s.z - p.z), k = Math.min(1, dt * 10);
      if (d > 8) p.set(s.x, s.y, s.z); else { p.x += (s.x - p.x) * k; p.y += (s.y - p.y) * k; p.z += (s.z - p.z) * k; }
      let dy = s.yw - av.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); av.g.rotation.y += dy * k;
      av.v += ((s.sp || 0) - av.v) * Math.min(1, dt * 6); if (av.W) av.W.update(dt, av.v); };
    av.dispose = () => { if (av.horse) release(av.horse); if (av.sitter && av.sitter.parent) av.sitter.parent.remove(av.sitter); scene.remove(av.g); avatars.delete(av); };
    const up0 = av.update, dp0 = av.dispose; av.update = (dt, s) => { up0(dt, s); if (guns) guns.poseRemote(av, s, av.horse ? av.sitter : av.walker, !!av.horse); }; av.dispose = () => { if (guns) guns.disposeRemote(av); dp0(); };
    av.rebuild(); avatars.add(av); return av;
  }
  const touchLabel = () => H.mounted ? 'GET OFF' : H.near ? 'RIDE' : '';
  const stats = () => { const i = GX.renderer.info; i.autoReset = false; i.reset(); GX.renderer.render(scene, camera); i.autoReset = true; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; };
  const syncAll = dt => { syncCamera(dt); envTick(dt); };
  const gunNet = () => guns ? guns.netState() : { g: 0 }, remoteShot = (id, m) => guns && guns.remoteShot(id, m);
  return { state: H, init, tick, syncCamera: syncAll, hud, gunNet, remoteShot, get guns() { return guns; }, use, dismount, touchLabel, hAt, PEN, nearestHorse, stats, herd, applyHerd, avatar };
}
