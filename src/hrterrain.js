// HORSE RIDER rideable mountains (v30): terrain features carved into the height field + streamed detail terrain chunks.
//  - mountain trails: least-cost paths (Dijkstra on a 10 m grid, grade-limited -> natural switchbacks) from the meadows to the
//    highest reachable summit in three directions, smoothed and cut into the slopes as a 4-5 m bench
//  - ponds (meadow basins + an alpine tarn) carved as bowls with a water level below their rim, a creek from the mountains down to one
//  - a world mask texture (distance to trail / to water) for the terrain + grass shaders
//  - camera-centred square of detail chunks (125 m, 1.6-3.1 m grid) streamed one per frame; the coarse inner square and the far
//    ring punch a hole where the chunks are (vertex sink + fragment discard, see terrainMaterial CHUNK_HOLE)
// Everything is deterministic from the height function, so every player in a lobby gets the same trails, ponds and creek.
import * as THREE from 'three';
const sstep = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// tiny binary heap keyed by Float64 costs
function Heap(n) { const k = new Int32Array(n + 1), c = new Float64Array(n + 1); let len = 0;
  return { get size() { return len; }, push(i, v) { let p = ++len; k[p] = i; c[p] = v; while (p > 1 && c[p >> 1] > c[p]) { const q = p >> 1; [k[p], k[q]] = [k[q], k[p]]; [c[p], c[q]] = [c[q], c[p]]; p = q; } },
    pop() { const top = k[1], tv = c[1]; k[1] = k[len]; c[1] = c[len]; len--; let p = 1; for (;;) { const l = p * 2, r = l + 1; let m = p; if (l <= len && c[l] < c[m]) m = l; if (r <= len && c[r] < c[m]) m = r; if (m === p) break; [k[p], k[m]] = [k[m], k[p]]; [c[p], c[m]] = [c[m], c[p]]; p = m; } return [top, tv]; } }; }

function chaikin(P, it) { for (let n = 0; n < it; n++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } Q.push(P[P.length - 1]); P = Q; } return P; }
function resample(P, step) { const out = [P[0].slice()]; let acc = 0; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = step - acc;
    while (t <= L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; } acc = L - (t - step); } const e = P[P.length - 1]; if (Math.hypot(e[0] - out[out.length - 1][0], e[1] - out[out.length - 1][1]) > step * .3) out.push(e.slice()); return out; }
function smooth1(Y, w, pass) { for (let p = 0; p < pass; p++) { const Z = Y.slice(); for (let i = 0; i < Y.length; i++) { let s = 0, n = 0; for (let j = Math.max(0, i - w); j <= Math.min(Y.length - 1, i + w); j++) { s += Y[j]; n++; } Z[i] = s / n; } Y = Z; } return Y; }
function segD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = px - ax - dx * t, ez = pz - az - dz * t; return [Math.sqrt(ex * ex + ez * ez), t]; }

// spatial hash of polyline segments: [ax, az, ay, bx, bz, by]
function SegHash(cell) { const M = new Map(), S = [], key = (i, j) => (i + 4096) * 8192 + (j + 4096);
  return { S, add(a, b, pad, leg = 0, at = 0) { const id = S.length; S.push([a[0], a[1], a[2], b[0], b[1], b[2], leg, at]); const x0 = Math.floor((Math.min(a[0], b[0]) - pad) / cell), x1 = Math.floor((Math.max(a[0], b[0]) + pad) / cell), z0 = Math.floor((Math.min(a[1], b[1]) - pad) / cell), z1 = Math.floor((Math.max(a[1], b[1]) + pad) / cell);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); let L = M.get(k); if (!L) M.set(k, L = []); L.push(id); } },
    // nearest segment -> [dist, y at the closest point] or null
    near(x, z) { const L = M.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!L) return null; let bd = 1e9, by = 0;
      for (const id of L) { const s = S[id], [d, t] = segD(x, z, s[0], s[1], s[3], s[4]); if (d < bd) { bd = d; by = s[2] + (s[5] - s[2]) * t; } } return [bd, by]; },
    // smooth trail height: distance-weighted blend of every nearby segment (hairpin legs meet in a ramp, no steps) -> [nearest dist, y]
    blend(x, z) { const L = M.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!L) return null; let bd = 1e9, sw = 0, sy = 0;
      for (const id of L) { const s = S[id], [d, t] = segD(x, z, s[0], s[1], s[3], s[4]); if (d < bd) bd = d; if (d < 11) { const w = (1 - sstep(6, 11, d)) / ((d + .6) * (d + .6)); sw += w; sy += w * (s[2] + (s[5] - s[2]) * t); } }
      return sw > 0 ? [bd, sy / sw] : [bd, 0]; } }; }

