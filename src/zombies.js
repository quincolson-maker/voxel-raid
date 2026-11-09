// Original solo survival mode. Shared low-poly geometry, bounded actor/drop pools.
import * as THREE from 'three';
import { mat, makeGun, WEAPONS, makeTroop, animateTroop } from './models.js';
import { createNet, cleanCode } from './coop.js';
const $ = id => document.getElementById(id);
const geo = new THREE.BoxGeometry(1, 1, 1);
function cube(parent, size, pos, material) { const m = new THREE.Mesh(geo, material); m.scale.set(...size); m.position.set(...pos); parent.add(m); m.castShadow = true; m.receiveShadow = true; return m; }
function label(parent, text, color, y = 3.5, sc = 4) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#0b1019'; x.fillRect(0, 0, 512, 128); x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(3, 3, 506, 122);
  x.fillStyle = color; x.font = 'bold 31px sans-serif'; x.textAlign = 'center'; x.fillText(text, 256, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, fog: false, toneMapped: false })); s.position.y = y; s.scale.set(sc, sc / 4, 1); parent.add(s); return s;
}
function zombieModel() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(0x8a9c79), cloth = mat(0x4b5555), wound = mat(0x62352f), eye = mat(0xff9933, { e: 0xff6611, ei: 3 });
  cube(body, [.48, .6, .29], [0, 1.17, 0], cloth); cube(body, [.27, .29, .26], [0, 1.69, 0], skin);
  cube(body, [.22, .08, .02], [0, 1.59, -.14], wound);
  for (const x of [-.075, .075]) cube(body, [.045, .04, .025], [x, 1.73, -.145], eye);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * .31, 1.4, 0); body.add(a); cube(a, [.12, .55, .12], [0, -.24, 0], skin); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * .13, .87, 0); body.add(l); cube(l, [.18, .79, .19], [0, -.4, 0], cloth); legs.push(l);
  }
  root.userData = { body, arms, legs }; return root;
}
const KINDS = ['walker', 'runner', 'brute'];
const BUILD_SECS = 420;
export function createZombies(ctx) {
  const { G, P, scene, GX, sfx, fx, setB, get, solid, buildChunk, dirty, astar, rebuildGrid, costD, hurt, msg, equip, damageBlock, held, hotbar } = ctx;
  const Q = new URLSearchParams(location.search);
  const Z = { round: 0, points: 500, earned: 0, kills: 0, heads: 0, pending: 0, spawnT: 0, breakT: 6, lastHurt: -99, maxHP: 100, perks: {}, timers: {}, stations: [], drops: [], pool: [], opened: false,
    best: 0, map: 'day', doorCells: [], remotes: new Map(), peers: new Map(), pts: {}, pk: {}, votes: new Set(), me: 'P1', buildT: BUILD_SECS, built: new Map(), nextId: 1, rpoints: 500, rearned: 0, role: 'solo', remote: null, reviveT: 0, ready: false, queue: [], netT: 0, gridT: 0, gridDirty: false, code: null, status: '' };
  const cap = ctx.mobile ? 16 : 28;
  const active = () => G.units.filter(u => u.hp > 0);
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const isHost = () => Z.role === 'host', isClient = () => Z.role === 'client';
  const COLORS = { P1: '#ffb066', P2: '#6fd6ff', P3: '#9dff7a', P4: '#ff7ad9' };
  const linked = () => net.open && Z.remotes.size > 0;
  const players = () => 1 + Z.remotes.size;
  const peerOf = id => { for (const [peer, p] of Z.peers) if (p === id) return peer; return null; };
  // ---------------- networking (host-authoritative star, up to 4 players) ----------------
  let mapWait = null;
  const net = createNet((m, from) => {
    if (m.t === 'full') { Z.full = true; const el = $('zJoinMsg'); if (el) el.textContent = 'That room is full (4 players)'; msg('That room is full (4 players)', 4); if (mapWait) { mapWait(null); mapWait = null; } return; }
    if (m.t === 'map') { Z.netMap = m.m; Z.me = m.me || 'P2'; if (mapWait) { mapWait(m.m); mapWait = null; } return; }
    if (!Z.ready) Z.queue.push([m, from]); else onMsg(m, from);
  }, onStatus);
  function waitMap() { return new Promise(res => { if (Z.netMap) return res(Z.netMap); mapWait = res; setTimeout(() => { if (mapWait) { mapWait = null; res('day'); } }, 5000); }); }
  const bestKey = () => Z.map === 'day' ? 'vr_zombies_best_day' : 'vr_zombies_best';
  function setStatus(s) { Z.status = s; const el = $('zCoop'); if (el) { el.hidden = !s; el.innerHTML = s; } }
  function shareURL(code) { return location.origin + location.pathname + '?join=' + code; }
  function hostStatus() { if (Z.code) setStatus(`CO-OP HOST · Room <b>${Z.code}</b> · ${players()}/4 players` + (players() < 4 ? `<br><small>${shareURL(Z.code)}</small>` : '')); }
  function hostRoom() {
    Z.role = 'host'; Z.me = 'P1'; setStatus('Creating co-op room…');
    net.host().then(code => { Z.code = code; hostStatus(); })
      .catch(e => { Z.role = 'solo'; setStatus(''); msg('Co-op unavailable (' + (e.type || e.message) + ') — playing solo', 4); });
  }
  function onStatus(s, peer) {
    if (s === 'open' && isHost()) {
      const used = new Set(Z.peers.values()); const id = ['P2', 'P3', 'P4'].find(x => !used.has(x)); if (!id) return; Z.peers.set(peer, id);
      net.send({ t: 'map', m: Z.map, me: id }, peer); addRemote(id);
      net.send({ t: 'init', b: [...Z.built].map(([k, t]) => [...k.split(',').map(Number), t]), op: Z.opened, ph: G.phase }, peer);
      Z.pts[id] ??= 500; Z.pk[id] ??= 0; hostStatus(); const s = id + ' joined the fight!'; msg(s, 3); sfx.horn(); net.send({ t: 'msg', s, d: 3 }, null, peer);
    }
    if (s === 'closed') {
      if (isHost()) { const id = Z.peers.get(peer); if (!id) return; Z.peers.delete(peer); removeRemote(id); Z.votes.delete(id); net.send({ t: 'left', id }); hostStatus(); const t = id + ' disconnected'; msg(t, 3); net.send({ t: 'msg', s: t, d: 3 }); if (P.downed && allDown()) over(); }
      else if (isClient()) hostLeft();
    }
  }
  function hostLeft() {
    for (const id of [...Z.remotes.keys()]) removeRemote(id);
    Z.role = 'solo'; Z.nextId = 1 + Math.max(0, ...G.units.map(u => u.id || 0), ...Z.drops.map(d => d.id || 0)); for (const u of G.units) if (u.hp > 0) prepUnit(u, u.kind, u.hp);
    setStatus('SOLO · host left'); msg('Host disconnected — continuing solo', 4); if (P.downed) { P.downed = false; over(); }
  }
  function addRemote(id) {
    if (Z.remotes.has(id) || id === Z.me) return Z.remotes.get(id); const g = makeTroop('skirm'); g.scale.setScalar(1.05); scene.add(g);
    const name = id + (id === 'P1' ? ' · HOST' : ''); const tag = label(g, name, COLORS[id] || '#fff', 2.45, 2.6); tag.material.depthTest = false; tag.renderOrder = 9;
    const R = { id, g, pos: P.spawn.clone(), tx: P.spawn.clone(), yaw: 0, pitch: 0, down: false, hp: 100, shots: 0, fireT: 0, name };
    g.position.copy(R.pos); Z.remotes.set(id, R); return R;
  }
  function removeRemote(id) { const R = Z.remotes.get(id); if (!R) return; scene.remove(R.g); Z.remotes.delete(id); Z.reviveT = 0; }
  function sendBlocks(cells, except) { net.send({ t: 'blk', c: cells }, null, except); }
  function applyBlocks(cells, broke) {
    for (const [x, y, z, t] of cells) { if (!t && get(x, y, z) && broke) fx.debris(x, y, z, 0x8a7a68, 4); setB(x, y, z, t); if (t) Z.built.set(key(x, y, z), t); else Z.built.delete(key(x, y, z)); }
    Z.gridDirty = true;
  }
  function applyP(R, m) { R.tx.set(m.x, m.y, m.z); R.yaw = m.yw; R.pitch = m.pt; R.hp = m.hp; R.down = m.dn; if (m.sh > R.shots) { R.fireT = .12; remoteFire(R, m.w); } R.shots = m.sh; }
  function onMsg(m, from) {
    const fid = isHost() ? Z.peers.get(from) : null;
    switch (m.t) {
      case 'init': if (isClient()) { applyBlocks(m.b); if (m.op && !Z.opened) openDoor(); setStatus(`CO-OP · Room <b>${net.code}</b> · you are <b style="color:${COLORS[Z.me]}">${Z.me}</b>`); msg('Joined co-op as ' + Z.me + '! Build defenses with your squad.', 4); } break;
      case 'full': msg('That room is full (4 players)', 4); break;
      case 'p':
        if (isHost()) { const R = Z.remotes.get(fid); if (R) { applyP(R, m); net.send({ ...m, id: fid }, null, from); } }
        else if (m.id && m.id !== Z.me) applyP(addRemote(m.id), m);
        break;
      case 'left': if (isClient()) removeRemote(m.id); break;
      case 's': if (isClient()) applySnap(m); break;
      case 'blk': applyBlocks(m.c, true); if (isHost()) sendBlocks(m.c, from); break;
      case 'hit': if (isHost() && fid) { const u = G.units.find(u => u.id === m.id && u.hp > 0); if (u) damage(u, m.a, m.hd, fid); } break;
      case 'buy': if (isHost() && fid) hostBuy(m.i, fid); break;
      case 'grant': if (isClient()) applyPurchase(Z.stations[m.i], m.g); break;
      case 'skip': if (isHost() && fid) voteSkip(fid); break;
      case 'hurt': if (!P.downed) { Z.lastHurt = G.t; hurt(P, m.d); } break;
      case 'rv': 
        if (isHost() && m.id && m.id !== 'P1') { const R = Z.remotes.get(m.id); if (R) R.down = false; net.send({ t: 'rv' }, peerOf(m.id)); break; }
        if (P.downed) { P.downed = false; P.hp = Math.max(50, Z.maxHP * .5); msg('REVIVED by a teammate!', 3); sfx.ui(); } break;
      case 'pw': if (m.k === 'ammo') refill(); break;
      case 'msg': msg(m.s, m.d || 2.5); if (m.h) sfx.horn(); break;
      case 'kf': if (isClient()) ctx.feed(m.s, m.w === Z.me ? 'me' : ''); break;
      case 'rk': Z.rkIn = (Z.rkIn || 0) + 1; ctx.launchRocket(new THREE.Vector3(...m.o), new THREE.Vector3(...m.v).multiplyScalar(42), false); if (isHost()) net.send(m, null, from); break;
      case 'over': over(true); break;
    }
  }
  function remoteFire(R, w) {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(R.pitch, R.yaw, 0, 'YXZ'));
    const mz = R.pos.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(dir, .75);
    fx.muzzle(mz, [1, .72, .4], .6); fx.tracer(mz, mz.clone().addScaledVector(dir, 30), 0xffb060, .05);
    if (w === 'rpg') return; const W_ = WEAPONS[w] || WEAPONS.pistol; sfx.at(R.pos, () => sfx.shot(W_.snd));
  }
  const liveRemotes = () => linked() ? [...Z.remotes.values()] : [];
  const allDown = () => liveRemotes().every(R => R.down);
  function voteSkip(id) {
    if (G.phase !== 'zbuild') return; Z.votes.add(id); const need = Math.ceil(players() / 2);
    if (id === 'P1' || Z.votes.size >= need) endBuild((id === 'P1' ? 'Host' : 'Squad vote') + ' skipped the build phase');
    else { const t = `${id} voted to skip (${Z.votes.size}/${need})`; msg(t, 2); net.send({ t: 'msg', s: t, d: 2 }); }
  }
  // ---------------- arena ----------------
  function bounds(x, z) { return Z.map === 'day' ? x >= 2 && x < 94 && z >= 2 && z < 94 : x >= 28 && x < (Z.opened ? 68 : 52) && z >= 28 && z < 68; }
  function wall(x, z) { for (let y = 1; y < 5; y++) setB(x, y, z, 3); }
  function station(kind, name, cost, x, z, color, gun) {
    const m = new THREE.Group(); m.position.set(x, 1, z); scene.add(m);
    cube(m, [1.5, 2.3, .8], [0, 1.15, 0], mat(color, { m: .4 }));
    cube(m, [1.2, .5, .83], [0, 1.7, 0], mat(color, { e: color, ei: .8 }));
    if (gun) { const w = makeGun(gun); w.scale.setScalar(1.8); w.position.set(0, 1.2, -.6); w.rotation.y = Math.PI / 2; m.add(w); }
    label(m, name + ' · ' + cost, '#' + color.toString(16).padStart(6, '0'));
    const st = { kind, name, cost, x, z, m, gun }; Z.stations.push(st); return st;
  }
  function init(opts = {}) {
    Z.role = opts.role || 'solo'; Z.map = opts.map || Q.get('zmap') || 'day'; Z.best = Number(localStorage.getItem(bestKey())) || 0;
    const bq = Q.get('zbuild'); Z.buildT = bq != null ? Math.max(0, +bq || 0) : BUILD_SECS;
    G.phase = Z.buildT > 0 ? 'zbuild' : 'zbreak'; G.shield = false; P.team = 'def'; P.hp = 100; P.dead = 0; P.downed = false;
    G.mat = { 2: 240, 3: 160, 4: 60 }; P.piece = 0; P.mat = 0;
    if (Z.map === 'day') P.spawn.set(Z.role === 'client' ? 51.5 : 45.5, 1, 57.5); else P.spawn.set(Z.role === 'client' ? 42 : 40, 1, 52); P.pos.copy(P.spawn); P.yaw = 0;
    P.slots = ['pistol', 'rpg']; P.ammoOf = {}; P.reserve = { pistol: 90, rpg: 4 }; P.w = -1; equip(0);
    document.body.classList.add('zombie-mode'); $('zHud').hidden = false;
    if (Z.map === 'day') {
    // DAYBREAK — FIREBASE: the large daytime base map (Citadel Ring layout) with gaps cut in the outer wall.
    ctx.buildDay(); const C = 48;
    for (let d = -1; d <= 1; d++) for (let y = 1; y <= 3; y++) { setB(C + d, y, C - 16, 0); setB(C + d, y, C + 16, 0); setB(C - 16, y, C + d, 0); setB(C + 16, y, C + d, 0); }
    for (let d = -1; d <= 1; d++) for (let y = 1; y <= 3; y++) { setB(C + d, y, C - 6, 4); Z.doorCells.push([C + d, y, C - 6]); }
    station('weapon', 'M4A1', 500, C - 13, C + 5, 0x80c9ee, 'carbine');
    station('weapon', 'M870', 750, C + 13, C - 5, 0xe4ad61, 'shotgun');
    station('ammo', 'AMMO CACHE', 350, C + 5, C + 13, 0x8ad8a5);
    station('door', 'OPEN COMMAND POST', 1000, C, C - 8, 0xe1bf62);
    const box = station('box', 'MYSTERY BOX', 950, C, C - 4.6, 0xbc8bdf); box.locked = true;
    station('health', 'IRON HEART', 2000, C - 5, C - 13, 0xe86c64);
    station('reload', 'QUICK HANDS', 1500, C + 13, C + 6, 0x73c4e8);
    const title = new THREE.Group(); title.position.set(C, 1, C + 16); scene.add(title); label(title, 'DAYBREAK — FIREBASE', '#ffd27a', 5);
    GX.setLighting('day', false); scene.fog.density *= 1.6; scene.userData.zombieNight = false;
    } else {
    for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) setB(x, 0, z, 1);
    for (let x = 27; x <= 68; x++) { wall(x, 27); wall(x, 68); }
    for (let z = 28; z < 68; z++) { wall(27, z); wall(68, z); if (z < 46 || z > 50) wall(52, z); }
    for (let z = 46; z <= 50; z++) for (let y = 1; y <= 4; y++) setB(52, y, z, 4);
    cube(scene, [42, .12, 42], [48, .94, 48], new THREE.MeshStandardMaterial({ map: ctx.PBRS.concrete.map, color: 0x67716b, roughness: .9 }));
    for (let z = 32; z < 66; z += 8) for (const x of [30, 49, 65]) cube(scene, [.12, .02, 3], [x, 1.01, z], mat(0x9c8b42));
    for (const [x, z] of [[36, 39], [44, 59], [60, 38], [60, 59]]) for (let a = 0; a < 3; a++) setB(x + a, 1, z, 8);
    station('weapon', 'M4A1', 500, 30, 48, 0x80c9ee, 'carbine');
    station('weapon', 'M870', 750, 38, 30, 0xe4ad61, 'shotgun');
    station('ammo', 'AMMO CACHE', 350, 46, 65, 0x8ad8a5);
    station('door', 'OPEN EAST WING', 1000, 50, 48, 0xe1bf62);
    station('box', 'MYSTERY BOX', 950, 64, 48, 0xbc8bdf);
    station('health', 'IRON HEART', 2000, 58, 65, 0xe86c64);
    station('reload', 'QUICK HANDS', 1500, 58, 30, 0x73c4e8);
    const title = new THREE.Group(); title.position.set(40, 1, 28); scene.add(title); label(title, 'DEAD SIGNAL / OUTPOST 07', '#df8c70', 5);
    for (const x of [31, 49, 64]) for (const z of [32, 63]) {
      cube(scene, [.12, 4, .12], [x, 3, z], mat(0x272d33)); cube(scene, [.45, .12, .45], [x, 5, z], mat(0xffaa66, { e: 0xffaa66, ei: 3 }));
    }
    if (!ctx.mobile) { for (const x of [34, 61]) { const l = new THREE.PointLight(0xffaa70, 16, 24, 2); l.position.set(x, 4, 48); scene.add(l); } }
    GX.setLighting('night', false); scene.background = new THREE.Color(0x0c1721); scene.fog.color.set(0x15242b); scene.fog.density = .027;
    scene.userData.zombieNight = true;
    }
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) buildChunk(a, b); dirty.clear(); rebuildGrid();
    if (G.phase === 'zbuild') { msg(document.body.classList.contains('touch') ? 'BUILD PHASE — barricade the outpost! PLACE builds · SKIP starts round 1' : 'BUILD PHASE — barricade the outpost! RMB places · G starts round 1', 6); hotbar(); }
    else msg((Z.map === 'day' ? 'DAYBREAK — FIREBASE' : 'DEAD SIGNAL') + ' — survive. E / USE to buy supplies.', 5);
    if (Z.role === 'host') hostRoom();
    if (Z.role === 'client') setStatus(`CO-OP · Room <b>${net.code}</b> · syncing…`);
    Z.ready = true; const q = Z.queue.splice(0); q.forEach(([m, f]) => onMsg(m, f));
  }
  // ---------------- build phase ----------------
  function canBuild(x, y, z) { return y >= 1 && y <= 6 && (Z.map === 'day' ? x >= 3 && z >= 3 && x < 93 && z < 93 : x >= 28 && z >= 28 && z < 68 && x < (Z.opened ? 68 : 52)) && liveRemotes().every(R => Math.hypot(x + .5 - R.pos.x, z + .5 - R.pos.z) > .9); }
  function onPlace(cells, t) { const c = cells.map(([x, y, z]) => [x, y, z, t]); for (const [x, y, z] of cells) Z.built.set(key(x, y, z), t); Z.gridDirty = true; net.send({ t: 'blk', c }); hotbar(); }
  function skip() {
    if (G.phase !== 'zbuild') return false;
    if (isClient()) { net.send({ t: 'skip' }); msg('Skip vote sent…', 1.5); return true; }
    if (linked()) voteSkip('P1'); else endBuild('Build phase skipped'); return true;
  }
  function endBuild(why) {
    if (G.phase !== 'zbuild') return; G.phase = 'zbreak'; Z.breakT = 4; Z.buildT = 0; const s = (why || 'Build phase over') + ' — ZOMBIES INCOMING'; msg(s, 3); sfx.horn();
    net.send({ t: 'msg', s, h: 1, d: 3 });
  }
  // ---------------- economy ----------------
  function award(n, who = 'P1') { n *= Z.timers.double > 0 ? 2 : 1; if (who !== 'P1' && who !== 'h') { Z.pts[who] = (Z.pts[who] ?? 500) + n; } else { Z.points += n; Z.earned += n; } }
  function nextRound() { Z.round++; Z.pending = Math.round((5 + Z.round * 3) * (1 + .5 * (players() - 1))); Z.roundSize = Z.pending; Z.spawnT = 0; G.phase = 'zombies'; const s = 'ROUND ' + Z.round + (Z.round % 5 === 0 ? ' — BRUTE INCOMING' : ''); msg(s, 3); sfx.horn(); net.send({ t: 'msg', s, h: 1, d: 3 }); }
  function prepUnit(u, kind, hp) {
    const brute = kind === 'brute'; u.kind = kind;
    u.d = { n: kind.toUpperCase(), s: brute ? 1.4 : 1, spd: Math.min(4.4, 1 + Z.round * .12) * (kind === 'runner' ? 1.6 : brute ? .7 : 1) };
    u.hp = hp ?? (65 + Z.round * 23) * (brute ? 4 : 1) * (1 + .3 * (players() - 1)); u.deadT = 0; u.flinch = u.flinch || 0; u.cd = 1; u.repath = Math.random(); u.path = null; u.pi = 0; u.groan = 2 + Math.random() * 8; u.age = u.age ?? Math.random() * 6;
  }
  function newUnit() { let u = Z.pool.pop(); if (!u) { const m = zombieModel(); u = { m, pos: new THREE.Vector3(), tpos: new THREE.Vector3(), d: {}, team: 'att', zombie: true }; } u.flinch = 0; u.age = Math.random() * 6; return u; }
  function addUnit(u) { u.m.position.copy(u.pos); u.m.scale.setScalar(u.d.s); const r = u.m.userData; r.body.rotation.set(0, 0, 0); r.body.position.set(0, 0, 0); scene.add(u.m); G.units.push(u); }
  function spawn() {
    const u = newUnit(); u.id = Z.nextId++;
    const brute = Z.round % 5 === 0 && Z.pending === Z.roundSize;
    prepUnit(u, brute ? 'brute' : Z.round >= 3 && Z.pending % 4 === 0 ? 'runner' : 'walker');
    let x, z; const tg = targets(), A = tg.length ? tg[Math.floor(Math.random() * tg.length)].pos : P.pos;
    for (let i = 0; i < 40; i++) { if (Z.map === 'day') { const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 12; x = Math.max(3.5, Math.min(92.5, A.x + Math.cos(ang) * r)); z = Math.max(3.5, Math.min(92.5, A.z + Math.sin(ang) * r)); } else { x = 29.5 + Math.random() * (Z.opened ? 36 : 20); z = 29.5 + Math.random() * 36; } if (!solid(x, 1, z) && !solid(x, 2, z) && Math.hypot(x - P.pos.x, z - P.pos.z) > 14 && liveRemotes().every(R => Math.hypot(x - R.pos.x, z - R.pos.z) > 12)) break; }
    u.pos.set(x, 1, z); u.tpos.copy(u.pos); addUnit(u); Z.pending--;
  }
  function kill(u, head = false, drop = true, who = 'P1') {
    if (u.deadT) return; if (who === 'h') who = 'P1'; Z.pk[who] = (Z.pk[who] || 0) + 1; ctx.feed((who !== 'P1' ? who : linked() ? 'P1' : 'YOU') + '  ⌖' + (head ? ' ◉' : '') + '  ' + (u.kind || 'zombie').toUpperCase(), who === 'P1' ? 'me' : ''); net.send({ t: 'kf', s: who + '  ⌖' + (head ? ' ◉' : '') + '  ' + (u.kind || 'zombie').toUpperCase(), w: who }); u.hp = 0; u.deadT = 1.6; Z.kills++; if (head) Z.heads++; award(head ? 100 : 60, who);
    if (drop && Math.random() < .12 && Z.drops.length < 4) dropPower(u.pos);
  }
  function damage(u, amount, head, who = 'P1') {
    if (isClient()) { net.send({ t: 'hit', id: u.id, a: amount, hd: !!head }); u.flinch = .22; u.hp -= amount; if (u.hp <= 0) u.hp = 1; return; }
    award(10, who); u.flinch = .22; u.hp -= Z.timers.insta > 0 ? 1e9 : amount * (head ? 1.5 : 1); if (u.hp <= 0) kill(u, head, true, who);
  }
  const powerNames = { ammo: 'MAX AMMO', insta: 'INSTA-KILL', double: 'DOUBLE POINTS', nuke: 'NUKE', strike: 'PRECISION STRIKE', uav: 'RECON DRONE' };
  function dropMesh(pos, kind) { const m = new THREE.Group(); m.position.copy(pos); cube(m, [.55, .55, .55], [0, .5, 0], mat(0x91ff8c, { e: 0x54ff64, ei: 1.5 })); label(m, powerNames[kind], '#aaffaa', 1.4); scene.add(m); return m; }
  function dropPower(pos, kind) { kind ||= Object.keys(powerNames)[Math.floor(Math.random() * 6)]; Z.drops.push({ m: dropMesh(pos, kind), kind, life: 24, id: Z.nextId++ }); }
  function freeDrop(d) { scene.remove(d.m); d.m.traverse(o => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); }
  function refill() { for (const k of P.slots) { P.ammoOf[k] = WEAPONS[k].mag; P.reserve[k] = WEAPONS[k].mag * 5; } P.ammo = P.mag; P.reload = 0; }
  function power(kind) {
    msg(powerNames[kind], 3); sfx.horn(); net.send({ t: 'msg', s: powerNames[kind], h: 1, d: 3 });
    if (kind === 'ammo') { refill(); net.send({ t: 'pw', k: 'ammo' }); }
    else if (kind === 'nuke') { for (const u of active()) kill(u, false, false); fx.explosion(P.pos.clone().setY(3), 3); sfx.boom(.7); }
    else if (kind === 'strike') { let c = P.pos, bd = 0; for (const u of active()) { const d = u.pos.distanceTo(P.pos); if (d > bd) { bd = d; c = u.pos; } } ctx.precisionStrike(P.pos, Math.atan2(-(c.x - P.pos.x), -(c.z - P.pos.z))); }
    else if (kind === 'uav') Z.uavT = 30;
    else Z.timers[kind] = 30;
  }
  function nearest() { let best, dist = 3.4; for (const s of Z.stations) { if (s.used || (!Z.opened && (Z.map === 'day' ? s.locked : s.x > 52))) continue; const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z); if (d < dist) { best = s; dist = d; } } return best; }
  function openDoor() { Z.opened = true; const s = Z.stations.find(s => s.kind === 'door'); if (s) { s.used = true; s.m.visible = false; } if (Z.map === 'day') for (const c of Z.doorCells) setB(...c, 0); else for (let z = 46; z <= 50; z++) for (let y = 1; y <= 4; y++) setB(52, y, z, 0); rebuildGrid(); }
  // Validate on the authority (host), apply effect on the purchaser.
  function hostBuy(i, who) {
    const s = Z.stations[i]; if (!s || s.used) return false; const me = who === 'P1' || who === 'h'; const pts = me ? Z.points : (Z.pts[who] ?? 0);
    if (pts < s.cost) { if (!me) net.send({ t: 'msg', s: 'Need ' + s.cost + ' points', d: 1.5 }, peerOf(who)); else msg('Need ' + s.cost + ' points', 1.5); return false; }
    if (me) Z.points -= s.cost; else Z.pts[who] -= s.cost;
    if (s.kind === 'door') { openDoor(); const c = Z.map === 'day' ? Z.doorCells.map(([x, y, z]) => [x, y, z, 0]) : []; if (Z.map !== 'day') for (let z = 46; z <= 50; z++) for (let y = 1; y <= 4; y++) c.push([52, y, z, 0]); sendBlocks(c); net.send({ t: 'msg', s: Z.map === 'day' ? 'COMMAND POST OPEN' : 'EAST WING OPEN', d: 2 }); }
    const gun = s.kind === 'weapon' || s.kind === 'box' ? s.gun || ['carbine', 'smg9', 'shotgun', 'dmr', 'lmg'][Math.floor(Math.random() * 5)] : null;
    if (!me) net.send({ t: 'grant', i, g: gun }, peerOf(who)); else applyPurchase(s, gun);
    return true;
  }
  function applyPurchase(s, gun) {
    if (!s) return;
    if (gun) { let slot = P.slots.indexOf(gun); if (slot < 0) { slot = P.slots[P.w] === 'rpg' ? 1 - P.w : P.w; P.slots[slot] = gun; } P.ammoOf[gun] = WEAPONS[gun].mag; P.reserve[gun] = WEAPONS[gun].mag * 5; P.w = -1; equip(slot); msg(WEAPONS[gun].name + ' acquired!', 2); }
    else if (s.kind === 'ammo') refill();
    else if (s.kind === 'health' || s.kind === 'reload') { Z.perks[s.kind] = true; if (s.kind === 'health') { Z.maxHP = 180; P.hp = 180; } msg(s.name + ' active', 2); }
    sfx.ui();
  }
  function buy() {
    if (G.over || P.downed) return false; const s = nearest(); if (!s) { msg('Approach a glowing supply station', 1.5); return false; }
    if (Z.points < s.cost) { msg('Need ' + s.cost + ' points', 1.5); return false; }
    if ((s.kind === 'health' || s.kind === 'reload') && Z.perks[s.kind]) { msg('Perk already active', 1); return false; }
    const i = Z.stations.indexOf(s);
    if (isClient()) { net.send({ t: 'buy', i }); return true; }
    return hostBuy(i, 'P1');
  }
  function reviveTarget() { if (P.downed) return null; for (const R of liveRemotes()) if (R.down && R.pos.distanceTo(P.pos) < 2.4) return R; return null; }
  // E / USE: revive if a downed teammate is close (hold), otherwise buy.
  function use() { if (reviveTarget()) return true; return buy(); }
  // ---------------- downed / game over ----------------
  function onZeroHP() {
    if (G.over || P.downed) return;
    if (linked() && !allDown()) { P.downed = true; P.hp = 0; P.reload = 0; msg('YOU ARE DOWN — your teammate can revive you (hold E / USE)', 5); sfx.horn(); return; }
    if (isClient() && linked()) { P.downed = true; P.hp = 0; return; } // host decides game over
    over();
  }
  function over(fromNet) {
    if (G.over) return;
    if (isHost() && !fromNet) net.send({ t: 'over' });
    G.over = true; G.phase = 'over'; P.dead = 999; if (document.pointerLockElement) document.exitPointerLock();
    const survived = Math.max(0, Z.round - 1); Z.best = Math.max(Z.best, survived); localStorage.setItem(bestKey(), Z.best);
    $('end').style.display = ''; $('endT').textContent = linked() || fromNet ? 'SQUAD WIPED' : 'SIGNAL LOST';
    $('endS').textContent = `Rounds survived: ${survived} · Reached round ${Z.round}\n${linked() ? 'Team kills' : 'Kills'}: ${Z.kills} · Headshots: ${Z.heads}\nPoints earned: ${Z.earned} · Unspent: ${Z.points}\nBest survival: ${Z.best} rounds`;
  }
  // ---------------- per-frame ----------------
  function animUnit(u, dt) {
    const r = u.m.userData;
    u.age += dt * (u.kind === 'runner' ? 10 : 5); r.body.rotation.x = .14 - u.flinch * 1.2; r.body.rotation.z = Math.sin(u.age) * .065;
    r.arms.forEach((a, i) => a.rotation.x = -1.15 + Math.sin(u.age + i) * .18 - (u.cd > .8 ? .6 : 0));
    r.legs.forEach((l, i) => l.rotation.x = Math.sin(u.age + i * Math.PI) * .4); u.m.position.copy(u.pos);
  }
  function deathAnim(u, dt) { const r = u.m.userData; u.deadT -= dt; r.body.rotation.x = Math.min(1.55, r.body.rotation.x + dt * 3); r.body.position.y = Math.max(-.5, r.body.position.y - dt * .5); if (u.deadT <= 0) { scene.remove(u.m); Z.pool.push(u); return false; } return true; }
  function common(dt) {
    for (const k in Z.timers) Z.timers[k] = Math.max(0, Z.timers[k] - dt); Z.uavT = Math.max(0, (Z.uavT || 0) - dt);
    if (!P.downed && G.t - Z.lastHurt > 5) P.hp = Math.min(Z.maxHP, P.hp + dt * 12);
    for (const R of Z.remotes.values()) {
      const moving = R.pos.distanceTo(R.tx) > .05; R.pos.lerp(R.tx, Math.min(1, dt * 12)); R.fireT = Math.max(0, R.fireT - dt);
      R.g.position.copy(R.pos); animateTroop(R.g, dt, moving && !R.down, R.fireT > 0 ? R.fireT : 0, 0);
      if (R.down) { R.g.rotation.set(-1.35, R.yaw, 0, 'YXZ'); R.g.position.y += .25; } else R.g.rotation.set(0, R.yaw, 0);
    }
    { const tgt = reviveTarget();
      if (tgt && held()) { Z.reviveT += dt; if (Z.reviveT >= 3) { Z.reviveT = 0; tgt.down = false; net.send({ t: 'rv', id: tgt.id }, isHost() ? peerOf(tgt.id) : null); msg(tgt.id + ' revived!', 2); sfx.ui(); } } else Z.reviveT = 0; }
    Z.netT -= dt;
    if (Z.netT <= 0 && net.open) {
      Z.netT = .1; if (isClient()) net.send({ t: 'p', x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yw: +P.yaw.toFixed(3), pt: +P.pitch.toFixed(3), hp: Math.round(P.hp), dn: !!P.downed, sh: P.shots || 0, w: P.slots[P.w] });
      if (isHost()) { net.send({ t: 'p', id: 'P1', x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yw: +P.yaw.toFixed(3), pt: +P.pitch.toFixed(3), hp: Math.round(P.hp), dn: !!P.downed, sh: P.shots || 0, w: P.slots[P.w] }); net.send(snap()); }
    }
    Z.gridT -= dt; if (Z.gridDirty && Z.gridT <= 0) { Z.gridDirty = false; Z.gridT = .5; rebuildGrid(); }
  }
  function snap() {
    return { t: 's', ph: G.phase, r: Z.round, bt: +Z.buildT.toFixed(1), br: +Z.breakT.toFixed(1), pe: Z.pending, pts: { ...Z.pts, P1: Z.points }, pk: Z.pk, k: Z.kills, h: Z.heads, op: Z.opened, tm: Z.timers,
      z: G.units.filter(u => u.hp > 0 || u.deadT > 0).map(u => [u.id, KINDS.indexOf(u.kind), +u.pos.x.toFixed(2), +u.pos.y.toFixed(2), +u.pos.z.toFixed(2), +u.m.rotation.y.toFixed(2), Math.max(0, Math.round(u.hp)), u.flinch > 0 ? 1 : 0, u.cd > .8 ? 1 : 0]),
      d: Z.drops.map(d => [d.id, d.kind, +d.m.position.x.toFixed(2), +d.m.position.y.toFixed(2), +d.m.position.z.toFixed(2)]) };
  }
  function applySnap(m) {
    if (m.ph === 'zbuild' || m.ph === 'zbreak' || m.ph === 'zombies') G.phase = m.ph;
    Z.round = m.r; Z.buildT = m.bt; Z.breakT = m.br; Z.pending = m.pe; Z.pts = m.pts || {}; Z.points = Z.pts[Z.me] ?? Z.points; Z.pk = m.pk || {}; Z.kills = m.k; Z.heads = m.h; Z.timers = m.tm || {};
    if (m.op && !Z.opened) openDoor();
    const seen = new Set();
    for (const [id, ki, x, y, z, ry, hp, fl, atk] of m.z) {
      seen.add(id); let u = G.units.find(u => u.id === id);
      if (!u) { if (hp <= 0) continue; u = newUnit(); u.id = id; prepUnit(u, KINDS[ki] || 'walker', hp); u.pos.set(x, y, z); u.tpos.set(x, y, z); addUnit(u); }
      u.tpos.set(x, y, z); u.ry = ry; if (fl) u.flinch = .22; u.cd = atk ? 1 : 0;
      if (hp <= 0 && u.hp > 0) { u.hp = 0; u.deadT = 1.6; } else if (hp > 0) u.hp = hp;
    }
    for (const u of G.units) if (!seen.has(u.id) && u.hp > 0) { u.hp = 0; u.deadT = 1.6; }
    const ds = new Set();
    for (const [id, kind, x, y, z] of m.d) { ds.add(id); if (!Z.drops.find(d => d.id === id)) Z.drops.push({ id, kind, life: 24, m: dropMesh(new THREE.Vector3(x, y, z), kind) }); }
    Z.drops = Z.drops.filter(d => { if (ds.has(d.id)) return true; freeDrop(d); return false; });
  }
  function tickClient(dt) {
    G.units = G.units.filter(u => {
      if (u.hp <= 0) return deathAnim(u, dt);
      u.flinch = Math.max(0, u.flinch - dt); u.groan -= dt; if (u.groan <= 0) { u.groan = 5 + Math.random() * 8; sfx.at(u.pos, () => sfx.groan()); }
      u.pos.lerp(u.tpos, Math.min(1, dt * 10)); if (u.ry != null) u.m.rotation.y = u.ry; animUnit(u, dt); return true;
    });
    for (const d of Z.drops) d.m.rotation.y += dt;
  }
  function targets() { const t = []; if (!P.downed && P.hp > 0) t.push(P); for (const R of liveRemotes()) if (!R.down) t.push(R); return t; }
  function tick(dt) {
    if (G.over) return;
    common(dt);
    if (isClient()) { tickClient(dt); return; }
    if (G.phase === 'zbuild') { Z.buildT -= dt; if (Z.buildT <= 0) endBuild('Build time over'); for (const d of Z.drops) d.m.rotation.y += dt; return; }
    if (P.downed && allDown()) { over(); return; }
    if (!P.downed && P.hp <= 0) { onZeroHP(); if (G.over) return; }
    const tg = targets();
    const live = active(); if (!Z.pending && !live.length) { if (G.phase !== 'zbreak') { G.phase = 'zbreak'; Z.breakT = 9; msg('ROUND CLEARED — resupply', 3); net.send({ t: 'msg', s: 'ROUND CLEARED — resupply', d: 3 }); } }
    if (G.phase === 'zbreak' || !Z.round) { Z.breakT -= dt; if (Z.breakT <= 0) nextRound(); }
    else { Z.spawnT -= dt; if (Z.pending && live.length < cap && G.units.length < cap + 6 && Z.spawnT <= 0) { spawn(); Z.spawnT = Math.max(.35, 1.2 - Z.round * .04); } }
    G.units = G.units.filter(u => {
      if (u.hp <= 0) return deathAnim(u, dt);
      u.cd -= dt; u.repath -= dt; u.flinch = Math.max(0, u.flinch - dt); u.groan -= dt;
      if (u.groan <= 0) { u.groan = 5 + Math.random() * 8; sfx.at(u.pos, () => sfx.groan()); }
      let T = tg[0], bd = 1e9; for (const t of tg) { const dd = t.pos.distanceTo(u.pos); if (dd < bd) { bd = dd; T = t; } }
      if (!T) { animUnit(u, dt); return true; }
      if (u.target !== T) { u.target = T; u.repath = 0; }
      const dx = T.pos.x - u.pos.x, dz = T.pos.z - u.pos.z;
      u.m.rotation.y = Math.atan2(-dx, -dz);
      if (Math.hypot(dx, dz) < 1.45 * u.d.s && Math.abs(T.pos.y - u.pos.y) < 2.4 && u.cd <= 0) {
        u.cd = 1.05; const dmg = u.kind === 'brute' ? 45 : 24;
        if (T === P) { Z.lastHurt = G.t; P.hitFrom = u.pos; hurt(P, dmg); } else net.send({ t: 'hurt', d: dmg }, peerOf(T.id));
      }
      if (bd > 1.15 && !u.flinch) {
        if (u.repath <= 0) { u.path = astar(u.pos.x, u.pos.z, T.pos.x, T.pos.z, costD, 0); u.pi = 0; u.repath = 1.8 + Math.random(); }
        let tx = T.pos.x, tz = T.pos.z; if (u.path?.length && u.pi < u.path.length) { [tx, tz] = u.path[u.pi]; if (Math.hypot(tx - u.pos.x, tz - u.pos.z) < .45) u.pi++; }
        const len = Math.hypot(tx - u.pos.x, tz - u.pos.z) || 1, speed = u.d.spd * dt;
        const nx = u.pos.x + (tx - u.pos.x) / len * speed, nz = u.pos.z + (tz - u.pos.z) / len * speed;
        const okX = bounds(nx, u.pos.z) && !solid(nx, 1, u.pos.z) && !solid(nx, 2, u.pos.z), okZ = bounds(u.pos.x, nz) && !solid(u.pos.x, 1, nz) && !solid(u.pos.x, 2, nz);
        if (okX) u.pos.x = nx; if (okZ) u.pos.z = nz;
        if (!okX || !okZ) smash(u, okX ? u.pos.x : nx, okZ ? u.pos.z : nz);
        for (const o of live) if (o !== u) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, dd = Math.hypot(dx, dz); if (dd > .001 && dd < .6) { const x = u.pos.x + dx / dd * dt, z = u.pos.z + dz / dd * dt; if (bounds(x, z) && !solid(x, 1, z)) { u.pos.x = x; u.pos.z = z; } } }
      }
      animUnit(u, dt); return true;
    });
    Z.drops = Z.drops.filter(d => {
      d.life -= dt; d.m.rotation.y += dt;
      if (d.m.position.distanceTo(P.pos) < 1.8 && !P.downed || liveRemotes().some(R => !R.down && d.m.position.distanceTo(R.pos) < 1.8)) { power(d.kind); d.life = 0; }
      if (d.life <= 0) { freeDrop(d); return false; } return true;
    });
  }
  // Zombies claw through player-built barricades in their way (arena walls are not breakable).
  function smash(u, x, z) {
    if (u.cd > 0) return; const bx = Math.floor(x), bz = Math.floor(z);
    for (const y of [1, 2, 3]) {
      const k = key(bx, y, bz); if (!Z.built.has(k)) continue;
      u.cd = 1.05; const broke = damageBlock(bx, y, bz, u.kind === 'brute' ? 90 : u.kind === 'runner' ? 18 : 26);
      if (broke) { Z.built.delete(k); Z.gridDirty = true; sendBlocks([[bx, y, bz, 0]]); if (y === 1 && Z.built.has(key(bx, 2, bz))) { /* upper blocks stay; zombies keep clawing */ } }
      return;
    }
  }
  function hud() {
    const build = G.phase === 'zbuild';
    document.body.classList.toggle('zbuild', build);
    $('mode').textContent = (Z.map === 'day' ? 'DAYBREAK' : 'DEAD SIGNAL') + (linked() ? ' · CO-OP' : '');
    const mm = Math.max(0, Math.ceil(Z.buildT));
    $('timer').textContent = build ? `BUILD ${mm / 60 | 0}:${String(mm % 60).padStart(2, '0')}` : G.phase === 'zbreak' || !Z.round ? 'Next: ' + Math.ceil(Math.max(0, Z.breakT)) : 'ENDLESS'; $('stars').textContent = '';
    $('zBuild').hidden = !build; if (build) $('zBuildT').textContent = `${mm / 60 | 0}:${String(mm % 60).padStart(2, '0')}`;
    $('sub').textContent = build ? `Barricade the outpost · ${Z.built.size} blocks placed` : `${active().length + Z.pending} hostiles remaining · ${Z.kills} kills · ${Z.heads} headshots`;
    $('dbar').style.width = '0'; $('hp').style.width = Math.max(0, P.hp / Z.maxHP * 100) + '%';
    $('ammo').textContent = WEAPONS[P.slots[P.w]].name + '  ' + (P.reload > 0 ? 'Reloading…' : `${P.ammo} / ${P.reserve[P.slots[P.w]] || 0}`);
    $('res').textContent = P.downed ? 'DOWNED — wait for revive' : `${Math.ceil(P.hp)} HP · ${Z.perks.health ? 'IRON HEART · ' : ''}${Z.perks.reload ? 'QUICK HANDS' : ''}`;
    $('right').textContent = `${Z.points} POINTS\nBest: ${Z.best} rounds`;
    const sb = $('zScore'); if (sb) { sb.hidden = !linked() || !Z.showScore; if (linked()) { const ids = ['P1', 'P2', 'P3', 'P4'].filter(id => id === Z.me || Z.remotes.has(id));
      sb.innerHTML = '<div class="sh"><span>SQUAD</span><span>KILLS</span><span>PTS</span></div>' + ids.map(id => { const R = Z.remotes.get(id), me = id === Z.me, down = me ? P.downed : R.down, hp = me ? Math.ceil(P.hp) : R.hp;
        const pts = me ? Z.points : isHost() ? Z.pts[id] ?? 0 : Z.pts[id] ?? '—'; return `<div style="color:${COLORS[id]}${me ? ';font-weight:bold' : ''}"><span>${id}${me ? ' (you)' : ''} ${down ? '✚ DOWN' : hp + 'HP'}</span><span>${Z.pk[id] || 0}</span><span>${pts}</span></div>`; }).join(''); } }
    if (!build) $('hotbar').textContent = '';
    $('zRound').textContent = build ? '' : Z.round <= 4 ? 'Ⅰ'.repeat(Z.round) || '—' : Z.round;
    $('zPowers').textContent = Object.entries(Z.timers).filter(([, v]) => v > 0).map(([k, v]) => powerNames[k] + ' ' + Math.ceil(v) + 's').join(' · ');
    const s = nearest(), rt = reviveTarget();
    $('zUse').textContent = P.downed ? 'YOU ARE DOWN — hold on!' : rt ? (Z.reviveT > 0 ? `REVIVING… ${Math.round(Z.reviveT / 3 * 100)}%` : (document.body.classList.contains('touch') ? 'Hold REVIVE' : '[HOLD E] Revive teammate')) : s ? (document.body.classList.contains('touch') ? `${s.name} — ${s.cost} pts` : `[E] ${s.name} — ${s.cost} pts`) : '';
  }
  function strikeAt(c) { ctx.explodeFx(c); if (isClient()) return; for (const u of active()) if (u.pos.distanceTo(c) < 4.5) damage(u, 400, false); }
  function rocket(o, d) { net.send({ t: 'rk', o: [o.x, o.y, o.z].map(v => +v.toFixed(2)), v: [d.x, d.y, d.z].map(v => +v.toFixed(3)) }); }
  const api = { nearest, reviveTarget, liveRemotes, waitMap, strikeAt, rocket, state: Z, net, init, tick, hud, damage, buy, use, over, refill, power, dropPower, kill, nextRound, skip, endBuild, canBuild, onPlace, onZeroHP, hostBuy, snap, cleanCode, linked };
  return api;
}
