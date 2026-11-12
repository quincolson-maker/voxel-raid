// ---------------- v33 saloon checkers: 8x8 draughts (American rules) vs the bartender or another rider ----------------
// Rules: men move diagonally forward, kings both ways; captures are compulsory and multi-jumps continue with the same
// piece; a man reaching the far row is crowned (and the turn ends); you lose when you have no legal move; 80 plies
// with no capture is a draw. The host (or a solo player) runs every match; clients send moves ({t:'ck'}) and get the
// board back ({t:'cks'}). The bartender looks one move ahead with a random skill. Drunk players' hands slip.
export function ckNew(a, b) { const B = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const d = (r + c) % 2 === 1; B.push(d && r < 3 ? -1 : d && r > 4 ? 1 : 0); }
  return { id: 'c' + Math.random().toString(36).slice(2, 8), kind: 'ck', who: [a, b], B, turn: 0, win: -1, chain: -1, quiet: 0, last: null, n: 0 }; }
const sideOf = p => p === 0 ? 1 : -1; // player 0 = red (+, starts at the bottom, moves up), player 1 = black (-)
function pieceMoves(B, i, out, jumpsOnly) { const v = B[i]; if (!v) return; const s = Math.sign(v), king = Math.abs(v) === 2, r = (i / 8) | 0, c = i % 8;
  for (const dr of king ? [-1, 1] : [s > 0 ? -1 : 1]) for (const dc of [-1, 1]) { const r1 = r + dr, c1 = c + dc; if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue; const j = r1 * 8 + c1;
    if (B[j] === 0) { if (!jumpsOnly) out.push({ f: i, t: j, cap: -1 }); continue; } if (Math.sign(B[j]) === s) continue;
    const r2 = r1 + dr, c2 = c1 + dc; if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue; const k = r2 * 8 + c2; if (B[k] === 0) out.push({ f: i, t: k, cap: j }); } }
export function ckMoves(G, p = G.turn) { const s = sideOf(p), all = []; if (G.chain >= 0) { pieceMoves(G.B, G.chain, all, true); return all; }
  for (let i = 0; i < 64; i++) if (Math.sign(G.B[i]) === s) pieceMoves(G.B, i, all, false); const caps = all.filter(m => m.cap >= 0); return caps.length ? caps : all; }
export function ckApply(G, mv) { if (G.win !== -1 || !mv) return 'bad'; const ok = ckMoves(G).find(m => m.f === mv.f && m.t === mv.t); if (!ok) return 'bad';
  const B = G.B, v = B[ok.f]; B[ok.t] = v; B[ok.f] = 0; let crowned = false; if (ok.cap >= 0) { B[ok.cap] = 0; G.quiet = 0; } else G.quiet++;
  const r = (ok.t / 8) | 0; if (Math.abs(v) === 1 && ((v > 0 && r === 0) || (v < 0 && r === 7))) { B[ok.t] = v * 2; crowned = true; }
  G.last = { f: ok.f, t: ok.t, cap: ok.cap, p: G.turn }; G.n++;
  if (ok.cap >= 0 && !crowned) { const more = []; pieceMoves(B, ok.t, more, true); if (more.length) { G.chain = ok.t; return 'jump'; } }
  G.chain = -1; G.turn = 1 - G.turn; if (!ckMoves(G).length) { G.win = 1 - G.turn; return 'win'; } if (G.quiet >= 80) { G.win = 2; return 'draw'; } return ok.cap >= 0 ? 'cap' : 'ok'; }
const clone = G => ({ ...G, B: G.B.slice(), last: null });
const material = (B, s) => { let m = 0; for (const v of B) if (v) m += (Math.sign(v) === s ? 1 : -1) * (Math.abs(v) === 2 ? 1.6 : 1); return m; };
export function ckAI(G, skill = .5) { const p = G.turn, s = sideOf(p), ms = ckMoves(G); if (!ms.length) return null; let best = null, bs = -1e9;
  for (const m of ms) { const g = clone(G); const res = ckApply(g, m); let sc = material(g.B, s); if (res === 'win') sc += 50;
    if (g.turn === p && g.win < 0) { const more = ckMoves(g); sc += more.length ? .9 : 0; } // keeps jumping
    else if (g.win < 0) { let worst = 0; for (const o of ckMoves(g)) { const h = clone(g); ckApply(h, o); worst = Math.min(worst, material(h.B, s) - material(g.B, s)); } sc += worst * (.4 + skill * .6); } // the reply they fear
    const r = (m.t / 8) | 0; sc += (s > 0 ? 7 - r : r) * .02 + (m.t % 8 > 0 && m.t % 8 < 7 ? .03 : 0) + (Math.random() - .5) * (1.2 - skill) * 1.4;
    if (sc > bs) { bs = sc; best = m; } } return { f: best.f, t: best.t }; }

