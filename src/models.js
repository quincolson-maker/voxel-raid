// Original realistic-proportion models: soldiers, emplacements, command post, viewmodel rifle, terrain & vegetation.
// All geometry is authored in code (original work). Textures are CC0 (see CREDITS.md).
import * as THREE from 'three';
import { GLTFLoader } from '../addons/loaders/GLTFLoader.js';
const matCache = new Map(), geoCache = new Map();
export function mat(color, o = {}) { const k = color + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .85, metalness: o.m ?? 0, flatShading: !!o.flat, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide })); return matCache.get(k); }
const G = (k, f) => { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k); };
const box = (w, h, d) => G('b' + [w, h, d], () => new THREE.BoxGeometry(w, h, d));
const cyl = (a, b, h, s = 10) => G('c' + [a, b, h, s], () => new THREE.CylinderGeometry(a, b, h, s));
const cap = (r, l, s = 8) => G('k' + [r, l, s], () => new THREE.CapsuleGeometry(r, l, 3, s));
const sph = (r, w = 12, h = 8, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => G('s' + [r, w, h, ps, pl, ts, tl], () => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl));
function M(g, m, x = 0, y = 0, z = 0, parent, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; if (parent) parent.add(o); return o; }
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
export let PBR = null; export function setPBR(p) { PBR = p; }
// ------------- Soldiers (1.8 m, realistic proportions) -------------
const SKIN = 0xc69477, BLACK = 0x1c1d1f;
function rifle(parent, x, y, z) { const g = pivot(parent, x, y, z); const poly = mat(0x24262a, { r: .55, m: .3 }), steel = mat(0x3a3c40, { r: .4, m: .85 });
  M(box(.05, .08, .42), poly, 0, 0, -.05, g); M(cyl(.012, .012, .3, 8), steel, 0, .015, -.4, g, Math.PI / 2); M(box(.035, .12, .06), poly, 0, -.09, -.08, g, .2); M(box(.04, .07, .18), poly, 0, -.01, .22, g); M(box(.03, .04, .08), steel, 0, .065, -.05, g); return g; }
