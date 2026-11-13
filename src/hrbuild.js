// v35 woodcraft (all original, procedural): an axe (G) fells trees with a few swings (they topple, leave a stump, regrow), the
// logs go into your inventory, and build mode (B) spends them on snap pieces on a 4 m grid: foundation, log wall, wall with a
// door, wall with a window, roof, porch. Ghost preview (green = ok, red = not), rotate (R), place (click / PLACE), remove your
// own piece (right-click / REMOVE, half the wood back). Walls are solid for riders, horses and zombies (zombies can't get through
// doors either). Solo builds persist in localStorage; in co-op the host owns the world (validates, caps each player, syncs).
import * as THREE from 'three';
export const PIECES = [
  { k: 'found', n: 'Foundation', c: 4 }, { k: 'wall', n: 'Log wall', c: 6 }, { k: 'door', n: 'Wall + door', c: 5 },
  { k: 'win', n: 'Wall + window', c: 5 }, { k: 'roof', n: 'Roof', c: 5 }, { k: 'porch', n: 'Porch', c: 3 }];
export const BUILD = { CELL: 4, WALL_H: 3.3, CAP: 80, REGROW: 240, NO_CHOP_TOWN: 34 };
const PK = Object.fromEntries(PIECES.map(p => [p.k, p])), isEdge = k => k === 'wall' || k === 'door' || k === 'win' || k === 'porch';
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // edge 0 = north (-z), 1 = east, 2 = south, 3 = west
// canonical key of a piece slot (an edge is shared by two cells)
export function slotKey(k, gx, gz, e) { if (!isEdge(k)) return (k === 'roof' ? 'r' : 'f') + gx + ',' + gz; if (k === 'porch') return 'p' + gx + ',' + gz + ',' + e;
  if (e === 1) { gx++; e = 3; } else if (e === 2) { gz++; e = 0; } return 'w' + gx + ',' + gz + ',' + e; }
function woodTex(log) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = log ? '#7a5434' : '#8a6238'; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${40 + Math.random() * 30},${25 + Math.random() * 20},10,${.15 + Math.random() * .25})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const y = Math.random() * 128; x.moveTo(0, y); x.bezierCurveTo(80, y + (Math.random() - .5) * 10, 170, y + (Math.random() - .5) * 10, 256, y + (Math.random() - .5) * 6); x.stroke(); }
  if (!log) for (let y = 0; y < 128; y += 32) { x.fillStyle = 'rgba(20,10,4,.55)'; x.fillRect(0, y, 256, 2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function merge(list) { // [geometry, matrix] -> one non-indexed geometry (position/normal/uv)
  const parts = list.map(([g, m]) => { const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(m); return n; }); let N = 0; for (const p of parts) N += p.attributes.position.count;
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), uv = new Float32Array(N * 2); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; p.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeBoundingSphere(); return g; }
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function pieceGeo(k) { // local frame: x along the edge / cell, y up from the base, z across; walls are centred on the edge line
  const L = [], H = BUILD.WALL_H, R = .21, n = Math.round(H / (R * 2)), log = (x0, x1, y) => { const w = x1 - x0; if (w < .05) return; L.push([new THREE.CylinderGeometry(R, R, w, 9), M4((x0 + x1) / 2, y, 0, 0, 0, Math.PI / 2)]); };
  if (k === 'found') { L.push([new THREE.BoxGeometry(4.1, 1.7, 4.1), M4(0, -.85, 0)]); for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) L.push([new THREE.BoxGeometry(.34, 2.2, .34), M4(x, -1.05, z)]); }
  else if (k === 'roof') { L.push([new THREE.BoxGeometry(4.7, .16, 4.9), M4(0, .7, 0, Math.atan2(1.4, 4.2), 0, 0)]); for (const s of [-1, 1]) L.push([new THREE.BoxGeometry(.2, .2, 4.5), M4(s * 2.05, .68, 0, Math.atan2(1.4, 4.2))]); // lean-to panel (high at -z)
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -2.1, 0, 0, 2.1, 0, 1.4, -2.1], 3)); tri.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    for (const s of [-1, 1]) L.push([tri.clone(), M4(s * 2, 0, 0, 0, s < 0 ? Math.PI : 0, 0, 1, 1, s < 0 ? -1 : 1)]); }
  else if (k === 'porch') { L.push([new THREE.BoxGeometry(4.1, .18, 2), M4(0, -.09, -1)]); for (const x of [-1.9, 1.9]) { L.push([new THREE.BoxGeometry(.18, 2.4, .18), M4(x, 1.1, -1.85)]); L.push([new THREE.BoxGeometry(.18, 1.8, .18), M4(x, -.9, -1.85)]); }
    L.push([new THREE.BoxGeometry(4.1, .1, .1), M4(0, .9, -1.9)]); L.push([new THREE.BoxGeometry(4.3, .12, 2.3), M4(0, 2.35, -1.05, -.12)]); }
  else { for (let i = 0; i < n; i++) { const y = R + i * R * 2; if (k === 'door' && y < 2.25) { log(-2.15, -.62, y); log(.62, 2.15, y); } else if (k === 'win' && y > .95 && y < 2.05) { log(-2.15, -.62, y); log(.62, 2.15, y); } else log(-2.15, 2.15, y); }
    if (k === 'door') { for (const s of [-1, 1]) L.push([new THREE.BoxGeometry(.12, 2.3, .5), M4(s * .62, 1.15, 0)]); L.push([new THREE.BoxGeometry(1.36, .14, .5), M4(0, 2.3, 0)]); }
    if (k === 'win') { for (const s of [-1, 1]) L.push([new THREE.BoxGeometry(.1, 1.2, .5), M4(s * .62, 1.5, 0)]); for (const y of [.92, 2.08]) L.push([new THREE.BoxGeometry(1.36, .1, .55), M4(0, y, 0)]); L.push([new THREE.BoxGeometry(.06, 1.1, .06), M4(0, 1.5, 0)]); } }
  return merge(L); }
