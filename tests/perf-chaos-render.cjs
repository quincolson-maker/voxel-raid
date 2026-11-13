// v37 chaos: rendered frame cost with 420 of the dead around you (works on builds with or without chaos mode, for before/after).
// usage: node tests/perf-chaos-render.cjs <base> <label>. Box numbers (SwiftShader): draw calls / triangles are exact, ms are comparative only.
const puppeteer = require('puppeteer-core'), fs = require('fs'); const base = process.argv[2] || 'http://localhost:8767', label = process.argv[3] || 'run', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); await p.setViewport({ width: 1280, height: 720 }); await p.goto(base + '/?dev=1&solo=1&q=low&prochorse=1&perf=1&chaos=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__booted && window.__horse && __horse.state.horses.length >= 4 && window.__perf && __horse.state.zombies, { timeout: 600000 });
  await p.evaluate(() => { const Z = __horse.state.zombies, S = Z.state, P = __P; Z.clear(); S.spawnT = 1e9; S.cap = 420; S.hp = 1e9; const PEN = __horse.PEN; P.pos.set(PEN.x, __horse.hAt(PEN.x, PEN.z + 40), PEN.z + 40); P.yaw = 0; P.pitch = -.05;
    let n = 0; for (let i = 0; n < 420 && i < 2000; i++) { const a = i * 2.39996, r = 16 + (i % 70) * 2.6, x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r; if (Math.hypot(x - PEN.x, z - PEN.z) < 20) continue; Z.spawn(['walker', 'runner', 'brute'][i % 3], [x, z]); n++; }
    for (const o of S.list) o.hold = true; });
  await sleep(15000); const S = []; for (let i = 0; i < 8; i++) { await sleep(1500); S.push(await p.evaluate(() => { const q = __perf(); return { calls: q.render.calls, tris: q.render.tris, cpu: q.cpu.med, frame: q.frame.med, z: q.zombies }; })); }
  const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1]; const r = { label, calls: med(S.map(s => s.calls)), tris: med(S.map(s => s.tris)), cpuMed: med(S.map(s => s.cpu)), frameMed: med(S.map(s => s.frame)), zombies: S[S.length - 1].z };
  fs.mkdirSync('docs/perf', { recursive: true }); fs.writeFileSync(`docs/perf/chaos-render-${label}.json`, JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); await br.close(); })().catch(e => { console.error(e); process.exit(1); });