function soldier({ uniform, vest, helmet, pants, scale = 1, bulk = 1 }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(scale);
  const U = mat(uniform, { r: .95 }), V = mat(vest, { r: .9 }), P = mat(pants, { r: .95 }), B = mat(BLACK, { r: .7 }), S = mat(SKIN, { r: .7 });
  const legs = [-.1, .1].map(x => { const hip = pivot(body, x * bulk, .92, 0); M(cap(.075 * bulk, .32), P, 0, -.22, 0, hip); const knee = pivot(hip, 0, -.44, 0);
    M(cap(.065 * bulk, .32), P, 0, -.2, 0, knee); M(box(.11, .1, .27), B, 0, -.43, -.05, knee); hip.userData.knee = knee; return hip; });
  const torso = pivot(body, 0, .95, 0); M(cap(.15 * bulk, .32), U, 0, .28, 0, torso); M(box(.36 * bulk, .4, .26), V, 0, .32, 0, torso); // plate carrier
  for (let i = -1; i <= 1; i++) M(box(.08, .1, .05), V, i * .1, .2, -.15, torso); // mag pouches
  M(box(.3 * bulk, .38, .16), mat(vest, { r: .95 }), 0, .32, .2, torso); // pack
  const head = pivot(torso, 0, .62, 0); M(cyl(.045, .05, .08), S, 0, -.04, 0, head); M(sph(.1), S, 0, .07, 0, head);
  M(sph(.125, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(helmet, { r: .8 }), 0, .09, .005, head); M(box(.15, .03, .02), mat(0x111111, { r: .2, m: .5 }), 0, .07, -.1, head); // helmet, eye pro
  const arms = [-1, 1].map(s => { const sh = pivot(torso, s * .21 * bulk, .45, 0); M(cap(.06 * bulk, .22), U, 0, -.15, 0, sh); const el = pivot(sh, 0, -.3, 0); M(cap(.055 * bulk, .2), U, 0, -.13, 0, el); M(sph(.05), mat(0x2a2a26), 0, -.29, 0, el); sh.userData.el = el; return sh; });
  root.userData.rig = { body, torso, head, legs, arms, t: Math.random() * 6 }; return root;
}
export function makeTroop(kind) {
  let g;
  if (kind === 'skirm') { g = soldier({ uniform: 0x8a7a5c, vest: 0x6f6650, helmet: 0x6b634e, pants: 0x80725a }); const r = g.userData.rig; rifle(r.arms[1].userData.el, 0, -.28, -.15); }
  else if (kind === 'breaker') { g = soldier({ uniform: 0x7a6e54, vest: 0x5a5444, helmet: 0x5f5848, pants: 0x74684f }); const r = g.userData.rig;
    const pack = M(box(.32, .34, .2), mat(0x4a4a3c), 0, .3, .32, r.torso); for (let i = 0; i < 3; i++) M(cyl(.04, .04, .3, 8), mat(0x6a5a30), -.1 + i * .1, .3, .44, r.torso); M(sph(.025), mat(0xff3020, { e: 0xff2010, ei: 3 }), .12, .48, .44, r.torso); g.userData.fuse = true; }
  else if (kind === 'bulwark') { g = soldier({ uniform: 0x5e5a4c, vest: 0x3c3a32, helmet: 0x34332d, pants: 0x55513f, scale: 1.08, bulk: 1.25 }); const r = g.userData.rig; // heavy breacher w/ ballistic shield
    const sh = M(box(.6, 1.05, .05), mat(0x2b2c2e, { r: .5, m: .4 }), 0, -.15, -.32, r.arms[0].userData.el); M(box(.3, .08, .06), mat(0x7ab0d0, { r: .1, m: .2, t: .7 }), 0, .25, -.035, sh); M(box(.22, .1, .25), mat(0x3c3a32), 0, .7, -.06, r.head); }
  else { g = soldier({ uniform: 0x4c5638, vest: 0x3d4530, helmet: 0x3f4632, pants: 0x48523a }); const r = g.userData.rig; rifle(r.arms[1].userData.el, 0, -.28, -.15); }
  return g;
}
export function animateTroop(g, dt, moving, attackT, deadT) {
  const r = g.userData.rig; r.t += dt * (moving ? 8 : 1.5);
  if (deadT > 0) { r.body.rotation.x = Math.min(Math.PI / 2, r.body.rotation.x + dt * 4); r.body.position.y = Math.max(-.25, r.body.position.y - dt * .4); r.legs.forEach(l => l.userData.knee.rotation.x = Math.min(1, l.userData.knee.rotation.x + dt * 3)); return; }
  const s = Math.sin(r.t) * (moving ? .55 : 0);
  r.legs[0].rotation.x = s; r.legs[1].rotation.x = -s; r.legs[0].userData.knee.rotation.x = Math.max(0, -Math.sin(r.t - .6)) * (moving ? .9 : 0); r.legs[1].userData.knee.rotation.x = Math.max(0, Math.sin(r.t - .6)) * (moving ? .9 : 0);
  // rifle held at the ready; attack = shouldered with recoil
  const aim = attackT > 0 ? 1 : .6; r.arms[1].rotation.x = -aim * 1.25 + attackT * .1; r.arms[1].userData.el.rotation.x = -.5 * aim; r.arms[0].rotation.set(-aim * 1.1, 0, .35); r.arms[0].userData.el.rotation.x = -1.1 * aim;
  r.body.position.y = moving ? Math.abs(Math.cos(r.t)) * .04 : Math.sin(r.t) * .005; r.torso.rotation.x = moving ? .12 : 0; r.head.rotation.y = Math.sin(r.t * .23) * .3 * (moving ? .3 : 1);
}
// ------------- Emplacements & structure decor -------------
const sandbag = () => G('sandbag', () => { const g = new THREE.CapsuleGeometry(.14, .38, 3, 8); g.rotateZ(Math.PI / 2); g.scale(1, .55, 1); return g; });
function sandbagRing(parent, r, rows, n) { const m = PBR ? new THREE.MeshStandardMaterial({ map: PBR.hesco.map, normalMap: PBR.hesco.normalMap, color: 0x8a8068, roughness: 1 }) : mat(0x9a8a6a);
  for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) { const a = (i + row * .5) / n * Math.PI * 2; M(sandbag(), m, Math.cos(a) * r, .09 + row * .16, Math.sin(a) * r, parent, 0, -a + Math.PI / 2, 0); } }