export function createBuild(c) {
  const { scene, H, P, camera, sfx, msg, mobile, keys, T, hAt, dev } = c, B = { pieces: [], wood: 0, tool: null, sel: 0, rot: 0, ghost: null, felled: 0, chops: 0, placed: 0 };
  H.build = B; const CELL = BUILD.CELL, KEY = 'hr_v35_build', ring = (f0, f1, pk, d, type = 'sine') => { if (sfx.tone && sfx.ctx) sfx.tone(type, f0, f1, pk, d); }, thunk = () => { if (sfx.nz && sfx.ctx) sfx.nz('lowpass', 900, 1, .5, .12); ring(140, 70, .35, .12, 'triangle'); };
  const plank = new THREE.MeshStandardMaterial({ map: woodTex(false), roughness: .9 }), logM = new THREE.MeshStandardMaterial({ map: woodTex(true), roughness: .92, color: 0xd8c4a8 }), GEO = {};
  const geoOf = k => GEO[k] || (GEO[k] = pieceGeo(k)), matOf = k => k === 'found' || k === 'porch' || k === 'roof' ? plank : logM;
  const ghostM = [new THREE.MeshBasicMaterial({ color: 0x6dff7a, transparent: true, opacity: .38, depthWrite: false }), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: .38, depthWrite: false })];
  const role = () => (H.netRole ? H.netRole() : 'solo'), me = () => H.me || 'P1';
  // ---------------- trees: grid for quick lookups ----------------
  const TG = new Map(), tkey = (x, z) => Math.floor(x / 8) * 4096 + Math.floor(z / 8); H.trees.forEach((t, i) => { const k = tkey(t.x, t.z); if (!TG.has(k)) TG.set(k, []); TG.get(k).push(i); });
  const treesNear = (x, z, r) => { const out = []; for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) for (const ti of TG.get(i * 4096 + j) || []) { const t = H.trees[ti]; if (!t.cut && Math.hypot(t.x - x, t.z - z) < r) out.push(ti); } return out; };
  B.treesNear = treesNear;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function setTrunk(t, stump) { const im = t.conif ? H.tm.cTrunk : H.tm.bTrunk; if (t.ti == null) return; m4.compose(v.set(t.x, t.y, t.z), q.setFromAxisAngle(UP, t.r), sc.set(t.s * (stump ? 1.15 : 1), stump ? .045 : t.s * (t.conif ? 1 : .9 + t.hue * .3), t.s * (stump ? 1.15 : 1))); im.setMatrixAt(t.ti, m4); im.instanceMatrix.needsUpdate = true; }
  const falling = [];
  function fell(ti, from, mine) { const t = H.trees[ti]; if (!t || t.cut) return; t.cut = true; cutL.push(t); t.regrow = BUILD.REGROW; setTrunk(t, true); if (t.ob) { t.ob0 = [t.ob[2], t.ob[3]]; t.ob[2] *= .7; t.ob[3] = .6; } H.lodAt = null; H.treeLOD && H.treeLOD(true);
    // the falling tree: a stand-in trunk + crown tipping over away from the chopper
    const g = new THREE.Group(), s = t.s, h = (t.conif ? 12 : 5.2) * s; g.position.set(t.x, t.y + .5 * s, t.z);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.16 * s, .34 * s, h, 7).translate(0, h / 2, 0), H.tm.cTrunk.material); g.add(tr);
    const cr = new THREE.Mesh(t.conif ? new THREE.ConeGeometry(2.1 * s, h * .78, 8).translate(0, h * .58, 0) : new THREE.SphereGeometry(2.6 * s, 9, 7).translate(0, h + 1.4 * s, 0), new THREE.MeshStandardMaterial({ color: t.conif ? 0x2e4a2a : 0x4c6a2c, roughness: .95 })); g.add(cr); scene.add(g);
    const dx = t.x - from.x, dz = t.z - from.z, l = Math.hypot(dx, dz) || 1; falling.push({ g, ax: new THREE.Vector3(dz / l, 0, -dx / l), a: 0, w: .15, t: 0, thud: false }); ring(320, 90, .12, .9, 'sawtooth'); // creak
    if (mine) { const n = 3 + Math.round(t.s * 3); B.wood += n; B.felled++; msg(`Timber! +${n} logs 🪵 (${B.wood})`, 2.2); save(); } }
  B.fell = fell;
  function regrowTick(dt) { for (let i = cutL.length - 1; i >= 0; i--) { const t = cutL[i]; if ((t.regrow -= dt) > 0) continue; cutL.splice(i, 1); t.cut = false; setTrunk(t, false); if (t.ob && t.ob0) { t.ob[2] = t.ob0[0]; t.ob[3] = t.ob0[1]; } H.lodAt = null; H.treeLOD && H.treeLOD(true); } }
  // regrowth scan is cheap only when something is cut: keep a list
  const cutL = [], cutList = () => cutL;
  // ---------------- axe ----------------
  const axe = new THREE.Group(); { const wood = new THREE.MeshStandardMaterial({ color: 0x7a5330, roughness: .8 }), steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: .85, roughness: .35 });
    axe.add(new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .62, 8).translate(0, .31, 0), wood)); const hd = new THREE.Mesh(new THREE.BoxGeometry(.03, .1, .16).translate(0, .56, .07), steel); axe.add(hd);
    axe.add(new THREE.Mesh(new THREE.BoxGeometry(.035, .14, .035).translate(0, .56, -.02), steel)); axe.visible = false; axe.traverse(m => { m.frustumCulled = false; m.renderOrder = 5; }); scene.add(axe); }
  let swing = 0, hitDone = true, swingQ = false; const chop = { ti: -1, hits: 0 };
  const inTown = (x, z) => { const S = H.town2 && H.town2.town; if (S && Math.hypot(x - S.cx, z - S.cz) < BUILD.NO_CHOP_TOWN) return true; return H.zombies && H.zombies.inSafeZone && H.zombies.inSafeZone(x, z) !== ''; };
  function swingAxe() { if (B.tool !== 'axe' || swing > 0) return false; swing = .6; hitDone = false; B.chops++; return true; }
  function axeHit() { const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = -1, bd = 1e9; for (const ti of treesNear(P.pos.x, P.pos.z, 3.4)) { const t = H.trees[ti], dx = t.x - P.pos.x, dz = t.z - P.pos.z, d = Math.hypot(dx, dz); if ((dx * fx + dz * fz) / (d || 1) < .5 && d > .9) continue; if (d < bd) { bd = d; best = ti; } }
    if (best < 0) { ring(900, 500, .05, .06, 'triangle'); return; } const t = H.trees[best]; if (inTown(t.x, t.z)) { msg('No chopping in town — the sheriff likes his trees', 2); return; }
    if (chop.ti !== best) { chop.ti = best; chop.hits = 0; } chop.hits++; thunk(); const need = 3 + Math.round(t.s * 2); B.lastNeed = need;
    if (chop.hits >= need) { chop.ti = -1; if (role() === 'client') H.zSend && H.zSend({ t: 'sv', k: 'tree', i: best }); else if (role() === 'host') H.zSend && H.zSend({ t: 'svr', k: 'tree', i: best }); fell(best, P.pos, true); }
    else msg(`Chop! ${chop.hits}/${need}`, .8); }
  // ---------------- pieces ----------------
  const cellOf = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)], cc = g => g * CELL + CELL / 2;
  const findP = key => B.pieces.find(p => p.key === key);
  function baseY(k, gx, gz, e) { const f = findP('f' + gx + ',' + gz), x = cc(gx), z = cc(gz);
    if (k === 'found') { let hi = -1e9; for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, 0]]) hi = Math.max(hi, hAt(x + a, z + b)); return hi + .35; }
    if (k === 'roof') { if (f) return f.y + BUILD.WALL_H; return hAt(x, z) + BUILD.WALL_H; }
    const [dx, dz] = DIRS[e]; if (f) return f.y; return hAt(x + dx * 2, z + dz * 2) - .05; }
  function check(p) { const P0 = PK[p.k]; if (!P0) return 'bad piece'; const x = cc(p.gx), z = cc(p.gz); if (inTown(x, z)) return 'No building in town or by the pen';
    if (Math.abs(x) > (H.WALK || 900) - 6 || Math.abs(z) > (H.WALK || 900) - 6) return 'Too far out'; if (findP(p.key)) return 'Something is already there';
    let lo = 1e9, hi = -1e9; for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const h = hAt(x + a, z + b); lo = Math.min(lo, h); hi = Math.max(hi, h); } if (hi - lo > 1.6) return 'Too steep to build here';
    if (p.k === 'found' && treesNear(x, z, 2.9).length) return 'Chop the trees here first';
    if (isEdge(p.k)) { const [dx, dz] = DIRS[p.e], ex = x + dx * 2, ez = z + dz * 2; for (const ti of treesNear(ex, ez, 2.6)) { const t = H.trees[ti]; if (Math.abs((t.x - ex) * dz - (t.z - ez) * dx) < 2.2 && Math.abs((t.x - ex) * dx + (t.z - ez) * dz) < .9) return 'A tree is in the way'; } }
    if (p.k === 'roof' && !B.pieces.some(q => isEdge(q.k) && q.k !== 'porch' && q.gx === p.gx && q.gz === p.gz) && !B.pieces.some(q => q.k === 'found' && q.gx === p.gx && q.gz === p.gz)) return 'A roof needs walls or a foundation under it';
    if (B.pieces.filter(q => q.o === p.o).length >= BUILD.CAP) return `That's ${BUILD.CAP} pieces — the most one rider can build`; return ''; }
  const segs = (p) => { const x = cc(p.gx), z = cc(p.gz), [dx, dz] = DIRS[p.e], ex = x + dx * 2, ez = z + dz * 2, tx = -dz, tz = dx, y0 = p.y - .3, y1 = p.y + BUILD.WALL_H;
    const seg = (a, b) => [ex + tx * a, ez + tz * a, ex + tx * b, ez + tz * b, y0, y1]; return p.k === 'door' ? [seg(-2.1, -.68), seg(.68, 2.1)] : [seg(-2.1, 2.1)]; };
  function addPiece(p, quiet) { if (findP(p.key)) return null; const m = new THREE.Mesh(geoOf(p.k), matOf(p.k)); m.castShadow = m.receiveShadow = true; const x = cc(p.gx), z = cc(p.gz);
    if (isEdge(p.k)) { const [dx, dz] = DIRS[p.e]; m.position.set(x + dx * 2, p.y, z + dz * 2); m.rotation.y = p.k === 'porch' ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][p.e] : p.e % 2 ? Math.PI / 2 : 0; }
    else { m.position.set(x, p.y, z); m.rotation.y = p.k === 'roof' ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][p.e] : 0; } scene.add(m); p.m = m;
    if (p.k === 'wall' || p.k === 'door' || p.k === 'win') { p.w = segs(p); for (const s of p.w) T.walls.push(s); p.zw = p.k === 'door' ? segs({ ...p, k: 'wall' }) : p.w; } // zombies never get through a doorway
    if (p.k === 'found' || p.k === 'porch') { let f; if (p.k === 'found') f = { x0: -2.05, x1: 2.05, z0: -2.05, z1: 2.05, ya: 0, yb: 0, axis: 'x' }; else { const [dx, dz] = DIRS[p.e]; const cx2 = dx * 3, cz2 = dz * 3; f = { x0: cx2 - (dx ? 1 : 2.05), x1: cx2 + (dx ? 1 : 2.05), z0: cz2 - (dz ? 1 : 2.05), z1: cz2 + (dz ? 1 : 2.05), ya: 0, yb: 0, axis: 'x' }; }
      p.st = { cx: x, cz: z, rot: 0, y0: p.y, c: 1, s: 0, floors: [f], R: 6, geo: new Map() }; T.structs.push(p.st); }
    B.pieces.push(p); if (!quiet) { thunk(); setTimeout(thunk, 120); } return p; }
  function delPiece(p) { const i = B.pieces.indexOf(p); if (i < 0) return; B.pieces.splice(i, 1); scene.remove(p.m); if (p.w) for (const s of p.w) { const j = T.walls.indexOf(s); if (j >= 0) T.walls.splice(j, 1); } if (p.st) { const j = T.structs.indexOf(p.st); if (j >= 0) T.structs.splice(j, 1); } }
  const strip = p => ({ k: p.k, gx: p.gx, gz: p.gz, e: p.e, y: +p.y.toFixed(2), o: p.o, key: p.key });
  B.zHit = (x, z, r) => { for (const p of B.pieces) { if (!p.zw) continue; if (Math.abs(cc(p.gx) - x) > 6 || Math.abs(cc(p.gz) - z) > 6) continue; for (const w of p.zw) { const ex = w[2] - w[0], ez = w[3] - w[1], L = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - w[0]) * ex + (z - w[1]) * ez) / L)); if (Math.hypot(x - w[0] - ex * t, z - w[1] - ez * t) < r + .2) return true; } } return false; };
  // ---------------- persistence (solo / host world) ----------------
  function save() { if (role() === 'client') { try { localStorage.setItem(KEY + '_wood', String(B.wood)); } catch (_) {} return; } try { localStorage.setItem(KEY, JSON.stringify({ v: 1, P: B.pieces.map(strip) })); localStorage.setItem(KEY + '_wood', String(B.wood)); } catch (_) {} }
  function load() { for (const p of B.pieces.slice()) delPiece(p); try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && Array.isArray(o.P)) for (const p of o.P.slice(0, 400)) if (PK[p.k]) addPiece({ ...p, key: slotKey(p.k, p.gx, p.gz, p.e) }, true); } catch (_) {} }
  B.wood = +(localStorage.getItem(KEY + '_wood') || 0) || 0; load(); B.save = save; B.load = load;
  // ---------------- placing ----------------
  function target() { const P0 = PIECES[B.sel], fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), ax = P.pos.x + fx * 3.6, az = P.pos.z + fz * 3.6, [gx, gz] = cellOf(ax, az);
    let e = 0; const lx = ax - cc(gx), lz = az - cc(gz); if (P0.k === 'roof') e = Math.round(Math.atan2(fx, -fz) / (Math.PI / 2)) & 3; else e = Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? 1 : 3) : (lz > 0 ? 2 : 0);
    e = (e + B.rot) & 3; const p = { k: P0.k, gx, gz, e: isEdge(P0.k) || P0.k === 'roof' ? e : 0, o: me() }; p.key = slotKey(p.k, p.gx, p.gz, p.e); p.y = baseY(p.k, gx, gz, p.e); return p; }
  function place(p = target()) { const P0 = PK[p.k]; if (B.wood < P0.c) { msg(`${P0.n} needs ${P0.c} logs — you have ${B.wood}. Chop some trees (G)`, 2.2); return false; }
    if (isEdge(p.k) && p.k !== 'porch') { const w = segs(p); for (const s of w) { const ex = s[2] - s[0], ez = s[3] - s[1], L = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((P.pos.x - s[0]) * ex + (P.pos.z - s[1]) * ez) / L)); if (Math.hypot(P.pos.x - s[0] - ex * t, P.pos.z - s[1] - ez * t) < .7) { msg('Step back — you would wall yourself in', 1.6); return false; } } }
    const why = check(p); if (why) { msg(why, 2); ring(220, 160, .1, .15, 'square'); return false; }
    B.wood -= P0.c; B.placed++; if (role() === 'client') { B.pend = B.pend || new Map(); const n = (B.nq = (B.nq || 0) + 1); B.pend.set(n, P0.c); H.zSend && H.zSend({ t: 'sv', k: 'bPut', n, p: strip(p) }); addPiece(p); }
    else { addPiece(p); if (role() === 'host') H.zSend && H.zSend({ t: 'svr', k: 'bAdd', p: strip(p) }); } save(); return true; }
  function removeAt(p = target()) { let q = findP(p.key); if (!q) q = B.pieces.filter(r => r.gx === p.gx && r.gz === p.gz).pop(); if (!q) { msg('Nothing of yours to take down here', 1.4); return false; } if (q.o !== me() && role() !== 'solo') { msg("That's someone else's", 1.4); return false; }
    const back = Math.floor(PK[q.k].c / 2); B.wood += back; delPiece(q); msg(`Took down the ${PK[q.k].n.toLowerCase()} (+${back} logs)`, 1.6); if (role() === 'client') H.zSend && H.zSend({ t: 'sv', k: 'bDel', key: q.key }); else if (role() === 'host') H.zSend && H.zSend({ t: 'svr', k: 'bDel', key: q.key }); save(); return true; }
  B.keyOf = slotKey; B.baseOf = baseY; B.place = place; B.remove = removeAt; B.target = target; B.add = addPiece; B.check = check;
  // ---------------- co-op (host-authoritative) ----------------
  B.owns = k => k === 'bPut' || k === 'bDel' || k === 'tree' || k === 'bAdd' || k === 'bAll' || k === 'bNo';
  B.netIn = (m, from) => { // host: a client's request
    if (m.k === 'tree') { fell(m.i | 0, H.trees[m.i | 0] || P.pos, false); H.zSend && H.zSend({ t: 'svr', k: 'tree', i: m.i | 0 }); return; }
    if (m.k === 'bPut' && m.p && PK[m.p.k]) { const p = { k: m.p.k, gx: m.p.gx | 0, gz: m.p.gz | 0, e: (m.p.e | 0) & 3, o: from }; p.key = slotKey(p.k, p.gx, p.gz, p.e); p.y = baseY(p.k, p.gx, p.gz, p.e); const why = check(p);
      if (why) { H.zSendTo && H.zSendTo(from, { t: 'svr', k: 'bNo', n: m.n, why }); return; } addPiece(p, true); H.zSend && H.zSend({ t: 'svr', k: 'bAdd', p: strip(p) }); save(); return; }
    if (m.k === 'bDel') { const q = findP(m.key); if (q && q.o === from) { delPiece(q); H.zSend && H.zSend({ t: 'svr', k: 'bDel', key: m.key }); save(); } } };
  B.netRes = m => { // client: the host's word
    if (m.k === 'tree') { fell(m.i | 0, H.trees[m.i | 0] || P.pos, false); return; }
    if (m.k === 'bAdd' && m.p) { const q = findP(m.p.key); if (q) { if (Math.abs(q.y - m.p.y) > .01 || q.o !== m.p.o) { delPiece(q); addPiece({ ...m.p }, true); } else q.o = m.p.o; } else addPiece({ ...m.p }, true); if (B.pend && m.p.o === me()) B.pend.clear(); return; }
    if (m.k === 'bDel') { const q = findP(m.key); if (q) delPiece(q); return; }
    if (m.k === 'bAll' && Array.isArray(m.L)) { for (const p of B.pieces.slice()) delPiece(p); for (const p of m.L) addPiece({ ...p }, true); for (const i of m.cut || []) fell(i, H.trees[i] || P.pos, false); return; }
    if (m.k === 'bNo') { const c2 = B.pend && B.pend.get(m.n); if (c2) { B.wood += c2; B.pend.delete(m.n); } msg(m.why || "Can't build there", 2); const t = target(); void t; B.resync = true; } };
  let lastRole = role(), known = new Set();
  function netTick() { const r = role(); if (r !== lastRole) { if (r === 'client') { for (const p of B.pieces.slice()) delPiece(p); } else load(); lastRole = r; known = new Set(); }
    if (r === 'host' && H.netRemotes) for (const R of H.netRemotes()) if (!known.has(R.id)) { known.add(R.id); const cut = []; H.trees.forEach((t, i) => { if (t.cut) cut.push(i); }); H.zSendTo && H.zSendTo(R.id, { t: 'svr', k: 'bAll', L: B.pieces.map(strip), cut }); } }
  // ---------------- tools / input / UI ----------------
  const ui = document.createElement('div'); ui.id = 'hrTools'; ui.innerHTML = '<button data-t="axe" title="Axe (G)">🪓</button><button data-t="build" title="Build (B)">🔨</button><span id="hrWood">🪵 0</span>'; document.body.appendChild(ui);
  const bar = document.createElement('div'); bar.id = 'hrBuildBar'; bar.hidden = true; document.body.appendChild(bar);
  const mb = document.createElement('div'); mb.id = 'hrBuildBtns'; mb.innerHTML = '<button data-b="rot">ROTATE</button><button data-b="next">PIECE ▸</button><button data-b="del">REMOVE</button><button data-b="place" class="big">PLACE</button><button data-b="chop" class="big">CHOP</button>'; mb.style.display = 'none'; document.body.appendChild(mb);
  const css = document.createElement('style'); css.textContent = `#hrTools{position:fixed;left:8px;top:96px;z-index:43;display:flex;gap:6px;align-items:center;font:700 14px system-ui;color:#fff;text-shadow:0 1px 3px #000}
#hrTools button{width:38px!important;height:38px!important;min-width:0!important;max-width:38px;flex:0 0 38px;margin:0;border-radius:9px;border:2px solid #ffd76a88;background:rgba(30,20,10,.6);font-size:19px;padding:0;touch-action:none}#hrTools button.on{background:rgba(200,140,40,.85);border-color:#ffd76a}
#hrBuildBar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:43;display:flex;gap:5px;font:600 12px system-ui;color:#fff}#hrBuildBar div{padding:6px 9px;border-radius:8px;background:rgba(20,14,8,.7);border:2px solid #fff3;text-align:center}#hrBuildBar div.on{border-color:#ffd76a;background:rgba(120,80,20,.85)}#hrBuildBar div.no{opacity:.45}
#hrBuildBtns{position:fixed;right:14px;bottom:120px;z-index:44;display:flex;flex-direction:column;gap:8px;align-items:flex-end}#hrBuildBtns button{min-width:92px;height:44px;border-radius:12px;border:2px solid #ffd76a;background:rgba(60,40,15,.8);color:#fff;font:800 14px system-ui;touch-action:none}#hrBuildBtns button.big{height:70px;min-width:110px;font-size:17px;background:rgba(40,120,40,.85)}
body.hr-scoped #hrTools{display:none}`; document.head.appendChild(css);
  const woodEl = ui.querySelector('#hrWood'); let barKey = '';
  function setTool(t) { if (t && (H.mounted || H.seated || (H.saloon && (H.saloon.fight || H.saloon.dance)) || H.dead)) { msg(H.mounted ? 'Get off your horse first' : 'Not now', 1.4); t = null; }
    if (t === B.tool) t = null; B.tool = t; H.tool = t; if (t && H.guns && H.guns.holster) H.guns.holster(); axe.visible = false; if (B.ghost) { scene.remove(B.ghost); B.ghost = null; }
    if (t === 'axe') msg(mobile ? 'Axe out — walk up to a tree and tap CHOP' : 'Axe out — walk up to a tree and click to chop (G puts it away)', 2.4);
    if (t === 'build') msg(mobile ? 'Build mode — PIECE ▸ picks, ROTATE turns, PLACE builds' : 'Build mode — 1-6 or wheel picks a piece, R rotates, click places, right-click removes, B exits', 3);
    for (const b of ui.querySelectorAll('button')) b.classList.toggle('on', b.dataset.t === t); }
  B.setTool = setTool;
  for (const b of ui.querySelectorAll('button')) b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); setTool(b.dataset.t); });
  for (const b of mb.querySelectorAll('button')) b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); const a = b.dataset.b; if (a === 'rot') B.rot = (B.rot + 1) & 3; if (a === 'next') B.sel = (B.sel + 1) % PIECES.length; if (a === 'del') removeAt(); if (a === 'place') place(); if (a === 'chop') swingAxe(); });
  const okPtr = () => H.on && !mobile && (document.pointerLockElement || dev) && !H.uiOpen;
  addEventListener('keydown', e => { if (!H.on || e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) || H.uiOpen) return; if (e.code === 'KeyG') setTool('axe'); else if (e.code === 'KeyB') setTool('build');
    else if (B.tool === 'build') { const d = /^Digit([1-6])$/.exec(e.code); if (d) B.sel = +d[1] - 1; if (e.code === 'KeyR') B.rot = (B.rot + 1) & 3; if (e.code === 'Escape') setTool(null); } else if (B.tool && e.code === 'Escape') setTool(null); });
  addEventListener('mousedown', e => { if (!B.tool || !okPtr()) return; if (B.tool === 'axe' && e.button === 0) swingAxe(); if (B.tool === 'build') { if (e.button === 0) place(); if (e.button === 2) removeAt(); } });
  addEventListener('wheel', e => { if (B.tool !== 'build' || !okPtr()) return; B.sel = (B.sel + (e.deltaY > 0 ? 1 : PIECES.length - 1)) % PIECES.length; }, { passive: true });
  function uiTick() { woodEl.textContent = '🪵 ' + B.wood; const k = B.tool + B.sel + B.wood; mb.style.display = mobile && B.tool ? 'flex' : 'none'; if (mobile && B.tool) for (const b of mb.querySelectorAll('button')) b.style.display = (B.tool === 'axe') === (b.dataset.b === 'chop') ? '' : 'none';
    bar.hidden = B.tool !== 'build'; if (k !== barKey && B.tool === 'build') { barKey = k; bar.innerHTML = PIECES.map((p, i) => `<div class="${i === B.sel ? 'on' : ''} ${B.wood < p.c ? 'no' : ''}">${mobile ? '' : `<b>${i + 1}</b> `}${p.n}<br>🪵 ${p.c}</div>`).join(''); } }
  // ---------------- tick ----------------
  let regrowT = 0;
  B.tick = dt => { netTick(); if (B.tool && (H.mounted || H.seated || H.dead || (H.saloon && (H.saloon.fight || H.saloon.dance)))) setTool(null);
    if (B.tool && !H.tool) H.tool = B.tool; // keep the gun lock while a tool is out
    for (let i = falling.length - 1; i >= 0; i--) { const f = falling[i]; f.t += dt; if (f.a < Math.PI / 2 - .02) { f.w += dt * 2.6; f.a = Math.min(Math.PI / 2 - .02, f.a + f.w * dt); f.g.quaternion.setFromAxisAngle(f.ax, f.a); } else if (!f.thud) { f.thud = true; f.t = 0; if (sfx.nz && sfx.ctx) sfx.nz('lowpass', 300, .8, .9, .5); ring(70, 40, .5, .5); } else if (f.t > 2.5) { f.g.position.y -= dt * 1.5; if (f.t > 4) { scene.remove(f.g); f.g.traverse(m => { if (m.geometry) m.geometry.dispose(); }); falling.splice(i, 1); } } }
    if ((regrowT -= dt) <= 0) { regrowT = 2; if (cutList().length) regrowTick(2); }
    if (swing > 0) { swing = Math.max(0, swing - dt); if (!hitDone && swing < .38) { hitDone = true; axeHit(); } }
    if (B.tool === 'build') { const p = target(), ok = B.wood >= PK[p.k].c && !check(p); if (!B.ghost || B.ghost.userData.k !== p.k) { if (B.ghost) scene.remove(B.ghost); B.ghost = new THREE.Mesh(geoOf(p.k), ghostM[0]); B.ghost.userData.k = p.k; B.ghost.renderOrder = 4; scene.add(B.ghost); }
      const tmp = addPreview(p); B.ghost.position.copy(tmp.position); B.ghost.rotation.y = tmp.rotation.y; B.ghost.material = ghostM[ok ? 0 : 1]; B.ok = ok; }
    uiTick(); };
  const pv = new THREE.Object3D();
  function addPreview(p) { const x = cc(p.gx), z = cc(p.gz); if (isEdge(p.k)) { const [dx, dz] = DIRS[p.e]; pv.position.set(x + dx * 2, p.y, z + dz * 2); pv.rotation.y = p.k === 'porch' ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][p.e] : p.e % 2 ? Math.PI / 2 : 0; } else { pv.position.set(x, p.y, z); pv.rotation.y = p.k === 'roof' ? [0, -Math.PI / 2, Math.PI, Math.PI / 2][p.e] : 0; } return pv; }
  // first-person axe (after the camera is placed)
  const ax3 = new THREE.Vector3();
  B.postCam = () => { axe.visible = B.tool === 'axe'; if (!axe.visible) return; const s = swing > 0 ? 1 - swing / .6 : 0, arc = s < .35 ? -s / .35 * .9 : -0.9 + (s - .35) / .65 * 2.2;
    axe.position.copy(camera.position); axe.quaternion.copy(camera.quaternion); axe.translateX(.32); axe.translateY(-.42 + (swing > 0 ? Math.sin(s * Math.PI) * .12 : Math.sin(performance.now() / 600) * .01)); axe.translateZ(-.55); axe.rotateX(-.35 + (swing > 0 ? arc * .9 : 0)); axe.rotateZ(.25); void ax3; };
  B.swing = swingAxe; B.PIECES = PIECES;
  return B;
}
