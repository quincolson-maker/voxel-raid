// v37 perf: which objects cost the triangles / draw calls in a view. usage: node tests/perf-breakdown.cjs <base> [pen|town|forest] [q]
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767', view = process.argv[3] || 'town', q = process.argv[4] || 'low', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); await p.setViewport({ width: 1280, height: 720 }); await p.goto(base + `/?dev=1&solo=1&q=${q}&prochorse=1&perf=1&zombies=0`, { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__booted && window.__horse && __horse.state.horses.length >= 4 && window.__perf, { timeout: 600000 });
  await p.evaluate(k => { const H = __horse.state, PEN = __horse.PEN; if (k === 'town') { const T = H.town2, s = T.town, [x, z] = T.toW(s, -6, -9); __P.pos.set(x, __horse.hAt(x, z), z); __P.yaw = s.rot; }
    else if (k === 'pen') { __P.pos.set(PEN.x, __horse.hAt(PEN.x, PEN.z + 26), PEN.z + 26); __P.yaw = 0; } else { const t = H.trees[(H.trees.length / 2) | 0]; __P.pos.set(t.x + 18, __horse.hAt(t.x + 18, t.z), t.z); __P.yaw = Math.PI / 2; } __P.pitch = -.05; }, view);
  await sleep(8000);
  const r = await p.evaluate(() => { let scene = null; 
    // find the scene: walk up from any horse mesh
    let o = __horse.state.horses[0].g; while (o.parent) o = o.parent; scene = o;
        const rows = {}; let tot = 0, calls = 0, shadowCasters = 0, shadowTris = 0;
    const tri = g => g.index ? g.index.count / 3 : g.attributes.position ? g.attributes.position.count / 3 : 0;
    const path = m => { const a = []; let x = m; while (x && a.length < 3) { if (x.name) a.push(x.name); x = x.parent; } if (a.length) return a.join('<'); const g = m.geometry; return m.type + ':' + (g.type || '') + ':' + (m.material && (m.material.name || m.material.type)) + ':' + (m.parent && m.parent.type) + (m.isInstancedMesh ? ':inst' + m.count : '') + ':' + (g.attributes.position ? g.attributes.position.count : 0); };
    scene.traverseVisible(m => { if (!m.isMesh && !m.isInstancedMesh && !m.isPoints) return; const g = m.geometry; if (!g) return; let t = tri(g); const inst = m.isInstancedMesh ? m.count : 1; const mats = Array.isArray(m.material) ? m.material.length : 1;
      const k = path(m); const R = rows[k] || (rows[k] = { n: 0, tris: 0, calls: 0, shadow: 0 }); R.n++; R.tris += t * inst; R.calls += mats; if (m.castShadow) { R.shadow += t * inst; shadowTris += t * inst; shadowCasters++; } tot += t * inst; calls += mats; });
    const top = Object.entries(rows).sort((a, b) => b[1].tris - a[1].tris).slice(0, 25); const topC = Object.entries(rows).sort((a, b) => b[1].calls - a[1].calls).slice(0, 15);
    return { lod: __horse.state.saloon && __horse.state.saloon.npcLOD && __horse.state.saloon.npcLOD(), perf: __perf() && { calls: __perf().render.calls, tris: __perf().render.tris, passes: __perf().passes, dpr: __perf().dpr }, visibleTotal: tot, visibleCalls: calls, shadowCasters, shadowTris, top, topC, shadowMap: (() => { const L = []; scene.traverse(x => { if (x.isDirectionalLight && x.castShadow) L.push([x.shadow.mapSize.x, x.shadow.camera.right - x.shadow.camera.left]); }); return L; })() }; });
  console.log(JSON.stringify(r, null, 0).replace(/\],\[/g, '],\n[')); await br.close(); })().catch(e => { console.error(e); process.exit(1); });
