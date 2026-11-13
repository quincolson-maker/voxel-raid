// HORSE RIDER v33: places you can walk into. Everything here is original procedural geometry (no downloaded assets).
//  - two FIRE LOOKOUT towers above the snow line at the tops of the mountain trails (opposite sides of the map): four
//    switchback flights of stairs to a cab 16 m up. Tower 1: a desk with a Tommy gun (100-round drum) and a box with the
//    Golden Buffalo rifle (walk up, take them). Tower 2: the gun upgrade station (bronze / silver / gold tiers for points,
//    plus the Tommy gun and the Golden Buffalo for sale).
//  - a little western TOWN in the meadows: a saloon and, right next to it, a general store, a boardwalk porch and a
//    hitching rail. It is a zombie safe zone. The saloon pours drinks (being drunk gets worse the more you drink) and has a
//    dartboard (301 against the bartender or another rider); the store sells a black windbreaker with HORSE RIDER on the back.
// Walkable structures: floor surfaces (boxes / ramps) + height-aware wall segments, queried by horse.js (floorAt / walls).
import * as THREE from 'three';
import { mergeGeometries } from '../addons/utils/BufferGeometryUtils.js';

export const TOWN_PRICES = { jacket: 5000, drink: 20 };
const TAU = Math.PI * 2;
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rng(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
let MATS = null;
function mats() { if (MATS) return MATS;
  const plank = canvasTex(256, 256, (x, w, h) => { const r = rng(11); for (let i = 0; i < 8; i++) { const l = 30 + r() * 12; x.fillStyle = `hsl(${24 + r() * 8},${32 + r() * 10}%,${l}%)`; x.fillRect(0, i * h / 8, w, h / 8 - 2); x.fillStyle = 'rgba(20,10,4,.6)'; x.fillRect(0, i * h / 8 + h / 8 - 2, w, 2);
    for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(40,22,10,${.12 + r() * .15})`; x.beginPath(); const y = i * h / 8 + r() * h / 8; x.moveTo(0, y); x.bezierCurveTo(w * .3, y + r() * 6 - 3, w * .7, y + r() * 6 - 3, w, y); x.stroke(); } x.fillStyle = 'rgba(15,8,3,.55)'; x.fillRect(((r() * 4) | 0) * w / 4, i * h / 8, 2, h / 8); } });
  plank.wrapS = plank.wrapT = THREE.RepeatWrapping;
  const S = o => new THREE.MeshStandardMaterial(o);
  MATS = { plank: S({ map: plank, roughness: .88 }), dark: S({ color: 0x4a3322, roughness: .9 }), roof: S({ color: 0x5a5048, roughness: .75, metalness: .25 }), glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb8c4, roughness: .05, transparent: true, opacity: .35, envMapIntensity: 1.5 }),
    iron: S({ color: 0x30302e, roughness: .5, metalness: .8 }), steel: S({ color: 0xaeb4b8, roughness: .42, metalness: .85 }), grate: S({ color: 0x8d9296, roughness: .55, metalness: .8 }), concrete: S({ color: 0x9c9a94, roughness: .96 }), wood: S({ map: plank, color: 0xb8b0a4, roughness: .92 }), red: S({ color: 0x8a2a20, roughness: .8 }), crate: S({ map: plank, color: 0xc9a070, roughness: .9 }), felt: S({ color: 0x2c4a2a, roughness: 1 }), brass: S({ color: 0xc9a245, roughness: .3, metalness: .9 }), mirror: S({ color: 0x5a5448, roughness: .16, metalness: .9 }), bGreen: S({ color: 0x2f5a30, roughness: .15, metalness: .1 }), bAmber: S({ color: 0x8a4a12, roughness: .15, metalness: .1 }), bone: S({ color: 0xe8dcc0, roughness: .7 }), black: S({ color: 0x15110e, roughness: .35, metalness: .1 }), ivory: S({ color: 0xf4efe0, roughness: .4 }), lamp: new THREE.MeshBasicMaterial({ color: 0xffd38a }) };
  return MATS; }
function signTex(txt, bg = '#3a2414', fg = '#f1dfb0', w = 512, h = 128, font = 'bold 64px Georgia,serif') { return canvasTex(w, h, (x) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 4); }); }

// ---------------- darts: standard board, 301 ----------------
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export function dartScore(x, y) { // mm from the bull, +x right, +y up
  const r = Math.hypot(x, y); if (r <= 6.35) return { pts: 50, label: 'BULL', m: 2 }; if (r <= 15.9) return { pts: 25, label: '25', m: 1 }; if (r > 170) return { pts: 0, label: 'MISS', m: 0 };
  const th = ((Math.atan2(x, y) * 180 / Math.PI) + 360 + 9) % 360, n = ORDER[Math.floor(th / 18) % 20];
  if (r >= 99 && r <= 107) return { pts: n * 3, label: 'T' + n, m: 3 }; if (r >= 162) return { pts: n * 2, label: 'D' + n, m: 2 }; return { pts: n, label: String(n), m: 1 }; }
export function segAim(n, ring) { const i = ORDER.indexOf(n), a = i * 18 * Math.PI / 180, r = ring === 3 ? 103 : ring === 2 ? 166 : 135; return [Math.sin(a) * r, Math.cos(a) * r]; }
export function aiTarget(rem) { if (rem > 60) return segAim(20, 3); if (rem === 50) return [0, 0]; if (rem <= 40 && rem % 2 === 0) return segAim(rem / 2, 2); if (rem <= 20) return segAim(rem, 1); if (rem % 3 === 0 && rem <= 60) return segAim(rem / 3, 3); return segAim(Math.min(20, rem - 20 > 0 ? rem - 20 : rem), 1); }
// 301: subtract each dart; going below zero (or to exactly 1, which can't be finished... kept simple: below zero) busts the turn
export function applyDart(G, pts) { const p = G.turn, rem = G.s[p] - pts; G.log.push({ p, pts }); if (rem < 0) { G.s[p] = G.start; G.bust = true; endTurn(G); return 'bust'; } G.s[p] = rem; if (rem === 0) { G.win = p; return 'win'; } if (++G.darts >= 3) endTurn(G); return 'ok'; }
function endTurn(G) { G.turn = 1 - G.turn; G.darts = 0; G.start = G.s[G.turn]; }
export function newGame(a, b) { return { id: Math.random().toString(36).slice(2, 8), who: [a, b], s: [301, 301], turn: 0, darts: 0, start: 301, win: -1, log: [], bust: false }; }

import { createCheckers, ckNew, ckMoves, ckApply, ckAI } from './hrcheckers.js';
export function createTown(c) {
  const { scene, hAt, H, P, mobile, msg, sfx, camera } = c, M = mats(), T = { structs: [], walls: [], spots: [], safe: [], towers: [], town: null, drunk: 0, drinks: 0, passT: 0, ui: null };
  H.town = T; H.safeRects = T.safe;
  // ---- structures: local (x, z) frame with a rotation (multiples of 90 deg), floors as boxes / ramps relative to the base height ----
  function struct(cx, cz, rot, y0) { const s = { cx, cz, rot, y0, c: Math.cos(rot), s: Math.sin(rot), floors: [], R: 0, geo: new Map() }; T.structs.push(s); return s; }
  const toW = (s, x, z) => [s.cx + x * s.c + z * s.s, s.cz - x * s.s + z * s.c], toL = (s, x, z) => { const dx = x - s.cx, dz = z - s.cz; return [dx * s.c - dz * s.s, dx * s.s + dz * s.c]; };
  function floor(s, x0, x1, z0, z1, ya, yb = ya, axis = 'x') { s.floors.push({ x0, x1, z0, z1, ya, yb, axis }); s.R = Math.max(s.R, Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(z0), Math.abs(z1))) + 2); }
  function wall(s, ax, az, bx, bz, ya, yb) { const [wx, wz] = toW(s, ax, az), [vx, vz] = toW(s, bx, bz); T.walls.push([wx, wz, vx, vz, s.y0 + ya, s.y0 + yb]); }
  function cyl(s, mat, x, y, z, r, h, n = 14) { const g = new THREE.CylinderGeometry(r, r, h, n); g.translate(x, y, z); if (!s.geo.has(mat)) s.geo.set(mat, []); s.geo.get(mat).push(g); }
  function box(s, mat, x, y, z, w, h, d, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); if (mat.map) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 2, uv.getY(i) * h / 2); } (s.geo.get(mat) || s.geo.set(mat, []).get(mat)).push(g); }
  function finish(s) { const g = new THREE.Group(); g.position.set(s.cx, s.y0, s.cz); g.rotation.y = s.rot; for (const [m, gs] of s.geo) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.castShadow = !mobile || m !== M.glass; me.receiveShadow = true; g.add(me); } s.geo.clear(); scene.add(g); s.g = g; return g; }
  function spot(s, x, y, z, kind, label, r = 1.6) { const [wx, wz] = toW(s, x, z), o = { x: wx, z: wz, y: s.y0 + y, kind, label, r, s }; T.spots.push(o); return o; }
  // highest walkable surface at (x, z) that is no more than a step above y (else the terrain)
  T.floorAt = (x, z, y) => { let g = hAt(x, z); for (const s of T.structs) { const dx = x - s.cx, dz = z - s.cz; if (dx * dx + dz * dz > s.R * s.R) continue; const [lx, lz] = toL(s, x, z);
      for (const f of s.floors) { if (lx < f.x0 || lx > f.x1 || lz < f.z0 || lz > f.z1) continue; const t = f.axis === 'x' ? (lx - f.x0) / (f.x1 - f.x0) : (lz - f.z0) / (f.z1 - f.z0), h = s.y0 + f.ya + (f.yb - f.ya) * t; if (h <= y + .62 && h > g) g = h; } } return g; };
  T.onStruct = (x, z, y) => T.floorAt(x, z, y) > hAt(x, z) + .25;
  T.wallHit = (x, z, r, y) => { for (const w of T.walls) { if (y + 1.7 < w[4] || y > w[5] - .05) continue; const ex = w[2] - w[0], ez = w[3] - w[1], L = ex * ex + ez * ez, t = L ? Math.max(0, Math.min(1, ((x - w[0]) * ex + (z - w[1]) * ez) / L)) : 0; if (Math.hypot(x - w[0] - ex * t, z - w[1] - ez * t) < r + .08) return true; } return false; };

  // ---- v34 fire lookout: a US Forest Service style steel tower (Aermotor-like) ----
  // Tapered galvanized lattice (4 angled legs, girts + X bracing every 4 m) on concrete footings; an external switchback
  // stair on the +z side (two 1.1 m lanes, 4 flights of 4 m, railed landings at each level, the foot at ground height);
  // a railed catwalk around a square wooden cab (windows on all four sides, door facing the top landing, pyramid roof).
  // Local frame: entry at (-4.6, 4.6) walking +x; the base height y0 is the ground at the entry.
  const TW = { L: 16, HW0: 3.6, HW1: 2.3, C: 2.4, K: 3.4, A: 4.6, B: 5.7, Z0: 4.05, Z1: 5.15, Z2: 6.25, X: 3, LX: 4.2 };
  T.TW = TW;
  T.entry = t => ({ foot: toW(t, -4.6, TW.A), out: toW(t, -8, TW.A), y: t.y0 });
  T.inFoot = (t, x, z, m = 0) => { const [lx, lz] = toL(t, x, z); return Math.abs(lx) < TW.LX + .6 + m && lz > -TW.K - .6 - m && lz < TW.Z2 + .4 + m; };
  function beam(s, mat, a, b, w, d = w) { const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = v.length(); if (len < 1e-3) return; const g = new THREE.BoxGeometry(w, len, d);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.multiplyScalar(1 / len))); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); (s.geo.get(mat) || s.geo.set(mat, []).get(mat)).push(g); }
  function rail(s, ax, az, bx, bz, y, col = true) { if (col) wall(s, ax, az, bx, bz, y, y + 1.1); const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.2));
    beam(s, M.steel, [ax, y + 1.05, az], [bx, y + 1.05, bz], .05); beam(s, M.steel, [ax, y + .55, az], [bx, y + .55, bz], .035); for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; beam(s, M.steel, [x, y, z], [x, y + 1.08, z], .05); } }
  function tower(cx, cz, kind, rot = 0) {
    const { L, HW0, HW1, C, K, A, B, Z0, Z1, Z2, X, LX } = TW; const s = struct(cx, cz, rot, 0); const gL = (x, z) => { const [wx, wz] = toW(s, x, z); return hAt(wx, wz); };
    s.y0 = gL(-4.6, A); s.kind = kind; T.towers.push(s); const G = (x, z) => gL(x, z) - s.y0, hw = y => HW0 + (HW1 - HW0) * Math.max(0, y) / L;
    // concrete footings + legs (each leg leans in from its footing to the top corner)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g0 = G(sx * HW0, sz * HW0), bx = sx * hw(g0), bz = sz * hw(g0); box(s, M.concrete, bx, g0 - .35, bz, .9, 1.3, .9);
      beam(s, M.steel, [bx, g0 + .3, bz], [sx * HW1, L, sz * HW1], .2); wall(s, bx, bz, bx, bz, g0 - 1, L); }
    // girts at each level + X bracing on every face, per level
    const lv = [0, 4, 8, 12, L]; for (let k = 0; k < lv.length - 1; k++) { const y0 = lv[k], y1 = lv[k + 1], h0 = hw(y0), h1 = hw(y1);
      for (const [ux, uz] of [[1, 0], [0, 1]]) for (const sg of [-1, 1]) { const P0 = (h, t, y) => ux ? [t * h, y, sg * h] : [sg * h, y, t * h];
        beam(s, M.steel, P0(h1, -1, y1), P0(h1, 1, y1), .1); if (k === 0) beam(s, M.steel, P0(h0, -1, y0 + .35), P0(h0, 1, y0 + .35), .1);
        beam(s, M.steel, P0(h0, -1, y0 + .35), P0(h1, 1, y1), .05); beam(s, M.steel, P0(h0, 1, y0 + .35), P0(h1, -1, y1), .05); } }
    // switchback stair: flights alternate lanes A (+x) / B (-x); landings at x = +-3..4.2 at 4, 8, 12 (and the top landing at 16)
    const gFoot = G(-X, A); // v34: the first tread sits on the ground at the foot (no lip), plus a concrete entry pad that meets the ground
    { const ge = G(-5.4, A); floor(s, -5.4, -X, A - .55, A + .55, ge, gFoot, 'x'); const lo = Math.min(ge, gFoot); box(s, M.concrete, (-5.4 - X) / 2, (ge + gFoot) / 2 - .5, A, 5.4 - X, 1.0, 1.2); }
    for (let i = 0; i < 4; i++) { const lane = i % 2 ? B : A, up = i % 2 === 0, ya = i === 0 ? gFoot : i * 4, yb = (i + 1) * 4, zl = lane - .55, zr = lane + .55;
      floor(s, -X, X, zl, zr, up ? ya : yb, up ? yb : ya, 'x');
      const n = Math.round((yb - ya) / .21); for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = up ? -X + 2 * X * t : X - 2 * X * t, y = ya + (yb - ya) * (k + 1) / n; box(s, M.grate, x, y - .03, lane, 2 * X / n + .05, .05, 1.0); }
      for (const ez of [zl + .04, zr - .04]) beam(s, M.steel, [up ? -X : X, ya - .15, ez], [up ? X : -X, yb - .15, ez], .06, .22); // stringers
      for (const ez of [zl, zr]) if (ez !== Z1 || up) beam(s, M.steel, [up ? -X : X, ya + 1, ez], [up ? X : -X, yb + 1, ez], .045); // sloped handrails
      if (i < 3) { const sx = up ? 1 : -1, lx0 = sx * X, lx1 = sx * LX; floor(s, Math.min(lx0, lx1), Math.max(lx0, lx1), Z0, Z2, yb); box(s, M.grate, (lx0 + lx1) / 2, yb - .04, (Z0 + Z2) / 2, LX - X, .08, Z2 - Z0);
        rail(s, lx1, Z0, lx1, Z2, yb); rail(s, lx0, Z0, lx1, Z0, yb); rail(s, lx0, Z2, lx1, Z2, yb); } }
    wall(s, -X, Z0, X, Z0, -3, L + 1.2); wall(s, -X, Z1, X, Z1, -3, L + 1.2); wall(s, -X, Z2, X, Z2, -3, L + 1.2); // stair sides: solid stringers + rails (never fall off)
    wall(s, -X, Z1 + .05, -X, Z2 - .05, -3, 3.6); wall(s, X, Z0 + .05, X, Z1 - .05, -3, 0); // no walking under the flights
    for (const [x, z] of [[LX, Z0], [LX, Z2], [-LX, Z0], [-LX, Z2], [X, Z2], [-X, Z2]]) { const g0 = G(x, z), top = x > 0 ? 12 : L; box(s, M.concrete, x, g0 - .3, z, .5, 1, .5); beam(s, M.steel, [x, g0, z], [x, top, z], .12); if (Math.abs(x) === LX) wall(s, x, z, x, z, g0 - 1, top); }
    // catwalk (railed, cantilevered round the cab) + the top landing that joins it
    floor(s, -K, K, -K, K, L); box(s, M.plank, 0, L - .08, 0, 2 * K, .16, 2 * K); floor(s, -LX, -2.2, 3.0, Z2, L); box(s, M.grate, -3.2, L - .05, (3.0 + Z2) / 2, 2.0, .1, Z2 - 3.0);
    for (const [ax, az, bx, bz] of [[K, -K, K, K], [-K, -K, K, -K], [-K, -K, -K, 3.0], [-2.2, K, K, K], [-LX, 3.0, -LX, Z2], [-LX, Z2, -X, Z2], [-LX, 3.0, -K, 3.0], [-2.2, K, -2.2, Z1]]) rail(s, ax, az, bx, bz, L);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam(s, M.steel, [sx * HW1, L - .1, sz * HW1], [sx * K, L - .1, sz * K], .12); // catwalk outriggers
    // the cab: weathered board siding to the sill, glass all round (steel mullions), header, pyramid roof, door on the +z side
    const HH = 2.6, door = [-1.6, -.4]; for (const [ax, az, bx, bz] of [[-C, -C, C, -C], [C, -C, C, C], [-C, -C, -C, C], [-C, C, door[0], C], [door[1], C, C, C]]) { wall(s, ax, az, bx, bz, L, L + HH);
      const w = Math.abs(bx - ax), d = Math.abs(bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, W = Math.max(w, d); box(s, M.wood, mx, L + .5, mz, (w || .1) + .1, 1, (d || .1) + .1); box(s, M.glass, mx, L + 1.55, mz, w || .04, 1.1, d || .04); box(s, M.wood, mx, L + 2.35, mz, (w || .1) + .1, .5, (d || .1) + .1);
      const nm = Math.max(1, Math.round(W / .9)); for (let k = 0; k <= nm; k++) { const t = k / nm, x = ax + (bx - ax) * t, z = az + (bz - az) * t; box(s, M.steel, x, L + 1.55, z, .05, 1.1, .05); } box(s, M.steel, mx, L + 1.02, mz, (w || .05) + .06, .05, (d || .05) + .06); }
    box(s, M.wood, door[0] - .05, L + 1.3, C, .1, 2.6, .12); box(s, M.wood, door[1] + .05, L + 1.3, C, .1, 2.6, .12); box(s, M.wood, (door[0] + door[1]) / 2, L + 2.25, C, door[1] - door[0], .3, .12); // door frame (open)
    { const g = new THREE.ConeGeometry((C + .55) * Math.SQRT2, 1.7, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, L + HH + .85, 0); (s.geo.get(M.roof) || s.geo.set(M.roof, []).get(M.roof)).push(g); }
    beam(s, M.iron, [0, L + HH + 1.6, 0], [0, L + HH + 2.4, 0], .03); box(s, M.wood, 0, L + .02, 0, 2 * C, .04, 2 * C); // lightning rod, cab floor
    if (kind === 'armory') { // desk with the Tommy gun, a box with the Golden Buffalo
      box(s, M.wood, 1.2, L + .78, -1.7, 1.7, .06, .8); for (const [x, z] of [[.45, -2], [1.95, -2], [.45, -1.4], [1.95, -1.4]]) box(s, M.dark, x, L + .38, z, .07, .76, .07); wall(s, .35, -1.3, 2.05, -1.3, L, L + .8);
      box(s, M.crate, -1.4, L + .3, -1.8, 1.5, .6, .6); wall(s, -2.15, -1.5, -.65, -1.5, L, L + .6);
      s.tommySpot = spot(s, 1.2, L, -.7, 'tommy', 'Take the Tommy gun', 1.5); s.goldSpot = spot(s, -1.4, L, -.9, 'gold', 'Take the Golden Buffalo', 1.5); }
    else { box(s, M.dark, 0, L + .55, -1.9, 3.2, 1.1, .7); wall(s, -1.6, -1.5, 1.6, -1.5, L, L + 1.1); const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), new THREE.MeshBasicMaterial({ map: signTex('GUN UPGRADES', '#2a1a0c', '#ffd77a'), toneMapped: false })); sg.position.set(0, L + 1.75, -2.3); s.signs = [sg];
      for (const [x, col] of [[-1, 0xcd7f32], [0, 0xc0c0c0], [1, 0xffd700]]) box(s, new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: .3 }), x, L + 1.18, -2.0, .4, .14, .3);
      s.shopSpot = spot(s, 0, L, -.8, 'shop', 'Gun upgrade station', 1.7); }
    const g = finish(s); for (const sg of s.signs || []) g.add(sg);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .45), new THREE.MeshStandardMaterial({ map: signTex(kind === 'armory' ? 'LOOKOUT No.1' : 'LOOKOUT No.2'), roughness: .8 })); lab.position.set(-4.3, 2.75, A); lab.rotation.y = -Math.PI / 2; box(s, M.steel, -4.25, 2.75, A, .06, .5, 2.2); g.add(lab); // sign at the stair foot
    return s; }

  // ---- the town: saloon + general store side by side, boardwalk porch, hitching rail ----
  function town(cx, cz, rot) {
    let gMax = -1e9; for (let x = -18; x <= 11; x += 1.5) for (let z = -4; z <= 11; z += 1.5) { const [wx, wz] = [cx + x * Math.cos(rot) + z * Math.sin(rot), cz - x * Math.sin(rot) + z * Math.cos(rot)]; gMax = Math.max(gMax, hAt(wx, wz)); }
    const s = struct(cx, cz, rot, gMax + .02), F = .45, WH = 4.3, Y2 = F + 3.6; s.kind = 'town'; T.town = s; s.F = F; s.Y2 = Y2; // v35: the saloon is bigger (x -17..-1, z 0..10) with an upper floor at Y2
    for (let x = -18; x <= 11; x += 2) for (let z = -3.4; z <= 10.6; z += 2) box(s, M.dark, x, (F - 2.5) / 2, z, .24, 2.5 + F, .24); // stilts down to the ground
    floor(s, -17.2, 10.2, -2.4, 10, F); box(s, M.plank, -3.5, F - .06, 3.8, 27.4, .12, 12.8); // boardwalk + floors
    floor(s, -17.2, 10.2, -3.4, -2.4, 0, F, 'z'); box(s, M.plank, -3.5, F / 2 - .05, -2.9, 27.4, .1, 1);
    for (const [x0, x1, door, name, D, HT] of [[-17, -1, [-6.8, -5.2], 'SALOON', 10, 7.6], [1, 10, [4.7, 6.3], 'GENERAL STORE', 8, WH]]) { const mx = (x0 + x1) / 2, w = x1 - x0, sal = name === 'SALOON';
      for (const [ax, az, bx, bz] of [[x0, D, x1, D], [x0, 0, x0, D], [x1, 0, x1, D], [x0, 0, door[0], 0], [door[1], 0, x1, 0]]) { wall(s, ax, az, bx, bz, F, F + HT); if(az===0&&bz===0){const holes=[];for(const x of [x0+1.6,x1-1.6])if(x<door[0]-.8||x>door[1]+.8)holes.push([x-.7,x+.7,F+1.1,F+2.3]);if(sal)for(const x of [-15.5,-12.5,-9.5,-3.5])holes.push([x-.6,x+.6,Y2+.95,Y2+2.05]);const cuts=[ax,bx,...holes.flatMap(h=>[Math.max(ax,h[0]),Math.min(bx,h[1])]).filter(x=>x>ax&&x<bx)].sort((a,b)=>a-b);for(let k=0;k<cuts.length-1;k++){const l=cuts[k],r=cuts[k+1];if(r-l<.001)continue;const open=holes.filter(h=>h[0]<(l+r)/2&&h[1]>(l+r)/2).sort((a,b)=>a[2]-b[2]);let y=F;for(const h of open){if(h[2]>y)box(s,M.plank,(l+r)/2,(y+h[2])/2,0,r-l,h[2]-y,.16);y=Math.max(y,h[3]);}if(y<F+HT)box(s,M.plank,(l+r)/2,(y+F+HT)/2,0,r-l,F+HT-y,.16);}}else box(s,M.plank,(ax+bx)/2,F+HT/2,(az+bz)/2,Math.abs(bx-ax)+.16,HT,Math.abs(bz-az)+.16); }
      if (sal) box(s, M.plank, (door[0] + door[1]) / 2, F + 2.9 + (HT - 2.9) / 2, 0, door[1] - door[0] + .2, HT - 2.9, .16); // wall above the door
      box(s, M.plank, mx, F + HT + 1.2, 0, w + .2, 2.4, .2); box(s, M.roof, mx, F + HT + .15, D / 2, w + .6, .2, D + .6); box(s, M.dark, mx, F + 2.9, -1.3, w + .2, .12, 2.6); // false front, roof, porch roof
      for (const x of [x0 + .2, mx, x1 - .2]) box(s, M.dark, x, F + 1.4, -2.3, .14, 2.9, .14);
      for (const x of [x0 + 1.6, x1 - 1.6]) if (x < door[0] - .8 || x > door[1] + .8) box(s, M.glass, x, F + 1.7, -.02, 1.4, 1.2, .06);
      if (sal) for (const x of [-15.5, -12.5, -9.5, -3.5]) box(s, M.glass, x, Y2 + 1.5, -.02, 1.2, 1.1, .06); // upstairs windows
      if (!sal) for (const k of [0, 1]) box(s, M.dark, door[k] + (k ? -.38 : .38), F + 1.25, -.05, .72, 1.1, .05); // batwing doors (the saloon's swing: src/hrsaloon.js)
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1, 7.5), 1.1), new THREE.MeshStandardMaterial({ map: signTex(name, sal ? '#5a1a12' : '#1a2a3a'), roughness: .8 })); sg.position.set(mx, F + HT + 1.2, -.12); sg.rotation.y = Math.PI; (s.signs = s.signs || []).push(sg); }
    // ---- v35 saloon interior: upper floor (mezzanine) over the left third, a stair up along its edge, balcony rail; the back bar with mirror + bottles
    floor(s, -17, -11.5, 0, 10, Y2); box(s, M.plank, -14.25, Y2 - .1, 5, 5.5, .2, 10); for (const z of [1, 3.5, 6, 8.5]) box(s, M.dark, -14.25, Y2 - .32, z, 5.5, .24, .2); // floor + joists
    for (const z of [.25, 2.8]) box(s, M.dark, -11.55, F + (Y2 - F) / 2, z, .22, Y2 - F, .22); // posts
    floor(s, -11.5, -10.4, 2.8, 8.4, F, Y2, 'z'); floor(s, -11.5, -10.4, 8.4, 10, Y2); box(s, M.plank, -10.95, Y2 - .08, 9.2, 1.1, .16, 1.6);
    { const n = 17; for (let k = 0; k < n; k++) { const z = 2.8 + (k + .5) * 5.6 / n, y = F + (Y2 - F) * (k + 1) / n; box(s, M.plank, -10.95, y - .05, z, 1.1, .1, 5.6 / n + .04); }
      for (const x of [-11.5, -10.4]) { const g = new THREE.Vector3(); beam(s, M.dark, [x, F + .1, 2.8], [x, Y2 - .1, 8.4], .08, .3); } }
    wall(s, -10.4, 2.8, -10.4, 10, F, Y2 + 1.1); wall(s, -11.5, 2.8, -11.5, 8.4, F, Y2 + 1.1); wall(s, -11.5, 0, -11.5, 2.8, Y2, Y2 + 1.1); // stair sides + balcony rail (solid)
    beam(s, M.dark, [-10.4, F + 1.05, 2.8], [-10.4, Y2 + 1.05, 8.4], .07); beam(s, M.dark, [-10.4, Y2 + 1.05, 8.4], [-10.4, Y2 + 1.05, 10], .07); beam(s, M.dark, [-11.5, Y2 + 1.05, 0], [-11.5, Y2 + 1.05, 2.8], .08);
    for (let z = .3; z <= 2.8; z += .35) box(s, M.dark, -11.5, Y2 + .5, z, .05, 1, .05); for (let z = 8.6; z <= 10; z += .35) box(s, M.dark, -10.4, Y2 + .5, z, .05, 1, .05);
    for (let k = 0; k <= 8; k++) { const z = 2.8 + k * .7, y = F + (Y2 - F) * k / 8; box(s, M.dark, -10.4, y + .55, z, .05, 1.05, .05); }
    // bar: counter with a brass foot rail + top edge, back bar (shelves, bottles, mirror), antlers + skull over it
    box(s, M.dark, -7, F + .55, 5.5, 6, 1.1, .6); wall(s, -10, 5.5, -4, 5.5, F, F + 1.1); box(s, M.brass, -7, F + .2, 5.12, 6, .06, .06); box(s, M.brass, -7, F + 1.12, 5.2, 6.05, .04, .1); for (let x = -9.7; x <= -4.2; x += 1.1) box(s, M.brass, x, F + .1, 5.17, .04, .2, .04);
    box(s, M.dark, -7, F + .5, 9.55, 6.2, 1, .7); box(s, M.mirror, -7, F + 1.95, 9.92, 4.8, 1.3, .04); for (const y of [F + 1.35, F + 2.75, F + 3.2]) box(s, M.dark, -7, y, 9.75, 6.2, .05, .4);
    { const r = rng(7), bc = [M.bGreen, M.bAmber, M.glass, M.bGreen, M.bAmber]; for (const y of [F + 1.38, F + 2.78]) for (let i = 0; i < 22; i++) { const x = -9.9 + i * .27 + r() * .05; if (y < 2 && x > -9.4 && x < -4.6) continue; box(s, bc[(r() * 5) | 0], x, y + .17, 9.75, .08, .3 + r() * .08, .08); }
      for (let i = 0; i < 14; i++) box(s, bc[i % 5], -9.6 + i * .2, F + 1.17, 9.5, .07, .26, .07); }
    box(s, M.bone, -7, F + 4.0, 9.85, .32, .26, .32); beam(s, M.bone, [-7.1, F + 4.08, 9.8], [-7.9, F + 4.5, 9.75], .05); beam(s, M.bone, [-6.9, F + 4.08, 9.8], [-6.1, F + 4.5, 9.75], .05); beam(s, M.bone, [-7.6, F + 4.33, 9.8], [-7.7, F + 4.7, 9.75], .04); beam(s, M.bone, [-6.4, F + 4.33, 9.8], [-6.3, F + 4.7, 9.75], .04); box(s, M.dark, -7, F + 4.05, 9.95, .6, .5, .05);
    // round tables + chairs, a piano, spittoons, the bandits' table (under the upper floor), the dealer's dim corner, a small stage
    const rtable = (x, z, chairs = 4) => { cyl(s, M.dark, x, F + .74, z, .55, .05); cyl(s, M.dark, x, F + .37, z, .07, .74); cyl(s, M.dark, x, F + .02, z, .3, .04); wall(s, x - .3, z, x + .3, z, F, F + .9);
      for (let k = 0; k < chairs; k++) { const a = k / chairs * TAU + .4, cx2 = x + Math.cos(a) * .85, cz2 = z + Math.sin(a) * .85; box(s, M.dark, cx2, F + .45, cz2, .42, .05, .42, -a); box(s, M.dark, cx2 + Math.cos(a) * .2, F + .75, cz2 + Math.sin(a) * .2, .06, .6, .4, -a); for (const [u, v] of [[-.16, -.16], [.16, -.16], [-.16, .16], [.16, .16]]) box(s, M.dark, cx2 + u, F + .22, cz2 + v, .04, .44, .04); } };
    rtable(-4.2, 1.6); rtable(-3, 7.2, 3); rtable(-14.2, 6.2, 4); rtable(-8.6, 8.1, 0);
    box(s, M.black, -1.75, F + .7, 8.6, .55, 1.4, 1.6); box(s, M.black, -1.75, F + 1.45, 8.6, .6, .1, 1.65); box(s, M.ivory, -2.07, F + .82, 8.6, .12, .04, 1.4); for (let k = 0; k < 10; k++) box(s, M.black, -2.08, F + .85, 7.98 + k * .14, .08, .03, .05);
    cyl(s, M.dark, -2.7, F + .3, 8.6, .2, .6); // piano + stool
    for (const [x, z] of [[-9.9, 4.8], [-4.1, 4.8], [-12.2, 9.5]]) { cyl(s, M.brass, x, F + .12, z, .17, .24); cyl(s, M.brass, x, F + .25, z, .12, .03); }
    box(s, M.plank, -15.4, F + .2, 1.9, 3.2, .4, 2.8); floor(s, -17, -13.8, .5, 3.3, F + .4); wall(s, -13.8, .5, -13.8, 3.3, F, F + .35); box(s, M.red, -16.95, F + 2, 1.9, .06, 3.1, 2.8); // stage + curtain
    box(s, M.dark, -16.3, F + .5, 8.8, .9, 1, 1.6); box(s, M.dark, -16.4, F + 1.1, 9.6, .5, .04, .5); // dealer's crate table in the dark corner
    // upstairs: three slot machines on stools along the left wall (the machines themselves: src/hrsaloon.js), a settee, rail
    for (const z of [3, 5.2, 7.4]) { cyl(s, M.dark, -15.25, Y2 + .35, z, .2, .7); cyl(s, M.red, -15.25, Y2 + .72, z, .23, .06); wall(s, -16.95, z - .5, -16.2, z - .5, Y2, Y2 + 2); wall(s, -16.95, z + .5, -16.2, z + .5, Y2, Y2 + 2); wall(s, -16.2, z - .5, -16.2, z + .5, Y2, Y2 + 1.2); }
    box(s, M.red, -13, Y2 + .3, 9.5, 2, .5, .6); box(s, M.red, -13, Y2 + .7, 9.8, 2, .5, .15);
    // kerosene lamps (2 warm lights, no shadows), light shafts + dust are in src/hrsaloon.js
    for (const [x, y, z] of [[-7, F + 3.2, 3], [-4, F + 3.2, 7], [-14.2, Y2 - .5, 6.2], [-14, Y2 + 2.4, 5]]) { box(s, M.iron, x, y + .45, z, .02, .7, .02); box(s, M.lamp, x, y, z, .16, .24, .16); box(s, M.brass, x, y - .14, z, .22, .04, .22); }
    // wanted posters
    for (const [x, y, z, ry, name] of [[-1.12, F + 1.8, 6.5, -Math.PI / 2, 'BLACK BART'], [-16.95, F + 1.8, 5, Math.PI / 2, 'THE KID'], [-9.2, F + 2, .1, 0, 'DUTCH']]) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(.6, .8), new THREE.MeshStandardMaterial({ map: wantedTex(name), roughness: .95 })); pm.position.set(x, y, z); pm.rotation.y = ry; s.signs.push(pm); }
    const board = new THREE.Mesh(new THREE.CircleGeometry(.23, 40), new THREE.MeshStandardMaterial({ map: dartTex(), roughness: .9 })); board.position.set(-1.12, F + 1.73, 3.5); board.rotation.y = -Math.PI / 2; (s.signs = s.signs || []).push(board);
    box(s, M.dark, 5.5, F + .55, 5.5, 6, 1.1, .6); wall(s, 2.5, 5.5, 8.5, 5.5, F, F + 1.1); for (let i = 0; i < 5; i++) box(s, M.crate, 2.3 + i * 1.3, F + 1.9, 7.6, 1, .5, .6);
    { box(s, M.dark, -9, F + .74, 2.6, 1.1, .06, 1.1); box(s, M.dark, -9, F + .37, 2.6, .12, .74, .12); for (const z of [1.75, 3.45]) { box(s, M.dark, -9, F + .45, z, .45, .05, .45); box(s, M.dark, -9, F + .22, z, .06, .44, .06); } // checkers table + two chairs
      const ckb = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), new THREE.MeshStandardMaterial({ map: ckTex(), roughness: .7 })); ckb.rotation.x = -Math.PI / 2; ckb.position.set(-9, F + .776, 2.6); s.signs.push(ckb); }
    box(s, M.iron, 8.6, F + .8, 2.4, .05, 1.6, .05);
    box(s, M.dark, -6, .55, -5.2, 6, .1, .12); for (const x of [-9, -3]) box(s, M.dark, x, .5, -5.2, .14, 1.05, .14); wall(s, -9, -5.2, -3, -5.2, -1, 1.05); // hitching rail
    for (const x of [-8.5, 7.5]) box(s, M.lamp, x, F + 2.6, -.25, .12, .2, .12);
    const g = finish(s); for (const sg of s.signs) g.add(sg); T.board = board;
    s.ckSpot = spot(s, -9, F, 1.5, 'checkers', 'Play checkers', 1.3);
    s.drinkSpot = spot(s, -7, F, 4.5, 'drink', 'Order a whiskey', 1.6); s.dartSpot = spot(s, -2.6, F, 3.5, 'darts', 'Play darts', 1.5); s.storeSpot = spot(s, 5.5, F, 4.5, 'store', 'General store', 1.7);
    const [ax, az] = toW(s, -3.5, 3.6), hw = 19, hd = 13.5, wide = Math.abs(Math.sin(rot)) > .5; T.safe.push({ x: ax, z: az, hw: wide ? hd : hw, hd: wide ? hw : hd, town: true });
    T.npcAt = [[toW(s, -7, 6.5), s.y0 + F, rot], [toW(s, 5.5, 6.5), s.y0 + F, rot]]; // bartender, storekeeper (facing the room)
    return s; }
  function wantedTex(name) { return canvasTex(192, 256, (x, w, h) => { x.fillStyle = '#d9c59a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(90,60,20,.25)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 6, 6);
    x.fillStyle = '#2a1a0c'; x.textAlign = 'center'; x.font = 'bold 34px Georgia,serif'; x.fillText('WANTED', w / 2, 40); x.font = '14px Georgia,serif'; x.fillText('DEAD OR ALIVE', w / 2, 60); x.beginPath(); x.arc(w / 2, 115, 32, 0, TAU); x.fill(); x.fillRect(w / 2 - 45, 145, 90, 40);
    x.fillStyle = '#d9c59a'; x.fillRect(w / 2 - 36, 106, 72, 8); x.fillStyle = '#2a1a0c'; x.font = 'bold 18px Georgia,serif'; x.fillText(name, w / 2, 210); x.font = 'bold 22px Georgia,serif'; x.fillText('$500 REWARD', w / 2, 238); }); }
  function ckTex() { return canvasTex(256, 256, (x, w) => { const q = w / 8; for (let r = 0; r < 8; r++) for (let cc = 0; cc < 8; cc++) { x.fillStyle = (r + cc) % 2 ? '#5b3a1f' : '#e2cc98'; x.fillRect(cc * q, r * q, q, q); if ((r + cc) % 2 && (r < 3 || r > 4)) { x.fillStyle = r < 3 ? '#1d1d1d' : '#c0392b'; x.beginPath(); x.arc(cc * q + q / 2, r * q + q / 2, q * .36, 0, TAU); x.fill(); } } }); }
  function dartTex() { return canvasTex(256, 256, (x, w) => { const c = w / 2, R = c * .98, k = R / 170; x.fillStyle = '#111'; x.beginPath(); x.arc(c, c, R, 0, TAU); x.fill();
    for (let i = 0; i < 20; i++) { const a0 = (i * 18 - 9 - 90) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180, dark = i % 2 === 0;
      for (const [r0, r1, col] of [[15.9, 99, dark ? '#1a1a1a' : '#efe2c0'], [99, 107, dark ? '#c0281e' : '#1f7a3a'], [107, 162, dark ? '#1a1a1a' : '#efe2c0'], [162, 170, dark ? '#c0281e' : '#1f7a3a']]) { x.fillStyle = col; x.beginPath(); x.arc(c, c, r1 * k, a0, a1); x.arc(c, c, r0 * k, a1, a0, true); x.fill(); } }
    x.fillStyle = '#1f7a3a'; x.beginPath(); x.arc(c, c, 15.9 * k, 0, TAU); x.fill(); x.fillStyle = '#c0281e'; x.beginPath(); x.arc(c, c, 6.35 * k, 0, TAU); x.fill(); }); }

  // ---- interaction ----
  T.nearSpot = () => { if (H.mounted) return null; let best = null, bd = 1e9; for (const o of T.spots) { if (Math.abs(P.pos.y - o.y) > 1.3) continue; const d = Math.hypot(P.pos.x - o.x, P.pos.z - o.z); if (d < o.r && d < bd) { bd = d; best = o; } } return best; };
  T.label = o => !o ? '' : o.kind === 'tommy' && H.guns && H.guns.state.owned.tommy ? '' : o.kind === 'gold' && H.guns && H.guns.state.owned.gold ? '' : o.label;
  // hotfix: every interactable gets an on-screen button (phones had none for the v35 saloon spots); unknown kinds fall back to USE
  T.TL = { tommy: 'TAKE<small>TOMMY GUN</small>', gold: 'TAKE<small>GOLD BUFFALO</small>', shop: 'UPGRADES', drink: 'DRINK', darts: 'PLAY<small>DARTS</small>', checkers: 'PLAY<small>CHECKERS</small>', store: 'STORE' };
  T.touchLabel = o => !o ? '' : T.TL[o.kind] || (T.label(o) ? 'USE' : '');
  T.touchText = o => T.touchLabel(o).replace(/<small>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  T.use = () => { const o = T.nearSpot(); if (!o || !T.label(o)) return false; const g = H.guns; if (T.onUse && T.onUse(o)) { sfx.ui && sfx.ui(); return true; }
    if (o.kind === 'tommy') { g.give('tommy'); g.draw('tommy'); msg('Tommy gun — 100-round drum, full auto (4)', 3); if (o.s.tommyMesh) o.s.tommyMesh.visible = false; }
    else if (o.kind === 'gold') { g.give('gold'); g.draw('gold'); msg('The Golden Buffalo — aim, then scroll / pinch / + − to zoom across the map (5)', 4); if (o.s.goldMesh) o.s.goldMesh.visible = false; }
    else if (o.kind === 'shop') openShop('guns'); else if (o.kind === 'store') openShop('store'); else if (o.kind === 'drink') drink(); else if (o.kind === 'darts') openDarts(); else if (o.kind === 'checkers') ck.open();
    sfx.ui && sfx.ui(); return true; };
  // show the actual gun models on the desk / in the box (each rider takes their own copy)
  T.dressGuns = models => { const s = T.towers.find(t => t.kind === 'armory'); if (!s || s.tommyMesh) return;
    const tm = models.tommy.group.clone(); tm.visible = true; tm.scale.setScalar(1.2); tm.rotation.set(0, Math.PI / 2, Math.PI / 2); tm.position.set(1.2, 16.86, -1.7); s.g.add(tm); s.tommyMesh = tm;
    const gm = models.gold.group.clone(); gm.visible = true; gm.scale.setScalar(1.15); gm.rotation.set(0, Math.PI / 2, Math.PI / 2); gm.position.set(-1.4, 16.64, -1.8); s.g.add(gm); s.goldMesh = gm;
    if (H.guns.state.owned.tommy) tm.visible = false; if (H.guns.state.owned.gold) gm.visible = false; };

  // ---- shops (touch friendly): gun upgrades + guns for sale at tower 2, the jacket at the general store ----
  const $ = id => document.getElementById(id); let shopEl = null;
  function closeUI() { if (shopEl) shopEl.hidden = true; T.ui = null; H.uiOpen = false; }
  function openShop(which) { if (!shopEl) { shopEl = document.createElement('div'); shopEl.id = 'hrShop'; document.body.appendChild(shopEl); shopEl.addEventListener('pointerdown', e => e.stopPropagation());
      shopEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a, w = b.dataset.w, g = H.guns;
        if (a === 'x') return closeUI(); if (a === 'buy') g.purchase(w); else if (a === 'up') g.upgrade(w); else if (a === 'jacket') buyJacket(); else if(a==='extra'){const item=T.extraStoreItems?.find(i=>i.state.id===b.dataset.id);if(item)(item.state.owned?item.toggle():item.buy());} else if (a === 'wear') { T.wear = !T.wear; save(); c.jacket && c.jacket(T.wear); } render(); }); }
    T.ui = which; H.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock(); shopEl.hidden = false; render(); }
  function render() { if (!shopEl || shopEl.hidden) return; const g = H.guns, S = g.state, pts = g.pts(), TN = ['', 'BRONZE', 'SILVER', 'GOLD'], cls = ['', 'b', 's', 'g'];
    let h = `<button class="x" data-a="x">✕</button>`;
    if (T.ui === 'guns') { h += `<h3>GUN UPGRADE STATION</h3><div class="pt">${pts} points · zombie kills +10 (headshot +15)</div>`;
      for (const w of ['tommy', 'gold']) if (!S.owned[w]) h += `<div class="row"><span class="nm">${({ tommy: 'Tommy gun · 100-round drum', gold: 'Golden Buffalo · huge zoom' })[w]}</span><button data-a="buy" data-w="${w}" ${pts < g.PRICE[w] ? 'disabled' : ''}>BUY ${g.PRICE[w]}</button></div>`;
      for (const w of ['revolver', 'rifle', 'sniper', 'tommy', 'gold']) { if (!S.owned[w]) continue; const t = g.tier(w); h += `<div class="row"><span class="nm">${({ revolver: 'Six-shooter', rifle: 'Lever rifle', sniper: 'Buffalo rifle', tommy: 'Tommy gun', gold: 'Golden Buffalo' })[w]} ${t ? '· ' + TN[t] : ''}</span>` +
        (t < 3 ? `<button class="${cls[t + 1]}" data-a="up" data-w="${w}" ${pts < g.UP_COST[w][t] ? 'disabled' : ''}>${TN[t + 1]} ${g.UP_COST[w][t]}</button>` : '<span>MAXED</span>') + '</div>'; }
      h += '<div style="opacity:.7;font-size:12px">Each tier: more damage, a bigger magazine, faster reloads and fire rate.</div>'; }
    else { h += `<h3>GENERAL STORE</h3><div class="pt">${pts} points</div><div class="row"><span class="nm">Black windbreaker · HORSE RIDER on the back</span>` + (T.jacket ? `<button data-a="wear">${T.wear ? 'TAKE OFF' : 'WEAR'}</button>` : `<button data-a="jacket" ${pts < TOWN_PRICES.jacket ? 'disabled' : ''}>BUY ${TOWN_PRICES.jacket}</button>`) + '</div>'; }
    if(T.ui==='store')for(const item of T.extraStoreItems||[]){const i=item.state,name=String(i.name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));h+=`<div class="row"><span class="nm">${name}</span><button data-a="extra" data-id="${i.id}" ${!i.owned&&pts<i.price?'disabled':''}>${i.owned?(i.equipped?'REMOVE':'EQUIP'):'BUY '+i.price}</button></div>`;}
    shopEl.innerHTML = h; }
  function buyJacket() { const g = H.guns; if (T.jacket) return; if (g.pts() < TOWN_PRICES.jacket) { msg('Not enough points', 1.5); return; } g.state.spent += TOWN_PRICES.jacket; T.jacket = true; T.wear = true; save(); c.jacket && c.jacket(true); msg('Black HORSE RIDER windbreaker — looking sharp', 3); }
  T.save = () => save();
  function save() { try { localStorage.setItem('hr_v33_town', JSON.stringify({ jacket: !!T.jacket, wear: !!T.wear })); if (H.guns) H.guns.save && H.guns.save(); } catch (_) {} }
  try { const sv = JSON.parse(localStorage.getItem('hr_v33_town') || sessionStorage.getItem('hr_v33_town') || 'null'); if (sv) { T.jacket = !!sv.jacket; T.wear = !!sv.wear; } } catch (_) {}
  addEventListener('keydown', e => { if (e.code === 'Escape' && T.ui) closeUI(); });

  // ---- drinks: the more you drink the worse it gets; it wears off slowly (each drink adds time) ----
  function drink() { const g = H.guns; if (g.pts() < TOWN_PRICES.drink) { msg('A whiskey is ' + TOWN_PRICES.drink + ' points', 1.5); return; } g.state.spent += TOWN_PRICES.drink; save();
    T.drinks++; T.drunk += 1; msg(T.drunk < 2 ? 'Whiskey. Smooth.' : T.drunk < 4 ? 'Another one… the room is moving' : T.drunk < 6 ? 'You are properly drunk' : T.drunk < 8 ? 'You can barely walk straight' : T.drunk < 11 ? 'Everything is spinning… three of everything' : T.drunk < 13 ? 'Barkeep: "Last one, partner."' : 'Too much…', 2); if (sfx.tone && sfx.ctx) sfx.tone('sine', 300, 180, .2, .2); }
  T.tick = dt => { if (T.passT > 0) { T.passT -= dt; T.black = Math.min(1, (T.black || 0) + dt * 1.5); if (T.passT <= 0) wake(); }
    else { T.black = Math.max(0, (T.black || 0) - dt * .5); if (T.drunk >= T.PASS && !H.mounted) passOut(); }
    T.drunk = Math.max(0, T.drunk - dt / 75); // 75 s per drink: three drinks stay with you ~3.75 minutes, it stacks
    ck.tick(dt);
    if (T.drunk > 1.2 && (T.hicT = (T.hicT || 3) - dt) <= 0) { T.hicT = 2 + Math.random() * Math.max(1.5, 9 - T.drunk); T.hic = .25; if (sfx.tone && sfx.ctx) { sfx.tone('square', 520, 260, .06, .06); sfx.tone('sine', 260, 180, .1, .08); } }
    T.hic = Math.max(0, (T.hic || 0) - dt); let bl = $('hrBlack'); if (!bl) { bl = document.createElement('div'); bl.id = 'hrBlack'; bl.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:39;opacity:0'; document.body.appendChild(bl); } bl.style.opacity = (T.black || 0).toFixed(2);
    if (T.dart || (dEl && !dEl.hidden)) dartTick(dt); for (const W of T.npcs) if (Math.hypot(W.m.position.x - camera.position.x, W.m.position.z - camera.position.z) < 60) W.update(dt, 0); };
  function passOut() { T.passT = 5; T.passes = (T.passes || 0) + 1; msg('You passed out…', 4); if (H.guns) H.guns.holster(); closeUI(); }
  function wake() { const s = T.town; if (s) { const [x, z] = toW(s, -6, -4.2); P.pos.set(x, T.floorAt(x, z, 1e9), z); } T.drunk = 3.2; msg('You wake up outside the saloon. Your head is pounding.', 4); }
  T.npcs = []; T.dressNPC = mk => { if (T.npcs.length || !T.npcAt) return; for (const [[x, z], y, rot] of T.npcAt) { const W = mk(); if (!W) return; W.m.position.set(x, y, z); W.m.rotation.y = rot + Math.PI; scene.add(W.m); W.start && W.start(); T.npcs.push(W); } };
  T.level = () => T.drunk; T.PASS = 14; // 0 sober .. 14+ (passes out; v34 raised from 8)

  // ---- darts: 301 against the bartender (skill varies) or another rider (host-authoritative over the co-op link) ----
  let dEl = null, cv = null, ctx2 = null; const D = { aim: [0, 0], ptr: [0, 0], t: 0, flying: null };
  function openDarts(game) { if (!dEl) { dEl = document.createElement('div'); dEl.id = 'hrDarts'; dEl.innerHTML = '<canvas width="360" height="360"></canvas><div class="sb"></div><div class="bt"><button data-a="ai">VS BARTENDER</button><span class="pv"></span><button data-a="x">EXIT</button></div>'; document.body.appendChild(dEl);
      cv = dEl.querySelector('canvas'); ctx2 = cv.getContext('2d'); const pos = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width - .5) * 2 * 200, -((e.clientY - r.top) / r.height - .5) * 2 * 200]; };
      cv.addEventListener('pointermove', e => { D.ptr = pos(e); }); cv.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); D.ptr = pos(e); D.hold = true; });
      cv.addEventListener('pointerup', e => { e.preventDefault(); if (D.hold) throwDart(); D.hold = false; });
      dEl.addEventListener('pointerdown', e => e.stopPropagation()); dEl.querySelector('.bt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'x') { if (T.dart && T.dart.who.includes(me())) netOut({ a: 'q' }); closeDarts(); } else if (b.dataset.a === 'ai') netOut({ a: 'ai' }); else if (b.dataset.a === 'pv') netOut({ a: 'ch', to: b.dataset.id }); }); }
    T.ui = 'darts'; H.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock(); dEl.hidden = false; if (game) T.dart = game; dartUI(); }
  function closeDarts() { if (dEl) dEl.hidden = true; T.ui = null; H.uiOpen = false; }
  const me = () => H.me || 'P1', role = () => H.netRole ? H.netRole() : 'solo', isAuth = () => role() !== 'client';
  function sway() { const k = 1 + T.drunk * .9 + T.drunk * T.drunk * .12, t = D.t; return [Math.sin(t * 1.3) * 9 * k + Math.sin(t * 3.1 + 1) * 4 * k, Math.sin(t * 1.7 + .6) * 8 * k + Math.cos(t * 2.6) * 4 * k]; }
  T.dartSway = () => { const s = sway(); return Math.hypot(...s); };
  function throwDart() { const G = T.dart; if (!G || G.win >= 0 || G.who[G.turn] !== me()) return; const [sx, sy] = sway(); const x = D.ptr[0] + sx + (Math.random() - .5) * 8, y = D.ptr[1] + sy + (Math.random() - .5) * 8; netOut({ a: 'th', x: +x.toFixed(1), y: +y.toFixed(1) }); }
  // authority: the host (or a solo player) runs every match
  const games = new Map(); T.games = games;
  const ck = T.ck = createCheckers({ H, msg, sfx, send: m => c.send && c.send(m), level: () => T.drunk, spot: () => T.town.ckSpot });
  function netOut(m) { if (isAuth()) netIn(m, me()); else c.send && c.send({ t: 'dt', ...m }); }
  function bcast(G) { const st = { t: 'dts', g: G }; if (c.send && role() === 'host') c.send(st); netState(st); }
  function netIn(m, from) { if (!m || !from) return; let G = [...games.values()].find(g => g.who.includes(from) && g.win < 0);
    if (m.a === 'ai') { if (G) games.delete(G.id); G = newGame(from, 'BARKEEP'); G.skill = 14 + Math.random() * 22; games.set(G.id, G); bcast(G); return; }
    if (m.a === 'ch' && typeof m.to === 'string') { if (G) games.delete(G.id); G = newGame(from, m.to.slice(0, 4)); games.set(G.id, G); bcast(G); return; }
    if (!G) return; if (m.a === 'q') { G.win = -2; games.delete(G.id); bcast(G); return; }
    if (m.a === 'th' && G.who[G.turn] === from && Number.isFinite(m.x) && Number.isFinite(m.y)) { const r = dartScore(Math.max(-400, Math.min(400, m.x)), Math.max(-400, Math.min(400, m.y))); G.last = { x: m.x, y: m.y, ...r, p: G.turn }; G.bust = false; applyDart(G, r.pts); bcast(G); if (G.win >= 0) games.delete(G.id); } }
  function netState(m) { const G = m && m.g; if (!G || !Array.isArray(G.who)) return; if (G.who.includes(me())) { if (G.win === -2) { if (T.dart && T.dart.id === G.id) { T.dart = null; msg('Darts: match over', 1.5); } dartUI(); return; } T.dart = G; if (!dEl || dEl.hidden) openDarts(G); dartUI(); if (G.last) D.flying = { ...G.last, t: .35 }; } }
  T.netIn = netIn; T.netState = netState; T.dartSend = netOut;
  function dartTick(dt) { D.t += dt; const G = T.dart; if (isAuth() && G && G.win < 0 && G.who[G.turn] === 'BARKEEP' && games.has(G.id)) { G.aiT = (G.aiT || 0) + dt; if (G.aiT > 1.1) { G.aiT = 0; const [ax, ay] = aiTarget(G.s[G.turn]), gau = () => { let u = 0; for (let i = 0; i < 4; i++) u += Math.random() - .5; return u * 1.2; };
      const x = ax + gau() * G.skill, y = ay + gau() * G.skill, r = dartScore(x, y); G.last = { x, y, ...r, p: G.turn }; G.bust = false; applyDart(G, r.pts); bcast(G); if (G.win >= 0) games.delete(G.id); } }
    if (D.flying) D.flying.t -= dt; drawBoard(); }
  function dartUI() { if (!dEl || dEl.hidden) return; const G = T.dart, sb = dEl.querySelector('.sb'), pv = dEl.querySelector('.pv');
    if (!G) sb.innerHTML = '301 · three darts a turn · finish on exactly 0 (going under busts the turn)'; else { const nm = i => G.who[i] === me() ? 'YOU' : G.who[i]; sb.innerHTML = `${nm(0)} <b>${G.s[0]}</b> · ${nm(1)} <b>${G.s[1]}</b> · ` + (G.win >= 0 ? `<b>${nm(G.win)} WIN${G.who[G.win] === me() ? '!' : 'S'}</b>` : `${nm(G.turn)} to throw (${3 - G.darts} left)${G.bust ? ' · BUST' : ''}${G.last ? ' · last ' + G.last.label : ''}`); }
    const near = (H.netRemotes ? H.netRemotes() : []).filter(r => r.s && T.town && Math.hypot(r.s.x - T.dartSpot().x, r.s.z - T.dartSpot().z) < 12); pv.innerHTML = near.map(r => `<button data-a="pv" data-id="${r.id}">VS ${r.id}</button>`).join(''); }
  T.dartSpot = () => T.town.dartSpot;
  function drawBoard() { if (!ctx2 || dEl.hidden) return; const x = ctx2, W = 360, c0 = W / 2, k = (W / 2) / 200; x.fillStyle = '#2a1a10'; x.fillRect(0, 0, W, W); if (!T.boardImg) T.boardImg = dartTex().image; x.drawImage(T.boardImg, c0 - 170 * k, c0 - 170 * k, 340 * k, 340 * k);
    const nums = ORDER; x.fillStyle = '#f1dfb0'; x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; nums.forEach((n, i) => { const a = i * 18 * Math.PI / 180; x.fillText(n, c0 + Math.sin(a) * 185 * k, c0 - Math.cos(a) * 185 * k); });
    const G = T.dart; if (G && G.win < 0 && G.who[G.turn] === me()) { const [sx, sy] = sway(), rx = c0 + (D.ptr[0] + sx) * k, ry = c0 - (D.ptr[1] + sy) * k; x.strokeStyle = '#7dff8a'; x.lineWidth = 2; x.beginPath(); x.arc(rx, ry, 9, 0, TAU); x.moveTo(rx - 14, ry); x.lineTo(rx + 14, ry); x.moveTo(rx, ry - 14); x.lineTo(rx, ry + 14); x.stroke(); }
    if (G) for (const l of G.log.slice(-3)) {} if (G && G.last) { const lx = c0 + G.last.x * k, ly = c0 - G.last.y * k; x.fillStyle = '#ffd34a'; x.beginPath(); x.arc(lx, ly, 4, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 15px system-ui'; x.fillText(G.last.label, lx, ly - 14); } dartUI(); }
  T.extraStoreItems=[];T.registerStoreItem=item=>{if(!item?.state||!/^[-a-z0-9_]+$/.test(item.state.id)||typeof item.buy!=='function'||typeof item.toggle!=='function')throw new TypeError('Invalid store item');if(!T.extraStoreItems.some(i=>i.state.id===item.state.id))T.extraStoreItems.push(item);render();return item;};
  T.buyJacket = buyJacket; T.dartScore = dartScore; T.applyDart = applyDart; T.newGame = newGame; T.toW = toW; T.toL = toL;
  T.openDarts = openDarts; T.openShop = openShop; T.closeUI = () => { closeUI(); closeDarts(); ck.close(); }; T.ckNew = ckNew; T.ckMoves = ckMoves; T.ckApply = ckApply; T.ckAI = ckAI; T.D = D;

  // ---- build: towers at the two trail tops furthest apart, the town on flat meadow ground ----
  T.build = (sites) => { for (const [x, z, k, r] of sites.towers) tower(x, z, k, r || 0); if (sites.town) town(...sites.town); return T; };
  return T;
}

// ---- the HORSE RIDER windbreaker: rigid panels on the rig's bones (torso on the spine, sleeves on the arms), white block letters on the back ----
let JK = null;
function jacketMats() { if (JK) return JK; const back = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#0d0e10'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .025})`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 104px Impact,"Arial Black",sans-serif'; x.fillText('HORSE', 256, 196); x.fillText('RIDER', 256, 318); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const nylon = new THREE.MeshPhysicalMaterial({ color: 0x0f1012, roughness: .42, clearcoat: .35, clearcoatRoughness: .5, sheen: .3, sheenColor: new THREE.Color(0x30343a) });
  JK = { nylon, back: new THREE.MeshPhysicalMaterial({ map: back, roughness: .42, clearcoat: .35, clearcoatRoughness: .5 }), zip: new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: .9, roughness: .3 }) }; return JK; }
export function wearJacket(root, on) { const B = root && root.userData && root.userData.B; if (!B) return false;
  if (root.userData.jacket) { for (const m of root.userData.jacket) m.visible = !!on; return true; } if (!on) return true;
  const J = jacketMats(), parts = []; root.updateMatrixWorld(true); const P = n => B[n] && B[n].getWorldPosition(new THREE.Vector3());
  const hips = P('Hips'), neck = P('neck') || P('Neck'), la = P('LeftArm'), ra = P('RightArm'), lf = P('LeftForeArm'), rf = P('RightForeArm'), lh = P('LeftHand'), rh = P('RightHand'); if (!hips || !neck || !la || !ra) return false;
  const q = root.getWorldQuaternion(new THREE.Quaternion()), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = neck.clone().sub(hips).normalize(), side = ra.clone().sub(la), sw = side.length(), rt = side.normalize();
  const len = neck.distanceTo(hips) * 1.22, wdt = sw * 1.3, dep = sw * .98, mid = hips.clone().lerp(neck, .5).addScaledVector(up, len * .06);
  const basis = new THREE.Matrix4().makeBasis(rt, up, rt.clone().cross(up).negate().multiplyScalar(-1)), torsoQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, new THREE.Vector3().crossVectors(rt, up)));
  const front = new THREE.Vector3().crossVectors(rt, up); if (front.dot(fwd) < 0) front.negate();
  const torsoG = new THREE.CylinderGeometry(wdt * .56, wdt * .47, len, 18, 1, true); torsoG.scale(1, 1, dep / wdt); const torso = new THREE.Mesh(torsoG, J.nylon); torso.position.copy(mid); torso.quaternion.copy(torsoQ); torso.material.side = THREE.DoubleSide;
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(wdt * .56, 18, 8, 0, TAU, 0, Math.PI / 2).scale(1, .42, dep / wdt), J.nylon); shoulder.position.copy(mid).addScaledVector(up, len / 2); shoulder.quaternion.copy(torsoQ);
  const backP = new THREE.Mesh(new THREE.PlaneGeometry(wdt * .9, len * .8), J.back); backP.position.copy(mid).addScaledVector(front, -dep * .5 - .012).addScaledVector(up, len * .06); backP.lookAt(backP.position.clone().addScaledVector(front, -1));
  const zip = new THREE.Mesh(new THREE.BoxGeometry(.008, len * .95, .006), J.zip); zip.position.copy(mid).addScaledVector(front, dep * .5 + .004); zip.quaternion.copy(torsoQ);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(wdt * .2, .022, 6, 16), J.nylon); collar.position.copy(neck).addScaledVector(up, -.02); collar.quaternion.copy(torsoQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const spine = B.Spine02 || B.Spine01 || B.Spine || B.Hips; for (const m of [torso, shoulder, backP, zip, collar]) { m.castShadow = true; spine.attach(m); parts.push(m); }
  const sleeve = (a, b, bone, r0, r1) => { if (!a || !b || !bone) return; const L = a.distanceTo(b), g = new THREE.CylinderGeometry(r1, r0, L * 1.02, 12, 1, true), m = new THREE.Mesh(g, J.nylon); m.material.side = THREE.DoubleSide; m.position.copy(a).lerp(b, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; bone.attach(m); parts.push(m); };
  const ar = sw * .3; sleeve(la, lf, B.LeftArm, ar, ar * .85); sleeve(ra, rf, B.RightArm, ar, ar * .85); sleeve(lf, lh, B.LeftForeArm, ar * .85, ar * .7); sleeve(rf, rh, B.RightForeArm, ar * .85, ar * .7);
  root.userData.jacket = parts; return true; }