export function makeDefense(kind) {
  const g = new THREE.Group(), head = new THREE.Group(); g.add(head); const steel = mat(0x2f3134, { r: .45, m: .8 }), olive = mat(0x464b36, { r: .7, m: .3 });
  if (kind === 'turret') { // tripod heavy machine gun behind sandbags
    sandbagRing(g, .95, 2, 12); for (let i = 0; i < 3; i++) M(cyl(.02, .02, .8, 6), steel, Math.cos(i * 2.1) * .2, .3, Math.sin(i * 2.1) * .2, g, Math.sin(i * 2.1) * .4, 0, -Math.cos(i * 2.1) * .4);
    head.position.y = .7; M(box(.16, .16, .55), olive, 0, 0, 0, head); M(cyl(.03, .03, .8, 8), steel, 0, .02, -.6, head, Math.PI / 2); M(cyl(.045, .045, .35, 8), steel, 0, .02, -.35, head, Math.PI / 2); M(box(.12, .14, .16), mat(0x3e4a30), .14, -.04, 0, head); M(box(.3, .02, .25), steel, 0, .12, -.05, head);
    head.userData.muzzle = new THREE.Vector3(0, .72, -1);
  } else if (kind === 'mortar') { sandbagRing(g, 1.25, 2, 16); M(cyl(.25, .3, .05, 12), steel, 0, .03, 0, g); const bar = pivot(head, 0, .1, 0); bar.rotation.x = -.85;
    M(cyl(.06, .06, 1.1, 12), olive, 0, .55, 0, bar); M(cyl(.075, .075, .06, 12), steel, 0, 1.08, 0, bar); for (const s of [-1, 1]) M(cyl(.015, .015, .7, 6), steel, s * .18, .35, -.35, head, .5, 0, s * .2); head.userData.barrel = bar; head.userData.muzzle = new THREE.Vector3(0, 1, -.6);
  } else if (kind === 'needle') { // watchtower cabin with corrugated roof & DMR
    const tim = PBR ? new THREE.MeshStandardMaterial({ map: PBR.timber.map, normalMap: PBR.timber.normalMap, roughness: .9 }) : mat(0x7a5a3a);
    M(box(2.4, .12, 2.4), tim, 0, .06, 0, g); for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]]) M(box(.12, 2, .12), tim, x, 1, z, g);
    for (const s of [-1, 1]) { M(box(2.4, .08, .06), tim, 0, .9, s * 1.15, g); M(box(.06, .08, 2.4), tim, s * 1.15, .9, 0, g); }
    const roof = PBR ? new THREE.MeshStandardMaterial({ map: PBR.corrugated.map, normalMap: PBR.corrugated.normalMap, roughness: .7, metalness: .4, side: THREE.DoubleSide }) : mat(0x6a5040);
    M(box(2.8, .05, 2.8), roof, 0, 2.05, 0, g, .12); head.position.y = .9; M(cyl(.02, .02, 1, 6), steel, 0, .1, -.5, head, Math.PI / 2); M(box(.08, .1, .5), olive, 0, .1, 0, head); head.userData.muzzle = new THREE.Vector3(0, 1.0, -1);
  }
  g.userData.head = head; return g;
}
export function makeKeepDecor(s) { // command post: antenna mast, camo net, flag, light
  const g = new THREE.Group(); const steel = mat(0x3a3d40, { r: .5, m: .7 });
  M(cyl(.04, .06, 5, 6), steel, s / 2 - .6, 2.5, s / 2 - .6, g); M(cyl(.01, .01, 2.5, 4), steel, -s / 2 + .5, 1.25, -s / 2 + .5, g); M(box(.6, .35, .4), mat(0x3e4a30), -s / 2 + 1, .18, -s / 2 + 1, g);
  const net = new THREE.PlaneGeometry(s + 1, s + 1, 8, 8); const p = net.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(i * 1.7) * .15 + Math.cos(i * .9) * .1); net.computeVertexNormals();
  const netM = M(net, mat(0x4a5236, { r: 1, ds: true, t: .92 }), 0, 1.4, 0, g, -Math.PI / 2); netM.receiveShadow = true;
  const flagPole = M(cyl(.025, .025, 3, 6), steel, -s / 2 + .3, 1.5, s / 2 - .3, g); const flag = M(new THREE.PlaneGeometry(.9, .55, 6, 2), mat(0x2b5a8a, { ds: true }), .45, 1.2, 0, flagPole); flag.userData.flag = true;
  const light = new THREE.PointLight(0xffd8a0, 3, 9, 2); light.position.set(0, .8, 0); g.add(light); M(sph(.06), mat(0xfff0c0, { e: 0xffe0a0, ei: 4 }), 0, .8, 0, g);
  g.userData.gem = flag; return g;
}
let PROPS = {}; export function loadProps(onDone) { const L = new GLTFLoader(); let n = 0; const names = ['ammo_box', 'wooden_military_crate'];
  for (const k of names) L.load(`assets/models/${k}/${k}.gltf`, gl => { gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); PROPS[k] = gl.scene; if (++n == names.length) onDone && onDone(); }, undefined, () => { if (++n == names.length) onDone && onDone(); }); }
