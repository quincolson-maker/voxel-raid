// Horse Rider tree + RNG helpers (moved out of the old voxel-mode models.js in v31).
import * as THREE from 'three';
export function conifer() { const parts = []; for (let i = 0; i < 10; i++) { const r = 2.7 - i * .25, y = 3.2 + i * .95; const g = new THREE.ConeGeometry(r, 1.8, 14, 3, true); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); const d = Math.hypot(p.getX(k), p.getZ(k)); const j = 1 + Math.sin(a * 11 + i * 2.3) * .18 + Math.sin(a * 23 + i) * .08; p.setXYZ(k, p.getX(k) * j, p.getY(k) - d * d * .12 + Math.sin(a * 7 + i) * .12, p.getZ(k) * j); }
    g.translate(0, y, 0); parts.push(g); }
  const g = mergeGeos(parts); const col = []; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = .65 + Math.min(.5, Math.hypot(p.getX(i), p.getZ(i)) * .2); col.push(k, k, k); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function mergeGeos(gs) { const pos = [], nor = [], uv = []; for (let g of gs) { g = g.index ? g.toNonIndexed() : g; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return r; }
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------- v32 realistic trees: alpha-tested branch / leaf cards with procedural CC0-free textures, soft normals, wind ----------------
export const TREE_WIND = { value: 0 };
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
// a pine spray: brown twig along +u, dense needles angled toward the tip; left 5 % is an opaque dark core strip (used by the inner cone)
export function needleTexture() { const [c, x] = cv(256, 128), r = mulberry(5);
  x.clearRect(0, 0, 256, 128); x.fillStyle = '#1d2a17'; x.fillRect(0, 0, 13, 128);
  const twig = (y0, len, ang, wdt) => { x.strokeStyle = '#4a3a28'; x.lineWidth = wdt; x.beginPath(); x.moveTo(0, y0); const ex = len * Math.cos(ang), ey = y0 + len * Math.sin(ang); x.lineTo(ex, ey); x.stroke(); return [ex, ey]; };
  const tuft = (sx, sy, ex, ey, n, L) => { for (let i = 0; i < n; i++) { const t = r(), px = sx + (ex - sx) * t, py = sy + (ey - sy) * t, side = r() < .5 ? -1 : 1, l = L * (.55 + r() * .6) * (1 - t * .45), a = Math.atan2(ey - sy, ex - sx) + side * (.55 + r() * .5);
      const g = 70 + r() * 50, gg = 40 + r() * 28; x.strokeStyle = `rgba(${18 + r() * 26 | 0},${gg + 30 | 0},${16 + r() * 18 | 0},${.85 + r() * .15})`; x.lineWidth = 1 + r() * 1.3; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); if (g > 110) {} } };
  const [ex, ey] = twig(64, 246, 0, 3.2); tuft(8, 64, ex, ey, 900, 34);
  for (let k = 0; k < 7; k++) { const t = .15 + k * .11, sx = 246 * t, side = k % 2 ? -1 : 1, a = side * (.5 + r() * .35), L = 70 * (1 - t * .6); x.strokeStyle = '#4a3a28'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(sx, 64); const tx = sx + Math.cos(a) * L, ty = 64 + Math.sin(a) * L; x.lineTo(tx, ty); x.stroke(); tuft(sx, 64, tx, ty, 160, 22); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; return t; }
// a leaf cluster card for broadleaf crowns; left strip opaque for the inner core
export function leafTexture() { const [c, x] = cv(256, 256), r = mulberry(13);
  x.clearRect(0, 0, 256, 256); x.fillStyle = '#26381a'; x.fillRect(0, 0, 13, 256);
  for (let i = 0; i < 260; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 110, px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d * .9, s = 7 + r() * 9, ang = r() * 6.28;
    const l = 26 + r() * 30, h = 70 + r() * 35; x.fillStyle = `hsl(${h},${38 + r() * 25}%,${l * (1 - d / 260)}%)`; x.save(); x.translate(px, py); x.rotate(ang); x.beginPath(); x.ellipse(0, 0, s, s * .48, 0, 0, 6.28); x.fill();
    x.strokeStyle = 'rgba(20,30,10,.35)'; x.lineWidth = .8; x.beginPath(); x.moveTo(-s, 0); x.lineTo(s, 0); x.stroke(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function geo(pos, nor, uv, col) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; }
// conifer of whorled branch cards (two crossed cards per branch, drooping) around a dark inner cone; ~12 m tall at scale 1 like conifer()
export function conifCards(whorls = 16) { const r = mulberry(21), pos = [], nor = [], uv = [], col = [];
  const quad = (a, b, c, d, na, nb, ka, kb) => { for (const [p, n, u, k] of [[a, na, [0, 0], ka], [b, nb, [1, 0], kb], [c, nb, [1, 1], kb], [a, na, [0, 0], ka], [c, nb, [1, 1], kb], [d, na, [0, 1], ka]]) { pos.push(...p); nor.push(...n); uv.push(...u); col.push(k, k, k); } };
  const top = 12.2, y0 = 2.4; let ga = 0;
  for (let k = 0; k < whorls; k++) { const f = k / (whorls - 1), y = y0 + f * (top - 1.4 - y0), R = 3.0 * Math.pow(1 - f, 1.05) + .35, nb = f > .8 ? 4 : f > .5 ? 5 : 6; ga += 2.39996;
    for (let b = 0; b < nb; b++) { const a = ga + b * 6.2832 / nb + (r() - .5) * .5, ca = Math.cos(a), sa = Math.sin(a), L = R * (.85 + r() * .3), droop = L * (.28 + r() * .15), w = .45 + L * .32;
      const ty = y - droop, tx = ca * L, tz = sa * L, px = -sa, pz = ca; const n0 = [ca * .5, .85, sa * .5], n1 = [ca * .85, .45, sa * .85]; const kIn = .38, kOut = .62 + f * .35;
      // horizontal card (width across, slightly cupped)
      quad([ca * .1 - px * w * .25, y + .05, sa * .1 - pz * w * .25], [tx - px * w * .55, ty, tz - pz * w * .55], [tx + px * w * .55, ty, tz + pz * w * .55], [ca * .1 + px * w * .25, y + .05, sa * .1 + pz * w * .25], n0, n1, kIn, kOut);
      // vertical card along the branch for volume from the side
      const vh = w * .45; quad([ca * .1, y + vh * .5, sa * .1], [tx, ty + vh * .8, tz], [tx, ty - vh * .8, tz], [ca * .1, y - vh * .5, sa * .1], n0, n1, kIn * .9, kOut * .92); } }
  // leader at the top
  for (let b = 0; b < 2; b++) { const a = b * 1.5708, ca = Math.cos(a) * .55, sa = Math.sin(a) * .55; quad([-ca, top - 2.2, -sa], [-ca * .2, top, -sa * .2], [ca * .2, top, sa * .2], [ca, top - 2.2, sa], [0, .3, 1], [0, 1, 0], .5, .9); }
  // dark inner cone (uv in the opaque strip) so you never see sky through the middle
  const segs = 7, cy0 = y0 - .2, cy1 = top - 1.6; for (let i = 0; i < segs; i++) { const a0 = i / segs * 6.2832, a1 = (i + 1) / segs * 6.2832, rb = 1.05, n = a => [Math.cos(a), .45, Math.sin(a)];
    for (const [p, nn] of [[[Math.cos(a0) * rb, cy0, Math.sin(a0) * rb], n(a0)], [[Math.cos(a1) * rb, cy0, Math.sin(a1) * rb], n(a1)], [[0, cy1, 0], [0, 1, 0]]]) { pos.push(...p); nor.push(...nn); uv.push(.025, .5); col.push(.32, .32, .32); } }
  return geo(pos, nor, uv, col); }
// broadleaf crown of leaf-cluster cards around a few clumps (+ dark low-poly cores), like broadleafGeo() in size
export function broadleafCards(seed = 11, perClump = 12) { const r = mulberry(seed), pos = [], nor = [], uv = [], col = [];
  const n = 9; for (let i = 0; i < n; i++) { const a = r() * 6.28, d = i ? .6 + r() * 1.3 : 0, cy = 4.4 + r() * 2.2 - d * .3, s = 1.35 + r() * .7 - d * .15, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    for (let j = 0; j < perClump; j++) { const u = r() * 2 - 1, ph = r() * 6.28, q = Math.sqrt(1 - u * u), dx = q * Math.cos(ph), dy = u * .85, dz = q * Math.sin(ph), sz = s * (.95 + r() * .45);
      const ox = cx + dx * s * .72, oy = cy + dy * s * .72, oz = cz + dz * s * .72; // card faces outward-ish with a random spin
      let tx = -dz, tz = dx; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const sp = r() * 6.28, bx = dy * tz, by = dz * tx - dx * tz, bz = -dy * tx; const c1 = Math.cos(sp), s1 = Math.sin(sp);
      const ux = tx * c1 + bx * s1, uy = by * s1, uz = tz * c1 + bz * s1, vx = -tx * s1 + bx * c1, vy = by * c1, vz = -tz * s1 + bz * c1, h = sz * .5;
      const nn = [dx * .8, dy * .8 + .35, dz * .8], k = .55 + (dy * .5 + .5) * .45 + Math.min(.15, (cy - 3.2) * .05);
      const P = (a, b) => [ox + ux * a * h + vx * b * h, oy + uy * a * h + vy * b * h, oz + uz * a * h + vz * b * h];
      for (const [aa, bb, uu, vv] of [[-1, -1, .08, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, -1, .08, 0], [1, 1, 1, 1], [-1, 1, .08, 1]]) { pos.push(...P(aa, bb)); nor.push(...nn); uv.push(uu, vv); col.push(k, k, k); } }
    const ic = new THREE.IcosahedronGeometry(s * .62, 0).toNonIndexed(), p = ic.attributes.position; for (let v = 0; v < p.count; v++) { const x = p.getX(v), y = p.getY(v), z = p.getZ(v), l = Math.hypot(x, y, z) || 1; pos.push(x + cx, y * .82 + cy, z + cz); nor.push(x / l, y / l + .3, z / l); uv.push(.025, .5); col.push(.36, .36, .36); } }
  return geo(pos, nor, uv, col); }
// card material: alpha-tested, double sided, world-noise tint (like foliage()), sun through the edges, wind sway growing with height + tip flutter
export function cardMaterial(map, color, f = 3) { const m = new THREE.MeshStandardMaterial({ map, color, vertexColors: true, roughness: .86, metalness: 0, alphaTest: .45, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.uWindT = TREE_WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT; varying vec3 vFW;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
 vec3 ip = instanceMatrix[3].xyz;
#else
 vec3 ip = vec3(0.);
#endif
 float hw = max(0., position.y - 1.5) / 10.; float sway = (sin(uWindT * 1.1 + ip.x * .05 + ip.z * .043) * .6 + sin(uWindT * 2.3 + ip.z * .09) * .25) * hw * hw * .45;
 float flut = sin(uWindT * 4.7 + position.x * 2.1 + position.z * 1.7 + ip.x) * .045 * uv.x;
 transformed.x += sway + flut; transformed.z += sway * .6 - flut * .7; transformed.y += flut * .5;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFW = (modelMatrix * vec4(transformed, 1.)).xyz;\n#ifdef USE_INSTANCING\nvFW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW; float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } float fn(vec3 p){ vec3 i = floor(p), q = fract(p); q = q * q * (3. - 2. * q); return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), q.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), q.x), q.y), mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), q.x), mix(fh(i + vec3(0,1,1)), fh(i + 1.), q.x), q.y), q.z); }')
      .replace('#include <color_fragment>', `#include <color_fragment>\n float lc = fn(vFW * ${(f * .35).toFixed(2)}) * .6 + fn(vFW * ${(f * 1.1).toFixed(2)}) * .4; diffuseColor.rgb *= mix(.72, 1.12, lc) * mix(vec3(1.), vec3(.88, 1.03, .82), fn(vFW * .13));`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.indirectDiffuse *= 1.08;'); };
  m.shadowSide = THREE.DoubleSide; return m; }