export function buildFeatures(h0, o) {
  const t0 = performance.now(), { BASE, WALK, avoid } = o, G = 10, N = Math.floor(WALK / G) * 2 + 1, O = -Math.floor(WALK / G) * G;
  const X = i => O + i * G, H = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = h0(X(i), X(j));
  const steep = new Float32Array(N * N), cav = new Float32Array(N * N);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; steep[k] = Math.hypot(H[k + 1] - H[k - 1], H[k + N] - H[k - N]) / (2 * G);
    let s = 0, n = 0; for (let b = -3; b <= 3; b += 3) for (let a = -3; a <= 3; a += 3) { const ii = i + a, jj = j + b; if ((a || b) && ii >= 0 && jj >= 0 && ii < N && jj < N) { s += H[jj * N + ii]; n++; } } cav[k] = H[k] - s / n; } // >0 ridge, <0 gully
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
  const node = (x, z) => Math.max(0, Math.min(N - 1, Math.round((x - O) / G))) + Math.max(0, Math.min(N - 1, Math.round((z - O) / G))) * N;
  // Dijkstra over the grid with an edge cost function; returns {D, prev, len}
  function dijkstra(src, cost, stop) { const D = new Float64Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), len = new Float32Array(N * N), hp = Heap(N * N * 4); D[src] = 0; hp.push(src, 0);
    while (hp.size) { const [k, d] = hp.pop(); if (d > D[k]) continue; if (stop && stop(k)) break; const i = k % N, j = (k / N) | 0;
      for (const [a, b] of DIRS) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const n = jj * N + ii, L = Math.hypot(a, b) * G, c = cost(k, n, L); if (!(c < Infinity)) continue;
        const nd = d + c; if (nd < D[n]) { D[n] = nd; prev[n] = k; len[n] = len[k] + L; hp.push(n, nd); } } } return { D, prev, len }; }
  const path = (prev, k) => { const P = []; for (; k >= 0; k = prev[k]) P.push([X(k % N), X((k / N) | 0)]); return P.reverse(); };
  const ok = k => !avoid(X(k % N), X((k / N) | 0));

  // ---- trails ----
  const trailCost = (k, n, L) => { const g = Math.abs(H[n] - H[k]) / L; if (g > (o.gmax ?? .4) || !ok(n)) return Infinity; const x = X(n % N), z = X((n / N) | 0), r = Math.hypot(x, z);
    return L * (1 + 10 * g * g + .6 * Math.max(0, steep[n] - .7) + (r < 230 ? 1.5 : 0)); };
  const heads = o.heads || [[-Math.PI / 2, 160], [.3, 165], [Math.PI, 175]], trails = [], tops = [];
  for (const [ang, r0] of heads) { const hx = Math.cos(ang) * r0, hz = Math.sin(ang) * r0, src = node(hx, hz), R = dijkstra(src, trailCost);
    let best = -1, bh = -1e9; for (let k = 0; k < N * N; k++) { if (!(R.D[k] < Infinity) || R.len[k] > 3400) continue; const x = X(k % N), z = X((k / N) | 0); if (Math.max(Math.abs(x), Math.abs(z)) > WALK - 45) continue;
      let da = Math.atan2(z, x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 1.05) continue; if (tops.some(t => Math.hypot(t[0] - x, t[1] - z) < 350)) continue; if (H[k] > bh) { bh = H[k]; best = k; } }
    if (best < 0) continue; let P = path(R.prev, best); P[0] = [hx, hz]; P = resample(chaikin(P, 3), 2.5); for (let pass = 0; pass < (o.sp ?? 4); pass++) { const Q = P.map(q => q.slice()); for (let i = 1; i < P.length - 1; i++) { let sx = 0, sz = 0, n = 0; for (let j = Math.max(0, i - (o.sw ?? 3)); j <= Math.min(P.length - 1, i + (o.sw ?? 3)); j++) { sx += P[j][0]; sz += P[j][1]; n++; } Q[i] = [sx / n, sz / n]; } P = Q; } P = resample(P, 2.5); /* wider hairpins */ let Y = smooth1(P.map(p => h0(p[0], p[1])), 5, 3);
    for (let pass = 0; pass < 2; pass++) { for (let i = 1; i < Y.length; i++) { const c = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) * (o.gl ?? .55); Y[i] = Math.max(Y[i - 1] - c, Math.min(Y[i - 1] + c, Y[i])); } Y = smooth1(Y, 1, 1); } // grade-limited along the chord (tight hairpins too)
    const pts = P.map((p, i) => [p[0], p[1], Y[i]]); trails.push({ pts, head: [hx, hz, Y[0]], top: pts[pts.length - 1], ang }); tops.push(pts[pts.length - 1]); }
  const TH = SegHash(24); for (const t of trails) trails.forEach((t, k) => { for (let i = 0; i < t.pts.length - 1; i++) TH.add(t.pts[i], t.pts[i + 1], 12, k, i); });

  // ---- ponds: basins away from the pen, trails and paths; water level a little under the lowest rim point ----
  const r = rng(4242), ponds = [], trailNear = (x, z, m) => { const q = TH.near(x, z); return q && q[0] < m; };
  function basin(x, z, R) { const c = h0(x, z); let mn = 1e9, s = 0; for (const k of [1, 1.12, 1.3]) for (let a = 0; a < 24; a++) { const q = h0(x + Math.cos(a / 24 * 6.283) * R * k, z + Math.sin(a / 24 * 6.283) * R * k); mn = Math.min(mn, q); s += q; } return { c, mn, mean: s / 72 }; }
  function pickPond(rMin, rMax, maxH, R) { let best = null; for (let i = 0; i < 500; i++) { const a = r() * 6.283, d = rMin + r() * (rMax - rMin), x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (avoid(x, z) || avoid(x + R, z) || avoid(x - R, z) || avoid(x, z + R) || avoid(x, z - R) || trailNear(x, z, R + 22) || ponds.some(p => Math.hypot(p.x - x, p.z - z) < 160)) continue;
      const b = basin(x, z, R); if (b.c - BASE > maxH || steep[node(x, z)] > .3) continue; const sc = (b.mn - b.c) + (b.mean - b.c) * .5; if (!best || sc > best.sc) best = { x, z, R, L: b.mn - .25, sc }; } if (best) ponds.push(best); return best; }
  const pond0 = pickPond(170, 320, 25, 17); pickPond(190, 330, 25, 12); pickPond(480, Math.min(WALK - 80, 860), 210, 15);

  // ---- creek: from a gully up in the mountains down to the first pond (Dijkstra that hates going uphill, follows gullies) ----
  const creeks = [], CH = SegHash(24);
  if (pond0) { const pa = Math.atan2(pond0.z, pond0.x); let src = -1, bs = 1e9;
    for (let k = 0; k < N * N; k++) { const x = X(k % N), z = X((k / N) | 0), d = Math.hypot(x, z); if (d < 620 || d > 860) continue; let da = Math.atan2(z, x) - pa; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > .7) continue;
      const hh = H[k] - BASE; if (hh < 80 || hh > 260) continue; const s = cav[k] + Math.abs(da) * 4; if (s < bs) { bs = s; src = k; } }
    const tgt = node(pond0.x, pond0.z);
    if (src >= 0) { const R = dijkstra(src, (k, n, L) => ok(n) || n === tgt ? L * (1 + .25 * Math.max(0, cav[n] + 1)) + 60 * Math.max(0, H[n] - H[k]) : Infinity, k => k === tgt);
      if (R.D[tgt] < Infinity) { let P = path(R.prev, tgt); P = resample(chaikin(P, 3), 2); while (P.length > 2 && Math.hypot(P[P.length - 1][0] - pond0.x, P[P.length - 1][1] - pond0.z) < pond0.R * .5) P.pop();
        let Y = smooth1(P.map(p => h0(p[0], p[1])), 4, 2), m = 1e9; Y = Y.map((y, i) => { m = Math.min(m, y - .9); return m; }); for (let i = 0; i < Y.length; i++) Y[i] = Math.min(Y[i], i > Y.length - 30 ? pond0.L - .35 + (Y.length - 1 - i) * .02 : 1e9);
        const pts = P.map((p, i) => [p[0], p[1], Y[i]]); creeks.push({ pts }); for (let i = 0; i < pts.length - 1; i++) CH.add(pts[i], pts[i + 1], 8); } } }

  // ---- the carve: trail bench, then the creek channel (shallow where it crosses a trail: a ford), then the pond bowls ----
  function carve(x, z, h) {
    const q = TH.blend(x, z); let dT = 99; if (q) { dT = q[0]; if (dT < 9.5) h += (q[1] - h) * (1 - sstep(3, 9.5, dT)); }
    const c = CH.near(x, z); if (c && c[0] < 8 && h > c[1]) { const cut = (h - c[1]) * (1 - sstep(1.5, 11, c[0])); h -= Math.min(cut, .25 + 1.1 * sstep(3, 9, dT) + 20 * sstep(6, 12, dT)); }
    for (const p of ponds) { const dx = x - p.x, dz = z - p.z, q2 = (dx * dx + dz * dz) / (p.R * p.R); if (q2 < 1.8) { const q = Math.sqrt(q2), tg = Math.min(h, p.L + .55 - 1.6 * (1 - q2)); h += (tg - h) * (1 - sstep(.9, 1.34, q)); } } // soft shore, only ever lowered, never below the water line outside the bowl
    return h; }
  const info = { ms: Math.round(performance.now() - t0), trails: trails.map(t => ({ len: Math.round(t.pts.length * 2.5), top: Math.round(t.top[2] - BASE), head: t.head.map(v => +v.toFixed(1)) })), ponds: ponds.map(p => [Math.round(p.x), Math.round(p.z), p.R]), creek: creeks.map(c => c.pts.length * 2) };
  return { carve, trails, ponds, creeks, TH, CH, info,
    trailDist: (x, z) => { const q = TH.near(x, z); return q ? q[0] : 99; }, waterDist: (x, z) => { let d = 99; const q = CH.near(x, z); if (q) d = q[0]; for (const p of ponds) d = Math.min(d, Math.max(0, Math.hypot(x - p.x, z - p.z) - p.R * .85)); return d; } };
}

