// Two-player co-op transport: PeerJS (vendored, MIT) WebRTC data channel, free public PeerJS broker for signaling only.
// Gameplay traffic is peer-to-peer; no game server or paid hosting is involved.
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const pid = c => 'voxelraid-deadsignal-' + c;
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
// Test-only loopback (?loopnet=1): two tabs in one browser talk over BroadcastChannel with the same message flow.
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
export function createNet(onMsg, onStatus) {
  const N = { role: 'solo', conn: null, peer: null, code: null, open: false, lastRx: 0 };
  const now = () => performance.now();
  function wire(c) {
    N.conn = c;
    c.on('open', () => { N.open = true; N.lastRx = now(); onStatus('open'); });
    c.on('data', d => { N.lastRx = now(); if (d && d.t !== 'hb') onMsg(d); });
    const closed = () => { if (N.conn === c) { N.open = false; N.conn = null; onStatus('closed'); } };
    c.on('close', closed); c.on('error', closed);
  }
  N.host = () => new Promise((res, rej) => {
    if (!window.Peer && !LOOP) { rej(new Error('PeerJS missing')); return; }
    let tries = 0;
    const attempt = () => {
      const code = Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
      const peer = mkPeer(pid(code), { debug: 0 }); N.peer = peer;
      peer.on('open', () => { N.role = 'host'; N.code = code; res(code); });
      peer.on('connection', c => {
        if (N.conn && N.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); }); return; }
        wire(c);
      });
      peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (_) {} });
      peer.on('error', e => { if (e.type === 'unavailable-id' && ++tries < 4) { peer.destroy(); attempt(); } else if (!N.code) rej(e); else onStatus('error', e.type); });
    };
    attempt();
  });
  N.join = code => new Promise((res, rej) => {
    if (!window.Peer && !LOOP) { rej(new Error('PeerJS missing')); return; }
    const peer = mkPeer(null, { debug: 0 }); N.peer = peer; let done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error('Could not reach room ' + code)); } }, 20000);
    peer.on('open', () => {
      const c = peer.connect(pid(code), { reliable: true, serialization: 'json' }); wire(c);
      c.on('open', () => { if (!done) { done = true; clearTimeout(t); N.role = 'client'; N.code = code; res(); } });
    });
    peer.on('error', e => { if (!done) { done = true; clearTimeout(t); rej(new Error(e.type === 'peer-unavailable' ? 'Room ' + code + ' not found' : e.type)); } else onStatus('error', e.type); });
  });
  N.send = m => { if (N.open && N.conn) try { N.conn.send(m); } catch (_) {} };
  // Heartbeat so a backgrounded/closed phone is detected even if the data channel never fires 'close'.
  setInterval(() => { if (!N.open) return; N.send({ t: 'hb' }); if (now() - N.lastRx > 9000) { try { N.conn.close(); } catch (_) {} N.open = false; N.conn = null; onStatus('closed'); } }, 1500);
  return N;
}
