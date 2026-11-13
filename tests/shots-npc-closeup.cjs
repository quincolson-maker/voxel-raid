// NPC close-ups (Greta, a dancer, a seated bandit, a drifter, the dealer): camera ~1.3 m in front of each face.
// node tests/shots-npc-closeup.cjs <base> <label>  -> shot-npc-<label>-<who>.png
const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767', label = process.argv[3] || 'now', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 1800000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); await p.setViewport({ width: 1280, height: 720 });
  await p.goto(base + '/?dev=1&solo=1&zombies=0&q=medium', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__booted && window.__horse && __horse.state.saloon && __horse.state.models !== 'loading', { timeout: 900000 });
  await p.evaluate(() => { document.getElementById('keys').hidden = true; const m = document.getElementById('msg'); if (m) m.style.display = 'none'; });
  for (const who of (process.argv[4] || 'greta,dancer,bandit,drifter,dealer').split(',')) {
    const ok = await p.evaluate(who => { const H = __horse.state, S = H.saloon; const D = who === 'greta' ? S.greta : who === 'dancer' ? S.dancers[0] : who === 'bandit' ? S.seated[0] : who === 'drifter' ? S.drifters[0] : S.dealer; if (!D || !D.g) return false;
      if (D.route) D.wait = 1e9; D.g.updateMatrixWorld(true); const V = D.g.position.constructor, wp = D.g.getWorldPosition(new V()), q = D.g.getWorldQuaternion(new D.g.quaternion.constructor()), f = new V(0, 0, 1).applyQuaternion(q).setY(0).normalize();
      const head = (D.head || (D.g.userData.B && D.g.userData.B.Head)); const hy = head ? head.getWorldPosition(new V()).y + .1 : wp.y + 1.55;
      H.fp = true; __P.pos.set(wp.x + f.x * 1.25, hy - 1.62, wp.z + f.z * 1.25); H.fv.set(0, 0); __P.yaw = Math.atan2(f.x, f.z); __P.pitch = -.12; window.__holdNPC = D; return true; }, who);
    if (!ok) { console.log(label, who, 'missing'); continue; }
    await sleep(6000); await p.evaluate(() => { const D = window.__holdNPC; if (D && D.route) D.wait = 1e9; });
    await p.screenshot({ path: `shot-npc-${label}-${who}.png` }); console.log(label, who);
  }
  console.log('errors', JSON.stringify(errs.slice(0, 5))); await br.close(); })().catch(e => { console.error(e); process.exit(1); });