// world mask: R = closeness to a mountain trail (8 m), G = closeness to water (30 m); RG8, linear filtered
export function buildMask(F, half, size) {
  const px = 2 * half / size, A = new Uint8Array(size * size * 2), put = (c, x, z, d, D) => { const i = Math.floor((x + half) / px), j = Math.floor((z + half) / px); if (i < 0 || j < 0 || i >= size || j >= size) return; const v = Math.round(255 * Math.max(0, 1 - d / D)), k = (j * size + i) * 2 + c; if (v > A[k]) A[k] = v; };
  const stamp = (c, S, D) => { for (const s of S) { const x0 = Math.floor((Math.min(s[0], s[3]) - D + half) / px), x1 = Math.ceil((Math.max(s[0], s[3]) + D + half) / px), z0 = Math.floor((Math.min(s[1], s[4]) - D + half) / px), z1 = Math.ceil((Math.max(s[1], s[4]) + D + half) / px);
      for (let j = Math.max(0, z0); j <= Math.min(size - 1, z1); j++) for (let i = Math.max(0, x0); i <= Math.min(size - 1, x1); i++) { const x = -half + (i + .5) * px, z = -half + (j + .5) * px; put(c, x, z, segD(x, z, s[0], s[1], s[3], s[4])[0], D); } } };
  stamp(0, F.TH.S, 8); stamp(1, F.CH.S, 30);
  for (const p of F.ponds) { const D = 30, R = p.R * .85; for (let j = Math.floor((p.z - R - D + half) / px); j <= Math.ceil((p.z + R + D + half) / px); j++) for (let i = Math.floor((p.x - R - D + half) / px); i <= Math.ceil((p.x + R + D + half) / px); i++) { const x = -half + (i + .5) * px, z = -half + (j + .5) * px; put(1, x, z, Math.max(0, Math.hypot(x - p.x, z - p.z) - R), D); } }
  const t = new THREE.DataTexture(A, size, size, THREE.RGFormat, THREE.UnsignedByteType); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}