export function prop(k) { return PROPS[k] ? PROPS[k].clone() : null; }
export function makeRoof(kind, s) {
  const g = new THREE.Group();
  if (kind === 'hut') { const roof = PBR ? new THREE.MeshStandardMaterial({ map: PBR.corrugated.map, normalMap: PBR.corrugated.normalMap, roughness: .7, metalness: .4, side: THREE.DoubleSide }) : mat(0x6a5040);
    M(box(s + .4, .05, s + .4), roof, 0, .25, 0, g, .18); M(cyl(.08, .08, .8, 8), mat(0x555555, { m: .7, r: .5 }), s / 4, .6, s / 4, g); }
  else if (kind === 'vault') { for (let i = 0; i < 4; i++) { const c = prop(i % 2 ? 'ammo_box' : 'wooden_military_crate'); if (!c) { M(box(.9, .5, .6), mat(0x5a5a3c), (i - 1.5) * .9, .25, 0, g); continue; } c.position.set((i % 2 - .5) * 1.6, 0, (Math.floor(i / 2) - .5) * 1.4); c.rotation.y = i * .7; c.scale.setScalar(i % 2 ? 1.6 : 1); g.add(c); } }
  return g;
}
// ------------- Weapons: detailed original procedural models (generic, no trademarks) -------------
export const WEAPONS = {
  carbine: { name: 'Carbine', dmg: 26, rpm: 750, mag: 30, reload: 2.1, recoil: .9, spread: .012, ads: .002, range: 120, auto: true, fov: 52, snd: [2600, 150, .55] },
  smg9:    { name: 'SMG-9', dmg: 18, rpm: 850, mag: 30, reload: 1.8, recoil: .5, spread: .02, ads: .006, range: 60, auto: true, fov: 58, snd: [3400, 220, .4] },
  shotgun: { name: 'Shotgun', dmg: 14, pellets: 8, rpm: 70, mag: 7, reload: 3.0, recoil: 2.6, spread: .07, ads: .05, range: 30, auto: false, fov: 60, snd: [1200, 80, .9] },
  dmr:     { name: 'DMR', dmg: 62, rpm: 200, mag: 10, reload: 2.6, recoil: 2, spread: .01, ads: .0004, range: 220, auto: false, fov: 30, snd: [1900, 110, .8] },
  lmg:     { name: 'LMG', dmg: 24, rpm: 700, mag: 100, reload: 4.5, recoil: 1.1, spread: .03, ads: .012, range: 130, auto: true, fov: 55, snd: [2100, 120, .65] },
  pistol:  { name: 'Pistol', dmg: 30, rpm: 300, mag: 15, reload: 1.5, recoil: 1.2, spread: .015, ads: .006, range: 50, auto: false, fov: 62, snd: [3000, 200, .45] },
};
export function makeGun(kind) {
  const g = new THREE.Group(); const blk = mat(0x1b1c1e, { r: .55, m: .25 }), stl = mat(0x2c2e31, { r: .32, m: .9 }), fde = mat(0x8a7a5c, { r: .7, m: .1 }), poly = mat(0x232427, { r: .75 }), glass = mat(0x0a1018, { r: .05, m: .7 });
  const rail = (x, y, z, L) => { M(box(.022, .012, L), stl, x, y, z, g); for (let i = 0; i < L / .012 / 2; i++) M(box(.026, .006, .005), stl, x, y + .008, z - L / 2 + i * .024, g); };
  const muzzleAt = new THREE.Vector3(); let fore = -.3, sightY = .07;
  if (kind === 'carbine') { // M4-pattern carbine
    M(box(.045, .065, .2), blk, 0, 0, -.02, g); M(box(.04, .05, .12), blk, 0, -.045, .03, g); rail(0, .04, -.05, .2); // upper/lower receiver, flat-top rail
    M(cyl(.024, .024, .22, 8), fde, 0, .005, -.24, g, Math.PI / 2); rail(0, .034, -.24, .2); // free-float handguard
    M(cyl(.008, .008, .16, 8), stl, 0, .005, -.42, g, Math.PI / 2); M(cyl(.012, .011, .045, 8), stl, 0, .005, -.52, g, Math.PI / 2); // barrel, flash hider
    M(box(.006, .04, .01), stl, 0, .04, -.33, g); // front sight post
    M(box(.03, .14, .065), poly, 0, -.11, -.05, g, .25); M(box(.028, .085, .04), poly, 0, -.08, .08, g, -.35); // curved mag, grip
    M(cyl(.012, .012, .16, 8), stl, 0, -.005, .16, g, Math.PI / 2); M(box(.04, .075, .12), poly, 0, -.02, .24, g); // buffer tube, stock
    M(cyl(.016, .016, .07, 12), blk, 0, .07, -.04, g, Math.PI / 2); M(new THREE.CircleGeometry(.014, 12), glass, 0, .07, -.0049, g); // red dot
    muzzleAt.set(0, .005, -.55); fore = -.24; sightY = .07;
  } else if (kind === 'smg9') { // MP5-pattern SMG
    M(cyl(.026, .026, .24, 10), blk, 0, 0, -.05, g, Math.PI / 2); M(box(.04, .04, .14), blk, 0, -.03, -.02, g); M(cyl(.012, .012, .12, 8), blk, 0, .022, -.12, g, Math.PI / 2); // receiver tube, cocking tube
    M(cyl(.028, .03, .12, 10), poly, 0, -.008, -.2, g, Math.PI / 2); M(cyl(.007, .007, .06, 8), stl, 0, 0, -.28, g, Math.PI / 2); // forend, barrel
    M(box(.024, .11, .04), stl, 0, -.08, -.08, g, .35); M(box(.026, .08, .036), poly, 0, -.07, .04, g, -.3); // slim curved mag, grip
    for (const s of [-1, 1]) M(box(.006, .006, .16), stl, s * .02, -.005, .13, g); M(box(.045, .06, .012), stl, 0, -.02, .21, g); // retractable stock
    M(cyl(.014, .014, .025, 10), stl, 0, .04, -.24, g); M(cyl(.016, .016, .02, 10), stl, 0, .045, .02, g, Math.PI / 2); // drum sights
    muzzleAt.set(0, 0, -.31); fore = -.19; sightY = .055;
  } else if (kind === 'shotgun') {
    M(box(.045, .065, .2), blk, 0, 0, 0, g); M(cyl(.011, .011, .5, 8), stl, 0, .018, -.33, g, Math.PI / 2); M(cyl(.013, .013, .4, 8), stl, 0, -.015, -.28, g, Math.PI / 2); // receiver, barrel, mag tube
    M(cyl(.026, .026, .13, 10), poly, 0, -.012, -.25, g, Math.PI / 2); // pump forend
    M(box(.028, .085, .04), poly, 0, -.07, .1, g, -.35); M(box(.04, .07, .22), poly, 0, -.025, .22, g, .08); M(box(.006, .012, .01), stl, 0, .03, -.56, g); // grip, stock, bead
    for (let i = 0; i < 4; i++) M(cyl(.009, .009, .03, 8), mat(0x8a1a1a, { r: .5 }), .028, .0, .03 - i * .035, g, 0, 0, Math.PI / 2); // side-saddle shells
    muzzleAt.set(0, .018, -.58); fore = -.25; sightY = .04;
  } else if (kind === 'dmr') {
    M(box(.045, .07, .26), poly, 0, 0, -.02, g); M(cyl(.025, .025, .25, 8), poly, 0, .002, -.27, g, Math.PI / 2); M(cyl(.01, .01, .32, 8), stl, 0, .002, -.52, g, Math.PI / 2); M(cyl(.014, .014, .05, 8), stl, 0, .002, -.69, g, Math.PI / 2);
    M(box(.03, .1, .06), stl, 0, -.08, -.04, g, .1); M(box(.028, .085, .04), poly, 0, -.08, .09, g, -.35); M(box(.042, .09, .2), poly, 0, -.02, .22, g); M(box(.04, .03, .08), poly, 0, .045, .2, g); // mag, grip, stock, cheek riser
    M(cyl(.02, .02, .2, 14), blk, 0, .075, -.04, g, Math.PI / 2); M(cyl(.026, .02, .05, 14), blk, 0, .075, -.16, g, Math.PI / 2); M(cyl(.024, .02, .04, 14), blk, 0, .075, .08, g, Math.PI / 2); // scope
    M(new THREE.CircleGeometry(.018, 14), glass, 0, .075, .1001, g); M(cyl(.012, .012, .03, 8), blk, 0, .1, -.04, g); for (const z of [-.08, .02]) M(box(.02, .02, .015), stl, 0, .05, z, g);
    for (const s of [-1, 1]) M(cyl(.005, .005, .14, 6), stl, s * .03, -.06, -.35, g, .3, 0, s * .3); // folded bipod
    muzzleAt.set(0, .002, -.72); fore = -.27; sightY = .075;
  } else if (kind === 'lmg') {
    M(box(.055, .08, .3), blk, 0, 0, -.02, g); M(cyl(.016, .016, .4, 8), stl, 0, .005, -.38, g, Math.PI / 2); M(cyl(.02, .016, .06, 8), stl, 0, .005, -.6, g, Math.PI / 2); // receiver, heavy barrel
    M(box(.08, .1, .1), mat(0x3e4630, { r: .8 }), .03, -.08, -.04, g); M(box(.03, .015, .14), stl, 0, .055, -.03, g); M(box(.02, .03, .08), stl, 0, .075, -.2, g); // ammo box, feed tray, carry handle
    M(box(.03, .09, .04), poly, 0, -.08, .1, g, -.35); M(box(.045, .08, .2), poly, 0, -.02, .24, g); M(box(.05, .045, .14), poly, 0, -.035, -.23, g); // grip, stock, forend
    for (const s of [-1, 1]) M(cyl(.006, .006, .2, 6), stl, s * .03, -.07, -.48, g, .25, 0, s * .25); rail(0, .045, .05, .1); // bipod
    muzzleAt.set(0, .005, -.63); fore = -.23; sightY = .065;
  } else { // pistol
    M(box(.032, .035, .19), stl, 0, .02, -.04, g); M(box(.03, .03, .16), poly, 0, -.01, -.04, g); M(box(.03, .1, .045), poly, 0, -.06, .03, g, -.25); // slide, frame, grip
    M(box(.008, .006, .006), stl, 0, .04, -.13, g); M(box(.016, .006, .006), stl, 0, .04, .045, g); M(cyl(.006, .006, .02, 8), stl, 0, .02, -.14, g, Math.PI / 2);
    muzzleAt.set(0, .02, -.15); fore = 0; sightY = .043;
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
  g.userData = { muzzleAt, fore, sightY }; return g;
}
export function makeViewmodel() {
  const g = new THREE.Group(); const sleeve = mat(0x7d7058, { r: 1 }), glove = mat(0x2a2722, { r: .9 }); const hands = new THREE.Group(); g.add(hands);
  const limb = (a, b, r, m, par) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const L = A.distanceTo(B); const o = M(cap(r, L), m, 0, 0, 0, par); o.position.copy(A).lerp(B, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); o.renderOrder = 10; return o; };
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), new THREE.MeshBasicMaterial({ map: flashTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); flash.visible = false; flash.renderOrder = 11;
  const cache = {}; let gun = null;
  g.userData = { flash, setGun(kind) { if (gun) g.remove(gun); gun = cache[kind] || (cache[kind] = makeGun(kind)); g.add(gun); gun.add(flash); flash.position.copy(gun.userData.muzzleAt).add(new THREE.Vector3(0, 0, -.06));
    hands.clear(); const f = gun.userData.fore; M(sph(.034), glove, 0, -.085, .06, hands); limb([0, -.095, .08], [.08, -.3, .4], .038, sleeve, hands);
    if (kind === 'pistol') { M(sph(.034), glove, -.02, -.07, .05, hands); limb([-.02, -.08, .07], [-.14, -.3, .38], .038, sleeve, hands); }
    else { M(sph(.036), glove, -.004, -.035, f, hands); limb([-.01, -.055, f + .01], [-.2, -.32, .02], .04, sleeve, hands); }
    hands.traverse(o => o.isMesh && (o.renderOrder = 10, o.castShadow = false)); g.userData.sightY = gun.userData.sightY; }, get gun() { return gun; } };
  return g;
}
function flashTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff8e0'); gr.addColorStop(.2, '#ffd27a'); gr.addColorStop(.55, 'rgba(255,120,30,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,220,150,.9)'; x.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3; x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// ------------- Terrain (heightmap + slope/noise PBR splat), vegetation, perimeter fence -------------
export function makeTerrain(scene, P, Q, W, D, freeCell) {
  const S = 520, seg = Q.trees > 150 ? 220 : Q.trees > 100 ? 160 : 110, cx = W / 2, cz = D / 2;
  const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position;
  const outside = (x, z) => Math.max(Math.abs(x - cx) - W / 2, Math.abs(z - cz) - D / 2, 0);
  const nz = (x, z) => Math.sin(x * .031) * Math.cos(z * .037) + Math.sin(x * .083 + z * .061) * .5 + Math.sin(z * .17 - x * .05) * .22 + Math.sin(x * .29 + z * .23) * .08;
  const hAt = (x, z) => { const o = outside(x, z); const t = Math.min(1, Math.max(0, (o - 2) / 40)); return 1 + t * t * (8 + nz(x, z) * 10 + o * .08) + (o > 0 ? 0 : 0); };
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; p.setY(i, hAt(x, z)); }
  geo.translate(cx, 0, cz); geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: P.grass.map, normalMap: P.grass.normalMap, roughness: 1, metalness: 0 });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { tDirt: { value: P.dirt.map }, tRock: { value: P.rock.map }, tGrass: { value: P.grass.map } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz; vWN=normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform sampler2D tDirt,tRock,tGrass;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+1.),f.x),f.y);}`)
      .replace('#include <map_fragment>', `vec2 wuv=vWP.xz/3.; vec3 g1=texture2D(tGrass,wuv).rgb, g2=texture2D(tGrass,wuv*.23+.37).rgb; float mv=vn(vWP.xz*.05)*.6+vn(vWP.xz*.21)*.4;
