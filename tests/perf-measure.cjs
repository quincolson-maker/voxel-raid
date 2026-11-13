// v36 perf harness (?perf=1). Box numbers: headless Chrome + SwiftShader on this build machine. CPU timings are only for
// before/after comparison of the same scenario on the same machine; they are NOT phone/desktop FPS. Draw calls / triangles /
// geometries / textures / net bytes are exact counts.  usage: node tests/perf-measure.cjs <base> <label> [scenarios]
const puppeteer = require('puppeteer-core'), fs = require('fs');
const base = process.argv[2] || 'http://localhost:8767', label = process.argv[3] || 'run', only = (process.argv[4] || 'idle,z40,z150,z420,render').split(','), sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = { label, base, when: new Date().toISOString(), machine: 'box headless Chrome/SwiftShader', scen: {} };
  const page = async (extra, vp) => { const p = await br.newPage(); await p.setViewport(vp || { width: 1280, height: 720 }); await p.goto(base + '/?dev=1&solo=1&q=low&prochorse=1&perf=1' + extra, { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__booted && window.__horse && __horse.state.horses.length >= 4 && window.__perf, { timeout: 600000 }); return p; };
  const sample = async (p, secs) => { await p.evaluate(() => { window.__perfS = []; window.__perfI = setInterval(() => { const s = __perf(); if (s) __perfS.push(JSON.parse(JSON.stringify(s))); }, 520); }); await sleep(secs * 1000);
    return p.evaluate(() => { clearInterval(__perfI); return __perfS; }); };
  const agg = S => { if (!S.length) return null; const L = S.slice(1); const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }; const per = {};
    for (const s of L) for (const [k, v] of Object.entries(s.cpu.per)) (per[k] = per[k] || []).push(v);
    const last = S[S.length - 1]; return { samples: L.length, frameMed: med(L.map(s => s.frame.med)), frameP95: med(L.map(s => s.frame.p95)), frameMax: Math.max(...L.map(s => s.frame.max)), cpuMed: med(L.map(s => s.cpu.med)), cpuP95: med(L.map(s => s.cpu.p95)),
      per: Object.fromEntries(Object.entries(per).map(([k, a]) => [k, +med(a).toFixed(3)]).sort((a, b) => b[1] - a[1])), render: last.render, zombies: last.zombies, trees: last.trees, dpr: last.dpr, canvas: last.canvas, passes: last.passes, gpu: last.gpu }; };
  const zScen = async n => { const p = await page('&norender=1'); await p.evaluate(n => { const Z = __horse.state.zombies, S = Z.state; Z.clear(); S.spawnT = 1e9; S.cap = n; S.hp = 1e9; const P = __P;
      for (let i = 0; i < n; i++) { const a = i * 2.39996, r = 14 + (i % 40) * 1.6; Z.spawn(['walker', 'runner', 'brute'][i % 3] || 'walker', [P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r]); } }, n);
    await sleep(2500); const r = agg(await sample(p, 10)); r.count = await p.evaluate(() => __horse.state.zombies.state.list.length); await p.close(); return r; };
  if (only.includes('idle')) { const p = await page('&norender=1&zombies=0'); await sleep(2000); out.scen.idle = agg(await sample(p, 8)); await p.close(); }
  for (const n of [40, 150, 420]) if (only.includes('z' + n)) out.scen['z' + n] = await zScen(n);
  if (only.includes('render')) { const p = await page('&zombies=0'); const views = { pen: [0, 30, 0], town: null, forest: [1.4, 0, 0] }; out.scen.render = {};
    for (const [k] of Object.entries(views)) { await p.evaluate(k => { const H = __horse.state, PEN = __horse.PEN; if (k === 'town') { const T = H.town2, s = T.town, [x, z] = T.toW(s, -6, -9); __P.pos.set(x, __horse.hAt(x, z), z); __P.yaw = s.rot; }
        else if (k === 'pen') { __P.pos.set(PEN.x, __horse.hAt(PEN.x, PEN.z + 26), PEN.z + 26); __P.yaw = 0; } else { const t = H.trees[(H.trees.length / 2) | 0]; __P.pos.set(t.x + 18, __horse.hAt(t.x + 18, t.z), t.z); __P.yaw = Math.PI / 2; } __P.pitch = -.05; }, k);
      await sleep(4000); const S = await sample(p, 6); out.scen.render[k] = agg(S); }
    await p.close(); }
  fs.mkdirSync('docs/perf', { recursive: true }); fs.writeFileSync(`docs/perf/${label}.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out).slice(0, 3000)); await br.close(); })().catch(e => { console.error(e); process.exit(1); });