// streamed detail chunks: (2K+1)^2 square of CH-sized chunks around the player, one new chunk built per frame (nearest first)
export function createChunks(scene, mat, hAt, o) {
  const CH = o.CH, n = o.seg, K = o.K, LIM = o.lim, U = o.U, cells = new Map(), key = (i, j) => i * 1000 + j, step = CH / n;
  let shown = null, tris = 0, built = 0, lastP = null;
  function build(i, j) {
    const x0 = i * CH, z0 = j * CH, W = n + 3, hh = new Float32Array(W * W); for (let b = 0; b < W; b++) for (let a = 0; a < W; a++) hh[b * W + a] = hAt(x0 + (a - 1) * step, z0 + (b - 1) * step);
    const V = (n + 1) * (n + 1), sk = 4 * n + 4, pos = new Float32Array((V + sk * 2) * 3), nor = new Float32Array((V + sk * 2) * 3), uv = new Float32Array((V + sk * 2) * 2), IX = new Uint32Array(n * n * 6 + (4 * n + 4) * 12); let ni = 0; const idx = { push(...a) { for (const v of a) IX[ni++] = v; } }; // v37: typed index (was ~40k array pushes per chunk)
    for (let b = 0; b <= n; b++) for (let a = 0; a <= n; a++) { const v = b * (n + 1) + a, hc = hh[(b + 1) * W + a + 1], x = x0 + a * step, z = z0 + b * step;
      pos[v * 3] = x; pos[v * 3 + 1] = hc; pos[v * 3 + 2] = z; const nx = hh[(b + 1) * W + a] - hh[(b + 1) * W + a + 2], nz = hh[b * W + a + 1] - hh[(b + 2) * W + a + 1], l = Math.hypot(nx, 2 * step, nz);
      nor[v * 3] = nx / l; nor[v * 3 + 1] = 2 * step / l; nor[v * 3 + 2] = nz / l; uv[v * 2] = x / 2.5; uv[v * 2 + 1] = z / 2.5; }
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const v = b * (n + 1) + a; IX[ni++] = v; IX[ni++] = v + n + 1; IX[ni++] = v + 1; IX[ni++] = v + 1; IX[ni++] = v + n + 1; IX[ni++] = v + n + 2; }
    // skirts hanging 8 m under every edge (hide cracks against the coarse terrain around the chunk square)
    const rim = []; for (let a = 0; a <= n; a++) rim.push(a); for (let b = 1; b <= n; b++) rim.push(b * (n + 1) + n); for (let a = n - 1; a >= 0; a--) rim.push(n * (n + 1) + a); for (let b = n - 1; b >= 0; b--) rim.push(b * (n + 1));
    let w = V; for (const v of rim) { for (const dy of [0, -8]) { pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = pos[v * 3 + 1] + dy; pos[w * 3 + 2] = pos[v * 3 + 2]; nor[w * 3] = nor[v * 3]; nor[w * 3 + 1] = nor[v * 3 + 1]; nor[w * 3 + 2] = nor[v * 3 + 2]; uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1]; w++; } }
    for (let s = 0; s < rim.length - 1; s++) { const a = V + s * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3, a, a + 2, a + 1, a + 2, a + 3, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, w * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, w * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, w * 2), 2));
    g.setIndex(new THREE.BufferAttribute(IX.slice(0, ni), 1)); g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.visible = false; scene.add(m); built++; return { m, tris: ni / 3 }; }
  const inLim = (i, j) => i >= -LIM && i < LIM && j >= -LIM && j < LIM;
  function update(px, pz, all) {
    if (lastP && Math.hypot(px - lastP[0], pz - lastP[1]) > CH * .8) all = true; lastP = [px, pz]; // teleport / respawn: build the square now
    const pi = Math.floor(px / CH), pj = Math.floor(pz / CH); let todo = null, td = 1e9;
    for (let j = pj - K - 1; j <= pj + K + 1; j++) for (let i = pi - K - 1; i <= pi + K + 1; i++) { if (!inLim(i, j) || cells.has(key(i, j))) continue; const d = Math.hypot(i + .5 - px / CH, j + .5 - pz / CH);
      if (all && Math.max(Math.abs(i - pi), Math.abs(j - pj)) <= K) { cells.set(key(i, j), build(i, j)); continue; } if (d < td) { td = d; todo = [i, j]; } }
    if (todo) cells.set(key(todo[0], todo[1]), build(todo[0], todo[1]));
    // show the square around the player once all of it is built (else keep the old one)
    let ready = true; for (let j = pj - K; j <= pj + K && ready; j++) for (let i = pi - K; i <= pi + K; i++) if (inLim(i, j) && !cells.has(key(i, j))) { ready = false; break; }
    if (ready && (!shown || shown[0] !== pi || shown[1] !== pj)) { shown = [pi, pj]; U.value.set(pi, pj, K, 1); tris = 0;
      for (const [k, c] of cells) { const i = Math.round(k / 1000), j = k - i * 1000, vis = Math.max(Math.abs(i - pi), Math.abs(j - pj)) <= K; c.m.visible = vis; if (vis) tris += c.tris;
        if (Math.max(Math.abs(i - pi), Math.abs(j - pj)) > K + 2) { scene.remove(c.m); c.m.geometry.dispose(); cells.delete(k); } } }
  }
  return { update, get tris() { return tris; }, get count() { return cells.size; }, get built() { return built; }, get shown() { return shown; } };
}

