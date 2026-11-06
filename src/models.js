// Original low-poly models: troops, defense heads, keep decor, first-person viewmodel, terrain & foliage.
import * as THREE from 'three';
const matCache = new Map(), geoCache = new Map();
export function mat(color, o = {}) { const k = color + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .7, metalness: o.m ?? 0, flatShading: true, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.t ?? 1 })); return matCache.get(k); }
const box = (w, h, d) => { const k = 'b' + w + h + d; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); };
const cyl = (a, b, h, s = 8) => { const k = 'c' + a + b + h + s; if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(a, b, h, s)); return geoCache.get(k); };
const sph = (r, d = 1) => { const k = 's' + r + d; if (!geoCache.has(k)) geoCache.set(k, new THREE.IcosahedronGeometry(r, d)); return geoCache.get(k); };
const oct = r => { const k = 'o' + r; if (!geoCache.has(k)) geoCache.set(k, new THREE.OctahedronGeometry(r, 0)); return geoCache.get(k); };
function M(g, m, x = 0, y = 0, z = 0, parent, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; if (parent) parent.add(o); return o; }
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }

// ------------- Troop rigs -------------
// Each rig: root group with hips pivot, torso, head, arms (pivot at shoulder), legs (pivot at hip).
function rig({ skin, tunic, pants, boots, scale = 1, wide = 1, short = 1 }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(scale);
  const legH = .78 * short, torsoY = legH + .38;
  const legs = [-.15 * wide, .15 * wide].map(x => { const p = pivot(body, x, legH, 0); M(box(.22 * wide, legH * .7, .26), mat(pants), 0, -legH * .35, 0, p); M(box(.26 * wide, .22, .34), mat(boots), 0, -legH + .11, -.03, p); return p; });
  const torso = pivot(body, 0, torsoY, 0); M(box(.58 * wide, .72, .36), mat(tunic), 0, 0, 0, torso); M(box(.62 * wide, .12, .4), mat(boots), 0, -.3, 0, torso); // belt
  const head = pivot(torso, 0, .36, 0); M(box(.42, .42, .4), mat(skin), 0, .22, 0, head);
  M(box(.08, .08, .02), mat(0x1a1a22), -.1, .26, -.205, head); M(box(.08, .08, .02), mat(0x1a1a22), .1, .26, -.205, head); // eyes
  const arms = [-1, 1].map(s => { const p = pivot(torso, s * (.36 * wide + .04), .28, 0); M(box(.2, .62, .22), mat(tunic), 0, -.24, 0, p); M(box(.2, .16, .22), mat(skin), 0, -.6, 0, p); return p; });
  root.userData.rig = { body, torso, head, legs, arms, t: Math.random() * 6 }; return root;
}
export function makeTroop(kind) {
  let g;
  if (kind === 'skirm') { // Ember Ranger: hooded crossbow scout
    g = rig({ skin: 0xe9b98e, tunic: 0xe0702a, pants: 0x5a3b26, boots: 0x3b2618 }); const r = g.userData.rig;
    M(new THREE.ConeGeometry(.34, .5, 4), mat(0x3f7d3a), 0, .62, .02, r.head, 0, Math.PI / 4); M(box(.48, .12, .46), mat(0x3f7d3a), 0, .42, .02, r.head); // hood
    M(box(.46, .16, .42), mat(0xf2d34a), 0, .22, 0, r.torso); // scarf
    const xb = new THREE.Group(); r.arms[1].add(xb); xb.position.set(0, -.6, -.25); M(box(.08, .1, .7), mat(0x7a4a24), 0, 0, 0, xb); M(box(.7, .05, .06), mat(0x9aa0aa, { m: .8, r: .3 }), 0, .04, -.28, xb); M(box(.04, .04, .5), mat(0xffd27a, { e: 0x553300 }), 0, .08, -.1, xb);
    M(box(.26, .4, .14), mat(0x6b4426), 0, .02, .26, r.torso); // quiver
  } else if (kind === 'breaker') { // Powder Sapper: stout miner with a keg
    g = rig({ skin: 0xd99a72, tunic: 0x6b5a48, pants: 0x3e3a36, boots: 0x262422, wide: 1.25, short: .8 }); const r = g.userData.rig;
    M(new THREE.SphereGeometry(.26, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8b23a, { m: .6, r: .4 }), 0, .4, 0, r.head); M(new THREE.CylinderGeometry(.06, .06, .05, 8), mat(0xfff2b0, { e: 0xfff0a0, ei: 2 }), 0, .45, -.25, r.head, Math.PI / 2);
    M(box(.4, .1, .05), mat(0x222222, { m: .5 }), 0, .27, -.22, r.head); M(box(.3, .1, .06), mat(0x5a2f1c), 0, .06, -.21, r.head); // goggles, beard
    const keg = M(cyl(.26, .26, .5, 10), mat(0x8a5a2e), 0, .05, .36, r.torso, Math.PI / 2); M(cyl(.27, .27, .05, 10), mat(0x444444, { m: .8 }), 0, .15, 0, keg); M(cyl(.27, .27, .05, 10), mat(0x444444, { m: .8 }), 0, -.15, 0, keg);
    M(sph(.06, 0), mat(0xffa030, { e: 0xff6010, ei: 3 }), 0, .35, .36, r.torso); g.userData.fuse = true;
  } else if (kind === 'bulwark') { // Bulwark Golem: mossy stone siege brute with rune eyes
    g = rig({ skin: 0x8c8a84, tunic: 0x7d7b74, pants: 0x6a6862, boots: 0x55534e, scale: 1.45, wide: 1.4 }); const r = g.userData.rig;
    r.head.children.slice(1).forEach(c => c.material = mat(0x40ffe0, { e: 0x20e0c0, ei: 2.5 }));
    M(box(.7, .2, .5), mat(0x4f8a3a, { r: 1 }), 0, .4, 0, r.torso); M(box(.3, .22, .3), mat(0x4f8a3a, { r: 1 }), .1, .5, 0, r.head);
    r.arms.forEach(a => M(box(.34, .34, .34), mat(0x6a6862), 0, -.68, 0, a)); M(box(.12, .5, .02), mat(0x40ffe0, { e: 0x20e0c0, ei: 1.5 }), 0, 0, -.19, r.torso);
  } else { // Bastion Warden: azure-plated defender knight
    g = rig({ skin: 0xf0c9a0, tunic: 0x2f5fb8, pants: 0x3a3f52, boots: 0x22252f }); const r = g.userData.rig;
    M(box(.48, .3, .46), mat(0xc9d3e0, { m: .85, r: .3 }), 0, .4, 0, r.head); M(box(.06, .26, .32), mat(0xe04848), 0, .64, .02, r.head); // helm & crest
    M(box(.3, .3, .02), mat(0xffd34a, { m: .7, r: .3 }), 0, .02, -.19, r.torso); // sun emblem
    r.arms.forEach(a => M(box(.26, .16, .28), mat(0xc9d3e0, { m: .85, r: .3 }), 0, -.02, 0, a));
    const xb = new THREE.Group(); r.arms[1].add(xb); xb.position.set(0, -.6, -.25); M(box(.1, .12, .75), mat(0x384050, { m: .6 }), 0, 0, 0, xb); M(box(.74, .05, .06), mat(0xc9d3e0, { m: .8, r: .3 }), 0, .05, -.3, xb); M(box(.05, .05, .2), mat(0x7ad0ff, { e: 0x3aa0ff, ei: 2 }), 0, .1, -.1, xb);
  }
  g.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  return g;
}
// procedural animation: walk cycle, attack recoil, death topple
export function animateTroop(g, dt, moving, attackT, deadT) {
  const r = g.userData.rig; r.t += dt * (moving ? 9 : 2);
  if (deadT > 0) { r.body.rotation.x = Math.min(Math.PI / 2, r.body.rotation.x + dt * 5); r.body.position.y = Math.max(-.2, r.body.position.y - dt * .3); return; }
  const s = Math.sin(r.t) * (moving ? .7 : .05);
  r.legs[0].rotation.x = s; r.legs[1].rotation.x = -s; r.arms[0].rotation.x = -s * .8;
  r.arms[1].rotation.x = attackT > 0 ? -1.4 - attackT * 2 : (moving ? s * .5 - .6 : -.9 + Math.sin(r.t) * .05); r.body.position.y = moving ? Math.abs(Math.cos(r.t)) * .08 : 0;
  r.head.rotation.y = Math.sin(r.t * .3) * .2; r.torso.rotation.x = attackT > 0 ? -.15 : 0;
}

