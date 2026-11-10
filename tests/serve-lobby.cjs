// Dev/test server: serves the game statically AND the lobby directory API (/lobby, /lobbies) on one port.
// Run: node tests/serve-lobby.cjs [port]  → open http://localhost:PORT/?lobby=http://localhost:PORT
const http = require('http'), fs = require('fs'), path = require('path');
process.env.STALE_MS = process.env.STALE_MS || '45000';
const { handler } = require('../lobby-server/server.js');
const root = path.join(__dirname, '..'), port = +(process.argv[2] || 8795);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.hdr': 'application/octet-stream' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/lobby' || u.pathname === '/lobbies' || u.pathname === '/health') return handler(req, res);
  const f = path.join(root, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(port, () => console.log('serving game + lobby on', port));