export function createCheckers(c) { const { H, msg } = c, K = { el: null, G: null, sel: -1, t: 0, games: new Map() };
  const me = () => H.me || 'P1', role = () => H.netRole ? H.netRole() : 'solo', isAuth = () => role() !== 'client', level = () => c.level ? c.level() : 0;
  function open(G) { if (!K.el) build(); K.el.hidden = false; H.uiOpen = true; if (document.pointerLockElement) document.exitPointerLock(); if (G) K.G = G; ui(); }
  function close() { if (K.el) K.el.hidden = true; H.uiOpen = false; K.sel = -1; }
  function build() { const el = K.el = document.createElement('div'); el.id = 'hrCheck'; el.hidden = true; el.innerHTML = '<canvas width="360" height="360"></canvas><div class="sb"></div><div class="bt"><button data-a="ai">VS BARTENDER</button><span class="pv"></span><button data-a="x">EXIT</button></div>'; document.body.appendChild(el);
    K.cv = el.querySelector('canvas'); K.x = K.cv.getContext('2d');
    K.cv.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const r = K.cv.getBoundingClientRect(); let cc = Math.floor((e.clientX - r.left) / r.width * 8), rr = Math.floor((e.clientY - r.top) / r.height * 8); if (flip()) { cc = 7 - cc; rr = 7 - rr; } tap(rr * 8 + cc); });
    el.addEventListener('pointerdown', e => e.stopPropagation()); el.querySelector('.bt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'x') { if (K.G && K.G.who.includes(me()) && K.G.win === -1) netOut({ a: 'q' }); close(); } else if (b.dataset.a === 'ai') netOut({ a: 'ai' }); else if (b.dataset.a === 'pv') netOut({ a: 'ch', to: b.dataset.id }); }); }
  const mySide = () => K.G ? K.G.who.indexOf(me()) : -1, flip = () => mySide() === 1; // you always sit at the bottom
  function tap(i) { const G = K.G; if (!G || G.win !== -1 || G.who[G.turn] !== me()) return; const ms = ckMoves(G);
    if (K.sel >= 0) { const m = ms.find(m => m.f === K.sel && m.t === i); if (m) { let mv = m; const lv = level(); if (lv > 3 && Math.random() < Math.min(.45, (lv - 3) * .07)) { const alt = ms[(Math.random() * ms.length) | 0]; if (alt !== m) { mv = alt; msg('Your hand slips… wrong piece!', 1.6); } } netOut({ a: 'mv', f: mv.f, d: mv.t }); K.sel = G.chain >= 0 ? mv.t : -1; return; } }
    K.sel = ms.some(m => m.f === i) ? i : -1; draw(); }
  function netOut(m) { if (isAuth()) netIn(m, me()); else c.send && c.send({ t: 'ck', ...m }); }
  function bcast(G) { const st = { t: 'cks', g: G }; if (c.send && role() === 'host') c.send(st); netState(st); }
  function netIn(m, from) { if (!m || !from) return; let G = [...K.games.values()].find(g => g.who.includes(from) && g.win === -1);
    if (m.a === 'ai') { if (G) K.games.delete(G.id); G = ckNew(from, 'BARKEEP'); G.skill = .25 + Math.random() * .7; K.games.set(G.id, G); bcast(G); return; }
    if (m.a === 'ch' && typeof m.to === 'string') { if (G) K.games.delete(G.id); G = ckNew(from, m.to.slice(0, 4)); K.games.set(G.id, G); bcast(G); return; }
    if (!G) return; if (m.a === 'q') { G.win = -2; K.games.delete(G.id); bcast(G); return; }
    if (m.a === 'mv' && G.who[G.turn] === from && Number.isInteger(m.f) && Number.isInteger(m.d)) { const r = ckApply(G, { f: m.f, t: m.d }); if (r === 'bad') return; bcast(G); if (G.win !== -1) K.games.delete(G.id); } }
  function netState(m) { const G = m && m.g; if (!G || !Array.isArray(G.who) || !Array.isArray(G.B)) return; if (!G.who.includes(me())) return;
    if (G.win === -2) { if (K.G && K.G.id === G.id) { K.G = null; msg('Checkers: game abandoned', 1.5); } ui(); return; }
    const was = K.G && K.G.id === G.id ? K.G.win : -1; K.G = G; if (!K.el || K.el.hidden) open(G); ui(); if (G.win !== -1 && was === -1) { const i = G.who.indexOf(me()); msg(G.win === 2 ? 'Checkers: a draw' : G.win === i ? 'Checkers: you win!' : 'Checkers: ' + G.who[G.win] + ' wins', 3); if (c.sfx && c.sfx.tone && c.sfx.ctx) c.sfx.tone('triangle', 520, 780, .2, .15); } }
  function tick(dt) { K.t += dt; const G = K.G; if (isAuth()) for (const g of K.games.values()) if (g.win === -1 && g.who[g.turn] === 'BARKEEP') { g.aiT = (g.aiT || 0) + dt; if (g.aiT > .9) { g.aiT = 0; const mv = ckAI(g, g.skill); if (mv) { ckApply(g, mv); bcast(g); if (g.win !== -1) K.games.delete(g.id); } } }
    if (K.el && !K.el.hidden) draw(); }
  function ui() { if (!K.el) return; const G = K.G, sb = K.el.querySelector('.sb'), pv = K.el.querySelector('.pv');
    if (!G) sb.textContent = 'Checkers · tap a piece, then where it goes · captures are compulsory'; else { const nm = i => G.who[i] === me() ? 'YOU' : G.who[i], cnt = s => G.B.filter(v => Math.sign(v) === s).length;
      sb.innerHTML = `<span style="color:#ff6b5a">● ${nm(0)} ${cnt(1)}</span> · <span style="color:#ddd">● ${nm(1)} ${cnt(-1)}</span> · ` + (G.win === 2 ? 'draw' : G.win >= 0 ? nm(G.win) + ' won' : (G.who[G.turn] === me() ? '<b>your move</b>' + (G.chain >= 0 ? ' (keep jumping)' : '') : nm(G.turn) + ' to move')); }
    const near = (H.netRemotes ? H.netRemotes() : []).filter(r => r.s && c.spot && Math.hypot(r.s.x - c.spot().x, r.s.z - c.spot().z) < 12); pv.innerHTML = near.map(r => `<button data-a="pv" data-id="${r.id}">VS ${r.id}</button>`).join(''); draw(); }
  function draw() { if (!K.x || K.el.hidden) return; const x = K.x, W = 360, q = W / 8, G = K.G, lv = level(), fl = flip(); x.save(); x.fillStyle = '#20140b'; x.fillRect(0, 0, W, W);
    if (lv > .5) { const a = Math.sin(K.t * .8) * .012 * Math.min(6, lv); x.translate(W / 2, W / 2); x.rotate(a); x.translate(-W / 2, -W / 2); } // drunk: the board swims
    const at = i => { let r = (i / 8) | 0, cc = i % 8; if (fl) { r = 7 - r; cc = 7 - cc; } return [cc * q, r * q]; };
    for (let i = 0; i < 64; i++) { const [px, py] = at(i), d = (((i / 8) | 0) + i % 8) % 2; x.fillStyle = d ? '#5b3a1f' : '#e2cc98'; x.fillRect(px, py, q, q); }
    if (G) { if (G.last) for (const i of [G.last.f, G.last.t]) { const [px, py] = at(i); x.fillStyle = 'rgba(255,215,90,.28)'; x.fillRect(px, py, q, q); }
      const mine = G.who[G.turn] === me() && G.win === -1, ms = mine ? ckMoves(G) : [];
      if (mine) for (const m of ms) if (K.sel < 0) { const [px, py] = at(m.f); x.strokeStyle = 'rgba(125,255,138,.55)'; x.lineWidth = 2; x.strokeRect(px + 2, py + 2, q - 4, q - 4); }
      for (let i = 0; i < 64; i++) { const v = G.B[i]; if (!v) continue; const [px, py] = at(i), cx = px + q / 2, cy = py + q / 2; x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(cx + 2, cy + 3, q * .38, 0, Math.PI * 2); x.fill();
        x.fillStyle = v > 0 ? '#c0392b' : '#1d1d1d'; x.beginPath(); x.arc(cx, cy, q * .38, 0, Math.PI * 2); x.fill(); x.strokeStyle = v > 0 ? '#ff8a7a' : '#666'; x.lineWidth = 2.5; x.beginPath(); x.arc(cx, cy, q * .29, 0, Math.PI * 2); x.stroke();
        if (Math.abs(v) === 2) { x.fillStyle = '#ffd34a'; x.font = 'bold ' + (q * .42) + 'px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♛', cx, cy + 1); } }
      if (K.sel >= 0) { const [px, py] = at(K.sel); x.strokeStyle = '#7dff8a'; x.lineWidth = 3; x.strokeRect(px + 2, py + 2, q - 4, q - 4); for (const m of ms) if (m.f === K.sel) { const [tx, ty] = at(m.t); x.fillStyle = 'rgba(125,255,138,.7)'; x.beginPath(); x.arc(tx + q / 2, ty + q / 2, q * .13, 0, Math.PI * 2); x.fill(); } } }
    x.restore(); }
  Object.assign(K, { send: netOut, open, close, netIn, netState, tick, ui, tap, isOpen: () => !!(K.el && !K.el.hidden) }); return K; }
