// Run: node tests/horse-chaos.cjs [port]. v37 CHAOS MODE: ten times the dead. Solo desktop host fills to 420 (phone 180) with
// ?chaos=1; off-screen dead are not drawn, only nearby ones cast shadows, groans are budgeted; the Settings switch turns it
// off (cap back to 42, far extras removed, saved) and on again. Co-op: the host's switch rules, a client gets the nearest
// rows only (<= 120 per snapshot, small messages), sees CHAOS, and its own switch is locked ("host decides").
const puppeteer = require('puppeteer-core'); const assert = require('node:assert/strict'); const { spawn } = require('child_process'); const path = require('path');
const port = +(process.argv[2] || 8796), base = 'http://localhost:' + port, sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|ERR_|Failed to load resource|microphone|getUserMedia|NotAllowed|NotFound/i.test(t);
const until = async (p, fn, arg, ms = 60000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 200 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
async function page(br, mobile, errors, tag) { const p = await br.newPage();
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 }); return p; }
const fill = (p, n) => p.evaluate(n => { const Z = __horse.state.zombies, P = __P; let k = 0; for (let i = 0; Z.state.list.filter(o => o.alive).length < n && i < n * 3; i++) { const a = i * 2.39996, r = 20 + (i % 60) * 2.2, x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r; if (Z.state.goodGround(x, z)) { Z.spawn(['walker', 'runner', 'brute'][i % 3], [x, z]); k++; } } return k; }, n);
(async () => { const R = {}, errors = []; const srv = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(port)], { stdio: 'pipe' });
  await new Promise((r, j) => { srv.stdout.once('data', r); srv.once('exit', c => j(new Error('lobby exited ' + c))); }); let br;
  try { br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args });
    // ---- A: solo desktop ----
    const d = await page(br, false, errors, 'desk'); await d.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&perf=1&chaos=1', { waitUntil: 'load', timeout: 300000 });
    await until(d, () => window.__booted && __horse.state.zombies && __horse.state.zombies.state.t > 1, null, 300000);
    R.desk = await d.evaluate(() => { const Z = __horse.state.zombies; return { chaos: Z.chaos, cap: Z.state.cap }; }); assert.equal(R.desk.chaos, true); assert.equal(R.desk.cap, 420);
    // the natural ramp (spawn pacing) then top up to the cap for the measurements
    await sleep(6000); R.desk.ramp6s = await d.evaluate(() => __horse.state.zombies.state.list.filter(o => o.alive).length); assert.ok(R.desk.ramp6s >= 15, 'chaos spawns fast: ' + R.desk.ramp6s);
    await d.evaluate(() => { const Z = __horse.state.zombies.state; Z.hp = 1e9; }); await fill(d, 420); await sleep(3000);
    Object.assign(R.desk, await d.evaluate(() => { const Z = __horse.state.zombies, S = Z.state, cam = __cam.position; let cast = 0, near = 0, eyesFar = 0;
      for (const o of S.list) { let c = false; o.g.traverse(m => { if (m.isMesh && m.castShadow) c = true; }); if (c) cast++; if (Math.hypot(o.pos.x - cam.x, o.pos.z - cam.z) < 28) near++; }
      return { alive: S.list.filter(o => o.alive).length, drawn: S.drawn, cast, near28: near, hud: document.getElementById('hrZ').textContent.slice(0, 40) }; }));
    assert.ok(R.desk.alive >= 400 && R.desk.alive <= 420, 'alive ' + R.desk.alive); assert.ok(R.desk.drawn < R.desk.alive * .8, 'view culling: drawn ' + R.desk.drawn); assert.ok(R.desk.cast <= R.desk.near28 + 2, 'shadow distance'); assert.match(R.desk.hud, /CHAOS/);
    // groan budget: at most ~2.5/s on average with hundreds nearby
    R.desk.groans = await d.evaluate(async () => { const s = __sfx; let n = 0; const g = s.groan; s.groan = (...a) => { n++; return g && g.apply(s, a); }; await new Promise(r => setTimeout(r, 6000)); s.groan = g; return n; });
    R.desk.perf = await d.evaluate(async () => { await new Promise(r => setTimeout(r, 6000)); const p = __perf(); return p && { cpu: p.cpu.med, zombies: p.cpu.per.zombies, sep: p.cpu.per['z.sep'] }; });
    // Settings switch: off -> cap 42, far extras gone, saved; on again
    await d.evaluate(() => { document.getElementById('setBtn').click(); }); R.desk.btnOn = await d.$eval('#chaosBtn', b => b.textContent); assert.match(R.desk.btnOn, /ON/);
    await d.click('#chaosBtn'); await sleep(800);
    Object.assign(R.desk, await d.evaluate(() => { const Z = __horse.state.zombies; return { offCap: Z.state.cap, offChaos: Z.chaos, offAlive: Z.state.list.filter(o => o.alive).length, saved: localStorage.getItem('hr_chaos'), btnOff: document.getElementById('chaosBtn').textContent }; }));
    assert.equal(R.desk.offCap, 42); assert.equal(R.desk.offChaos, false); assert.equal(R.desk.saved, '0'); assert.match(R.desk.btnOff, /OFF/); assert.ok(R.desk.offAlive < R.desk.alive, 'far extras removed');
    await d.click('#chaosBtn'); await sleep(500); R.desk.backOn = await d.evaluate(() => [__horse.state.zombies.chaos, __horse.state.zombies.state.cap, localStorage.getItem('hr_chaos')]); assert.deepEqual(R.desk.backOn, [true, 420, '1']);
    await d.evaluate(() => localStorage.removeItem('hr_chaos')); await d.close();
    // ---- B: solo phone ----
    const m = await page(br, true, errors, 'phone'); await m.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1&touch=1&chaos=1', { waitUntil: 'load', timeout: 300000 });
    await until(m, () => window.__booted && __horse.state.zombies && __horse.state.zombies.state.t > 1, null, 300000);
    R.phone = await m.evaluate(() => ({ chaos: __horse.state.zombies.chaos, cap: __horse.state.zombies.state.cap })); assert.deepEqual(R.phone, { chaos: true, cap: 180 }); await m.close();
    // ---- C: co-op, host decides, nearest rows per client ----
    const Q = '/?dev=1&loopnet=1&q=low&norender=1&prochorse=1&lobby=' + encodeURIComponent(base);
    const h = await page(br, false, errors, 'host'); await h.goto(base + Q + '&chaos=1', { waitUntil: 'load', timeout: 300000 });
    await until(h, () => __hnet.state.role === 'host' && !!__hnet.state.code && __horse.state.zombies && __horse.state.zombies.chaos, null, 120000);
    await h.evaluate(() => { __horse.state.zombies.state.hp = 1e9; __horse.state.zombies.state.spawnT = 1e9; }); await fill(h, 300);
    const c = await page(br, true, errors, 'client'); await c.goto(base + Q + '&touch=1&chaos=0', { waitUntil: 'load', timeout: 300000 });
    await until(c, () => __hnet.state.role === 'client' && __horse.state.zombies && __horse.state.zombies.chaos, null, 180000);
    await c.evaluate(() => { const Z = __horse.state.zombies, A = Z.apply; window.__zs = []; Z.apply = m => { __zs.push([JSON.stringify(m).length, m.z.length, m.c]); if (__zs.length > 40) __zs.shift(); return A(m); }; }); await sleep(8000);
    R.coop = await c.evaluate(() => { const Z = __horse.state.zombies; document.getElementById('setBtn').click(); const b = document.getElementById('chaosBtn');
      return { chaos: Z.chaos, list: Z.state.list.length, msgs: __zs.length, maxRows: Math.max(...__zs.map(x => x[1])), maxBytes: Math.max(...__zs.map(x => x[0])), btn: b.textContent, disabled: b.disabled, hud: document.getElementById('hrZ').textContent.slice(0, 40) }; });
    R.coop.hostAlive = await h.evaluate(() => __horse.state.zombies.state.list.filter(o => o.alive).length);
    assert.equal(R.coop.chaos, true); assert.ok(R.coop.msgs > 5, 'snapshots arrive'); assert.ok(R.coop.maxRows <= 120 && R.coop.maxRows >= 60, 'rows ' + R.coop.maxRows); assert.ok(R.coop.list <= 160 && R.coop.list >= 60, 'client list ' + R.coop.list);
    assert.ok(R.coop.hostAlive >= 250, 'host horde'); assert.ok(R.coop.maxBytes < 6000, 'bytes ' + R.coop.maxBytes); assert.equal(R.coop.disabled, true); assert.match(R.coop.btn, /host decides/); assert.match(R.coop.hud, /CHAOS/);
    R.errors = errors.filter(e => !ignorable(e)); console.log(JSON.stringify(R)); assert.deepEqual(R.errors, []); console.log('PASS horse-chaos');
  } catch (e) { console.log(JSON.stringify(R)); console.error('FAIL', e.message, errors.slice(0, 5)); process.exitCode = 1; } finally { if (br) await br.close(); srv.kill(); } })();
