// Horse Rider multiplayer: automatic shared lobby (up to 25 riders) + always-on voice.
// Tapping HORSE RIDER looks up open Horse Rider lobbies in the lobby directory and joins the fullest one with a free
// slot; if there is none (or every join fails) this player hosts one and advertises it (mode: 'horse'). Two players
// who happen to host at the same moment merge: a lone host periodically checks the list and moves into an older-coded
// lobby. Transport is the existing PeerJS co-op star (src/coop.js); voice is the existing mesh (src/voice.js).
// Synced: each rider's position / facing / walking speed, which horse they ride and its pose; the host is the authority
// for the free herd (clients mirror it). Guns: other riders see your drawn gun, aim and shots (tracer, flash, smoke, sound) — visual only, no combat.
import { createNet, MAX_PLAYERS } from './coop.js';
import { createVoice } from './voice.js';
import { createAdvert, LOBBY_URL } from './lobby.js';
const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search);
const LOOP = QS.get('loopnet') === '1', LOCAL = /^(localhost|127\.|\[::1\])/.test(location.hostname);
const COLORS = { P1: '#ffb066', P2: '#6fd6ff', P3: '#9dff7a', P4: '#ff7ad9' }; for (let i = 5; i <= 25; i++) COLORS['P' + i] = `hsl(${Math.round((i * 137.5) % 360)},85%,68%)`; // v33: up to 25 riders
const IDS = Array.from({ length: 24 }, (_, i) => 'P' + (i + 2)), VOICE_MESH = 8, VOICE_NEAR = 70, VOICE_FAR = 110;
const SPK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3z"/>';
const ICONS = { live: SPK + '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  off: SPK + '<path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M15 9l6 6M21 9l-6 6"/></svg>' };
export function createHorseNet({ horse, P, msg }) {
  const H = horse.state;
  const S = { role: 'solo', me: 'P1', code: null, peers: new Map(), remotes: new Map(), busy: false, netT: 0, herdT: 0, fwd: new Map(), pbT: 0, vT: 0, mergeT: 8, last: null, footSp: 0, status: '' };
  // multiplayer needs the lobby directory (or the test loopback); plain localhost dev stays solo unless ?lobby= is given
  const enabled = () => !QS.has('solo') && (!!LOBBY_URL || LOOP || !LOCAL);
  const isHost = () => S.role === 'host', isClient = () => S.role === 'client';
  const peerOf = id => { for (const [peer, p] of S.peers) if (p === id) return peer; return null; };
  let hiWait = null;
  H.netRole = () => S.role; H.callsign = () => callsign(); H.colors = COLORS; H.netRemotes = () => [...S.remotes.values()];
  H.zSend = m => { if (!net.open || S.role === 'solo') return; net.send(m); }; // host: zombie snapshot to everyone; client: its hits to the host
  H.zSendTo = (id, m) => { if (!isHost() || !net.open) return; const p = peerOf(id); if (p) net.send(m, p); };
  H.netShot = m => { if (!net.open || S.role === 'solo') return; net.send(isHost() ? { ...m, id: 'P1' } : m); };
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
  const callsign = () => new URLSearchParams(location.search).get('name') || localStorage.getItem('vr_op') || 'Rider';
  const advertise = () => { if (isHost() && S.code) advert.update({ code: S.code, host: callsign(), players: 1 + S.remotes.size, max: MAX_PLAYERS, map: 'day', mode: 'horse' }); };
  function onStatus(s, peer) {
    if (s === 'open' && isHost()) {
      const used = new Set(S.peers.values()); const id = IDS.find(x => !used.has(x)); if (!id) return; S.peers.set(peer, id);
      net.send({ t: 'hi', me: id, herd: horse.herd(), ids: ['P1', ...S.remotes.keys()] }, peer); net.send({ t: 'join', id }, null, peer); addRemote(id); advertise(); msg(id + ' rode into the lobby', 2.5);
    }
    if (s === 'closed') {
      if (isHost()) { const id = S.peers.get(peer); if (!id) return; S.peers.delete(peer); removeRemote(id); net.send({ t: 'left', id }); advertise(); msg(id + ' left', 2); }
      else if (isClient()) hostLeft();
    }
  }
  function addRemote(id) { if (!id || id === S.me) return null; if (S.remotes.has(id)) return S.remotes.get(id);
    const R = { id, av: horse.avatar(id, COLORS[id] || '#fff'), s: null }; S.remotes.set(id, R); if (S.remotes.size + 1 <= VOICE_MESH) voice.peer(id); return R; }
  function removeRemote(id) { voice.drop(id); const R = S.remotes.get(id); if (!R) return; R.av.dispose(); S.remotes.delete(id); }
  function reset() { for (const id of [...S.remotes.keys()]) removeRemote(id); S.peers.clear(); voice.stop(); advert.stop();
    try { if (net.peer && !net.peer.destroyed) net.peer.destroy(); } catch (_) {} net.conns.clear(); net.open = false; net.peer = null;
    S.role = 'solo'; S.code = null; S.me = H.me = 'P1'; H.follow = false; for (const o of H.horses) o.net = null; }
  function hostLeft() { reset(); msg('Host left — finding another Horse Rider lobby…', 3); setTimeout(() => auto(), 1200); }
  function onMsg(m, from) {
    switch (m.t) {
      case 'p': { const id = isHost() ? S.peers.get(from) : m.id; if (!id || id === S.me) return; const R = S.remotes.get(id) || addRemote(id); if (R) R.s = m; if (isHost()) { if (S.remotes.size + 1 <= 4) net.send({ ...m, id }, null, from); else S.fwd.set(id, { ...m, id }); } break; }
      case 'pb': if (isClient() && Array.isArray(m.a)) for (const q of m.a) if (q && q.id && q.id !== S.me) { const R = S.remotes.get(q.id) || addRemote(q.id); if (R) R.s = q; } break; // v33: big lobbies, the host batches everyone's latest state
      case 'sh': { const id = isHost() ? S.peers.get(from) : m.id; if (!id || id === S.me) return; horse.remoteShot && horse.remoteShot(id, m); if (isHost()) net.send({ t: 'sh', w: m.w, o: m.o, e: m.e, id }, null, from); break; } // gunshots: visual + sound only
      case 'herd': if (isClient()) horse.applyHerd(m.h); break;
      case 'zs': if (isClient() && H.zombies) H.zombies.apply(m); break; // the host's zombies (host-authoritative)
      case 'zh': if (isHost() && H.zombies) H.zombies.remoteHit(m, S.peers.get(from)); break; // a client shot one
      case 'zk': if (isClient() && H.zombies) { if (m.b) { H.saloon && H.saloon.banditKill(); } else { H.zombies.confirmKill(m); if (H.guns) H.guns.credit(!!m.h); } } break;
      case 'sv': if (isHost() && H.build && H.build.owns(m.k)) H.build.netIn(m, S.peers.get(from)); else if (isHost() && H.saloon) H.saloon.netIn(m, S.peers.get(from)); break; // v35: a client's slot spin (the host draws the reels)
      case 'svr': if (isClient() && H.build && H.build.owns(m.k)) H.build.netRes(m); else if (isClient() && H.saloon) H.saloon.netRes(m); break; // host-confirmed kill: my points
      case 'dt': if (isHost() && H.town2) H.town2.netIn(m, S.peers.get(from)); break; // darts: a client's throw / challenge (host runs the match)
      case 'dts': if (isClient() && H.town2) H.town2.netState(m); break;
      case 'ck': if (isHost() && H.town2) H.town2.ck.netIn(m, S.peers.get(from)); break; // checkers move / challenge (host runs the game)
      case 'cks': if (isClient() && H.town2) H.town2.ck.netState(m); break;
      case 'zd': if (isClient() && H.zombies) H.zombies.remoteHurt(m); break; // a zombie hit me (host decides)
      case 'join': if (isClient()) addRemote(m.id); break;
      case 'left': if (isClient()) removeRemote(m.id); break;
    }
  }
  const lobbyList = () => !LOBBY_URL ? Promise.resolve([]) : fetch(LOBBY_URL + '/lobbies', { cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }).then(r => r.json()).then(j => Array.isArray(j.lobbies) ? j.lobbies : []).catch(() => []);
  async function tryJoin(code) {
    reset(); S.status = 'joining ' + code;
    try { await net.join(code); } catch (_) { reset(); return false; }
    const ok = await new Promise(res => { hiWait = res; setTimeout(() => { if (hiWait) { hiWait = null; res(null); } }, 6000); });
    if (!ok) { reset(); return false; }
    S.code = code; voice.start(S.remotes.size + 1 <= VOICE_MESH ? [...S.remotes.keys()] : []); msg('Joined a Horse Rider lobby — voice is on', 3); return true;
  }
  async function host() {
    reset(); S.role = 'host'; S.me = H.me = 'P1'; S.status = 'hosting';
    try { S.code = await net.host(); } catch (e) { reset(); S.status = 'offline'; msg('Multiplayer unavailable — riding solo', 3); return false; }
    S.hbT = 0; advertise(); voice.start([]); msg('Horse Rider lobby open — other riders join automatically', 3); return true;
  }
  // HORSE RIDER tap (or a lobby row): join an open Horse Rider lobby with a free slot, else host one
  async function auto(prefer) {
    if (!enabled() || S.busy) return; S.busy = true;
    try { const list = (await lobbyList()).filter(l => l.mode === 'horse' && l.players < l.max).sort((a, b) => b.players - a.players || (a.code < b.code ? -1 : 1));
      let mine = null; try { const o = JSON.parse(localStorage.getItem('hr_mycode') || 'null'); if (o && Date.now() - o.t > 15000) mine = o.code; } catch (_) {} // v34: skip a lobby this browser hosted before the app was closed (no heartbeat = stale); a live tab's lobby is fine
      const cands = [...(prefer ? [prefer] : []), ...list.map(l => l.code).filter(c => c !== prefer && c !== mine)];
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
    const N = 1 + S.remotes.size, rate = N <= 4 ? .1 : N <= 8 ? .15 : N <= 16 ? .25 : .33; // v33: send less often as the lobby fills
    if (isHost() && net.open && S.fwd.size && (S.pbT -= dt) <= 0) { S.pbT = rate; net.send({ t: 'pb', a: [...S.fwd.values()] }); S.fwd.clear(); }
    if (S.role !== 'solo' && (S.vT -= dt) <= 0) { S.vT = 2; // voice: full mesh up to 8 riders, beyond that only riders near you (and at most 8 links)
      for (const R of S.remotes.values()) { if (N <= VOICE_MESH) { voice.peer(R.id); continue; } const d = R.s ? Math.hypot(R.s.x - x, R.s.z - z) : 1e9, has = voice.links && voice.links.has(R.id);
        if (!has && d < VOICE_NEAR && voice.links.size < VOICE_MESH) voice.peer(R.id); else if (has && d > VOICE_FAR) voice.drop(R.id); } }
    if (net.open && S.netT <= 0) { S.netT = rate;
      const st = { t: 'p', x: +x.toFixed(2), y: +(h ? h.pos.y : P.pos.y).toFixed(2), z: +z.toFixed(2), yw: +(h ? P.yaw : (H.bodyYaw ?? P.yaw)).toFixed(3), m: h ? h.id : -1, hy: h ? +h.yaw.toFixed(3) : 0, sp: +(h ? H.speed : S.footSp).toFixed(2) };
      if (horse.gunNet) Object.assign(st, horse.gunNet()); if (H.saloon) Object.assign(st, H.saloon.netState()); st.n = callsign().slice(0, 14); if (H.dead) st.dd = 1; if (isHost()) st.id = 'P1'; net.send(st); }
    if (isHost() && net.open && S.herdT <= 0) { S.herdT = .25; net.send({ t: 'herd', h: horse.herd() }); }
    if (isHost() && S.code && (S.hbT = (S.hbT || 0) - dt) <= 0) { S.hbT = 5; try { localStorage.setItem('hr_mycode', JSON.stringify({ code: S.code, t: Date.now() })); } catch (_) {} }
    // v34: never stay offline: retry the lobby in the background (cold lobby server, PeerJS hiccup, came back from the background)
    if (S.role === 'solo' && enabled() && !S.busy && (S.retryT = (S.retryT ?? 15) - dt) <= 0) { S.retryT = 15; auto(); }
    // a lone host merges into an older open Horse Rider lobby (two players hosted at the same moment)
    if (isHost() && !S.remotes.size && LOBBY_URL && (S.mergeT -= dt) <= 0) { S.mergeT = 10;
      lobbyList().then(list => { const o = list.filter(l => l.mode === 'horse' && l.code !== S.code && l.players < l.max && l.code < S.code)[0]; if (o && isHost() && !S.remotes.size) auto(o.code); }); }
    H.online = S.role === 'solo' ? '' : '👥 ' + (1 + S.remotes.size) + '/' + MAX_PLAYERS;
  }
  return { state: S, net, voice, auto, tick, enabled, prime: () => { if (enabled()) voice.prime(); } };
}
