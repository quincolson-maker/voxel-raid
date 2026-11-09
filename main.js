import * as THREE from 'three';
import { LAYOUTS } from './layouts.js';
import { createGraphics, loadPBR, pbrMaterial, MATDEF, pickQuality, IS_TOUCH } from './src/gfx.js';
import { makeTroop, animateTroop, makeDefense, makeKeepDecor, makeRoof, makeViewmodel, makeTerrain, WEAPONS, setPBR, loadProps } from './src/models.js';
import { FX, SFX } from './src/fx.js';
import { initTouch } from './src/touch.js';
import { createZombies } from './src/zombies.js';
import { watchLobbies } from './src/lobby.js';
const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
if (IS_TOUCH) document.body.classList.add('touch');
// ---------------- Graphics ----------------
const QNAME = pickQuality(); $('quality').value = Q.get('q') || localStorage.getItem('vr_quality') || 'auto';
$('quality').onchange = e => { localStorage.setItem('vr_quality', e.target.value); location.reload(); };
const GX = createGraphics(QNAME); const { renderer, scene, camera } = GX;
const PBRS = loadPBR(renderer, QNAME == 'high' || QNAME == 'ultra'); setPBR(PBRS); let propsReady = false; loadProps(() => propsReady = true);
const sfx = new SFX();
// ---------------- World ----------------
const W = 96, H = 24, D = 96, CS = 16, CX = 48, CZ = 48;
const T = { AIR: 0, GROUND: 1, TIMBER: 2, COBBLE: 3, PLATE: 4, RAMPART: 5, HEART: 6, HALL: 7, FORGE: 8 };
const INFO = { 1: { c: 0x5a6a3a, hp: 1e9, m: 'grass' }, 2: { c: 0x8a6a48, hp: 40, n: 'Timber', m: 'timber' }, 3: { c: 0x9a9890, hp: 100, n: 'Concrete', m: 'concrete' }, 4: { c: 0x6a6e72, hp: 220, n: 'Steel', m: 'steel' },
  5: { c: 0xa09a90, hp: 150, base: 1, m: 'wall' }, 6: { c: 0x8a5040, hp: 160, base: 1, core: 1, m: 'brick' }, 7: { c: 0x7a5a48, hp: 70, base: 1, m: 'corrugated' }, 8: { c: 0xa89a78, hp: 120, base: 1, m: 'hesco' }, 9: { c: 0xb0a080, hp: 130, base: 1, m: 'hesco' } };
const blocks = new Uint8Array(W * H * D), bhp = new Float32Array(W * H * D);
const I = (x, y, z) => x + W * (z + D * y);
const inb = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
const get = (x, y, z) => { x |= 0; y |= 0; z |= 0; if (y < 0) return 1; if (!inb(x, y, z)) return y < 6 ? 1 : 0; return blocks[I(x, y, z)]; };
const solid = (x, y, z) => get(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;
const stats = { base: 0, baseTotal: 0, core: 0, coreTotal: 0 };
const dirty = new Set(); let gridDirty = true;
function markDirty(x, z) { const cx = x / CS | 0, cz = z / CS | 0; dirty.add(cx + ',' + cz);
  if (x % CS == 0 && cx > 0) dirty.add((cx - 1) + ',' + cz); if (x % CS == CS - 1) dirty.add((cx + 1) + ',' + cz);
  if (z % CS == 0 && cz > 0) dirty.add(cx + ',' + (cz - 1)); if (z % CS == CS - 1) dirty.add(cx + ',' + (cz + 1)); }
function setB(x, y, z, t, init) { if (!inb(x, y, z)) return; const i = I(x, y, z), o = blocks[i];
  if (o && INFO[o].base) { stats.base--; if (INFO[o].core) stats.core--; }
  blocks[i] = t; bhp[i] = t ? INFO[t].hp : 0;
  if (t && INFO[t].base) { stats.base++; if (INFO[t].core) stats.core++; if (init) { stats.baseTotal++; if (INFO[t].core) stats.coreTotal++; } }
  markDirty(x, z); if (y > 0 && y < 4) gridDirty = true; }
// ---------------- Voxel mesher: merged per-material faces with world-space UVs (continuous PBR surfaces), AO + damage scorch ----------------
const BMAT = {}; for (const t in INFO) if (t != 1) BMAT[t] = pbrMaterial(PBRS[INFO[t].m], { vertexColors: true, ...(INFO[t].m == 'hesco' ? { color: 0xd8c8a8 } : INFO[t].m == 'corrugated' ? { color: 0xc8c8c8, metalness: .6 } : {}) });
const chunks = {};
const FACES = [[[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]], [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]], [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]];
const AOL = [.5, .68, .84, 1];
const occ = (x, y, z) => inb(x, y, z) && blocks[I(x, y, z)] > 1 ? 1 : 0;
function buildChunk(cx, cz) { const per = {};
  for (let y = 1; y < H; y++) for (let z = cz * CS; z < cz * CS + CS; z++) for (let x = cx * CS; x < cx * CS + CS; x++) { const t = blocks[I(x, y, z)]; if (t < 2) continue;
    const B = per[t] || (per[t] = { pos: [], nor: [], uv: [], col: [], idx: [] }); const tile = MATDEF[INFO[t].m][1];
    const h = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0, n = .94 + ((h % 100) / 100) * .08; const fr = bhp[I(x, y, z)] / INFO[t].hp; const dmg = .45 + .55 * Math.min(1, fr * 1.2);
    for (const [d, vs] of FACES) { const nx = x + d[0], ny = y + d[1], nz = z + d[2]; if (ny < 1 && d[1] < 0) continue; if (inb(nx, ny, nz) && blocks[I(nx, ny, nz)] > 1) continue;
      const b = B.pos.length / 3; const aos = []; const ax = d[0] ? [2, 1] : d[2] ? [0, 1] : [0, 2];
      for (const v of vs) { const w = [x + v[0], y + v[1], z + v[2]]; B.pos.push(...w); B.nor.push(...d); B.uv.push(w[ax[0]] / tile * (d[0] + d[2] < 0 ? -1 : 1), w[ax[1]] / tile);
        const s_ = [0, 0, 0], tt = [0, 0, 0]; s_[ax[0]] = v[ax[0]] * 2 - 1; tt[ax[1]] = v[ax[1]] * 2 - 1;
        const s1 = occ(nx + s_[0], ny + s_[1], nz + s_[2]), s2 = occ(nx + tt[0], ny + tt[1], nz + tt[2]), c = occ(nx + s_[0] + tt[0], ny + s_[1] + tt[1], nz + s_[2] + tt[2]);
        const ao = AOL[s1 && s2 ? 0 : 3 - s1 - s2 - c] * (w[1] <= 1.01 ? .8 : 1); aos.push(ao); const k = ao * n * dmg; B.col.push(k, k * (.97 + .03 * fr), k * (.94 + .06 * fr)); }
      if (aos[0] + aos[2] < aos[1] + aos[3]) B.idx.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else B.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); } }
  const k = cx + ',' + cz; if (chunks[k]) { scene.remove(chunks[k]); chunks[k].geometry.dispose(); delete chunks[k]; }
  const pos = [], nor = [], uv = [], col = [], idx = [], mats = []; const g = new THREE.BufferGeometry();
  for (const t in per) { const B = per[t], base = pos.length / 3, start = idx.length; pos.push(...B.pos); nor.push(...B.nor); uv.push(...B.uv); col.push(...B.col); for (const i of B.idx) idx.push(i + base); g.addGroup(start, B.idx.length, mats.length); mats.push(BMAT[t]); }
  if (!mats.length) return;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mats); m.castShadow = m.receiveShadow = true; scene.add(m); chunks[k] = m; }
function flushChunks(max = 4) { let n = 0; for (const k of dirty) { const [a, b] = k.split(',').map(Number); if (a >= 0 && b >= 0 && a < W / CS && b < D / CS) buildChunk(a, b); dirty.delete(k); if (++n >= max) break; } }
// ---------------- Voxel ray ----------------
function rayVox(o, d, maxD) { let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z); const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz; let px = x, py = y, pz = z, t = 0;
  while (t < maxD) { if (get(x, y, z) && !(y >= H)) return { x, y, z, px, py, pz, dist: t }; px = x; py = y; pz = z;
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; } else if (ty < tz) { y += sy; t = ty; ty += tdy; } else { z += sz; t = tz; tz += tdz; } if (y < -1 || y > H) return null; }
  return null; }
const los = (a, b) => { const d = b.clone().sub(a), L = d.length(); const h = rayVox(a, d.normalize(), L); return !h || h.dist >= L - .8; };
// ---------------- Game state ----------------
const G = { mode: 'attack', phase: 'menu', timer: 0, shield: true, layout: 0, wave: 0, mat: { 2: 300, 3: 200, 4: 80 }, gears: 14, structures: [], units: [], traps: [], over: false, buildT: 300, t: 0 };
const PIECES_ATT = ['Wall', 'Ramp', 'Floor'], PIECES_DEF = ['Wall', 'Ramp', 'Floor', 'MG Nest', 'Mortar Pit', 'AT Mine'];
const COST = { 'MG Nest': 3, 'Mortar Pit': 4, 'AT Mine': 1 };
const MATS = [2, 3, 4];
const P = { slots: ['carbine', 'pistol'], w: 0, ammoOf: {}, adsT: 0, swap: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, ammo: 30, mag: 30, reload: 0, cd: 0, piece: 0, mat: 0, team: 'att', dead: 0, onGround: false, spawn: new THREE.Vector3(), recoil: 0, bob: 0 };
const fx = new FX(scene, camera, renderer, GX.Q, solid); fx.setScale(); addEventListener('resize', () => fx.setScale());
// ---------------- Structures ----------------
const SDEF = { core: { s: 6, h: 5, t: 6, n: 'Command Post' }, vault: { s: 4, h: 3, t: 7, n: 'Supply Depot' }, hut: { s: 3, h: 3, t: 7, n: 'Barracks' },
  turret: { s: 2, h: 2, t: 8, n: 'MG Nest', range: 20, dmg: 5, rate: .6, col: 0x40c0ff }, mortar: { s: 3, h: 1, t: 8, n: 'Mortar Pit', range: 30, min: 5, dmg: 35, rate: 3.5, splash: 3, col: 0xff6030 },
  needle: { s: 2, h: 4, t: 8, n: 'Watchtower', range: 30, dmg: 18, rate: 1.8, col: 0xd0ff40 } };
