// Co-op transport (up to 25 players): PeerJS (vendored, MIT) WebRTC data channels in a host-authoritative star.
// The free public PeerJS broker is used for signaling only; gameplay traffic is peer-to-peer. No game server.
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const pid = c => 'voxelraid-deadsignal-' + c;
export const MAX_PLAYERS = 25; // v33: Quin asked for 25 riders per lobby
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
// Test-only loopback (?loopnet=1): tabs in one browser talk over BroadcastChannel with the same message flow.
// Used because the CI/box Chrome policy disables non-proxied WebRTC UDP; real players always use WebRTC.
function loopPeer(id) {
  const h = {}, P = { destroyed: false, on: (e, f) => (h[e] = f), destroy() {}, reconnect() {} };
  const bc = new BroadcastChannel('vr-loop'); const me = id || 'c' + Math.random().toString(36).slice(2, 8);
  const conns = {};
  function mk(remote) { const ch = {}, on = (e, f) => { const prev = ch[e]; ch[e] = prev ? (...a) => { prev(...a); f(...a); } : f; }, c = { peer: remote, on, send: d => bc.postMessage({ to: remote, from: me, d }), close() { bc.postMessage({ to: remote, from: me, close: 1 }); ch.close && ch.close(); }, ch }; conns[remote] = c; return c; }
  bc.onmessage = ({ data: m }) => { if (m.to !== me) return;
    if (m.hello) { const c = mk(m.from); h.connection && h.connection(c); setTimeout(() => { bc.postMessage({ to: m.from, from: me, ack: 1 }); c.ch.open && c.ch.open(); }, 50); return; }
    const c = conns[m.from]; if (!c) return; if (m.ack) { c.ch.open && c.ch.open(); return; } if (m.close) { c.ch.close && c.ch.close(); return; } c.ch.data && c.ch.data(m.d); };
  addEventListener('pagehide', () => { for (const k in conns) conns[k].close(); });
  P.connect = remote => { const c = mk(remote); bc.postMessage({ to: remote, from: me, hello: 1 }); return c; };
  setTimeout(() => h.open && h.open(me), 30); return P;
}
const LOOP = new URLSearchParams(location.search).get('loopnet') === '1';
const mkPeer = (id, o) => LOOP ? loopPeer(id) : id ? new window.Peer(id, o) : new window.Peer(o);
// onMsg(msg, fromPeerId); onStatus('open'|'closed'|'error', peerId)
export function createNet(onMsg, onStatus) {
  const N = { role: 'solo', peer: null, code: null, conns: new Map(), open: false };
  const now = () => performance.now();
  const refresh = () => { N.open = [...N.conns.values()].some(c => c.ok); };
  function wire(c) {
    const id = c.peer; c.ok = false; c.lastRx = now(); N.conns.set(id, c);
    c.on('open', () => { if (N.conns.get(id) !== c) return; c.ok = true; c.lastRx = now(); refresh(); onStatus('open', id); }); // v36: an old session's connection never talks into a newer one
    c.on('data', d => { if (N.conns.get(id) !== c) return; c.lastRx = now(); if (d && d.t !== 'hb') onMsg(d, id); });
    const closed = () => { if (N.conns.get(id) === c) { N.conns.delete(id); refresh(); onStatus('closed', id); } };
    c.on('close', closed); c.on('error', closed);
  }
  N.host = () => new Promise((res, rej) => {
    if (!window.Peer && !LOOP) { rej(new Error('PeerJS missing')); return; }
    let tries = 0;
    const attempt = () => {
      const code = Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
      const peer = mkPeer(pid(code), { debug: 0 }); N.peer = peer;
      peer.on('open', () => { if (N.peer !== peer) return; N.role = 'host'; N.code = code; res(code); });
      peer.on('connection', c => { if (N.peer !== peer) { try { c.close(); } catch (_) {} return; }
        if (N.conns.size >= MAX_PLAYERS - 1) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); }); return; }
        wire(c);
      });
      peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (_) {} });
      peer.on('error', e => { if (N.peer !== peer) return; if (e.type === 'unavailable-id' && ++tries < 4) { peer.destroy(); attempt(); } else if (!N.code) rej(e); else onStatus('error', e.type); });
    };
    attempt();
  });
  N.join = code => new Promise((res, rej) => {
    if (!window.Peer && !LOOP) { rej(new Error('PeerJS missing')); return; }
    const peer = mkPeer(null, { debug: 0 }); N.peer = peer; let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error('Could not reach room ' + code)); } }, 20000);
    peer.on('open', () => { if (N.peer !== peer) { if (!done) { done = true; clearTimeout(t); rej(new Error('stale')); } return; }
      const c = peer.connect(pid(code), { reliable: true, serialization: 'json' }); wire(c);
      c.on('open', () => { if (!done) { done = true; clearTimeout(t); N.role = 'client'; N.code = code; res(); } });
    });
    peer.on('error', e => { if (N.peer !== peer) return; if (!done) { done = true; clearTimeout(t); rej(new Error(e.type === 'peer-unavailable' ? 'Room ' + code + ' not found' : e.type)); } else onStatus('error', e.type); });
  });
  // v36: drop every connection and the peer, forget the role / code (a new session starts clean)
  N.reset = () => { const p = N.peer; N.peer = null; try { if (p && !p.destroyed) p.destroy(); } catch (_) {} const old = [...N.conns.values()]; N.conns.clear(); for (const c of old) { try { c.close(); } catch (_) {} } N.open = false; N.role = 'solo'; N.code = null; };
  // send(msg) broadcasts (host) / goes to host (client); send(msg, peerId) targets one; except skips one peer.
  N.send = (m, to, except) => { for (const [id, c] of N.conns) { if (!c.ok || (to && id !== to) || id === except) continue; try { c.send(m); } catch (_) {} } };
  setInterval(() => { for (const [id, c] of N.conns) { if (!c.ok) continue; try { c.send({ t: 'hb' }); } catch (_) {} if (now() - c.lastRx > 9000) { try { c.close(); } catch (_) {} if (N.conns.get(id) === c) { N.conns.delete(id); refresh(); onStatus('closed', id); } } } }, 1500);
  return N;
}