vec3 grass=mix(g1,g2,.35)*mix(.85,1.2,mv)*vec3(1.05,1.25,.95); vec3 dirt=texture2D(tDirt,vWP.xz/3.).rgb; vec3 rock=texture2D(tRock,vWP.xz/6.).rgb;
float slope=1.-vWN.y; float dm=smoothstep(.62,.85,vn(vWP.xz*.09)*.7+vn(vWP.xz*.4)*.3); vec3 col=mix(grass,dirt,dm*.85); col=mix(col,rock,smoothstep(.18,.35,slope));
diffuseColor.rgb*=col;`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n');
  };
  P.grass.map.repeat.set(1, 1); P.grass.normalMap.repeat.set(S / 3, S / 3);
  const ground = new THREE.Mesh(geo, m); ground.receiveShadow = true; scene.add(ground);
  const rnd = mulberry(7), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  // conifers: textured trunk + layered needle-clump crowns (2 LODs: near detailed, far simple)
  const spots = []; for (let i = 0; i < Q.trees * 5 && spots.length < Q.trees; i++) { const x = cx + (rnd() - .5) * 400, z = cz + (rnd() - .5) * 400; const o = outside(x, z); if (o < 6 || o > 170) continue; spots.push([x, hAt(x, z) - .2, z, .9 + rnd() * .7]); }
  const bark = new THREE.MeshStandardMaterial({ map: P.bark.map, normalMap: P.bark.normalMap, roughness: 1 }); P.bark.map.repeat.set(1, 3);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .38, 12, 7).translate(0, 6, 0), bark, spots.length);
  const crownG = conifer(); const crown = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ roughness: .95, vertexColors: true }), spots.length);
  spots.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, rnd() * 6.28); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (.9 + rnd() * .3), s)); trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4); crown.setColorAt(i, c.setHSL(.27 + rnd() * .05, .3, .14 + rnd() * .06)); });
  // rocks (rock-textured, noise-displaced)
  const rg = new THREE.IcosahedronGeometry(1, 2); { const rp = rg.attributes.position; for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i); v.multiplyScalar(1 + Math.sin(v.x * 4.1 + v.y * 2.3) * .12 + Math.sin(v.z * 5.7) * .08); rp.setXYZ(i, v.x, v.y * .6, v.z); } rg.computeVertexNormals(); }
  const nr = Math.round(Q.trees * .5); const rock = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ map: P.rock.map, normalMap: P.rock.normalMap, roughness: 1 }), nr); let k = 0;
  for (let i = 0; i < nr * 4 && k < nr; i++) { const x = cx + (rnd() - .5) * 320, z = cz + (rnd() - .5) * 320; const o = outside(x, z); if (o < 3 || o > 150) continue; const s = .3 + rnd() * rnd() * 2.5;
    m4.compose(new THREE.Vector3(x, hAt(x, z) - s * .15, z), q.setFromEuler(new THREE.Euler(rnd() * .4, rnd() * 6, 0)), new THREE.Vector3(s * 1.3, s, s)); rock.setMatrixAt(k++, m4); } rock.count = k;
  for (const im of [trunk, crown, rock]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); }
  // grass: instanced blade clumps with wind sway, dense near the playfield; skipped on cells occupied by fortifications
  if (Q.grass) { const bg = bladeClump(); const gm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9 });
    gm.onBeforeCompile = sh => { sh.uniforms.uT = { value: 0 }; gm.userData.sh = sh; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.); float w=sin(uT*1.7+ip.x*.35+ip.z*.27)*.5+sin(uT*3.1+ip.x*.9)*.2; transformed.x+=w*position.y*.25; transformed.z+=w*position.y*.12;`); };
    const tufts = new THREE.InstancedMesh(bg, gm, Q.grass); let n = 0;
    for (let i = 0; i < Q.grass * 3 && n < Q.grass; i++) { const r = Math.sqrt(rnd()) * 95, a = rnd() * 6.28, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; const o = outside(x, z); if (o === 0 && !freeCell(x, z)) continue; const s = .7 + rnd() * .8;
      m4.compose(new THREE.Vector3(x, o > 0 ? hAt(x, z) : 1, z), q.setFromAxisAngle(up, rnd() * 6.28), new THREE.Vector3(s, s * (.7 + rnd() * .6), s)); tufts.setMatrixAt(n, m4); tufts.setColorAt(n++, c.setHSL(.2 + rnd() * .05, .35 + rnd() * .15, .5 + rnd() * .25)); }
    tufts.count = n; tufts.computeBoundingSphere(); tufts.receiveShadow = true; scene.add(tufts); scene.userData.grassMat = gm; }
  // chain-link perimeter fence just outside the playfield (procedural alpha texture)
  const fl = chainLinkTex(); const fm = new THREE.MeshStandardMaterial({ map: fl, alphaTest: .5, side: THREE.DoubleSide, metalness: .8, roughness: .45, color: 0x9aa0a4 });
  const post = mat(0x6a6e70, { m: .8, r: .4 }); const fH = 2.4, off = 3;
  for (const [x0, z0, x1, z1] of [[-off, -off, W + off, -off], [W + off, -off, W + off, D + off], [W + off, D + off, -off, D + off], [-off, D + off, -off, -off]]) {
    const L = Math.hypot(x1 - x0, z1 - z0); const pl = new THREE.Mesh(new THREE.PlaneGeometry(L, fH), fm); pl.position.set((x0 + x1) / 2, hAt((x0 + x1) / 2, (z0 + z1) / 2) + fH / 2, (z0 + z1) / 2); pl.rotation.y = -Math.atan2(z1 - z0, x1 - x0); fl.repeat.set(L / 1.2, fH / 1.2); pl.castShadow = true; scene.add(pl);
    const n = Math.round(L / 3); const posts = new THREE.InstancedMesh(cyl(.04, .04, fH + .1, 6), post, n + 1); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; m4.makeTranslation(x, hAt(x, z) + fH / 2, z); posts.setMatrixAt(i, m4); } posts.castShadow = true; scene.add(posts); }
  return { hAt };
}
function conifer() { const parts = []; for (let i = 0; i < 6; i++) { const r = 2.6 - i * .38, y = 3.5 + i * 1.45; const g = new THREE.ConeGeometry(r, 2.4, 9, 2, true); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); const d = Math.hypot(p.getX(k), p.getZ(k)); const j = 1 + Math.sin(a * 7 + i) * .12; p.setXYZ(k, p.getX(k) * j, p.getY(k) - d * .25, p.getZ(k) * j); }
    g.translate(0, y, 0); parts.push(g); }
  const g = mergeGeos(parts); const col = []; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = .65 + Math.min(.5, Math.hypot(p.getX(i), p.getZ(i)) * .2); col.push(k, k, k); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function bladeClump() { const pos = [], col = [], nor = []; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + Math.random(), r = Math.random() * .12, x = Math.cos(a) * r, z = Math.sin(a) * r, h = .35 + Math.random() * .3, w = .035, lean = .12;
    const dx = Math.cos(a + 1.57) * w, dz = Math.sin(a + 1.57) * w, tx = x + Math.cos(a) * lean, tz = z + Math.sin(a) * lean;
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, tx, h, tz); col.push(.25, .3, .12, .25, .3, .12, .75, .82, .45); for (let k = 0; k < 3; k++) nor.push(0, 1, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; }
function chainLinkTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 32); x.lineTo(32, 0); x.lineTo(64, 32); x.lineTo(32, 64); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(-32, 32); x.lineTo(0, 0); x.moveTo(96, 32); x.lineTo(64, 0); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
function mergeGeos(gs) { const pos = [], nor = [], uv = []; for (let g of gs) { g = g.index ? g.toNonIndexed() : g; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return r; }
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
