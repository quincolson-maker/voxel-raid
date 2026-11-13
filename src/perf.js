// v36 ?perf=1 (or localStorage vr_perf=1): measured numbers only. Frame time median / p95 / max, CPU time per subsystem,
// GPU time (EXT_disjoint_timer_query_webgl2 when the browser has it, else "n/a"), the whole composer frame's draw calls /
// triangles (shadows + post passes included: renderer.info is reset once per frame, not per pass), live geometries / textures /
// shader programs, pixel ratio and canvas size, active post passes, zombie / horse / tree LOD counts, network messages and
// bytes per message type and per peer each second (bytes = JSON characters sent, the PeerJS json serialization), and the
// age of the last zombie snapshot. Off by default: every hook below returns at once when it is off.
export const PF = { on: false, st: {}, acc: {}, n: 0, ft: [], ct: [], gt: [], net: { out: {}, in: {}, to: {}, from: {}, t0: 0 }, last: null, info: null, ext: null, q: [], spikes: 0 };
const now = () => performance.now(), WIN = 240;
PF.s = k => { if (PF.on) PF.st[k] = now(); };
PF.e = k => { if (PF.on) PF.acc[k] = (PF.acc[k] || 0) + now() - PF.st[k]; };
const bump = (o, k, b) => { const r = o[k] || (o[k] = [0, 0]); r[0]++; r[1] += b; };
const size = m => { try { return typeof m === 'string' ? m.length : JSON.stringify(m).length; } catch (_) { return 0; } };
PF.out = (m, to) => { if (!PF.on || !m) return; const b = size(m); bump(PF.net.out, m.t || '?', b); bump(PF.net.to, String(to || '?').slice(-6), b); };
PF.inc = (m, from) => { if (!PF.on || !m) return; const b = size(m); bump(PF.net.in, m.t || '?', b); bump(PF.net.from, String(from || '?').slice(-6), b); };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + .5))]; };
const r1 = x => Math.round(x * 10) / 10, kb = b => b >= 1024 ? r1(b / 1024) + ' KB' : b + ' B';
export function initPerf({ renderer, GX, H, Q, qname }) {
  PF.on = Q.get('perf') === '1' || localStorage.getItem('vr_perf') === '1'; if (!PF.on) return PF;
  renderer.info.autoReset = false; const gl = renderer.getContext();
  try { PF.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch (_) {}
  const el = document.createElement('pre'); el.id = 'perfHud';
  el.style.cssText = 'position:fixed;left:6px;top:46px;z-index:60;margin:0;padding:6px 8px;background:rgba(0,0,0,.72);color:#cfe;font:11px/1.3 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;white-space:pre;max-width:96vw;overflow:hidden;border-radius:6px';
  document.body.appendChild(el); PF.net.t0 = now(); let tSample = now(), framesSince = 0;
  PF.frameStart = () => { renderer.info.reset(); framesSince++; };
  PF.gpuBegin = () => { if (!PF.ext || PF.q.length > 4) return; const q = gl.createQuery(); gl.beginQuery(PF.ext.TIME_ELAPSED_EXT, q); PF.q.push(q); PF.qOpen = q; };
  PF.gpuEnd = () => { if (!PF.qOpen) return; gl.endQuery(PF.ext.TIME_ELAPSED_EXT); PF.qOpen = null;
    while (PF.q.length && PF.q[0] !== PF.qOpen) { const q = PF.q[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; PF.q.shift();
      if (!gl.getParameter(PF.ext.GPU_DISJOINT_EXT)) { PF.gt.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); if (PF.gt.length > WIN) PF.gt.shift(); } gl.deleteQuery(q); } };
  PF.frameEnd = (rdtMs, cpuMs) => { PF.ft.push(rdtMs); PF.ct.push(cpuMs); if (PF.ft.length > WIN) PF.ft.shift(); if (PF.ct.length > WIN) PF.ct.shift(); if (rdtMs > 50) PF.spikes++;
    const ri = renderer.info; PF.info = { calls: ri.render.calls, tris: ri.render.triangles, points: ri.render.points, lines: ri.render.lines, geoms: ri.memory.geometries, tex: ri.memory.textures, progs: (ri.programs || []).length };
    const t = now(); if (t - tSample < 500) return; const fs = Math.max(1, framesSince), perF = {}; for (const k in PF.acc) perF[k] = PF.acc[k] / fs; PF.acc = {}; framesSince = 0; tSample = t;
    const netSecs = Math.max(.001, (t - PF.net.t0) / 1000), rate = o => Object.entries(o).sort((a, b) => b[1][1] - a[1][1]).map(([k, [n, b]]) => ({ k, n: r1(n / netSecs), b: Math.round(b / netSecs) }));
    const net = { out: rate(PF.net.out), in: rate(PF.net.in), to: rate(PF.net.to), from: rate(PF.net.from) }; if (netSecs > 2) PF.net = { out: {}, in: {}, to: {}, from: {}, t0: t };
    const Z = H.zombies && H.zombies.state, zl = Z ? Z.list : [], T = H.tm, cv = renderer.domElement;
    const passes = GX.composer ? GX.composer.passes.filter(p => p.enabled).map(p => p.pfName || '?') : ['direct'];
    PF.last = { q: qname, dpr: r1(renderer.getPixelRatio() * 100) / 100, canvas: [cv.width, cv.height], passes,
      frame: { med: r1(pct(PF.ft, .5)), p95: r1(pct(PF.ft, .95)), max: r1(Math.max(0, ...PF.ft)), n: PF.ft.length, fps: r1(1000 / Math.max(1, pct(PF.ft, .5))), spikes50: PF.spikes },
      cpu: { med: r1(pct(PF.ct, .5) * 10) / 10, p95: r1(pct(PF.ct, .95)), per: Object.fromEntries(Object.entries(perF).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * 100) / 100])) },
      gpu: PF.ext ? (PF.gt.length ? { med: r1(pct(PF.gt, .5)), p95: r1(pct(PF.gt, .95)), n: PF.gt.length } : 'waiting') : 'n/a (no EXT_disjoint_timer_query_webgl2)',
      render: { ...PF.info },
      zombies: { total: zl.length, alive: zl.filter(o => o.alive).length, visible: zl.filter(o => o.g && o.g.visible).length, dressed: zl.filter(o => o.zNear).length, posedPerFrame: Z ? r1((Z.posedN || 0) / fs) : 0, snapAgeMs: Z && Z.snapAt ? Math.round(t - Z.snapAt) : null },
      horses: { total: (H.horses || []).length, near: (H.horses || []).filter(o => o.g.userData.near && o.g.userData.near.visible).length },
      trees: T ? { cNear: T.cNear.count, cFar: T.cFar.count, bNear: T.bNear.count, bFar: T.bFar.count } : null,
      net, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a' };
    if (Z) Z.posedN = 0;
    const L = PF.last, F = L.frame, C = L.cpu, R = L.render;
    el.textContent = [`PERF ${qname} · DPR ${L.dpr} · ${L.canvas.join('×')} px · ${passes.join(' > ')}`,
      `frame ms  med ${F.med}  p95 ${F.p95}  max ${F.max}  (${F.n} frames, ~${F.fps} fps, >50ms: ${F.spikes50})`,
      `cpu ms    med ${C.med}  p95 ${C.p95}  | ` + Object.entries(C.per).slice(0, 9).map(([k, v]) => k + ' ' + v).join(' · '),
      `gpu ms    ${typeof L.gpu === 'string' ? L.gpu : 'med ' + L.gpu.med + '  p95 ' + L.gpu.p95}`,
      `draw calls ${R.calls}  tris ${r1(R.tris / 1000)}k  pts ${R.points}  · geoms ${R.geoms} tex ${R.tex} progs ${R.progs} · heap ${L.mem}`,
      `zombies ${L.zombies.total} (alive ${L.zombies.alive}, drawn ${L.zombies.visible}, detailed ${L.zombies.dressed}, posed/frame ${L.zombies.posedPerFrame})  snapshot age ${L.zombies.snapAgeMs ?? '-'} ms`,
      `horses ${L.horses.total} (near ${L.horses.near})` + (L.trees ? `  trees near ${L.trees.cNear + L.trees.bNear} far ${L.trees.cFar + L.trees.bFar}` : ''),
      `net out/s ` + (net.out.slice(0, 7).map(o => `${o.k} ${o.n} ${kb(o.b)}`).join(' · ') || '-'),
      `net in/s  ` + (net.in.slice(0, 7).map(o => `${o.k} ${o.n} ${kb(o.b)}`).join(' · ') || '-'),
      `per peer  ` + ([...net.to.map(o => '→' + o.k + ' ' + kb(o.b) + '/s'), ...net.from.map(o => '←' + o.k + ' ' + kb(o.b) + '/s')].slice(0, 8).join(' · ') || '-')].join('\n'); };
  window.__perf = () => PF.last;
  return PF;
}