// ------------- Defense heads & structure decor -------------
export function makeDefense(kind, col) {
  const g = new THREE.Group(), head = new THREE.Group(); g.add(head); const glow = mat(col, { e: col, ei: 2.2 });
  if (kind === 'turret') { // Bolt Spire: swivel ballista with storm crystal
    M(cyl(.9, 1, .3, 10), mat(0x5a5f6a, { m: .8, r: .35 }), 0, .15, 0, g); M(cyl(.35, .45, .7, 8), mat(0x8a6b45), 0, .55, 0, head);
    M(box(1.6, .12, .14), mat(0x6b4426), 0, .85, -.2, head, 0, 0, 0); M(box(.14, .14, 1.4), mat(0x9aa4b5, { m: .9, r: .25 }), 0, .9, -.4, head); M(oct(.22), glow, 0, 1.25, .1, head);
  } else if (kind === 'mortar') { // Quake Mortar: banded bronze barrel
    M(cyl(1.1, 1.3, .4, 10), mat(0x4b4f58, { m: .7, r: .4 }), 0, .2, 0, g); const bar = new THREE.Group(); head.add(bar); bar.position.y = .7; bar.rotation.x = -.7;
    M(cyl(.45, .55, 1.3, 10), mat(0xb07a3a, { m: .9, r: .35 }), 0, .4, 0, bar); M(cyl(.58, .58, .12, 10), mat(0x3a3a40, { m: .9 }), 0, 0, 0, bar); M(cyl(.5, .5, .1, 10), mat(0x3a3a40, { m: .9 }), 0, .9, 0, bar);
    M(cyl(.36, .36, .02, 10), glow, 0, 1.06, 0, bar); head.userData.barrel = bar;
  } else if (kind === 'needle') { // Skyneedle: spire with orbiting ring and lime crystal
    M(cyl(.25, .55, 2.2, 6), mat(0xd8d2c4, { r: .5 }), 0, 1.1, 0, g); M(oct(.4), glow, 0, 2.7, 0, head);
    const ring = M(new THREE.TorusGeometry(.6, .06, 6, 16), mat(0xffd34a, { m: .9, r: .3 }), 0, 2.7, 0, head, Math.PI / 2); head.userData.ring = ring;
  }
  g.userData.head = head; g.userData.glow = glow; return g;
}
export function makeKeepDecor(s) { // floating heartstone + corner banners
  const g = new THREE.Group(); const gem = M(oct(.9), mat(0xff4fa0, { e: 0xff2a88, ei: 2.5, r: .2 }), 0, 2.2, 0, g); gem.scale.y = 1.5; g.userData.gem = gem;
  const light = new THREE.PointLight(0xff4fa0, 6, 12, 1.5); light.position.y = 2; g.add(light); g.userData.light = light;
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = M(cyl(.06, .06, 2.4, 5), mat(0x6b4426), x * (s / 2 - .5), 1.2, z * (s / 2 - .5), g);
    const f = M(box(.9, .6, .04), mat(0x8a2be2, { r: .9 }), .45, .8, 0, p); f.userData.flag = true; }
  return g;
}
export function makeRoof(kind, s) {
  const g = new THREE.Group();
  if (kind === 'hut') { M(new THREE.ConeGeometry(s * .78, 1.8, 4), mat(0xc0603a, { r: .8 }), 0, .9, 0, g, 0, Math.PI / 4); M(cyl(.18, .2, .9, 6), mat(0x55504a), .6, 1.4, .3, g); }
  else if (kind === 'vault') { M(box(1.4, .8, 1), mat(0x7a4a24), 0, .4, 0, g); M(box(1.46, .14, 1.06), mat(0xd8b23a, { m: .9, r: .3 }), 0, .82, 0, g); for (let i = 0; i < 6; i++) M(cyl(.14, .14, .05, 8), mat(0xffd34a, { m: 1, r: .25, e: 0x553300 }), (Math.random() - .5) * 1.6, .03 + i * .05, .9 + Math.random() * .3, g); }
  return g;
}