function placeStructure(kind, x, z, y0 = 1) { const d = SDEF[kind]; const x0 = Math.round(x - d.s / 2), z0 = Math.round(z - d.s / 2); let n = 0;
  for (let y = y0; y < y0 + d.h; y++) for (let i = 0; i < d.s; i++) for (let k = 0; k < d.s; k++) { if (kind == 'core' && y == y0 + d.h - 1 && (i == 0 || k == 0 || i == d.s - 1 || k == d.s - 1) && ((i + k) % 2)) continue; setB(x0 + i, y, z0 + k, d.t, true); n++; }
  const st = { kind, d, x: x0 + d.s / 2, z: z0 + d.s / 2, y0, top: y0 + d.h, cd: Math.random(), bx: x0, bz: z0, n0: n, frac: 1, fxT: 0 };
  let deco = null; if (d.range) deco = makeDefense(kind); else if (kind == 'core') deco = makeKeepDecor(d.s); else deco = makeRoof(kind, d.s);
  if (deco) { deco.position.set(st.x, st.top, st.z); scene.add(deco); st.mesh = deco; }
  G.structures.push(st); return st; }
function countSt(st) { let n = 0; for (let i = 0; i < st.d.s; i++) for (let k = 0; k < st.d.s; k++) for (let y = st.y0; y < st.top; y++) if (get(st.bx + i, y, st.bz + k) == st.d.t) n++; return n; }
const alive = st => st.frac > 0.02;
function topIntact(st) { for (let i = 0; i < st.d.s; i++) for (let k = 0; k < st.d.s; k++) if (get(st.bx + i, st.top - 1, st.bz + k)) return true; return false; }
function line(x0, z0, x1, z1, h, t) { const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)); for (let s = 0; s <= n; s++) { const x = Math.round(x0 + (x1 - x0) * s / n), z = Math.round(z0 + (z1 - z0) * s / n); for (let y = 1; y <= h; y++) { setB(CX + x, y, CZ + z, t, true); setB(CX + x + 1, y, CZ + z, t, true); } } }
function buildWorld(L) { for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) setB(x, 0, z, 1);
  const outer = L.rects.reduce((m, r) => Math.max(m, Math.abs(r[2] - r[0])), 0);
  for (const [a, b, c, d] of L.rects) { const wt = Math.abs(c - a) == outer ? 9 : 5; line(a, b, c, b, 3, wt); line(c, b, c, d, 3, wt); line(c, d, a, d, 3, wt); line(a, d, a, b, 3, wt); continue; line(c, b, c, d, 3, 5); line(c, d, a, d, 3, 5); line(a, d, a, b, 3, 5); }
  for (const [a, b, c, d] of L.lines) line(a, b, c, d, 3, 5);
  for (const [gx, gz] of L.gaps) for (let y = 1; y <= 3; y++) for (const dx of [0, 1]) setB(CX + gx + dx, y, CZ + gz, 0);
  for (const [k, x, z] of L.buildings) { if (k == 'trap') addTrap(CX + x, 1, CZ + z); else placeStructure(k, CX + x, CZ + z); }
  makeTerrain(scene, PBRS, GX.Q, W, D, (x, z) => !blocks[I(Math.floor(x), 1, Math.floor(z))] && !G.traps.some(t => Math.abs(t.x - x) < 1 && Math.abs(t.z - z) < 1));
  stats.baseTotal = stats.base; stats.coreTotal = stats.core; for (let a = 0; a < W / CS; a++) for (let b = 0; b < D / CS; b++) buildChunk(a, b); dirty.clear(); }
const trapGeo = new THREE.CylinderGeometry(.45, .45, .08, 10);
function addTrap(x, y, z) { const m = new THREE.Group(); const base = new THREE.Mesh(trapGeo, new THREE.MeshStandardMaterial({ color: 0x5a3a2a, metalness: .6, roughness: .5, transparent: true, opacity: G.mode == 'defend' ? 1 : .25 }));
  m.add(base); for (let i = 0; i < 8; i++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(.05, .18, 4), base.material); const a = i / 8 * 6.28; tooth.position.set(Math.cos(a) * .38, .1, Math.sin(a) * .38); m.add(tooth); }
  m.position.set(x + .5, y + .04, z + .5); scene.add(m); G.traps.push({ x: x + .5, y, z: z + .5, m, armed: true }); }
// ---------------- Damage ----------------
function damageBlock(x, y, z, amt, quiet) { const t = get(x, y, z); if (!t || t == 1 || !inb(x, y, z)) return false; if (G.shield && INFO[t].base) return false; const i = I(x, y, z);
  const before = bhp[i] / INFO[t].hp; bhp[i] -= amt;
  if (bhp[i] <= 0) { setB(x, y, z, 0); fx.clearCell(x + ',' + y + ',' + z); fx.debris(x, y, z, INFO[t].c, GX.Q.particles > 900 ? 7 : 4); sfx.brk(t == 5 || t == 3 || t == 6 ? 3 : t == 4 || t == 8 ? 4 : 2, vol(x, z)); return true; }
  const after = bhp[i] / INFO[t].hp; const rows = [.8, .55, .3]; if (rows.some(r => before > r && after <= r)) markDirty(x, z); if (!quiet) sfx.chip(vol(x, z) * .6); return false; }
function vol(x, z) { return Math.max(0, 1 - Math.hypot(x - P.pos.x, z - P.pos.z) / 45); }
function explode(c, r, dmg, team) { for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) { if (x * x + y * y + z * z > r * r) continue; const bx = Math.floor(c.x) + x, by = Math.floor(c.y) + y, bz = Math.floor(c.z) + z;
    const t = get(bx, by, bz); if (team == 'def' && t && INFO[t].base) continue; damageBlock(bx, by, bz, dmg * 1.5, true); }
  for (const u of [...G.units, P]) { const uteam = u === P ? P.team : u.team; if (uteam == team || u.hp <= 0) continue; const dd = u.pos.distanceTo(c); if (dd < r + 1) hurt(u, dmg * (1 - dd / (r + 2))); }
  fx.explosion(c, r); sfx.at(c, () => sfx.boom(1), .8);
  for (let k = 0; k < 6; k++) { const d = new THREE.Vector3(Math.random() - .5, -Math.random() * .8, Math.random() - .5).normalize(); const h = rayVox(c, d, r + 2); if (h) { const n = new THREE.Vector3(h.px - h.x, h.py - h.y, h.pz - h.z); if (n.lengthSq() == 1) fx.decal('scorch', c.clone().addScaledVector(d, h.dist), n, r * 1.3, h.y > 0 ? h.x + ',' + h.y + ',' + h.z : null); } } if (c.distanceTo(P.pos) < 14) shake = Math.max(shake, .5 * (1 - c.distanceTo(P.pos) / 14)); }
