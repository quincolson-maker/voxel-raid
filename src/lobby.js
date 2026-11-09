// Open-lobby directory client. Hosts heartbeat their room to a tiny free lobby service; the menu polls the list.
// Override the service with ?lobby=URL (tests use a local copy). Failures are silent: co-op codes still work.
const Q = new URLSearchParams(location.search);
// Local dev/tests (localhost) skip the public directory unless ?lobby=URL is given.
const LOCAL = /^(localhost|127\.|\[::1\])/.test(location.hostname);
export const LOBBY_URL = (Q.get('lobby') || (LOCAL ? '' : 'https://voxel-raid-lobby.onrender.com')).replace(/\/$/, '');
const post = (body, beacon) => { if (!LOBBY_URL) return Promise.resolve();
  const s = JSON.stringify(body);
  if (beacon && navigator.sendBeacon) { try { if (navigator.sendBeacon(LOBBY_URL + '/lobby', new Blob([s], { type: 'text/plain' }))) return Promise.resolve(); } catch (_) {} }
  // text/plain keeps this a CORS "simple" request (no preflight)
  return fetch(LOBBY_URL + '/lobby', { method: 'POST', body: s, headers: { 'Content-Type': 'text/plain' }, keepalive: !!beacon }).catch(() => {});
};
// Host side: advertise({ code, host, players, max, map }) then call again whenever the player count changes.
export function createAdvert() {
  let info = null, timer = 0; const key = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const beat = () => info && post({ ...info, key });
  const stop = () => { if (!info) return; post({ code: info.code, closed: true, key }, true); info = null; clearInterval(timer); };
  addEventListener('pagehide', stop);
  return {
    update(i) { const first = !info; info = { ...(info || {}), ...i }; beat(); if (first) timer = setInterval(beat, 15000); },
    stop,
  };
}
// Menu side: fetch the list now and every few seconds while visible; onList(lobbies | null on error).
export function watchLobbies(onList, isVisible) {
  if (!LOBBY_URL) { const el = document.getElementById('lobbies'); if (el) el.hidden = true; return { refresh() {}, stop() {} }; }
  let busy = false;
  const tick = () => { if (busy || !isVisible() || document.hidden) return; busy = true;
    fetch(LOBBY_URL + '/lobbies', { cache: 'no-store' }).then(r => r.json()).then(j => onList(Array.isArray(j.lobbies) ? j.lobbies : [])).catch(() => onList(null)).finally(() => { busy = false; }); };
  tick(); const t = setInterval(tick, 5000); document.addEventListener('visibilitychange', tick);
  return { refresh: tick, stop: () => clearInterval(t) };
}
