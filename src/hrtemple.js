// v39 THE HOLLOW SUN — a sealed temple of an invented, long-gone sun civilization, built into a mountainside: mirrors, glyph
// tiles and a counterweight open the sanctum (traps on the way); its gold cache pays 100,000 game points once per player and
// a hidden altar holds the Sun Pyramid. The temple itself is ChatGPT-generated code supplied by Quin (src/hrsuntemple.js,
// credited in CREDITS.md). This file places it (a hillside with a mound raised over the halls, the same on every machine) and
// wires it into our controller (underground floors under the mound, walls, falls), guns, host-authoritative co-op (the host
// orders every puzzle action and replays the log to everyone) and game points. The civilization and its glyphs are fictional.
import * as THREE from 'three';
import { createSunTemple } from './hrsuntemple.js';

export const TEMPLE = { gold: 100000, top: 18.5, trap: { rolling_boulder: 40, dart_wall: 12, swinging_blade: 30 } };
const IU = 27, IV0 = -77, IV1 = -4.5, DU = 16.5, AV1 = 9, MB = 30; // interior / mound half-width + depth, doorway half-width, apron front, mound blend
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const toLocal = (S, x, z) => { const dx = x - S.x, dz = z - S.z, c = Math.cos(S.rot), s = Math.sin(S.rot); return [dx * c - dz * s, dx * s + dz * c]; };
const toWorld = (S, u, v) => { const c = Math.cos(S.rot), s = Math.sin(S.rot); return [S.x + u * c + v * s, S.z - u * s + v * c]; };
const rampY = z => Math.max(-9, z * .14);
const rectD = (u, v, u0, u1, v0, v1) => Math.hypot(Math.max(0, u0 - u, u - u1), Math.max(0, v0 - v, v - v1));
export function templeRect(S, m = 0) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [u, v] of [[-IU - m, IV0 - m], [IU + m, IV0 - m], [-IU - m, AV1 + m], [IU + m, AV1 + m]]) { const [x, z] = toWorld(S, u, v); a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); }
  return { x: (a + b) / 2, z: (c + d) / 2, hw: (b - a) / 2, hd: (d - c) / 2 }; }

// Deterministic site: the seal faces the pen, 320-680 m out, on a flat apron, with the mountain climbing steeply behind it.
export function pickTempleSite(hAt, F, o) { const { PEN, WALK } = o, tops = (F.trails || []).map(t => t.top);
  for (let pass = 0; pass < 2; pass++) { let best = null; const maxR = pass ? 8 : 4.5, minRise = pass ? 2 : 12;
    for (let k = 0; k < 4; k++) { const rot = k * Math.PI / 2, ix = -Math.sin(rot), iz = -Math.cos(rot), px = Math.cos(rot), pz = -Math.sin(rot);
      for (let d = 320; d <= 680; d += 15) for (let l = -300; l <= 300; l += 25) { const S = { x: PEN.x + ix * d + px * l, z: PEN.z + iz * d + pz * l, rot };
        let ok = true; for (const [u, v] of [[-IU - MB - 8, IV0 - MB - 8], [IU + MB + 8, IV0 - MB - 8], [-IU - MB - 8, AV1 + 24], [IU + MB + 8, AV1 + 24]]) { const [x, z] = toWorld(S, u, v); if (Math.abs(x) > WALK - 40 || Math.abs(z) > WALK - 40) ok = false; } if (!ok) continue;
        let a = 1e9, b = -1e9, sum = 0, n = 0; for (let u = -12; u <= 12; u += 6) for (let v = 0; v <= 16; v += 4) { const [x, z] = toWorld(S, u, v), h = hAt(x, z); a = Math.min(a, h); b = Math.max(b, h); sum += h; n++; }
        const range = b - a; if (range > maxR) continue; const y0 = sum / n;
        let rise = 0, rn = 0; for (let u = -24; u <= 24; u += 12) for (let v = -70; v <= -20; v += 10) { const [x, z] = toWorld(S, u, v); rise += hAt(x, z) - y0; rn++; } rise /= rn; if (rise < minRise) continue;
        const sc = range * 2.5 + Math.max(0, 30 - rise) * .25 + Math.max(0, rise - 70) * .2 + Math.abs(l) * .003 + (d - 320) * .003; if (best && sc >= best.sc) continue;
        for (const t of tops) if (Math.hypot(t[0] - S.x, t[1] - S.z) < 120) ok = false; if (!ok) continue;
        for (let u = -IU - MB; u <= IU + MB && ok; u += 9) for (let v = IV0 - MB; v <= AV1 + 18 && ok; v += 9) { const [x, z] = toWorld(S, u, v); if (o.avoid(x, z) || F.waterDist(x, z) < 6 || F.trailDist(x, z) < 8) ok = false; } if (!ok) continue;
        best = { ...S, y0, sc, rise: +rise.toFixed(1), range: +range.toFixed(2), d, l, pass }; } }
    if (best) return best; }
  return null; }

