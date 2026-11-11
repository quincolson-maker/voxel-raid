// Horse Rider ground cover + far woods (all procedural, instanced; counts scale down on phones):
//  sagebrush (silver-green mounded shrubs), dry bunchgrass clumps that carry the meadow texture past the GPU grass radius,
//  prickly-pear and saguaro-style cacti on the dry sunny slopes, and a belt of far conifers climbing the lower mountain
//  slopes outside the walkable area (cheap far-LOD trees, no shadows) so the ranges read as layered forest → rock → snow.
import * as THREE from 'three';

function build(parts) { // parts: [geometry, [r,g,b] | fn(y)->rgb] -> one non-indexed geometry with vertex colours
  const pos = [], nor = [], col = [];
  for (const [g0, c] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); const k = typeof c === 'function' ? c(p.getX(i), p.getY(i), p.getZ(i)) : c; col.push(k[0], k[1], k[2]); } }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return r;
}
function roundNormals(g, cy, k) { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - cy, z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
  const nx = n.getX(i) * (1 - k) + x / l * k, ny = n.getY(i) * (1 - k) + y / l * k + .25, nz = n.getZ(i) * (1 - k) + z / l * k, m = Math.hypot(nx, ny, nz) || 1; n.setXYZ(i, nx / m, ny / m, nz / m); } return g; }
function rngf(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function sagebrushGeo(seed = 3) { const r = rngf(seed), parts = [];
  for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = r() * .38, s = .3 + r() * .28, g = new THREE.IcosahedronGeometry(s, 0); g.scale(1, .72, 1); g.translate(Math.cos(a) * d, s * .55 + r() * .12, Math.sin(a) * d);
    const t = r(); parts.push([g, (x, y) => { const k = .75 + Math.min(.35, y * .35); return [(.48 + t * .08) * k, (.53 + t * .06) * k, (.42 + t * .04) * k]; }]); }
  for (let i = 0; i < 2; i++) { const g = new THREE.CylinderGeometry(.02, .035, .45, 3, 1, true).translate(0, .22, 0); g.rotateZ((r() - .5) * .8); g.rotateY(r() * 6.28); parts.push([g, [.32, .26, .2]]); }
  return roundNormals(build(parts), .25, .7); }
export function bunchGrassGeo(seed = 5) { const r = rngf(seed), parts = [];
  for (let i = 0; i < 9; i++) { const h = .35 + r() * .45, g = new THREE.ConeGeometry(.035, h, 3, 1).translate(0, h / 2, 0); g.rotateZ((r() - .5) * .9); g.rotateX((r() - .5) * .9); g.translate((r() - .5) * .22, 0, (r() - .5) * .22);
    const t = r(); parts.push([g, (x, y) => { const k = Math.min(1, y / .6); return [.34 + .34 * k + t * .06, .32 + .26 * k + t * .04, .12 + .1 * k]; }]); }
  const b = build(parts); const n = b.attributes.normal; for (let i = 0; i < n.count; i++) { n.setXYZ(i, n.getX(i) * .4, .9, n.getZ(i) * .4); } return b; }
export function pricklyGeo(seed = 7) { const r = rngf(seed), parts = [], pad = (x, y, z, s, ry, rz) => { const g = new THREE.SphereGeometry(s, 6, 4); g.scale(1, 1.25, .28); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); return g; };
  const base = [[0, .28, 0, .26, 0, 0], [.2, .5, .05, .2, .6, -.5], [-.18, .52, -.04, .21, -.4, .45], [.05, .78, .02, .17, .2, .15], [.33, .8, .1, .14, 1, -.7]];
  for (const b of base) { const t = r(); parts.push([pad(b[0], b[1], b[2], b[3], b[4] + (r() - .5) * .4, b[5]), [.13 + t * .04, .24 + t * .05, .08]]); }
  for (let i = 0; i < 3; i++) { const g = new THREE.SphereGeometry(.035, 5, 4).translate(.2 * (r() - .5) * 2, .95 + r() * .2, 0); parts.push([g, [.75, .2, .3]]); } // fruit
  return build(parts); }
export function saguaroGeo(seed = 11) { const r = rngf(seed), parts = [], C = (x, y) => { const rib = .9 + .1 * Math.sin(Math.atan2(y, x) * 12); return [.1 * rib, .2 * rib, .085 * rib]; };
  const trunk = new THREE.CylinderGeometry(.24, .3, 4.2, 10, 2, true).translate(0, 2.1, 0), top = new THREE.SphereGeometry(.24, 10, 3, 0, 6.29, 0, 1.6).translate(0, 4.2, 0);
  parts.push([trunk, (x, y, z) => C(x, z)], [top, (x, y, z) => C(x, z)]);
  for (const s of r() < .6 ? [1, -1] : [1]) { const h0 = 1.4 + r() * 1, up = 1 + r() * 1.1, el = new THREE.CylinderGeometry(.17, .17, .55, 8, 1, true).rotateZ(Math.PI / 2).translate(s * .5, h0, 0);
    const arm = new THREE.CylinderGeometry(.16, .17, up, 8, 1, true).translate(s * .78, h0 + up / 2, 0), cap = new THREE.SphereGeometry(.16, 8, 3, 0, 6.29, 0, 1.6).translate(s * .78, h0 + up, 0);
    parts.push([el, (x, y, z) => C(y, z)], [arm, (x, y, z) => C(x - s * .78, z)], [cap, (x, y, z) => C(x, z)]); }
  return build(parts); }

