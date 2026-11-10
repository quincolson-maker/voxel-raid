// Voxel Raid lobby directory: a tiny dependency-free HTTP service (free Render web service).
// Hosts register their co-op room and heartbeat every ~15 s; the main menu lists rooms seen in the last 45 s.
// Stores nothing but room code, callsign, player count and map in memory. Gameplay and voice stay peer-to-peer.
const http = require('http');
const STALE_MS = +(process.env.STALE_MS || 45000), MAX_ROOMS = 200, MAX_BODY = 2048;
const rooms = new Map(); // code -> { code, host, players, max, map, mode ('zombies' | 'horse'), ts, ip }
const hits = new Map();  // ip -> { n, t } simple rate limit
const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanName = s => String(s || '').replace(/[^\w \-.']/g, '').trim().slice(0, 16) || 'Squad';
function prune() { const now = Date.now(); for (const [k, r] of rooms) if (now - r.ts > STALE_MS) rooms.delete(k); }
function limited(ip) { const now = Date.now(); let h = hits.get(ip); if (!h || now - h.t > 60000) { h = { n: 0, t: now }; hits.set(ip, h); } return ++h.n > 120; }
setInterval(() => { prune(); const now = Date.now(); for (const [k, h] of hits) if (now - h.t > 120000) hits.delete(k); }, 10000).unref();
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' });
  res.end(obj == null ? '' : JSON.stringify(obj));
}
function list() { prune(); return [...rooms.values()].filter(r => r.players < r.max).sort((a, b) => b.ts - a.ts).slice(0, 20).map(({ code, host, players, max, map, mode }) => ({ code, host, players, max, map, mode })); }
function handler(req, res) {
  const url = new URL(req.url, 'http://x'), ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (req.method === 'OPTIONS') return send(res, 204, null);
  if (url.pathname === '/' || url.pathname === '/health') return send(res, 200, { ok: true, rooms: rooms.size });
  if (url.pathname === '/lobbies' && req.method === 'GET') return send(res, 200, { lobbies: list(), stale: STALE_MS });
  if (url.pathname === '/lobby' && req.method === 'POST') {
    if (limited(ip)) return send(res, 429, { error: 'slow down' });
    let body = ''; req.on('data', d => { body += d; if (body.length > MAX_BODY) req.destroy(); });
    req.on('end', () => {
      let m; try { m = JSON.parse(body || '{}'); } catch (_) { return send(res, 400, { error: 'bad json' }); }
      const code = clean(m.code); if (code.length < 4) return send(res, 400, { error: 'bad code' });
      const cur = rooms.get(code);
      if (m.closed) { if (cur && cur.key === String(m.key || '')) rooms.delete(code); return send(res, 200, { ok: true }); }
      if (cur && cur.key !== String(m.key || '')) return send(res, 409, { error: 'code taken' });
      if (!cur && rooms.size >= MAX_ROOMS) { prune(); if (rooms.size >= MAX_ROOMS) return send(res, 503, { error: 'full' }); }
      const max = Math.max(2, Math.min(4, m.max | 0 || 4)), players = Math.max(1, Math.min(max, m.players | 0 || 1));
      rooms.set(code, { code, key: String(m.key || '').slice(0, 40), host: cleanName(m.host), players, max, map: m.map === 'night' ? 'night' : 'day', mode: m.mode === 'horse' ? 'horse' : 'zombies', ts: Date.now() });
      send(res, 200, { ok: true, stale: STALE_MS });
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}
module.exports = { handler, rooms };
if (require.main === module) http.createServer(handler).listen(process.env.PORT || 8790, () => console.log('lobby directory on', process.env.PORT || 8790));