let shake = 0, hurtFlash = 0;
function hurt(u, d) { if (u === P) { if (G.mode === 'zombies') zombies.state.lastHurt = G.t; if (P.dead > 0 || P.downed) return; P.hp -= d; hurtFlash = Math.min(1, hurtFlash + d / 30); sfx.hurt(); { let src = P.hitFrom, bd = 1e9; if (!src) for (const e of G.units) { if (e.hp > 0 && e.team != P.team) { const dd = e.pos.distanceTo(P.pos); if (dd < bd) { bd = dd; src = e.pos; } } } dmgDir(src); P.hitFrom = null; } if (P.hp <= 0) P.streak = 0; if (P.hp <= 0) { if (G.mode === 'zombies') zombies.onZeroHP(); else { P.dead = 5; msg('You were knocked out – respawning in 5s', 3); } } } else { u.hp -= d; if (u.hp <= 0) u.deadT = 1.4; } }
const feedEl = () => $('feed');
function feed(txt, cls = '') { const el = feedEl(); if (!el) return; const d = document.createElement('div'); d.className = 'kf ' + cls; d.textContent = txt; el.prepend(d); while (el.children.length > 5) el.lastChild.remove(); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 5000); }
function dmgDir(from) { if (!from) return; const a = Math.atan2(from.x - P.pos.x, from.z - P.pos.z); const rel = a - Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)); const el = document.createElement('div'); el.className = 'ddir'; el.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`; $('hud').appendChild(el); setTimeout(() => el.remove(), 900); }
// Killstreaks (classic modes): 3 RECON DRONE (enemies on compass), 5 PRECISION STRIKE (bombing run ahead), 7 SENTRY (auto turret)
const STREAKS = [[3, 'RECON DRONE'], [5, 'PRECISION STRIKE'], [7, 'SENTRY GUN']];
function onKill(name, head) { feed(`YOU  ⌖${head ? ' ◉' : ''}  ${name}`, 'me'); P.streak = (P.streak || 0) + 1; for (const [n, k] of STREAKS) if (P.streak === n && G.mode !== 'zombies') { feed('KILLSTREAK — ' + k, 'ks'); msg(k + ' READY — deploying', 2.5); sfx.horn(); useStreak(k); } }
function useStreak(k) { if (k === 'RECON DRONE') G.uavT = 25; else if (k === 'PRECISION STRIKE') precisionStrike(P.pos, P.yaw); else if (k === 'SENTRY GUN') { const f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); const x = Math.round(P.pos.x + f.x * 3), z = Math.round(P.pos.z + f.z * 3); G.sentries = G.sentries || []; const m = makeDefense('turret'); m.position.set(x + .5, Math.floor(P.pos.y), z + .5); scene.add(m); G.sentries.push({ m, pos: m.position.clone(), cd: 0, life: 45 }); } }
function precisionStrike(o, yaw) { const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); for (let i = 0; i < 6; i++) setTimeout(() => { if (G.over) return; const c = o.clone().addScaledVector(f, 14 + i * 4).add(new THREE.Vector3((Math.random() - .5) * 3, 1, (Math.random() - .5) * 3)); if (G.mode === 'zombies') zombies.strikeAt(c); else explode(c, 3, 260, P.team); }, 900 + i * 220); sfx.horn(); }
function updateSentries(dt) { if (!G.sentries) return; G.sentries = G.sentries.filter(s => { s.life -= dt; s.cd -= dt; let best = null, bd = 22; for (const u of G.units) { if (u.hp <= 0 || u.team == P.team) continue; const d = u.pos.distanceTo(s.pos); if (d < bd && los(s.pos.clone().setY(s.pos.y + 1.2), eye(u))) { bd = d; best = u; } }
  if (best) { s.m.rotation.y = Math.atan2(-(best.pos.x - s.pos.x), -(best.pos.z - s.pos.z)); if (s.cd <= 0) { s.cd = .18; const a = s.pos.clone().setY(s.pos.y + 1.2); fx.tracer(a, eye(best), 0xffc070, .05); sfx.at(s.pos, () => sfx.shot([2300, 140, .4])); if (G.mode === 'zombies') zombies.damage(best, 30, false); else { hurt(best, 30); if (best.hp <= 0) feed('SENTRY  ⌖  ' + best.d.n, 'me'); } } }
  if (s.life <= 0) { scene.remove(s.m); return false; } return true; }); }
let msgT = 0; function msg(s, t = 2) { $('msg').textContent = s; msgT = t; }
// ---------------- Units (original troops) ----------------
const UDEF = { skirm: { n: 'Rifleman', hp: 200, spd: 3.3, dmg: 7, rate: .55, range: 20, wall: 75, col: 0xff8a30, s: 1 },
  breaker: { n: 'Sapper', hp: 280, spd: 3, dmg: 0, rate: 1, range: 0, wall: 300, col: 0xc04020, bomb: 1, s: 1 },
  bulwark: { n: 'Breacher', hp: 1000, spd: 2.3, dmg: 0, rate: 1, range: 0, wall: 150, col: 0x8c8a84, s: 1.45, def: 1 },
  warden: { n: 'Defender', hp: 130, spd: 3.4, dmg: 6, rate: .6, range: 24, wall: 0, col: 0x3070ff, s: 1 } };
function makeUnit(kind, team, x, z) { const d = UDEF[kind]; const g = makeTroop(kind); scene.add(g);
  const u = { kind, d, team, hp: d.hp, pos: new THREE.Vector3(x, 1, z), vy: 0, cd: Math.random(), m: g, guard: new THREE.Vector3(x, 1, z), path: null, pi: 0, repath: Math.random(), atkT: 0, moving: false, deadT: 0 };
  G.units.push(u); return u; }
const enemiesOf = team => { const l = G.units.filter(u => u.team != team && u.hp > 0); if (P.team != team && P.dead <= 0) l.push(P); return l; };
const eye = u => u.pos.clone().add(new THREE.Vector3(0, u === P ? 1.6 : 1.5 * (u.d.s || 1), 0));
function nearestEnemy(u, range) { let best = null, bd = range; for (const e of enemiesOf(u.team)) { const dd = e.pos.distanceTo(u.pos); if (dd < bd && los(eye(u), eye(e))) { bd = dd; best = e; } } return best; }
const coreSt = () => G.structures.find(s => s.kind == 'core');
// ---------------- Grid A* pathfinding ----------------
const costA = new Float32Array(W * D), costD = new Float32Array(W * D);
function rebuildGrid() { for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { let hp = 0, s1 = blocks[I(x, 1, z)], s2 = blocks[I(x, 2, z)], s3 = blocks[I(x, 3, z)];
    for (let y = 1; y <= 3; y++) { const t = blocks[I(x, y, z)]; if (t) hp += bhp[I(x, y, z)]; }
    const step = s1 && !s2 && !s3; const i = x + z * W;
    costA[i] = !s1 && !s2 ? 1 : step ? 1.6 : 1 + hp / 45; costD[i] = !s1 && !s2 ? 1 : step ? 1.6 : Infinity; } gridDirty = false; }
const gS = new Float32Array(W * D), from = new Int32Array(W * D), closed = new Uint8Array(W * D);
function astar(sx, sz, gx, gz, cost, goalR = 0) { sx = Math.max(0, Math.min(W - 1, sx | 0)); sz = Math.max(0, Math.min(D - 1, sz | 0)); gx = Math.max(0, Math.min(W - 1, gx | 0)); gz = Math.max(0, Math.min(D - 1, gz | 0));
  gS.fill(Infinity); closed.fill(0); const heap = []; const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m == k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + .414 * Math.min(dx, dz); };
  const s = sx + sz * W; gS[s] = 0; from[s] = -1; push(h(sx, sz), s); let found = -1, it = 0;
  while (heap.length && it++ < 12000) { const [, c] = pop(); if (closed[c]) continue; closed[c] = 1; const cx = c % W, cz = (c / W) | 0;
    if (Math.max(Math.abs(cx - gx), Math.abs(cz - gz)) <= goalR) { found = c; break; }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue; const n = nx + nz * W;
      let c2 = cost[n]; if (Math.max(Math.abs(nx - gx), Math.abs(nz - gz)) <= goalR) c2 = 1; if (!isFinite(c2)) continue;
      if (dx && dz) { if (cost[cx + dx + cz * W] > 1.7 || cost[cx + (cz + dz) * W] > 1.7) continue; c2 *= 1.414; }
      const g = gS[c] + c2; if (g < gS[n]) { gS[n] = g; from[n] = c; push(g + h(nx, nz), n); } } }
  if (found < 0) return null; const path = []; for (let c = found; c >= 0 && c != s; c = from[c]) path.push([c % W + .5, ((c / W) | 0) + .5]); return path.reverse(); }
// ---------------- Unit AI ----------------
function pickGoal(u) { const tg = G.structures.filter(s => alive(s) && (u.kind == 'breaker' ? s.kind == 'core' : u.kind == 'bulwark' ? !!s.d.range : true)); const list = tg.length ? tg : G.structures.filter(alive);
  let bd = 1e9, goal = null; for (const s of list) { const dd = Math.hypot(s.x - u.pos.x, s.z - u.pos.z); const w = s.d.range ? dd * .6 : s.kind == 'core' ? dd * .8 : dd; if (w < bd) { bd = w; goal = s; } } return goal; }
function updateUnit(u, dt) { const d = u.d;
  if (u.hp <= 0) { u.deadT -= dt; animateTroop(u.m, dt, false, 0, 1); if (u.deadT <= 0) { scene.remove(u.m); return false; } return true; }
  u.atkT = Math.max(0, u.atkT - dt * 4); u.moving = false;
  const far = u.pos.distanceToSquared(P.pos) > 2500; if (!far || (G.t * 60 | 0) % 2 == 0) animateTroop(u.m, far ? dt * 2 : dt, u.lastMoving, u.atkT, 0);
  if (G.phase != 'raid') { u.m.position.copy(u.pos); return true; }
  u.cd -= dt; let goal = null; const foe = d.range ? nearestEnemy(u, d.range) : null;
  if (foe && u.cd <= 0) { u.cd = d.rate; u.atkT = 1; const a = eye(u), b = eye(foe); b.x += (Math.random() - .5) * 1.1; b.y += (Math.random() - .5) * 1.1; const dir = b.clone().sub(a).normalize();
    u.m.rotation.y = Math.atan2(-dir.x, -dir.z); const col = u.team == 'att' ? 0xff6a3a : 0x8aff60; sfx.at(u.pos.clone().setY(u.pos.y + 1.5), () => sfx.enemyShot(1));
    const hb = rayVox(a, dir, a.distanceTo(b)); if (hb) { const e = a.clone().addScaledVector(dir, hb.dist); fx.tracer(a, e, col); hitFx(e, hb, dir); if (u.team == 'att') damageBlock(hb.x, hb.y, hb.z, d.wall * .35); } else { fx.tracer(a, b, col); if (Math.random() < .7) hurt(foe, d.dmg); } }
  if (u.team == 'att') { if (!u.gs || !alive(u.gs) || u.repath <= 0) { u.gs = pickGoal(u); }
    goal = u.gs; if (foe && u.kind == 'skirm' && foe.pos.distanceTo(u.pos) < 9) goal = null; }
  else { const f = nearestEnemy(u, 40) || enemiesOf('def').sort((a, b) => a.pos.distanceTo(u.pos) - b.pos.distanceTo(u.pos))[0]; goal = f && f.pos.distanceTo(u.pos) > (foe ? 12 : 2) ? { x: f.pos.x, z: f.pos.z, d: { s: 0 } } : (f ? null : { x: u.guard.x, z: u.guard.z, d: { s: 0 } }); }
  // at the target structure: smash it
  if (u.team == 'att' && u.gs && goal && Math.hypot(u.gs.x - u.pos.x, u.gs.z - u.pos.z) < u.gs.d.s / 2 + 1.9) { u.cd2 = (u.cd2 || 0) - dt; if (u.cd2 <= 0) { u.cd2 = .5; const st = u.gs; let bb = null, bd = 1e9;
      for (let i = 0; i < st.d.s; i++) for (let k = 0; k < st.d.s; k++) for (let y = st.y0; y < st.top; y++) { if (!get(st.bx + i, y, st.bz + k)) continue; const dd = Math.hypot(st.bx + i + .5 - u.pos.x, y - u.pos.y - 1, st.bz + k + .5 - u.pos.z); if (dd < bd) { bd = dd; bb = [st.bx + i, y, st.bz + k]; } }
      if (bb) { const c = new THREE.Vector3(bb[0] + .5, bb[1] + .5, bb[2] + .5); u.atkT = 1; u.m.rotation.y = Math.atan2(-(c.x - u.pos.x), -(c.z - u.pos.z));
        if (d.bomb) { explode(c, 2.6, d.wall, 'att'); u.hp = 0; u.deadT = .01; } else if (d.range) { fx.tracer(eye(u), c, 0xffb050); damageBlock(...bb, d.wall); } else { explode(c, 1.3, d.wall * .5, 'att'); damageBlock(...bb, d.wall); } } } goal = null; }
  if (goal) { u.repath -= dt; const gx = goal.x, gz = goal.z;
    if (!u.path || u.repath <= 0 || u.pi >= u.path.length) { if (gridDirty) rebuildGrid(); u.path = astar(u.pos.x, u.pos.z, gx, gz, u.team == 'att' ? costA : costD, Math.max(1, Math.floor((goal.d.s || 0) / 2) + 1)); u.pi = 0; u.repath = 1.5 + Math.random(); }
    let wx = gx, wz = gz; if (u.path && u.pi < u.path.length) { [wx, wz] = u.path[u.pi]; if (Math.hypot(wx - u.pos.x, wz - u.pos.z) < .45) { u.pi++; if (u.pi < u.path.length) [wx, wz] = u.path[u.pi]; } }
    const dir = new THREE.Vector3(wx - u.pos.x, 0, wz - u.pos.z); const L = dir.length();
    if (L > .3) { dir.normalize(); u.m.rotation.y = Math.atan2(-dir.x, -dir.z);
      const step = d.spd * dt, nx = u.pos.x + dir.x * .55, nz = u.pos.z + dir.z * .55, fy = Math.floor(u.pos.y + .01);
      const footS = solid(nx, fy, nz), headS = solid(nx, fy + 1, nz);
      if (!footS && !headS) { u.pos.x += dir.x * step; u.pos.z += dir.z * step; u.moving = true; }
      else if (footS && !headS && !solid(nx, fy + 2, nz) && !solid(u.pos.x, fy + 2, u.pos.z)) { u.pos.y = fy + 1; u.pos.x += dir.x * step; u.pos.z += dir.z * step; u.moving = true; }
      else if (u.team == 'att') { if (d.bomb) { explode(new THREE.Vector3(nx, fy + 1, nz), 2.6, d.wall, 'att'); u.hp = 0; u.deadT = .01; }
        else { u.cd2 = (u.cd2 || 0) - dt; if (u.cd2 <= 0) { u.cd2 = .45; u.atkT = 1; const by = headS ? fy + 1 : fy; const bx = Math.floor(nx), bz = Math.floor(nz);
          damageBlock(bx, by, bz, d.wall); if (headS && footS) damageBlock(bx, fy, bz, d.wall * .5); fx.impact(new THREE.Vector3(nx, by + .5, nz), [1, .7, .4]); if (d.range) fx.tracer(eye(u), new THREE.Vector3(nx, by + .5, nz), 0xffb050); } } }
      else { u.repath = 0; } } }
  // separation
  for (const o of G.units) { if (o === u || o.hp <= 0) continue; const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, dd = dx * dx + dz * dz; if (dd < .36 && dd > 1e-4) { const k = (.6 - Math.sqrt(dd)) * .5; const nx = u.pos.x + dx * k, nz = u.pos.z + dz * k; if (!solid(nx, u.pos.y + .1, nz) && !solid(nx, u.pos.y + 1.1, nz)) { u.pos.x = nx; u.pos.z = nz; } } }
  if (!solid(u.pos.x, u.pos.y - .05, u.pos.z)) { u.vy -= 20 * dt; u.pos.y += u.vy * dt; if (solid(u.pos.x, u.pos.y, u.pos.z)) { u.pos.y = Math.floor(u.pos.y) + 1; u.vy = 0; } } else u.vy = 0;
  if (u.pos.y < -5) u.hp = 0;
  u.lastMoving = u.moving; u.m.position.copy(u.pos); return true; }
// ---------------- Defenses ----------------
function updateStructures(dt) {
  for (const s of G.structures) {
    s.fxT -= dt; if (s.fxT <= 0) { s.fxT = .35; const was = s.frac; s.frac = countSt(s) / s.n0;
      if (s.mesh) { const dead = s.d.range ? (!topIntact(s) || s.frac < .25) : s.kind == 'core' ? coreDown() : s.frac < .5;
        if (dead) { scene.remove(s.mesh); s.mesh = null; fx.explosion(new THREE.Vector3(s.x, s.top + .5, s.z), 2); sfx.boom(vol(s.x, s.z)); if (s.d.range) msg(s.d.n + ' destroyed!', 1.2); } }
      if (s.frac > .02 && s.frac < .66) fx.smokePuff(s.x, s.top + .3, s.z, s.frac < .4); }
    if (!s.mesh) continue; const h = s.mesh.userData.head;
    if (s.kind == 'core') { s.mesh.userData.gem.rotation.y = Math.sin(G.t * 2.3) * .25; }
        if (s.frac < .66 && h) h.rotation.z = (1 - s.frac) * .25;
    if (G.phase != 'raid' || !s.d.range) continue;
    s.cd -= dt; if (s.cd > 0) continue; const o = new THREE.Vector3(s.x, s.top + 1, s.z); let best = null, bd = s.d.range;
    for (const e of enemiesOf('def')) { const dd = e.pos.distanceTo(o); if (dd < bd && dd > (s.d.min || 0) && (s.kind == 'mortar' || los(o, eye(e)))) { bd = dd; best = e; } }
    if (!best) continue; s.cd = s.d.rate * (s.frac < .5 ? 1.5 : 1); const tp = eye(best); h.rotation.y = Math.atan2(-(tp.x - o.x), -(tp.z - o.z));
    if (s.kind == 'mortar') { const c = best.pos.clone().add(new THREE.Vector3(Math.random() * 2 - 1, .5, Math.random() * 2 - 1)); fx.tracer(o, c, 0xff6030, .15); fx.muzzle(o, [1, .5, .2]); explode(c, s.d.splash, s.d.dmg, 'def'); }
    else { fx.tracer(o, tp, s.d.col, .1); fx.muzzle(o, [1, .7, .35]); fx.impact(tp, [1, .8, .5]); sfx.at(o, () => sfx.zap(1)); hurt(best, s.d.dmg); } } }
function updateTraps() { if (G.phase != 'raid') return; for (const t of G.traps) { if (!t.armed) continue; for (const e of enemiesOf('def')) { if (Math.hypot(e.pos.x - t.x, e.pos.z - t.z) < 1.3 && Math.abs(e.pos.y - t.y) < 1.5) { t.armed = false; scene.remove(t.m); explode(new THREE.Vector3(t.x, t.y + .5, t.z), 2, 70, 'def'); msg('Mine triggered!', 1); break; } } } }
// ---------------- Player & input ----------------
const vm = makeViewmodel(); vm.scale.setScalar(.55); camera.add(vm);
const ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, opacity: .28, depthWrite: false }), 9); ghost.count = 0; ghost.frustumCulled = false; scene.add(ghost);
const keys = {}; addEventListener('keydown', e => { if (e.code === 'Tab' && G.phase != 'menu') e.preventDefault(); keys[e.code] = true; if (!(e.repeat && G.mode === 'zombies' && e.code === 'KeyE')) onKey(e.code); }); addEventListener('keyup', e => keys[e.code] = false);
const locked = () => document.pointerLockElement === renderer.domElement;
document.addEventListener('mousemove', e => { if (!locked()) return; look(e.movementX * .0022, e.movementY * .0022); });
function look(dx, dy) { P.swX = (P.swX || 0) + dx; P.swY = (P.swY || 0) + dy; P.yaw -= dx; P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - dy)); }
let mouseL = false; renderer.domElement.addEventListener('mousedown', e => { sfx.init(); if (IS_TOUCH) return; if (!locked()) { renderer.domElement.requestPointerLock(); return; } if (e.button == 0) mouseL = true; if (e.button == 2) { if (building()) place(); else P.adsHeld = true; } });
addEventListener('mouseup', e => { if (e.button == 0) mouseL = false; if (e.button == 2) P.adsHeld = false; }); addEventListener('contextmenu', e => e.preventDefault());
const pieces = () => G.mode == 'attack' || G.mode == 'zombies' ? PIECES_ATT : PIECES_DEF;
const building = () => G.phase == 'build' || G.phase == 'zbuild';
const act = { slide() { if ((P.sprintK || 0) > .3 && P.onGround) { P.slideT = .75; sfx.step(true); } else input.jump = false; }, piece() { P.piece = (P.piece + 1) % pieces().length; sfx.ui(); hotbar(); }, mat() { P.mat = (P.mat + 1) % 3; sfx.ui(); hotbar(); },
  reload() { if (P.ammo < P.mag && P.reload <= 0 && (G.mode !== 'zombies' || P.reserve[P.slots[P.w]] > 0)) { P.reload = WP().reload * (G.mode === 'zombies' && zombies.state.perks.reload ? .6 : 1); P.reloadMax = P.reload; sfx.reload(); } }, swap() { equip(1 - P.w); }, ads() { input.ads = !input.ads; }, skip() { if (G.mode === 'zombies') { zombies.skip(); return; } if (G.phase == 'build') G.timer = 0; else if (G.phase == 'raid' && Q.get('dev')) G.timer = 0; }, build: () => G.mode === 'zombies' ? (G.phase == 'zbuild' && !nearZStation() ? place() : zombies.use()) : place(),
  inspect() { if (P.reload <= 0) P.inspect = 2.2; }, score() { G.scoreOn = !G.scoreOn; }, help() { const k = $('keys'); k.hidden = !k.hidden; }, fs() { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else goFullscreen(); },
  quit() { if (confirm('Quit to the main menu?')) location.href = location.pathname; } };
const nearZStation = () => !!(zombies.nearest() || zombies.reviveTarget());
let lastShift = 0;
function onKey(c) { if (G.phase == 'menu' || G.over) return; if (c == 'ShiftLeft') { const n = performance.now(); if (n - lastShift < 320) P.tacReq = true; lastShift = n; } if ((c == 'KeyC' || c == 'ControlLeft') && (P.sprintK || 0) > .5 && P.onGround) { P.slideT = .75; sfx.step(true); } if (c == 'KeyI' && P.reload <= 0) P.inspect = 2.2; if (c == 'KeyE' && G.mode === 'zombies') zombies.use(); if (c == 'KeyQ') { if (building()) act.piece(); else act.swap(); } if (c == 'KeyZ') act.mat(); if (c == 'KeyR') act.reload(); if (c == 'KeyG') act.skip(); if (c == 'KeyH') act.help(); if (c == 'KeyV' && G.mode === 'zombies') zombies.voice.toggle(); if (c == 'Digit1') equip(0); if (c == 'Digit2') equip(1); }
addEventListener('wheel', e => { if (G.phase != 'menu' && !G.over) equip(1 - P.w); }, { passive: true });
const input = { mx: 0, mz: 0, fire: false, jump: false, ads: false };
if (IS_TOUCH) initTouch(input, look, act, () => sfx.init());
const heldUse = () => !!(keys.KeyE || input.use);
const fwd = () => new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
function canPlace(x, y, z) { if (!inb(x, y, z) || get(x, y, z)) return false; const p = P.pos; if (Math.abs(x + .5 - p.x) < .9 && Math.abs(z + .5 - p.z) < .9 && y >= Math.floor(p.y) && y <= p.y + 1.8) return false;
  if (G.mode == 'attack' && G.phase == 'build' && Math.hypot(x - CX, z - CZ) < 26) return false; if (G.mode == 'zombies' && !zombies.canBuild(x, y, z)) return false; return true; }
function pieceCells(h) { const name = pieces()[P.piece]; const f = fwd(); const ax = Math.abs(f.x) > Math.abs(f.z); const fx_ = ax ? Math.sign(f.x) : 0, fz = ax ? 0 : Math.sign(f.z); const rx = fz ? 1 : 0, rz = fx_ ? 1 : 0;
  const cells = [], X = h.px, Y = h.py, Z = h.pz;
  if (name == 'Wall') for (let i = -1; i <= 1; i++) for (let j = 0; j < 3; j++) cells.push([X + i * rx, Y + j, Z + i * rz]);
  if (name == 'Floor') for (let i = -1; i <= 1; i++) for (let k = 0; k < 3; k++) cells.push([X + i * rx + k * fx_, Y, Z + i * rz + k * fz]);
  if (name == 'Ramp') for (let i = -1; i <= 1; i++) for (let k = 0; k < 3; k++) cells.push([X + i * rx + k * fx_, Y + k, Z + i * rz + k * fz]);
  if (COST[name]) cells.push([X, Y, Z]); return cells; }
function place() { if (P.dead > 0 || P.downed || G.phase == 'menu' || G.over) return; if (G.mode == 'zombies' && G.phase != 'zbuild') { msg('Building is only allowed in the build phase', 1); return; } const h = rayVox(camera.position, fwd(), 8); if (!h) { msg('Aim at a surface (within 8 blocks)', 1); return; }
  const name = pieces()[P.piece];
  if (COST[name]) { if (G.gears < COST[name]) { msg('Not enough Gears', 1); return; } if (G.phase != 'build') { msg('Defenses can only be placed during prep', 1); return; }
    const x = h.px, y = h.py, z = h.pz; G.gears -= COST[name]; if (name == 'AT Mine') addTrap(x, y, z); else { placeStructure(name == 'MG Nest' ? 'turret' : 'mortar', x + 1, z + 1, y); stats.baseTotal = stats.base; stats.coreTotal = stats.core; } sfx.place(); hotbar(); return; }
  const mt = MATS[P.mat]; const ok = pieceCells(h).filter(c => canPlace(...c)); if (!ok.length) { msg(G.mode == 'attack' && G.phase == 'build' ? 'Cannot build inside the enemy shield zone' : G.mode == 'zombies' ? 'Build inside the outpost walls' : 'No room', 1); return; }
  if (G.mat[mt] < ok.length) { msg('Not enough ' + INFO[mt].n, 1); return; } G.mat[mt] -= ok.length; for (const c of ok) setB(...c, mt); sfx.place(); if (G.mode == 'zombies') zombies.onPlace(ok, mt); }
function updateGhost() { ghost.count = 0; if (!building() || P.dead > 0) return; const h = rayVox(camera.position, fwd(), 8); if (!h) return; const m = new THREE.Matrix4(); let n = 0, bad = 0;
  for (const c of pieceCells(h)) { const ok = canPlace(...c); if (!ok) bad++; if (n < 9) { m.makeTranslation(c[0] + .5, c[1] + .5, c[2] + .5); ghost.setMatrixAt(n++, m); } }
  ghost.count = bad == n ? 0 : n; ghost.material.color.set(bad == n ? 0xff5050 : 0x60ff90); ghost.material.opacity = bad == n ? .12 : .3; ghost.instanceMatrix.needsUpdate = true; }
let hitT = 0;
const WP = () => WEAPONS[P.slots[P.w]];
function equip(i) { if (i == P.w && vm.userData.gun) return; P.w = i; const k = P.slots[i], W_ = WEAPONS[k]; if (P.ammoOf[k] == null) P.ammoOf[k] = W_.mag; P.mag = W_.mag; P.ammo = P.ammoOf[k]; P.reload = 0; P.swap = .35; vm.userData.setGun(k); sfx.ui(); }
function shoot() { const W_ = WP(); if ((P.sprintK || 0) > .4 && P.slideT <= 0) return; if (P.reload > 0 || P.cd > 0 || P.dead > 0 || P.downed || P.swap > 0) return; if (P.ammo <= 0) { act.reload(); return; }
  if (!W_.auto && P.trigHeld) return; P.trigHeld = true;
  P.ammo--; P.shots = (P.shots || 0) + 1; P.ammoOf[P.slots[P.w]] = P.ammo; P.cd = 60 / W_.rpm; P.recoil = Math.min(1.6, P.recoil + W_.recoil * .6); P.burst = (P.cd > -.15 ? (P.burst || 0) + 1 : 0); const pat = Math.sin(P.burst * .7) * .6 + (P.burst > 6 ? .4 : -.2); P.pitch = Math.min(1.55, P.pitch + W_.recoil * .006 * (1 - P.adsT * .4)); P.yaw += (pat * .5 + (Math.random() - .5) * .5) * W_.recoil * .004; sfx.shot(W_.snd);
  const spread = W_.spread + (W_.ads - W_.spread) * P.adsT + (P.onGround ? 0 : .02) + Math.hypot(P.vel.x, P.vel.z) * .0015 * (1 - P.adsT);
  const o = camera.position.clone(); const mz = vm.userData.flash.getWorldPosition(new THREE.Vector3());
  vm.userData.flash.visible = P.adsT < .6; vm.userData.flash.scale.setScalar(.8 + Math.random() * .3); vm.userData.flash.rotation.z = Math.random() * 6; P.flashT = .025; fx.muzzle(mz, [1, .72, .4], 1 - P.adsT * .6);
  const gun = vm.userData.gun; if (gun) { const ep = gun.localToWorld(gun.userData.eject.clone()); const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion); fx.shell(ep, r.multiplyScalar(2 + Math.random()).addScaledVector(u, 1.5 + Math.random()).add(P.vel)); }
  if (W_.rocket) { const d = fwd(); P.recoil = 2.4; launchRocket(mz.clone().addScaledVector(d, .4), d.multiplyScalar(42), true); if (G.mode === 'zombies') zombies.rocket(mz, d); return; }
  let hitAny = false, killAny = false;
  for (let pi = 0; pi < (W_.pellets || 1); pi++) { const d = fwd(); d.x += (Math.random() - .5) * spread * 2; d.y += (Math.random() - .5) * spread * 2; d.z += (Math.random() - .5) * spread * 2; d.normalize();
    const R = W_.range; const hb = rayVox(o, d, R); let best = null, bt = hb ? hb.dist : R, head = false;
    for (const u of G.units) { if (u.team == P.team || u.hp <= 0) continue; const s = u.d.s || 1;
      for (const [hy, r, hd] of [[1.68 * s, .16 * s, true], [1.15 * s, .32 * s, false], [.55 * s, .22 * s, false]]) { const c = u.pos.clone(); c.y += hy; const t = c.clone().sub(o).dot(d); if (t < 0 || t > bt) continue; if (o.clone().addScaledVector(d, t).distanceTo(c) < r) { bt = t; best = u; head = hd; } } }
    const end = o.clone().addScaledVector(d, bt); if (pi < 3) fx.tracer(mz, end, 0xffb060, .05);
    const fall = Math.max(.5, 1 - bt / R * .5);
    if (best) { const dmg = Math.round(W_.dmg * (head ? 2 : 1) * fall); if (G.mode === 'zombies') zombies.damage(best, dmg, head); else best.hp -= dmg; fx.number(end, dmg, head); fx.impactMat(end, d.clone().negate(), 'flesh'); hitAny = true; if (G.mode === 'zombies' && best.hp <= 0) killAny = true; if (best.hp <= 0 && !best.deadT) { best.deadT = 1.4; killAny = true; onKill(best.d.n, head); } }
    else if (hb && G.mode !== 'zombies') { const t = get(hb.x, hb.y, hb.z); hitFx(end, hb, d); if (!(P.team == 'def' && INFO[t] && INFO[t].base)) { const bd = Math.round(W_.dmg * 1.15); if (!G.shield || !INFO[t].base) fx.number(end, bd, false, '#ffcf8a'); damageBlock(hb.x, hb.y, hb.z, bd); } } }
  if (hitAny) { sfx.hit(killAny); hitT = .18; $('hitm').className = killAny ? 'kill' : ''; } }
// ---------------- Rockets (secondary weapon) ----------------
const rockets = []; const rkMat = new THREE.MeshStandardMaterial({ color: 0x4f5a3c, roughness: .6, metalness: .3 }), rkFlame = new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
function warheadMesh() { const g = new THREE.Group(); const cone = new THREE.Mesh(new THREE.ConeGeometry(.09, .26, 12), rkMat); cone.rotation.x = -Math.PI / 2; cone.position.z = -.2; g.add(cone);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .045, .16, 12), rkMat); body.rotation.x = Math.PI / 2; body.position.z = -.0; g.add(body);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 8), rkMat); rod.rotation.x = Math.PI / 2; rod.position.z = .22; g.add(rod);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.006, .09, .1), rkMat); f.position.set(Math.cos(i * 1.57) * .06, Math.sin(i * 1.57) * .06, .33); f.rotation.z = i * 1.57; g.add(f); }
  const fl = new THREE.Mesh(new THREE.ConeGeometry(.07, .55, 10), rkFlame); fl.rotation.x = -Math.PI / 2; fl.position.z = .65; g.add(fl); g.userData.flame = fl; return g; }
function launchRocket(pos, vel, mine) { const m = warheadMesh(); m.position.copy(pos); m.lookAt(pos.clone().add(vel)); m.rotateY(Math.PI); scene.add(m); rockets.push({ m, pos: pos.clone(), vel: vel.clone(), life: 4, mine, puff: 0 }); sfx.at(pos, () => sfx.boom(.25), .4); }
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; const step = r.vel.clone().multiplyScalar(dt), L = step.length(); r.life -= dt;
    const h = rayVox(r.pos, step.clone().normalize(), L + .1); let hitU = null;
    for (const u of G.units) { if (u.hp <= 0 || u.team == P.team) continue; const c = u.pos.clone(); c.y += 1 * (u.d.s || 1); if (c.distanceTo(r.pos) < .9 * (u.d.s || 1)) { hitU = u; break; } }
    if (h || hitU || r.life <= 0) { const at = h ? r.pos.clone().addScaledVector(step.normalize(), Math.max(0, h.dist - .15)) : r.pos.clone(); scene.remove(r.m); rockets.splice(i, 1); rocketBoom(at, r.mine); continue; }
    r.pos.add(step); r.m.position.copy(r.pos); r.m.userData.flame.scale.setScalar(.7 + Math.random() * .6); r.puff -= dt; if (r.puff <= 0) { r.puff = .03; fx.smokePuff(r.pos.x, r.pos.y - 1.1, r.pos.z, false); } }
}
// Splash: big damage + knockback to enemies, light self-damage; visual-only for a co-op teammate's rocket (host applies its hits).
function rocketBoom(c, mine) { const R = 4.5;
  fx.explosion(c, 3); sfx.at(c, () => sfx.boom(1), .8); if (c.distanceTo(P.pos) < 16) shake = Math.max(shake, .7 * (1 - c.distanceTo(P.pos) / 16));
  if (!mine) return; let hitAny = false, killAny = false;
  for (const u of G.units) { if (u.hp <= 0 || u.team == P.team) continue; const dd = u.pos.distanceTo(c); if (dd > R) continue; const dmg = Math.round(320 * (1 - dd / (R + 1)));
    const push = u.pos.clone().sub(c).setY(0); if (push.lengthSq() < .01) push.set(Math.random() - .5, 0, Math.random() - .5); push.normalize().multiplyScalar(1.6 * (1 - dd / R));
    const nx = u.pos.x + push.x, nz = u.pos.z + push.z; if (!solid(nx, u.pos.y + .1, nz) && !solid(nx, u.pos.y + 1.1, nz)) { u.pos.x = nx; u.pos.z = nz; }
    u.flinch = .5; if (u.m && u.m.userData.body) u.m.userData.body.rotation.x = -.9;
    const wasAlive = u.hp > 0; if (G.mode === 'zombies') zombies.damage(u, dmg, false); else { hurt(u, dmg); if (wasAlive && u.hp <= 0) onKill(u.d.n + ' [RPG-7]'); } hitAny = true; if (u.hp <= 0) killAny = true; fx.number(u.pos.clone().setY(u.pos.y + 1.8), dmg, false); }
  const sd = c.distanceTo(P.pos.clone().setY(P.pos.y + .8)); if (sd < R - .5) { hurt(P, Math.round(22 * (1 - sd / R))); P.vel.y = Math.max(P.vel.y, 5 * (1 - sd / R)); }
  if (G.mode !== 'zombies') for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) if (x * x + y * y + z * z <= 4) { const bx = Math.floor(c.x) + x, by = Math.floor(c.y) + y, bz = Math.floor(c.z) + z, t = get(bx, by, bz); if (t && !(P.team == 'def' && INFO[t] && INFO[t].base)) damageBlock(bx, by, bz, 120, true); }
  if (hitAny) { sfx.hit(killAny); hitT = .18; $('hitm').className = killAny ? 'kill' : ''; } }
function hitFx(p, hb, d) { const t = get(hb.x, hb.y, hb.z); const n = new THREE.Vector3(hb.px - hb.x, hb.py - hb.y, hb.pz - hb.z); if (n.lengthSq() != 1) n.copy(d).negate();
  const m = INFO[t] ? INFO[t].m : 'grass'; fx.impactMat(p, n, m); if (hb.y > 0 || m == 'grass') fx.decal('hole', p, n, m == 'grass' ? .12 : .07 + Math.random() * .04, hb.y > 0 ? hb.x + ',' + hb.y + ',' + hb.z : null); }
function collides(p) { for (let x = Math.floor(p.x - .3); x <= Math.floor(p.x + .3); x++) for (let z = Math.floor(p.z - .3); z <= Math.floor(p.z + .3); z++) for (let y = Math.floor(p.y); y <= Math.floor(p.y + 1.75); y++) if (get(x, y, z)) return true; return false; }
function updatePlayer(dt) { if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { P.hp = 100; P.pos.copy(P.spawn); P.ammo = P.mag; P.ammoOf[P.slots[P.w]] = P.mag; } return; }
  const fwdHeld = keys.KeyW || input.mz < -.85; const sprinting = (keys.ShiftLeft || input.mz < -.92) && fwdHeld && P.reload <= 0 && !P.downed && !(P.adsHeld || input.ads);
  if (sprinting) { P.sprT = (P.sprT || 0) + dt; } else P.sprT = 0; const tac = sprinting && (P.tacReq || P.sprT > 1.6) && (P.tacT ?? 4) > 0; if (tac) P.tacT = Math.max(0, (P.tacT ?? 4) - dt); else { P.tacT = Math.min(4, (P.tacT ?? 4) + dt * .8); if (!sprinting) P.tacReq = false; }
  P.sprintK = (P.sprintK || 0) + ((sprinting ? 1 : 0) - (P.sprintK || 0)) * Math.min(1, dt * 10); P.slideT = Math.max(0, (P.slideT || 0) - dt);
  const sp = P.slideT > 0 ? 5 + P.slideT * 9 : tac ? 9.6 : sprinting ? 7.6 : 5; const f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), r = new THREE.Vector3(-f.z, 0, f.x); const m = new THREE.Vector3();
  if (keys.KeyW) m.add(f); if (keys.KeyS) m.sub(f); if (keys.KeyD) m.add(r); if (keys.KeyA) m.sub(r); if (m.lengthSq()) m.normalize().multiplyScalar(sp);
  if (input.mx || input.mz) { const mag = Math.min(1, Math.hypot(input.mx, input.mz)); m.copy(f).multiplyScalar(-input.mz).addScaledVector(r, input.mx).normalize().multiplyScalar((P.slideT > 0 || sprinting ? sp : 5) * mag); }
  if (P.slideT > 0) { if (!m.lengthSq()) m.copy(f); m.normalize().multiplyScalar(sp); }
  if (P.downed) m.multiplyScalar(.18); P.vel.x = m.x; P.vel.z = m.z; P.vel.y -= 22 * dt; if ((keys.Space || input.jump) && P.onGround && !P.downed) { P.vel.y = 8; P.onGround = false; }
  for (const ax of ['x', 'z', 'y']) { const old = P.pos[ax]; P.pos[ax] += P.vel[ax] * dt; if (collides(P.pos)) { if (ax != 'y' && P.onGround) { const up = P.pos.clone(); up.y = Math.floor(P.pos.y) + 1.01; if (!collides(up)) { P.pos.copy(up); continue; } if (keys.Space || input.jump) { up.y = Math.floor(P.pos.y) + 2.01; if (!collides(up)) { P.pos.copy(up); P.mantleT = .3; continue; } } } P.pos[ax] = old; if (ax == 'y') { if (P.vel.y < 0) P.onGround = true; P.vel.y = 0; } } else if (ax == 'y') P.onGround = false; }
  if (P.pos.y < -10) P.pos.copy(P.spawn);
  P.cd -= dt; P.swap = Math.max(0, P.swap - dt); if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const k = P.slots[P.w], n = G.mode === 'zombies' ? Math.min(P.mag - P.ammo, P.reserve[k] || 0) : P.mag - P.ammo; P.ammo += n; if (G.mode === 'zombies') P.reserve[k] -= n; P.ammoOf[k] = P.ammo; } } if (mouseL || input.fire) shoot(); else P.trigHeld = false;
  const wantAds = (P.adsHeld || input.ads) && !building() && P.reload <= 0 && P.dead <= 0; P.adsT += ((wantAds ? 1 : 0) - P.adsT) * Math.min(1, dt * 12);
  const fv = 75 + (WP().fov - 75) * P.adsT; if (Math.abs(camera.fov - fv) > .05) { camera.fov = fv; camera.updateProjectionMatrix(); }
  const ob = P.bob; P.bob += dt * Math.hypot(P.vel.x, P.vel.z) * 1.6; if (P.onGround && Math.floor(ob / Math.PI) != Math.floor(P.bob / Math.PI)) { const t = get(Math.floor(P.pos.x), Math.floor(P.pos.y - .1), Math.floor(P.pos.z)); sfx.step(t > 1); } P.recoil = Math.max(0, P.recoil - dt * 6); }
function updateViewmodel(dt) { const b = Math.sin(P.bob), b2 = Math.abs(Math.cos(P.bob)); const rm = P.reloadMax || 1.6; const rl = P.reload > 0 ? Math.sin(Math.min(1, (rm - P.reload) / rm) * Math.PI) : 0; const a = P.adsT, h = 1 - a;
  const sw = P.swap > 0 ? Math.sin(P.swap / .35 * Math.PI) : 0; const sy = ((vm.userData.gun && vm.userData.gun.userData.sightY) || vm.userData.sightY || .07) * .55;
  vm.position.set(.1 * h + b * .006 * h, (-.095 * h - sy * a) - b2 * .008 * h - rl * .12 - sw * .15, -.2 * h - .14 * a + P.recoil * .025);
  P.swX = (P.swX || 0) * Math.max(0, 1 - dt * 10); P.swY = (P.swY || 0) * Math.max(0, 1 - dt * 10); const kx = Math.max(-.08, Math.min(.08, P.swX * .6)), ky = Math.max(-.08, Math.min(.08, P.swY * .6));
  vm.position.x += kx * .25 * (h + .2); vm.position.y += ky * .2 * (h + .2);
  vm.rotation.set(P.recoil * .07 * h + ky * .5 * (h + .2) + rl * .5 - sw * .4, .03 * h + kx * (h + .2), rl * .35 + kx * .6 * h);
  const mg = vm.userData.gun && vm.userData.gun.userData.magM; if (mg) { const ph = P.reload > 0 ? (rm - P.reload) / rm : 1; const out = ph < .25 ? ph / .25 : ph < .55 ? 1 : ph < .8 ? 1 - (ph - .55) / .25 : 0;
    mg.position.copy(mg.userData.home); mg.position.y -= out * .35; mg.position.z += out * .05; mg.visible = !(ph > .4 && ph < .55); }
  const war = vm.userData.gun && vm.userData.gun.userData.war; if (war) { const ph = P.reload > 0 ? (rm - P.reload) / rm : 1; war.position.copy(war.userData.home);
    if (P.reload > 0) { const ins = ph < .35 ? 0 : Math.min(1, (ph - .35) / .45); war.visible = ph >= .35; war.position.z -= (1 - ins) * .35; war.position.y -= (1 - ins) * .12; } else war.visible = P.ammo > 0; }
  if (P.inspect > 0) { P.inspect -= dt; const t = 1 - P.inspect / 2.2, e = Math.sin(Math.min(1, t) * Math.PI); vm.rotation.y += e * .9; vm.rotation.z += e * .5; vm.position.x -= e * .05; vm.position.y += e * .03; }
  const spr = P.sprintK || 0; if (spr > 0) { vm.rotation.x -= spr * .55; vm.rotation.y += spr * .5; vm.position.y -= spr * .05; vm.position.x -= spr * .03; }
  const scoped = !!(WP().scope && a > .85); $('scope').classList.toggle('on', scoped);
  P.flashT = (P.flashT || 0) - dt; if (vm.userData.flash.visible && P.flashT <= 0) vm.userData.flash.visible = false; vm.visible = P.dead <= 0 && !scoped; $('cross').style.opacity = a > .5 || spr > .5 ? 0 : 1; }
// ---------------- Match flow ----------------
function applyAtmos() { const L = Q.get('light') || $('lightsel').value, rain = (Q.get('rain') || ($('rainchk').checked ? '1' : '')) == '1' && (QNAME == 'high' || QNAME == 'ultra' || Q.get('rain') == '1');
  GX.setLighting(L, rain); fx.setRain(rain); sfx.rainLoop(rain); GX.setLens(Q.has('lens') ? Q.get('lens') == '1' : $('lenschk').checked); }
const zombies = createZombies({ G, P, scene, GX, sfx, fx, setB, get, solid, buildChunk, dirty, astar, rebuildGrid, costD, hurt, msg, equip, PBRS, mobile: IS_TOUCH, damageBlock, buildDay: () => { G.mode = 'zombies'; buildWorld(LAYOUTS[0]); G.traps.forEach(t => scene.remove(t.m)); G.traps = []; }, held: heldUse, hotbar, launchRocket, feed, onKill, precisionStrike, explodeFx: (c) => { fx.explosion(c, 3); sfx.at(c, () => sfx.boom(1), .8); } });
function start(mode, opts) { sfx.init(); document.body.classList.add('ingame'); if (mode === 'zombies') { G.mode = mode; $('menu').style.display = 'none'; $('hud').style.display = ''; zombies.init(opts); return; } P.slots = [Q.get('gun') || $('primary').value || 'carbine', 'rpg']; P.ammoOf = {}; P.w = -1; equip(0); G.mode = mode; G.layout = +$('layout').value; G.buildT = Math.max(0, +$('buildT').value || 300); $('menu').style.display = 'none'; $('hud').style.display = '';
  P.team = mode == 'attack' ? 'att' : 'def'; const L = LAYOUTS[G.layout]; buildWorld(L); G.shield = true;
  if (mode == 'attack') { P.spawn.set(CX + .5, 1, 3); P.yaw = Math.PI; G.mat = { 2: 300, 3: 200, 4: 80 };
    const roster = ['skirm', 'breaker', 'skirm', 'bulwark', 'skirm', 'breaker', 'skirm', 'skirm', 'breaker', 'bulwark', 'skirm', 'breaker'];
    roster.forEach((k, i) => makeUnit(k, 'att', CX - 16.5 + i * 3, 5)); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; makeUnit('warden', 'def', CX + Math.cos(a) * 9, CZ + Math.sin(a) * 9); } }
  else { const c = coreSt(); P.spawn.set(c.x + 5, 1, c.z - 5); P.yaw = 0; G.mat = { 2: 150, 3: 120, 4: 60 }; G.gears = 14; for (let i = 0; i < 3; i++) makeUnit('warden', 'def', CX - 4 + i * 4, CZ - 10); G.buildT = Math.min(G.buildT, 90); }
  P.pos.copy(P.spawn); applyAtmos(); G.phase = 'build'; G.timer = G.buildT; msg(mode == 'attack' ? 'BUILD PHASE – prepare siege pieces outside the shield' : 'PREP PHASE – place defenses with Gears', 4); hotbar(); }
function startRaid() { G.phase = 'raid'; G.shield = false; sfx.horn(); gridDirty = true;
  if (G.mode == 'attack') { G.timer = 180; msg('RAID! Breach the base and destroy the Command Post', 3); } else { G.wave = 0; nextWave(); } }
function nextWave() { G.wave++; const n = 3 + G.wave * 3; for (let i = 0; i < n; i++) { const side = i % 4, t = (Math.random() - .5) * 60; const [x, z] = side == 0 ? [CX + t, 4] : side == 1 ? [CX + t, D - 4] : side == 2 ? [4, CZ + t] : [W - 4, CZ + t];
    makeUnit(i % 7 == 6 ? 'bulwark' : i % 3 == 0 ? 'breaker' : 'skirm', 'att', x, z); } G.timer = 90; msg('Wave ' + G.wave + ' of 3 incoming!', 2); sfx.horn(); }
const pct = () => stats.baseTotal ? Math.round(100 * (1 - stats.base / stats.baseTotal)) : 0;
const coreDown = () => stats.core < stats.coreTotal * .25;
function crests() { let s = 0; if (pct() >= 50) s++; if (coreDown()) s++; if (pct() >= 99) s++; return s; }
function end(why) { G.over = true; G.phase = 'over'; document.exitPointerLock && document.exitPointerLock(); const s = crests();
  const att = G.mode == 'attack'; const win = att ? s > 0 : s == 0 || (!coreDown()); $('end').style.display = '';
  $('endT').textContent = win ? 'VICTORY' : 'DEFEAT'; $('endS').textContent = `${why}\nDestruction: ${pct()}%   CP: ${coreDown() ? 'TOPPLED' : 'standing'}\nAttacker Crests: ${'★'.repeat(s)}${'☆'.repeat(3 - s)}`; }
function update(dt) { if (G.phase == 'menu' || G.over) return; G.t += dt; G.timer -= dt;
  if (G.phase == 'build' && G.timer <= 0) startRaid();
  if (G.mode === 'zombies') { updatePlayer(dt); updateRockets(dt); updateSentries(dt); zombies.tick(dt); if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').textContent = ''; } return; }
  G.uavT = Math.max(0, (G.uavT || 0) - dt); updatePlayer(dt); updateRockets(dt); updateSentries(dt); G.units = G.units.filter(u => updateUnit(u, dt)); updateStructures(dt); updateTraps();
  if (G.phase == 'raid') { const atts = G.units.filter(u => u.team == 'att' && u.hp > 0);
    if (G.mode == 'attack') { if (pct() >= 99) end('Base fully demolished!'); else if (G.timer <= 0) end('Raid timer expired'); }
    else { if (coreDown()) end('The Command Post fell'); else if (!atts.length) { if (G.wave >= 3) end('All waves repelled!'); else nextWave(); } else if (G.timer <= 0) { if (G.wave >= 3) end('Survived the siege'); else nextWave(); } } }
  for (const t of G.traps) if (t.armed) t.m.rotation.y += dt * .5;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').textContent = ''; } }
function syncCamera(dt) { shake = Math.max(0, shake - dt * 1.5); const sx = (Math.random() - .5) * shake * .15;
  camera.position.set(P.pos.x, P.pos.y + (P.downed ? .55 : P.slideT > 0 ? 1.0 : 1.6) + (P.onGround ? Math.abs(Math.cos(P.bob)) * .04 : 0), P.pos.z); camera.rotation.set(P.pitch + P.recoil * .015 + sx, P.yaw + sx, 0); }
// ---------------- HUD ----------------
let hudT = 0;
function hotbar() { const ps = pieces(); $('hotbar').innerHTML = ps.map((p, i) => `<div class="slot ${i == P.piece ? 'on' : ''}">${p}${COST[p] ? `<br><small>${COST[p]}⚙</small>` : ''}</div>`).join('') + `<div class="slot on" style="border-color:#7ad0ff;color:#7ad0ff">${INFO[MATS[P.mat]].n}<br><small>${G.mat[MATS[P.mat]]}</small></div>`; }
const CMP = (() => { let h = ''; for (let d = -360; d <= 720; d += 15) { const n = ((d % 360) + 360) % 360; const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[n]; h += `<span class="${lab ? 'c' : ''}">${lab || n}</span>`; } return h; })();
function compass() { const el = $('cstrip'); if (!el) return; if (!el.innerHTML) el.innerHTML = CMP; const hd = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360; el.style.transform = `translateX(${-(hd + 360) / 15 * 40 - 20}px)`; $('chead').textContent = Math.round(hd);
  const pins = $('cpins'); let ph = ''; const uav = (G.uavT || 0) > 0 || zombies.state.uavT > 0; if (uav) for (const u of G.units) { if (u.hp <= 0 || u.team == P.team) continue; let a = Math.atan2(u.pos.x - P.pos.x, -(u.pos.z - P.pos.z)) * 180 / Math.PI - hd; a = ((a + 540) % 360) - 180; if (Math.abs(a) < 75) ph += `<i style="left:${50 + a / 75 * 50}%"></i>`; }
  for (const R of zombies.liveRemotes()) { let a = Math.atan2(R.pos.x - P.pos.x, -(R.pos.z - P.pos.z)) * 180 / Math.PI - hd; a = ((a + 540) % 360) - 180; if (Math.abs(a) < 75) ph += `<b style="left:${50 + a / 75 * 50}%"></b>`; } pins.innerHTML = ph; }
function hud(dt) { compass(); document.body.classList.toggle('lowhp', P.hp > 0 && P.hp < 35 && !P.downed); hurtFlash = Math.max(0, hurtFlash - dt * 1.5); $('vign').style.opacity = Math.max(hurtFlash, P.dead > 0 ? .8 : P.hp < 30 ? .35 : 0);
  hitT -= dt; $('hitm').style.opacity = hitT > 0 ? 1 : 0;
  hudT -= dt; if (hudT > 0) return; hudT = .1; uiSync(); if (G.mode === 'zombies') { zombies.state.showScore = !!(keys.Tab || G.scoreOn); zombies.hud(); return; } const mm = Math.max(0, G.timer) | 0; const ts = `${mm / 60 | 0}:${String(mm % 60).padStart(2, '0')}`;
  $('mode').textContent = (G.mode == 'attack' ? '⚔ ATTACK' : '🛡 DEFEND'); $('timer').textContent = ts; $('stars').textContent = '★'.repeat(crests()) + '☆'.repeat(3 - crests());
  $('sub').textContent = `${LAYOUTS[G.layout].name} · ${G.phase == 'build' ? (G.mode == 'attack' ? 'BUILD PHASE' : 'PREP PHASE') : 'RAID' + (G.mode == 'defend' ? ' · wave ' + G.wave + '/3' : '')} · ${pct()}% destroyed · CP ${coreDown() ? 'TOPPLED' : Math.round(100 * stats.core / Math.max(1, stats.coreTotal)) + '%'}`;
  $('dbar').style.width = pct() + '%'; $('hp').style.width = Math.max(0, P.hp) + '%';
  $('ammo').textContent = WP().name + '  ' + (P.reload > 0 ? 'Reloading…' : `${P.ammo} / ${P.mag}`);
  $('res').textContent = `🪵 ${G.mat[2]}  🪨 ${G.mat[3]}  ⛓ ${G.mat[4]}${G.mode == 'defend' ? '  ⚙ ' + G.gears : ''}`;
  const a = G.units.filter(u => u.team == 'att' && u.hp > 0).length, d = G.units.filter(u => u.team == 'def' && u.hp > 0).length;
  $('right').textContent = `Raiders ${a} · Wardens ${d}\nDefenses ${G.structures.filter(s => s.d.range && s.mesh).length}`;
  hotbarSync(); }
// context-sensitive touch controls: ACTION only near a buy/door/revive (or PLACE in build phase); build tools only in build phase
function uiSync() { if (!IS_TOUCH) return; const b = building(), z = G.mode === 'zombies', rt = z && zombies.reviveTarget(), s = z && zombies.nearest();
  let lab = ''; if (P.downed) lab = ''; else if (rt) lab = 'REVIVE'; else if (s) lab = (/^OPEN/.test(s.name) ? 'OPEN' : /MYSTERY/.test(s.name) ? 'BOX' : 'BUY') + `<small>${s.cost}</small>`; else if (b) lab = 'PLACE';
  const a = $('tAct'); a.hidden = !lab; if (lab && a.innerHTML !== lab) a.innerHTML = lab; $('tBuildBar').hidden = !b;
  const sk = z && zombies.state.role === 'client' ? 'VOTE SKIP' : 'SKIP'; if ($('tSkip').textContent !== sk) $('tSkip').textContent = sk; }
let hbKey = ''; function hotbarSync() { const k = P.piece + ',' + P.mat + ',' + G.mat[MATS[P.mat]] + ',' + G.gears + G.mode; if (k != hbKey) { hbKey = k; hotbar(); } }
// ---------------- Menu ----------------
LAYOUTS.forEach((l, i) => { const o = document.createElement('option'); o.value = i; o.textContent = l.name + ' – ' + l.desc; $('layout').appendChild(o); });
$('layout').value = Math.floor(Math.random() * LAYOUTS.length);
function goFullscreen() { const e = document.documentElement; const rq = e.requestFullscreen || e.webkitRequestFullscreen || e.webkitRequestFullScreen || e.mozRequestFullScreen || e.msRequestFullscreen;
  if (!rq || document.fullscreenElement || document.webkitFullscreenElement) return; try { const r = rq.call(e, { navigationUI: 'hide' }); r && r.then && r.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (_) {} }
const lockIfDesktop = () => { if (IS_TOUCH) goFullscreen(); else renderer.domElement.requestPointerLock(); };
// orientation: robust across old phones (window.orientation, matchMedia, size compare), never blocks forever
let rotSkipped = false;
function isLandscape() { const vv = window.visualViewport; const w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
  if (Math.abs(w - h) > 40) return w > h; if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90;
  if (screen.orientation && screen.orientation.type) return screen.orientation.type.startsWith('landscape'); return matchMedia('(orientation: landscape)').matches; }
function checkRot() { $('rot').classList.toggle('show', IS_TOUCH && !rotSkipped && !isLandscape()); }
const recheck = () => { checkRot(); setTimeout(checkRot, 250); setTimeout(checkRot, 800); GX.resize(); fx.setScale(); };
addEventListener('resize', recheck); addEventListener('orientationchange', recheck); window.visualViewport?.addEventListener('resize', recheck); screen.orientation?.addEventListener?.('change', recheck);
$('rotskip').onclick = () => { rotSkipped = true; checkRot(); }; setTimeout(() => { if ($('rot').classList.contains('show')) $('rotskip').textContent = 'Play anyway (portrait)'; }, 4000); checkRot();
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
if (isIOS && !standalone && !document.documentElement.requestFullscreen && !localStorage.getItem('vr_ioshint')) $('ioshint').classList.add('show');
$('ioshintx').onclick = () => { localStorage.setItem('vr_ioshint', '1'); $('ioshint').classList.remove('show'); };
$('queue').onclick = () => { msg('Queue matched!'); start(Math.random() < .5 ? 'attack' : 'defend'); lockIfDesktop(); };
const zmapSel = () => Q.get('zmap') || 'day';
$('zombies').onclick = () => { start('zombies', { map: zmapSel() }); lockIfDesktop(); };
$('zHost').onclick = () => { zombies.voice.prime(); start('zombies', { role: 'host', map: zmapSel() }); lockIfDesktop(); };
let joining = false;
function joinRoom(code) { if (joining) return; if (code.length < 4) { $('zJoinMsg').textContent = 'Enter the room code from the host'; return; } joining = true; $('zJoinMsg').textContent = 'Connecting to room ' + code + '…'; $('zJoin').disabled = true; sfx.init(); zombies.voice.prime();
  zombies.net.join(code).then(() => zombies.waitMap()).then(map => { if (!map) throw new Error('That room is full (4 players)'); lobbies.stop(); start('zombies', { role: 'client', map }); lockIfDesktop(); }).catch(e => { joining = false; $('zJoinMsg').textContent = (e && e.message) || 'Could not connect'; $('zJoin').disabled = false; lobbies.refresh(); }); }
$('zJoin').onclick = () => joinRoom(zombies.cleanCode($('zCode').value));
// Open lobbies on the main menu (hosts heartbeat to the lobby directory; stale rooms drop after ~45 s)
const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const lobbies = watchLobbies(list => { const el = $('lobbyList'), hd = $('lobbyHead'); if (!el) return;
  if (list === null) { if (!el.children.length) hd.dataset.s = 'checking…'; return; }
  hd.dataset.s = list.length ? list.length + ' open' : 'none right now — host one!';
  const html = list.slice(0, 5).map(l => `<button class="lob" data-code="${esc(l.code)}"><b>${esc(l.host)}</b><span>${esc(l.code)} · ${l.map === 'night' ? 'NIGHT' : 'DAY'}</span><i>${l.players}/${l.max}</i></button>`).join(''); if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; } }, () => G.phase == 'menu' && $('menu').style.display !== 'none');
$('lobbyList').onclick = e => { const b = e.target.closest('.lob'); if (b) { $('zCode').value = b.dataset.code; joinRoom(b.dataset.code); } };
$('vMute').onclick = e => { e.preventDefault(); zombies.voice.toggle(); };
$('vMute').addEventListener('pointerdown', e => e.stopPropagation());
$('zJoinOpen').onclick = () => { $('joinBox').hidden = false; $('zJoinOpen').hidden = true; $('zCode').focus(); };
$('gear').onclick = () => { $('settings').hidden = !$('settings').hidden; $('gear').classList.toggle('on', !$('settings').hidden); };
const showFps = v => { $('fps').hidden = !v; $('fpschk').checked = v; }; showFps(localStorage.getItem('vr_fps') === '1' || Q.get('fps') === '1'); $('fpschk').onchange = e => { localStorage.setItem('vr_fps', e.target.checked ? '1' : ''); showFps(e.target.checked); };
if (Q.get('join')) { $('joinBox').hidden = false; $('zJoinOpen').hidden = true; $('zCode').value = zombies.cleanCode(Q.get('join')); $('zJoinMsg').textContent = 'Tap CONNECT to join room ' + $('zCode').value; $('zJoin').classList.add('gold'); }
$('operator').value = localStorage.getItem('vr_op') || 'WRAITH-6'; $('operator').onchange = e => localStorage.setItem('vr_op', e.target.value);
$('att').onclick = () => { start('attack'); lockIfDesktop(); }; $('def').onclick = () => { start('defend'); lockIfDesktop(); };
const KEYS = IS_TOUCH ? 'CONTROLS\nLeft side: move · right side: look · FIRE (drag to aim)\nADS · RELOAD · JUMP · SWAP cycles weapons\nACTION appears near a wall-buy, door, box or downed teammate (hold to revive)\nBuild phase: PLACE · PIECE · MAT · SKIP (co-op clients: VOTE SKIP)\n⋯ menu: slide, inspect, scoreboard, controls, fullscreen, quit\nTap here to close'
  : 'CONTROLS\nWASD move · mouse look · LMB fire · RMB aim · Space jump / mantle · Shift sprint (double-tap: tactical)\nC slide · 1/2, Q or wheel switch weapon · R reload · I inspect · E buy / open / hold to revive\nBuild phase: RMB place · Q piece · Z material · G skip (co-op: vote)\nHold Tab: scoreboard · V: mute/unmute voice (co-op) · H: this help · Esc: release mouse';
if (IS_TOUCH) $('zBuildHint').innerHTML = 'Tap <b>SKIP</b> to start round 1 now';
$('help').textContent = KEYS.replace(/\n/g, ' · ').replace(' · Tap here to close', ''); $('keys').textContent = KEYS; $('keys').onclick = () => { $('keys').hidden = true; };
$('fsb').onclick = () => act.fs();
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) { $('fsb').style.display = 'none'; $('mFs').style.display = 'none'; }
// test hooks
window.__sim = secs => { for (let i = 0; i < secs * 20 && !G.over; i++) update(.05); return [pct(), coreDown()]; };
window.__boom = (x, y, z, r) => explode(new THREE.Vector3(x, y, z), r, 300, 'att');
if (Q.get('dev') === '1') { window.__zombies = zombies; window.__coop = { place, act, syncCamera, keys, input, setB, get, rockets, rocketBoom, launchRocket }; }
window.__G = G; window.__P = P; window.__stats = stats; window.__pct = pct; window.__Q = QNAME;
if (Q.get('auto')) { if (Q.get('layout')) $('layout').value = Q.get('layout'); if (Q.get('build')) $('buildT').value = Q.get('build'); start(Q.get('auto')); if (Q.get('pitch')) P.pitch = +Q.get('pitch'); if (Q.get('yaw')) P.yaw = +Q.get('yaw');
  if (Q.get('px')) P.pos.set(+Q.get('px'), +(Q.get('py') || 1), +Q.get('pz')); }
// ---------------- Loop with adaptive resolution ----------------
const NORENDER = Q.has('norender'); const TSCALE = +(Q.get('ts') || 1); let last = performance.now(), fAcc = 0, fN = 0, lowT = 0, pr = renderer.getPixelRatio();
function loop(t) { requestAnimationFrame(loop); const rdt = Math.max(0, Math.min(.1, (t - last) / 1000)); last = t; const dt = Math.min(.05, rdt);
  try {
  for (let k = 0; k < TSCALE; k++) update(dt);
  if (G.phase != 'menu') { syncCamera(dt); sfx.listen(camera); updateViewmodel(dt); updateGhost(); hud(dt); }
  const lp = GX.lens(); if (lp) lp.uniforms.uT.value = (t % 1000);
  const gmat = scene.userData.grassMat; if (gmat && gmat.userData.sh) gmat.userData.sh.uniforms.uT.value = performance.now() / 1000;
  if (!NORENDER) { flushChunks(); fx.update(dt); GX.followSun(P.pos); GX.render(); }
  } catch (e) { if (!window.__loopErr) { window.__loopErr = e; console.error('frame error', e); } if (/render|WebGL|shader/i.test(String(e && e.stack)) && GX.composer) { GX.composer = null; } }
  fAcc += rdt; fN++; if (fAcc > 2) { const fps = fN / fAcc; $('fps').textContent = Math.round(fps) + ' fps · ' + QNAME;
    if (!Q.get('auto') && G.phase != 'menu') { if (fps < 28) { lowT++; if (lowT >= 2) { lowT = 0; if (GX.aoPass && GX.aoPass.enabled) GX.disableAO(); else if (pr > .55) { pr = Math.max(.5, pr - .15); GX.setPR(pr); fx.setScale(); } } } else lowT = 0; }
    fAcc = 0; fN = 0; }
  }
requestAnimationFrame(loop);
