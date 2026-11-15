// Voxel Raid lobby directory: a tiny dependency-free HTTP service (free Render web service).
// Hosts register their co-op room and heartbeat every ~15 s; the main menu lists rooms seen in the last 45 s.
// Stores nothing but room code, callsign, player count and map in memory. Gameplay and voice stay peer-to-peer.
const http = require('http'), fs = require('fs'), path = require('path');
// v2: weekly global leaderboard for Horse Rider. Riders post their own weekly totals; we keep the best per rider per ISO week.
// Kept in memory and mirrored to a small JSON file (a free Render instance may wipe it on redeploy; the game handles an empty board).
const LB_FILE = process.env.LB_FILE || path.join(__dirname, 'leaderboard.json'), LB_MAX = 500;
const isoWeek = (d = new Date()) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0'); };
let LB = { week: isoWeek(), riders: {} }; try { const v = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); if (v && v.week === LB.week && v.riders) LB = v; } catch (_) {}
// Optional permanent storage: set REDIS_URL (e.g. a free Render Key Value instance's internal URL). Tiny RESP client, no npm packages.
const net = require('net'), tls = require('tls'); const KV = process.env.REDIS_URL || process.env.KV_URL || '';
function kv(cmd) { return new Promise(res => { if (!KV) return res(null); let u; try { u = new URL(KV); } catch (_) { return res(null); }
  const opts = { host: u.hostname, port: +u.port || 6379, servername: u.hostname }, sock = (u.protocol === 'rediss:' ? tls : net).connect(opts); let buf = '', done = false; const fin = v => { if (done) return; done = true; try { sock.destroy(); } catch (_) {} res(v); };
  const enc = a => '*' + a.length + '\r\n' + a.map(x => { x = String(x); return '$' + Buffer.byteLength(x) + '\r\n' + x + '\r\n'; }).join('');
  const auth = u.password ? enc(u.username && u.username !== 'default' ? ['AUTH', decodeURIComponent(u.username), decodeURIComponent(u.password)] : ['AUTH', decodeURIComponent(u.password)]) : '';
  sock.setTimeout(4000, () => fin(null)); sock.on('error', () => fin(null)); sock.on('connect', () => sock.write(auth + enc(cmd))); sock.on('secureConnect', () => {});
  sock.on('data', d => { buf += d; const parts = buf.split('\r\n'); let i = 0; if (u.password) { if (!parts[0] || parts.length < 2) return; i = 1; } const h = parts[i]; if (h == null || h === '') return;
    if (h[0] === '$') { const n = +h.slice(1); if (n < 0) return fin(null); const body = parts.slice(i + 1).join('\r\n'); if (Buffer.byteLength(body) >= n) fin(body.slice(0, n)); } else if (h[0] === '+' || h[0] === ':') fin(h.slice(1)); else if (h[0] === '-') fin(null); }); }); }
kv(['GET', 'hr_lb']).then(v => { if (!v) return; try { const o = JSON.parse(v); if (o && o.week === isoWeek() && o.riders && Object.keys(o.riders).length >= Object.keys(LB.riders).length) LB = o; } catch (_) {} });
let lbDirty = false; setInterval(() => { if (!lbDirty) return; lbDirty = false; const s = JSON.stringify(LB); fs.writeFile(LB_FILE, s, () => {}); kv(['SET', 'hr_lb', s]); }, 15000).unref();
function lbRoll() { const w = isoWeek(); if (LB.week !== w) { LB = { week: w, riders: {} }; lbDirty = true; } }
const num = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
function lbTop(n = 25) { lbRoll(); return Object.values(LB.riders).sort((a, b) => b.pts - a.pts || b.k - a.k).slice(0, n).map(({ name, pts, k, b, s, rank }) => ({ name, pts, k, b, s, rank })); }
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
  if (url.pathname === '/' || url.pathname === '/health') return send(res, 200, { ok: true, rooms: rooms.size, lb: true, lbStore: KV ? 'kv' : 'file' });
  if (url.pathname === '/lb' && req.method === 'GET') return send(res, 200, { week: LB.week, top: lbTop(+url.searchParams.get('n') || 25), riders: Object.keys(LB.riders).length });
  if (url.pathname === '/lb' && req.method === 'POST') {
    if (limited(ip)) return send(res, 429, { error: 'slow down' });
    let body = ''; req.on('data', d => { body += d; if (body.length > MAX_BODY) req.destroy(); });
    req.on('end', () => { let m; try { m = JSON.parse(body || '{}'); } catch (_) { return send(res, 400, { error: 'bad json' }); }
      lbRoll(); const id = String(m.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24); if (id.length < 8 || m.week !== LB.week) return send(res, 400, { error: 'bad id or week', week: LB.week });
      const cur = LB.riders[id]; if (!cur && Object.keys(LB.riders).length >= LB_MAX) { const low = Object.entries(LB.riders).sort((a, b) => a[1].pts - b[1].pts)[0]; if (low && low[1].pts < num(m.pts, 5e6)) delete LB.riders[low[0]]; else return send(res, 200, { ok: true, top: lbTop() }); }
      const r = LB.riders[id] = { name: cleanName(m.name), pts: Math.max(cur ? cur.pts : 0, num(m.pts, 5e6)), k: Math.max(cur ? cur.k : 0, num(m.k, 1e5)), b: Math.max(cur ? cur.b : 0, num(m.b, 1e4)), s: Math.max(cur ? cur.s : 0, num(m.s, 99)), rank: String(m.rank || '').replace(/[^\w \-]/g, '').slice(0, 26), ts: Date.now() };
      lbDirty = true; const top = lbTop(); send(res, 200, { ok: true, week: LB.week, top, me: Object.values(LB.riders).filter(q => q.pts > r.pts).length + 1 }); });
    return; }
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
      const max = Math.max(2, Math.min(25, m.max | 0 || 4)), players = Math.max(1, Math.min(max, m.players | 0 || 1));
      rooms.set(code, { code, key: String(m.key || '').slice(0, 40), host: cleanName(m.host), players, max, map: m.map === 'night' ? 'night' : 'day', mode: m.mode === 'horse' ? 'horse' : 'zombies', ts: Date.now() });
      send(res, 200, { ok: true, stale: STALE_MS });
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}
module.exports = { handler, rooms };
if (require.main === module) http.createServer(handler).listen(process.env.PORT || 8790, () => console.log('lobby directory on', process.env.PORT || 8790));