// ------------- First-person viewmodel: Arc Repeater -------------
export function makeViewmodel() {
  const g = new THREE.Group(); const gun = new THREE.Group(); g.add(gun);
  const wood = mat(0x8a5a2e, { r: .6 }), brass = mat(0xd9a640, { m: .9, r: .3 }), steel = mat(0x6d7684, { m: .9, r: .35 }), glove = mat(0x3b2a1e, { r: .9 }), sleeve = mat(0x1f8a8a, { r: .8 }), skin = mat(0xe9b98e);
  M(box(.09, .11, .42), wood, 0, -.02, .1, gun); M(box(.11, .13, .22), brass, 0, .01, -.16, gun); M(cyl(.025, .03, .42, 8), steel, 0, .03, -.45, gun, Math.PI / 2);
  M(cyl(.045, .045, .06, 8), brass, 0, .03, -.62, gun, Math.PI / 2); const core = M(oct(.028), mat(0x5ad8ff, { e: 0x2ab8ff, ei: 3 }), 0, .1, -.16, gun); M(box(.03, .12, .05), wood, 0, -.1, -.05, gun, .3);
  M(box(.02, .05, .02), brass, 0, .1, -.58, gun); // sight
  const armR = new THREE.Group(); g.add(armR); M(box(.09, .09, .4), sleeve, .05, -.1, .32, armR); M(box(.1, .1, .1), glove, .02, -.08, .1, armR);
  const armL = new THREE.Group(); g.add(armL); M(box(.09, .09, .45), sleeve, -.14, -.08, -.05, armL, 0, -.5); M(box(.1, .1, .1), glove, -.04, -.03, -.3, armL); M(box(.1, .05, .1), skin, -.04, .02, -.3, armL);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(.35, .35), new THREE.MeshBasicMaterial({ map: flashTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flash.position.set(0, .03, -.7); flash.visible = false; gun.add(flash);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
  g.userData = { gun, core, flash, armL }; return g;
}
function flashTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(.25, '#bff4ff'); gr.addColorStop(.6, 'rgba(60,180,255,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = '#fff'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// ------------- Terrain, foliage -------------
export function makeTerrain(scene, tex, Q, W, D) {
  const S = 420, seg = Q.trees > 100 ? 160 : 90, cx = W / 2, cz = D / 2;
  const geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position;
  const outside = (x, z) => Math.max(Math.abs(x - cx) - W / 2, Math.abs(z - cz) - D / 2, 0);
  const nz = (x, z) => Math.sin(x * .045) * Math.cos(z * .05) + Math.sin(x * .11 + z * .07) * .5 + Math.sin(z * .13 - x * .02) * .35;
  const hAt = (x, z) => { const o = outside(x, z); const t = Math.min(1, Math.max(0, (o - 3) / 30)); return .92 + t * t * (6 + nz(x, z) * 7 + o * .05); };
  const colors = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; const h = hAt(x, z); p.setY(i, h); const k = .85 + nz(x * 2, z * 2) * .1; colors.push(k, k * (1 + (h - 1) * .01), k); }
  geo.translate(cx, 0, cz); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  tex.grass.repeat.set(S / 2, S / 2); tex.grassN.repeat.set(S / 2, S / 2);
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex.grass, normalMap: tex.grassN, normalScale: new THREE.Vector2(.6, .6), vertexColors: true, roughness: .95 }));
  ground.receiveShadow = true; scene.add(ground);
  // trees (instanced): trunks + two foliage styles (round broadleaf, tiered pine)
  const rnd = mulberry(7); const spots = [];
  for (let i = 0; i < Q.trees * 4 && spots.length < Q.trees; i++) { const x = cx + (rnd() - .5) * 300, z = cz + (rnd() - .5) * 300; const o = outside(x, z); if (o < 4 || o > 110) continue; spots.push([x, hAt(x, z) - .1, z, .8 + rnd() * .8, rnd() < .45]); }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .4, 3, 6).translate(0, 1.5, 0), mat(0x6b4426, { r: .9 }), spots.length);
  const leafG = new THREE.IcosahedronGeometry(1.9, 0).translate(0, 4.2, 0), pineG = mergeCones();
  const leaf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ roughness: .8, flatShading: true }), spots.length), pine = new THREE.InstancedMesh(pineG, new THREE.MeshStandardMaterial({ roughness: .8, flatShading: true }), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let nl = 0, np = 0;
  spots.forEach(([x, y, z, s, isPine], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m4);
    if (isPine) { pine.setMatrixAt(np, m4); pine.setColorAt(np++, c.setHSL(.33 + rnd() * .05, .45, .26 + rnd() * .08)); } else { leaf.setMatrixAt(nl, m4); leaf.setColorAt(nl++, c.setHSL(.22 + rnd() * .1, .55, .36 + rnd() * .12)); } });
  leaf.count = nl; pine.count = np;
  // rocks
  const nr = Math.round(Q.trees * .6); const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(0x9a9890, { r: .9 }), nr); let k = 0;
  for (let i = 0; i < nr * 4 && k < nr; i++) { const x = cx + (rnd() - .5) * 260, z = cz + (rnd() - .5) * 260; const o = outside(x, z); if (o < 2 || o > 100) continue; const s = .4 + rnd() * 1.4;
    m4.compose(new THREE.Vector3(x, hAt(x, z), z), q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)), new THREE.Vector3(s * 1.3, s * .7, s)); rock.setMatrixAt(k++, m4); } rock.count = k;
  for (const im of [trunk, leaf, pine, rock]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); }
  // grass tufts (crossed blades), inside & outside the playfield on open ground
  if (Q.grass) { const bl = new THREE.PlaneGeometry(.5, .45).translate(0, .22, 0); const b2 = bl.clone().rotateY(Math.PI / 2); const tg = mergeGeos([bl, b2]);
    const gm = new THREE.MeshStandardMaterial({ color: 0x6fb04a, side: THREE.DoubleSide, roughness: .9 }); const tufts = new THREE.InstancedMesh(tg, gm, Q.grass); let n = 0;
    for (let i = 0; i < Q.grass; i++) { const x = cx + (rnd() - .5) * 200, z = cz + (rnd() - .5) * 200; const o = outside(x, z); if (o === 0 && Math.hypot(x - cx, z - cz) < 30) continue; const s = .6 + rnd() * .9;
      m4.compose(new THREE.Vector3(x, o > 0 ? hAt(x, z) : 1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 3), new THREE.Vector3(s, s, s)); tufts.setMatrixAt(n, m4); tufts.setColorAt(n++, c.setHSL(.24 + rnd() * .06, .5, .4 + rnd() * .15)); }
    tufts.count = n; tufts.computeBoundingSphere(); scene.add(tufts); }
  return { hAt };
}
function mergeCones() { return mergeGeos([new THREE.ConeGeometry(2, 2.6, 7).translate(0, 3.4, 0), new THREE.ConeGeometry(1.6, 2.2, 7).translate(0, 4.8, 0), new THREE.ConeGeometry(1.1, 1.8, 7).translate(0, 6, 0)]); }
function mergeGeos(gs) { const pos = [], nor = [], uv = []; for (let g of gs) { g = g.index ? g.toNonIndexed() : g; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return r; }
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