// terrain: a flat apron + doorway, and a mound raised over the halls (never lowered), blending back into the mountain
export function makeTemplePad(S) { const R = 170; return (x, z, h) => { if (Math.abs(x - S.x) > R || Math.abs(z - S.z) > R) return h; const [u, v] = toLocal(S, x, z);
  const da = rectD(u, v, -DU, DU, IV1, AV1); if (da < 16) { const p = S.y0 - .08; h = da <= 0 ? p : p + (h - p) * sstep(0, 16, da); }
  if (!(Math.abs(u) <= DU && v > IV1)) { const dm = rectD(u, v, -IU, IU, IV0, IV1); if (dm < MB) h = Math.max(h, S.y0 + TEMPLE.top * (1 - sstep(0, MB, dm))); }
  return h; }; }

export function createTemple(c) {
  const { scene, H, P, T, hAt, sfx, msg, mobile, site: S } = c, me = () => String(H.me || 'P1'), host = () => c.role() !== 'client';
  const tm = createSunTemple({ position: new THREE.Vector3(S.x, S.y0, S.z), rotationY: S.rot, quality: mobile || c.low ? 'low' : 'high', viewDist: mobile ? 260 : 380, onPlate: i => act(['g', i]) });
  scene.add(tm.group); tm.group.updateMatrixWorld(true);
  if (mobile) tm.lights.forEach((l, i) => { if (i !== 0 && i !== 4) l.removeFromParent(); }); // phones: the seal and sanctum lamps only
  if (!mobile && !c.low) tm.group.traverse(m => { if (m.isMesh && !m.material.transparent) m.castShadow = true; }); // the roof shades the halls from the sun
  const INV = tm.inverse, L = new THREE.Vector3(), W = new THREE.Vector3();
  const toL = (x, y, z) => L.set(x, y, z).applyMatrix4(INV);
  const BOXES = tm.colliders, isFloorBox = b => b.max.y - b.min.y <= .65, WALLS = () => BOXES.filter(b => b !== tm.collapseBox && !isFloorBox(b));
  let WL = WALLS(); const ALL = new THREE.Box3(); for (const b of BOXES) if (!b.isEmpty()) ALL.union(b); ALL.expandByScalar(2);
  const R = { ...templeRect(S, 2), name: 'THE HOLLOW SUN', label: '🛡 NO ZOMBIES · THE HOLLOW SUN' }; (H.safeRects || (H.safeRects = [])).push(R);
  const out = { site: S, temple: tm, rect: R, state: { log: [], applied: 0 }, claims: (() => { try { return JSON.parse(localStorage.getItem('hr_temple') || '{}') || {}; } catch (_) { return {}; } })() };
  const saveClaims = () => { try { localStorage.setItem('hr_temple', JSON.stringify(out.claims)); } catch (_) {} };
  // ---- where the halls are: inside the interior rectangle and below the mound's surface ----
  out.inFoot = (x, z, m = 0) => { const [u, v] = toLocal(S, x, z); return Math.abs(u) <= IU + m && v >= IV0 - m && v <= IV1 + 1 + m; };
  out.under = (x, z, y) => { const [u, v] = toLocal(S, x, z); return Math.abs(u) <= IU - .5 && v >= IV0 + .5 && v <= IV1 + .5 && y < hAt(x, z) - 1.5; };
  out.floorAt = (x, z, y) => { toL(x, y, z); const u = L.x, v = L.z, yl = L.y; let f = -1e9;
    for (const q of tm.floorList) { if (Math.abs(u - q.x) > q.w / 2 || Math.abs(v - q.z) > q.d / 2) continue; const fy = q.y === null ? rampY(v) : q.y; if (fy <= yl + .55 && fy > f) f = fy; }
    for (const b of BOXES) { if (b.isEmpty() || x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue; const top = b === tm.collapseBox ? b.max.y - .28 - S.y0 : isFloorBox(b) ? b.max.y - S.y0 : null; if (top !== null && top <= yl + .55 && top > f) f = top; }
    return f <= -1e8 ? -1e9 : S.y0 + f; };
  // underground: the temple's floors decide (no floor = you fall); otherwise null (the terrain decides)
  out.groundAt = (x, z, y) => out.under(x, z, y) ? out.floorAt(x, z, y) : null;
  out.wallHit = (x, z, r, y) => { if (x < ALL.min.x - r || x > ALL.max.x + r || z < ALL.min.z - r || z > ALL.max.z + r) return false;
    for (const b of WL) { if (b.isEmpty() || y + 1.7 < b.min.y || y + .4 > b.max.y) continue; const cx = Math.max(b.min.x, Math.min(x, b.max.x)), cz = Math.max(b.min.z, Math.min(z, b.max.z)); if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; } return false; };
  // bullets: inside the halls the mound is air (0 = not the temple, 1 = hall air, 2 = rock above the halls)
  out.cell = (x, y, z) => { const [u, v] = toLocal(S, x, z); if (Math.abs(u) > IU || v < IV0 || v > IV1 + .5) return 0; const yl = y - S.y0; if (y >= hAt(x, z)) return 0; return yl < rampY(v) + 16 && yl > -14 ? 1 : 2; };
  const ray = new THREE.Ray(), hp = new THREE.Vector3();
  out.rayHit = (o, d, maxT) => { ray.origin.copy(o); ray.direction.copy(d); if (!ray.intersectBox(ALL, hp) && !ALL.containsPoint(o)) return -1; let best = -1;
    for (const b of WL) { if (b.isEmpty()) continue; if (ray.intersectBox(b, hp)) { const t = hp.distanceTo(o); if (t > .05 && t < maxT && (best < 0 || t < best)) best = t; } } return best; };
  // ---- the puzzles in co-op: every action goes to the host, which orders them in a log that every machine replays ----
  const IA = id => tm.interactions.find(q => q.id === id);
  function apply(a) { if (!Array.isArray(a)) return false; const [k, n] = a; let ok = false;
    if (k === 'e') ok = IA('entrance').activate({ force: true }); else if (k === 'm' && n >= 0 && n < 3) ok = IA('mirror_' + n).activate({ force: true });
    else if (k === 'g' && n >= 0 && n < 4) { if (!tm.state.glyph) { tm.stepGlyph(n); ok = true; } } else if (k === 'r') ok = IA('glyph_reset').activate({ force: true });
    else if (k === 'w' && Number.isFinite(n)) { ok = IA('counterweight').activate({ force: true, weight: n }); if (!ok && !tm.state.weight) out.lastWrong = n; ok = ok || !tm.state.weight; }
    else if (k === 'a') ok = IA('hidden_altar').activate({ force: true }); return ok; }
  function bc() { if (c.role() === 'host') c.send({ t: 'tms', log: out.state.log }); }
  function commit(a, who) { if (out.state.log.length >= 600) return; if (!apply(a)) return; out.state.log.push(a); out.state.applied = out.state.log.length; if (a[0] === 'w' && who !== me() && out.lastWrong === a[1]) {} bc(); }
  function act(a) { if (host()) commit(a, me()); else c.send({ t: 'tma', a }); }
  const okAct = a => Array.isArray(a) && a.length <= 2 && ['e', 'm', 'g', 'r', 'w', 'a'].includes(a[0]) && (a.length === 1 || (Number.isFinite(a[1]) && a[1] >= 0 && a[1] <= 20));
  out.netIn = (m, from) => { if (!m) return;
    if (m.t === 'tma' && host()) { if (!okAct(m.a)) return; const R0 = (c.remotes ? c.remotes() : []).find(q => q.id === from); if (R0 && R0.s && Number.isFinite(R0.s.x) && !out.inFoot(R0.s.x, R0.s.z, 30)) return; commit(m.a, from); return; }
    if (m.t === 'tms' && !host() && Array.isArray(m.log)) { const lg = m.log.slice(0, 600); for (let i = out.state.applied; i < lg.length; i++) if (okAct(lg[i])) apply(lg[i]); out.state.log = lg; out.state.applied = Math.max(out.state.applied, lg.length); } };
  // ---- events: sounds + words ----
  const tone = (...a) => sfx.tone && sfx.ctx && sfx.tone(...a), noise = (...a) => sfx.nz && sfx.ctx && sfx.nz(...a);
  const SOLVED = { mirror: 'The sun discs align — a beam strikes the seal', glyph: 'The glyph tiles glow — the second seal slides away', weight: 'The scale settles — twelve studs, twelve stones' };
  tm.onEvent(e => { if (e.type === 'door_open' && e.phase === 'opening') { noise('lowpass', 160, 1, 2.2, .5); if (e.id === 'sanctum_door') msg('All three seals are restored — the sanctum opens', 3.5); else if (e.id === 'entrance') msg('The sun seal grinds open', 2.5); }
    else if (e.type === 'puzzle_solved') { tone('sine', 520, 1040, .8, .3); msg(SOLVED[e.id] || 'A seal opens', 3); }
    else if (e.type === 'trap' && e.phase === 'telegraph') { noise('lowpass', 420, 1, .5, .35); if (e.id === 'collapsing_bridge') msg('The bridge shudders…', 1.2); }
    else if (e.type === 'trap' && e.phase === 'warning') { tone('square', 200, 120, .25, .25); } });
  // ---- spots (our USE system) ----
  const spots = [], sp = (kind, id, label, r = 2.2, extra = {}) => { const q = IA(id), o = { kind, x: q.position.x, y: q.position.y, z: q.position.z, label, r, temple: 1, id, ...extra }; T.spots.push(o); spots.push(o); return o; };
  const sEnt = sp('tp-seal', 'entrance', 'Push the sun seal', 3.2), sMir = [0, 1, 2].map(i => sp('tp-mirror', 'mirror_' + i, 'Turn sun disc ' + (i + 1), 1.8, { i }));
  const sRst = sp('tp-reset', 'glyph_reset', 'Reset the glyph tiles', 1.8), sW = sp('tp-weight', 'counterweight', '', 2.2), sAlt = sp('tp-altar', 'hidden_altar', '', 2.2), sPyr = sp('tp-pyramid', 'sun_pyramid', '', 2.2), sGold = sp('tp-gold', 'gold_cache', '', 3);
  Object.assign(T.TL, { 'tp-seal': 'PUSH', 'tp-mirror': 'TURN', 'tp-reset': 'RESET', 'tp-weight': 'ADD<small>STONE</small>', 'tp-altar': 'RAISE', 'tp-pyramid': 'TAKE', 'tp-gold': 'TAKE<small>GOLD</small>' });
  let stones = 0, stoneT = 0;
  const all = () => tm.state.mirror && tm.state.glyph && tm.state.weight;
  function labels() { sEnt.label = tm.doors[0].target ? '' : 'Push the sun seal'; for (const s of sMir) s.label = tm.state.mirror ? '' : 'Turn sun disc ' + (s.i + 1) + ' — follow the beam';
    sRst.label = tm.state.glyph ? '' : 'Reset the glyph tiles (read the dots: 1, 3, 2, 4)'; sW.label = tm.state.weight ? '' : stones ? `Stones on the scale: ${stones} (USE adds one)` : 'Count the gold studs — USE to load stones on the scale';
    sAlt.label = all() && !tm.sealUp ? 'Raise the hidden seal' : ''; sPyr.label = all() && tm.sealUp ? (out.claims.sun ? '' : 'Take the Sun Pyramid') : ''; sGold.label = all() ? (out.claims.gold ? 'Empty — you took your share of the gold' : 'Take the gold (+' + TEMPLE.gold.toLocaleString() + ' pts)') : ''; }
  const prevUse = T.onUse;
  T.onUse = o => { if (!o || !o.temple) return prevUse ? prevUse(o) : false;
    if (o.kind === 'tp-seal') act(['e']); else if (o.kind === 'tp-mirror') { act(['m', o.i]); tone('triangle', 330, 360, .12, .2); } else if (o.kind === 'tp-reset') { act(['r']); msg('The tiles go dark', 1.2); }
    else if (o.kind === 'tp-weight') { if (!tm.state.weight) { stones = Math.min(15, stones + 1); stoneT = 2.5; tone('square', 140, 120, .08, .2); } }
    else if (o.kind === 'tp-altar') act(['a']);
    else if (o.kind === 'tp-pyramid') { if (all() && tm.sealUp && !out.claims.sun) { out.claims.sun = 1; saveClaims(); if (H.sun) H.sun.give(); msg('The Sun Pyramid — press 6 (☀ on a phone) to hold it, then fire: it charges, then a sun beam burns through the dead', 5); tone('sine', 660, 1320, 1, .35); } }
    else if (o.kind === 'tp-gold') { if (all() && !out.claims.gold) { out.claims.gold = 1; saveClaims(); const G = H.guns; if (G) { G.state.score += TEMPLE.gold; G.save(); } msg('Gold of the Hollow Sun — +' + TEMPLE.gold.toLocaleString() + ' points', 4); tone('triangle', 520, 1560, .9, .4); } }
    return true; };
  // ---- per frame: the module (traps, doors), trap damage, falls, the counterweight commit ----
  const cp = new THREE.Vector3(), hitT = {}, CAP = new THREE.Box3(), cap = new THREE.Vector3();
  out.update = dt => { cp.copy(H.mounted ? H.mounted.pos : P.pos); tm.update(dt, null, cp); WL = WL.length ? WL : WALLS();
    if (!tm.near) for (const l of tm.lights) l.intensity = 0;
    if (stones && (stoneT -= dt) <= 0) { const n = stones; stones = 0; act(['w', n]); if (n !== 12) { msg('The scale lurches — ' + n + ' is the wrong weight. Darts hiss from the wall!', 2.5); const Z = H.zombies; if (Z && Z.hurtMe) Z.hurtMe(10, 0); } }
    out.underP = !H.mounted && out.under(P.pos.x, P.pos.z, P.pos.y);
    if (tm.near && !H.mounted) { CAP.min.set(P.pos.x - .35, P.pos.y, P.pos.z - .35); CAP.max.set(P.pos.x + .35, P.pos.y + 1.7, P.pos.z + .35);
      for (const q of tm.triggers) { if (q.type !== 'trap' || q.hazard.isEmpty() || !TEMPLE.trap[q.id]) continue; hitT[q.id] = Math.max(0, (hitT[q.id] || 0) - dt); if (hitT[q.id] > 0 || !q.hazard.intersectsBox(CAP)) continue;
        hitT[q.id] = 1.2; const Z = H.zombies; if (Z && Z.hurtMe) Z.hurtMe(TEMPLE.trap[q.id], 0); out.trapHits = (out.trapHits || 0) + 1; msg(q.id === 'rolling_boulder' ? 'The boulder slams into you!' : q.id === 'dart_wall' ? 'Darts!' : 'The blade catches you!', 1.2); } }
    if (out.underP && P.pos.y < S.y0 - 16) { const [x, z] = toWorld(S, 0, -27); P.pos.set(x, S.y0 + rampY(-27) + .1, z); H.vy = 0; const Z = H.zombies; if (Z && Z.hurtMe) Z.hurtMe(35, 0); out.falls = (out.falls || 0) + 1; msg('You fell into the chasm — and dragged yourself back up', 3); }
    if (host() && c.role() === 'host' && (out.bcT = (out.bcT || 0) + dt) > 2.5) { out.bcT = 0; bc(); }
    labels(); };
  out._act = act; // dev / tests: the same path as a USE press
  out.info = () => ({ x: +S.x.toFixed(1), z: +S.z.toFixed(1), y0: +S.y0.toFixed(2), rot: S.rot, rise: S.rise, range: S.range, pass: S.pass, solved: { ...tm.state }, log: out.state.log.length, claims: { ...out.claims } });
  labels(); return out;
}