// water: pond discs and the creek ribbon, with drifting ripples; shallow, so horses wade through
export function createWater(scene, F, hAt, o) {
  const U = { uT: { value: 0 } }, m = new THREE.MeshStandardMaterial({ color: 0x2a464b, roughness: .045, metalness: 0, transparent: true, opacity: .84, envMapIntensity: 1.5 });
  m.onBeforeCompile = sh => { sh.uniforms.uT = U.uT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWW=(modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWW; uniform float uT; float wh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float wn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wh(i),wh(i+vec2(1,0)),f.x),mix(wh(i+vec2(0,1)),wh(i+1.),f.x),f.y);}
float wv(vec2 p){return wn(p*.9+vec2(uT*.35,uT*.2))*.6+wn(p*2.3-vec2(uT*.5,-uT*.3))*.4;}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 p=vWW.xz; float e=.15, c=wv(p); vec3 wN=normalize(vec3((c-wv(p+vec2(e,0.)))*1.4,1.,(c-wv(p+vec2(0.,e)))*1.4)); normal=normalize((viewMatrix*vec4(wN,0.)).xyz); }`)
      .replace('#include <opaque_fragment>', 'float fr=.02+.98*pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),5.); diffuseColor.a=mix(.58,.97,fr); outgoingLight*=mix(.85,1.15,fr); /* v32: Schlick fresnel */\n#include <opaque_fragment>'); };
  const meshes = [];
  for (const p of F.ponds) { const g = new THREE.CircleGeometry(p.R * 1.15, o.mobile ? 28 : 48); g.rotateX(-Math.PI / 2); const w = new THREE.Mesh(g, m); w.position.set(p.x, p.L, p.z); w.renderOrder = 1; scene.add(w); meshes.push(w); }
  for (const c of F.creeks) { const P = c.pts, pos = [], idx = []; for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      for (const s of [-2.6, 0, 2.6]) { const x = P[i][0] + nx * s, z = P[i][1] + nz * s, y = P[i][2] + .28; pos.push(x, s ? Math.min(y, hAt(x, z) - .04) : y, z); } }
    for (let i = 0; i < P.length - 1; i++) for (let s = 0; s < 2; s++) { const a = i * 3 + s; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const w = new THREE.Mesh(g, m); w.renderOrder = 1; scene.add(w); meshes.push(w); }
  return { meshes, update(dt) { U.uT.value += dt; } };
}