export function createFlora(scene, o) {
  const { hAt, BASE, EDGE, avoid, mobile, HQ, farTree, needle, obst } = o, r = rngf(o.seed || 91), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const slope = (x, z) => { const a = hAt(x, z), b = hAt(x + 1.5, z), c = hAt(x, z + 1.5); return Math.hypot(b - a, c - a) / 1.5; };
  const n2 = (x, z) => Math.sin(x * .013 + Math.cos(z * .009) * 2) * Math.cos(z * .011 - Math.sin(x * .007) * 1.7); // cheap smooth mask, -1..1
  const dry = (x, z) => { const s = (hAt(x + 2, z) - hAt(x - 2, z)) * .25 + (hAt(x, z + 2) - hAt(x, z - 2)) * .25; return n2(x + 400, z - 250) * .6 + (s > 0 ? .2 : -.1) + (hAt(x, z) - BASE > 15 ? .15 : 0); }; // sunny / exposed / high = dry
  const vm = (vc = true) => new THREE.MeshStandardMaterial({ vertexColors: vc, roughness: .93, metalness: 0 });
  const out = { meshes: [], counts: {} };
  function scatter(name, geo, mat, n, test, size, shadow, tint) { const L = []; for (let i = 0; i < n * 6 && L.length < n; i++) { const x = (r() - .5) * 2 * EDGE, z = (r() - .5) * 2 * EDGE; if (avoid(x, z) || !test(x, z)) continue; L.push([x, z]); }
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, L.length)); L.forEach(([x, z], i) => { const s = size(); m4.compose(v.set(x, hAt(x, z) - .05, z), q.setFromAxisAngle(up, r() * 6.28), s3.set(s, s * (.85 + r() * .3), s)); im.setMatrixAt(i, m4); if (tint) im.setColorAt(i, tint(col)); });
    im.count = L.length; im.castShadow = !!shadow; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); out.meshes.push(im); out.counts[name] = L.length; return L; }
  const k = mobile ? .22 : HQ ? .75 : .45;
  scatter('sagebrush', sagebrushGeo(), vm(), Math.round(2600 * k), (x, z) => slope(x, z) < .45 && dry(x, z) > -.35, () => .7 + r() * r() * 1.4, false, c => c.setHSL(.2 + r() * .06, .12 + r() * .1, .62 + r() * .2));
  scatter('bunchgrass', bunchGrassGeo(), vm(), Math.round(6000 * k * (mobile ? .75 : 1)), (x, z) => slope(x, z) < .55 && hAt(x, z) - BASE < 110, () => .8 + r() * .9, false, c => c.setHSL(.12 + r() * .1, .3 + r() * .25, .75 + r() * .25));
  const pr = scatter('prickly', pricklyGeo(), vm(), Math.round(260 * k), (x, z) => dry(x, z) > .25 && slope(x, z) < .4 && hAt(x, z) - BASE < 40, () => .8 + r() * .8, HQ);
  const sg = scatter('saguaro', saguaroGeo(), vm(), Math.round(110 * (mobile ? .4 : 1)), (x, z) => dry(x, z) > .35 && slope(x, z) < .3 && hAt(x, z) - BASE < 35, () => .75 + r() * .55, !mobile);
  if (obst) for (const [x, z] of sg) obst.push([x, z, .32, 4]); // the big cacti block like trees do
  // far woods on the lower mountain slopes (outside the walkable square), coloured like the near conifers
  if (farTree) { const L = [], N = Math.round((mobile ? 900 : HQ ? 4200 : 2400)); for (let i = 0; i < N * 10 && L.length < N; i++) { const a = r() * 6.283, d = EDGE + 25 + Math.pow(r(), 1.6) * 760, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const hh = hAt(x, z) - BASE, sl = slope(x, z); if (sl > .7 || hh > 175 + n2(x, z) * 35 || hh < -10) continue; if (n2(x * 1.7, z * 1.7) < -.35 + Math.min(.5, hh / 400)) continue; L.push([x, z, hh]); }
    const im = new THREE.InstancedMesh(farTree, needle, Math.max(1, L.length)); L.forEach(([x, z, hh], i) => { const s = (.9 + r() * .9) * (1 - Math.min(.35, hh / 500)); m4.compose(v.set(x, hAt(x, z) - .3, z), q.setFromAxisAngle(up, r() * 6.28), s3.set(s, s * (1 + r() * .3), s)); im.setMatrixAt(i, m4);
      im.setColorAt(i, col.setHSL(.28 + r() * .07, .3 + r() * .12, .15 + r() * .06)); });
    im.count = L.length; im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; scene.add(im); out.meshes.push(im); out.counts.farWoods = L.length; }
  out.tris = out.meshes.reduce((n, m) => n + m.count * (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
  return out;
}
