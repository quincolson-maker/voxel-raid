// Horse Rider multiplayer: automatic shared lobby (up to 4 riders) + always-on voice.
// Tapping HORSE RIDER looks up open Horse Rider lobbies in the lobby directory and joins the fullest one with a free
// slot; if there is none (or every join fails) this player hosts one and advertises it (mode: 'horse'). Two players
// who happen to host at the same moment merge: a lone host periodically checks the list and moves into an older-coded
// lobby. Transport is the existing PeerJS co-op star (src/coop.js); voice is the existing mesh (src/voice.js).
// Synced: each rider's position / facing / walking speed, which horse they ride and its pose; the host is the authority
// for the free herd (clients mirror it). No combat.
import { createNet, MAX_PLAYERS } from './coop.js';
import { createVoice } from './voice.js';
import { createAdvert, LOBBY_URL } from './lobby.js';
const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search);
const LOOP = QS.get('loopnet') === '1', LOCAL = /^(localhost|127\.|\[::1\])/.test(location.hostname);
const COLORS = { P1: '#ffb066', P2: '#6fd6ff', P3: '#9dff7a', P4: '#ff7ad9' };
const SPK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3z"/>';
const ICONS = { live: SPK + '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  off: SPK + '<path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M15 9l6 6M21 9l-6 6"/></svg>' };
export function createHorseNet({ horse, P, msg }) {
  const H = horse.state;
  const S = { role: 'solo', me: 'P1', code: null, peers: new Map(), remotes: new Map(), busy: false, netT: 0, herdT: 0, mergeT: 8, last: null, footSp: 0, status: '' };
  // multiplayer needs the lobby directory (or the test loopback); plain localhost dev stays solo unless ?lobby= is given
  const enabled = () => !QS.has('solo') && (!!LOBBY_URL || LOOP || !LOCAL);
  const isHost = () => S.role === 'host', isClient = () => S.role === 'client';
  const peerOf = id => { for (const [peer, p] of S.peers) if (p === id) return peer; return null; };
  let hiWait = null;
  const net = createNet((m, from) => {
    if (m.t === 'full') { if (hiWait) { hiWait(null); hiWait = null; } return; }
    if (m.t === 'vs') { routeVoice(m, from); return; }
    if (m.t === 'hi') { S.role = 'client'; S.me = H.me = m.me; if (m.herd) horse.applyHerd(m.herd); for (const id of m.ids || []) addRemote(id); if (hiWait) { hiWait(true); hiWait = null; } return; }
    onMsg(m, from);
  }, onStatus);
  const voice = createVoice({ me: () => S.me, onChange: voiceUI,
    send: m => { if (isHost()) { const p = peerOf(m.to); if (p) net.send({ ...m, f: 'P1' }, p); } else if (isClient()) net.send({ ...m, f: S.me }); } });
  function routeVoice(m, from) {
    if (isHost()) { const fid = S.peers.get(from); if (!fid) return; m.f = fid; if (m.to === 'P1') voice.signal(m); else { const p = peerOf(m.to); if (p) net.send(m, p); } }
    else if (m.to === S.me) voice.signal(m);
  }
  // same speaker button (placement, states, labels) as zombies co-op
  function voiceUI(V) { const b = $('vMute'); if (!b) return; b.hidden = !V.on; if (!V.on) return;
    const st = V.state, n = V.connected(); b.className = 'v-' + st; b.innerHTML = (st === 'live' ? ICONS.live : ICONS.off) + '<span>' + (st === 'live' ? 'MIC ON' : st === 'muted' ? 'MUTED' : st === 'starting' ? 'MIC…' : 'NO MIC') + (n ? ' · ' + n : '') + '</span>';
    b.title = st === 'live' ? 'Voice on — tap to mute (V)' : st === 'muted' ? 'Muted — tap to talk (V)' : st === 'starting' ? 'Waiting for microphone permission' : (V.err || 'Mic unavailable') + ' — tap to retry. You can still hear the other riders.';
    b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', st === 'live' ? 'false' : 'true'); }
  const advert = createAdvert();
  const callsign = () => ($('operator') && $('operator').value) || 'Rider';
  const advertise = () => { if (isHost() && S.code) advert.update({ code: S.code, host: callsign(), players: 1 + S.remotes.size, max: MAX_PLAYERS, map: 'day', mode: 'horse' }); };
  function onStatus(s, peer) {
    if (s === 'open' && isHost()) {
      const used = new Set(S.peers.values()); const id = ['P2', 'P3', 'P4'].find(x => !used.has(x)); if (!id) return; S.peers.set(peer, id);
      net.send({ t: 'hi', me: id, herd: horse.herd(), ids: ['P1', ...S.remotes.keys()] }, peer); net.send({ t: 'join', id }, null, peer); addRemote(id); advertise(); msg(id + ' rode into the lobby', 2.5);
    }
    if (s === 'closed') {
      if (isHost()) { const id = S.peers.get(peer); if (!id) return; S.peers.delete(peer); removeRemote(id); net.send({ t: 'left', id }); advertise(); msg(id + ' left', 2); }
      else if (isClient()) hostLeft();
    }
  }
  function addRemote(id) { if (!id || id === S.me) return null; if (S.remotes.has(id)) return S.remotes.get(id);
    const R = { id, av: horse.avatar(id, COLORS[id] || '#fff'), s: null }; S.remotes.set(id, R); voice.peer(id); return R; }
  function removeRemote(id) { voice.drop(id); const R = S.remotes.get(id); if (!R) return; R.av.dispose(); S.remotes.delete(id); }
  function reset() { for (const id of [...S.remotes.keys()]) removeRemote(id); S.peers.clear(); voice.stop(); advert.stop();
    try { if (net.peer && !net.peer.destroyed) net.peer.destroy(); } catch (_) {} net.conns.clear(); net.open = false; net.peer = null;
    S.role = 'solo'; S.code = null; S.me = H.me = 'P1'; H.follow = false; for (const o of H.horses) o.net = null; }
  function hostLeft() { reset(); msg('Host left — finding another Horse Rider lobby…', 3); setTimeout(() => auto(), 1200); }
  function onMsg(m, from) {
    switch (m.t) {
      case 'p': { const id = isHost() ? S.peers.get(from) : m.id; if (!id || id === S.me) return; const R = S.remotes.get(id) || addRemote(id); if (R) R.s = m; if (isHost()) net.send({ ...m, id }, null, from); break; }
      case 'herd': if (isClient()) horse.applyHerd(m.h); break;
      case 'join': if (isClient()) addRemote(m.id); break;
      case 'left': if (isClient()) removeRemote(m.id); break;
    }
  }
  const lobbyList = () => !LOBBY_URL ? Promise.resolve([]) : fetch(LOBBY_URL + '/lobbies', { cache: 'no-store' }).then(r => r.json()).then(j => Array.isArray(j.lobbies) ? j.lobbies : []).catch(() => []);
  async function tryJoin(code) {
    reset(); S.status = 'joining ' + code;
    try { await net.join(code); } catch (_) { reset(); return false; }
    const ok = await new Promise(res => { hiWait = res; setTimeout(() => { if (hiWait) { hiWait = null; res(null); } }, 8000); });
    if (!ok) { reset(); return false; }
    S.code = code; voice.start([...S.remotes.keys()]); msg('Joined a Horse Rider lobby — voice is on', 3); return true;
  }
  async function host() {
    reset(); S.role = 'host'; S.me = H.me = 'P1'; S.status = 'hosting';
    try { S.code = await net.host(); } catch (e) { reset(); S.status = 'offline'; msg('Multiplayer unavailable — riding solo', 3); return false; }
    advertise(); voice.start([]); msg('Horse Rider lobby open — other riders join automatically', 3); return true;
  }
  // HORSE RIDER tap (or a lobby row): join an open Horse Rider lobby with a free slot, else host one
  async function auto(prefer) {
    if (!enabled() || S.busy) return; S.busy = true;
    try { const list = (await lobbyList()).filter(l => l.mode === 'horse' && l.players < l.max).sort((a, b) => b.players - a.players || (a.code < b.code ? -1 : 1));
      const cands = [...(prefer ? [prefer] : []), ...list.map(l => l.code).filter(c => c !== prefer)];
      for (const c of cands.slice(0, 3)) if (await tryJoin(c)) return true;
      return await host();
    } finally { S.busy = false; }
  }
  function tick(dt) {
    if (!H.on) return;
    for (const R of S.remotes.values()) R.av.update(dt, R.s);
    const h = H.mounted, x = h ? h.pos.x : P.pos.x, z = h ? h.pos.z : P.pos.z;
    if (S.last && dt > 0) S.footSp += (Math.hypot(x - S.last[0], z - S.last[1]) / dt - S.footSp) * Math.min(1, dt * 8); S.last = [x, z];
    S.netT -= dt; S.herdT -= dt;
    if (net.open && S.netT <= 0) { S.netT = .1;
      const st = { t: 'p', x: +x.toFixed(2), y: +(h ? h.pos.y : P.pos.y).toFixed(2), z: +z.toFixed(2), yw: +P.yaw.toFixed(3), m: h ? h.id : -1, hy: h ? +h.yaw.toFixed(3) : 0, sp: +(h ? H.speed : S.footSp).toFixed(2) };
      if (isHost()) st.id = 'P1'; net.send(st); }
    if (isHost() && net.open && S.herdT <= 0) { S.herdT = .25; net.send({ t: 'herd', h: horse.herd() }); }
    // a lone host merges into an older open Horse Rider lobby (two players hosted at the same moment)
    if (isHost() && !S.remotes.size && LOBBY_URL && (S.mergeT -= dt) <= 0) { S.mergeT = 10;
      lobbyList().then(list => { const o = list.filter(l => l.mode === 'horse' && l.code !== S.code && l.players < l.max && l.code < S.code)[0]; if (o && isHost() && !S.remotes.size) auto(o.code); }); }
    H.online = S.role === 'solo' ? '' : '👥 ' + (1 + S.remotes.size) + '/' + MAX_PLAYERS;
  }
  return { state: S, net, voice, auto, tick, enabled, prime: () => { if (enabled()) voice.prime(); } };
}
