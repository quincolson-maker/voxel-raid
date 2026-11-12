// Horse Rider tree + RNG helpers (moved out of the old voxel-mode models.js in v31).
import * as THREE from 'three';
export function conifer() { const parts = []; for (let i = 0; i < 10; i++) { const r = 2.7 - i * .25, y = 3.2 + i * .95; const g = new THREE.ConeGeometry(r, 1.8, 14, 3, true); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); const d = Math.hypot(p.getX(k), p.getZ(k)); const j = 1 + Math.sin(a * 11 + i * 2.3) * .18 + Math.sin(a * 23 + i) * .08; p.setXYZ(k, p.getX(k) * j, p.getY(k) - d * d * .12 + Math.sin(a * 7 + i) * .12, p.getZ(k) * j); }
    g.translate(0, y, 0); parts.push(g); }
  const g = mergeGeos(parts); const col = []; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = .65 + Math.min(.5, Math.hypot(p.getX(i), p.getZ(i)) * .2); col.push(k, k, k); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function mergeGeos(gs) { const pos = [], nor = [], uv = []; for (let g of gs) { g = g.index ? g.toNonIndexed() : g; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return r; }
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

