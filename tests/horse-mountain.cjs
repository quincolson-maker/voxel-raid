// Run: node tests/horse-mountain.cjs [base URL] [prefix]. Horse Rider v30 rideable mountains (desktop q=medium, phone q=low):
//  - the carved mountain trails exist (3 trailheads -> summits) and streamed detail chunks are around the player
//  - mount a horse at a trailhead and ride the trail up (simulated ticks, camera-relative steering) to the summit: a high elevation
//  - riding straight at a cliff face does not climb it (slope limit), the horse stays inside the rideable square
//  - screenshots: on the mountain trail, at the peak looking down at the valley, detailed close-up ground at a pond bank
// Saves <prefix>-{desktop,mobile}-{trail,peak,ground}.png (default prefix shot-horserider-mountains), prints perf stats.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767', prefix = process.argv[3] || 'shot-horserider-mountains';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404/i.test(t);
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args });
  const out = {};
  try { for (const mobile of (process.env.ONLY ? [process.env.ONLY === 'mobile'] : [false, true])) {
    const tag = mobile ? 'mobile' : 'desktop', errors = [], R = (out[tag] = {});
    const p = await br.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
    await p.goto(base + `/?dev=1&solo=1&zombies=0&q=${mobile ? 'low' : 'medium'}` + (mobile ? '&touch=1' : ''), { waitUntil: 'networkidle0', timeout: 120000 });
    if (mobile) await p.tap('#horseBtn'); else await p.click('#horseBtn');
    await p.waitForFunction(() => __G.mode === 'horse' && __horse.state.horses.length >= 4, { timeout: 30000 });
    await p.waitForFunction(() => __horse.state.models !== 'loading', { timeout: 120000 });
    R.features = await p.evaluate(() => __horse.state.F.info);
    assert.ok(R.features.trails.length >= 2, 'mountain trails carved'); assert.ok(R.features.ponds.length >= 2, 'ponds'); assert.ok(R.features.creek.length >= 1, 'creek');
    R.chunks0 = await p.evaluate(() => ({ count: __horse.state.chunks.count, shown: __horse.state.chunks.shown }));
    assert.ok(R.chunks0.count >= (mobile ? 9 : 25) - 4 && R.chunks0.shown, 'detail chunks streamed around the player');
    await p.addStyleTag({ content: '#hud,#hrZ,#hrGun,#touch,#vMute,#hrStam,#fsb,#ioshint,#hrPrompt,#msg{visibility:hidden!important}' });
    // 1) close-up ground at the meadow pond bank (on foot)
    await p.evaluate(() => { const H = __horse, [px, pz, pr] = H.state.F.info.ponds[0], a = Math.atan2(-pz, -px), x = px + Math.cos(a) * pr * 1.45, z = pz + Math.sin(a) * pr * 1.45;
      __P.pos.set(x, H.hAt(x, z), z); __P.yaw = Math.atan2(-(px - x), -(pz - z)) + .5; __P.pitch = -.42; H.state.bodyYaw = __P.yaw; H.state.lookT = 0; });
    await sleep(mobile ? 7000 : 10000); await p.screenshot({ path: `${prefix}-${tag}-ground.png` });
    // 2) mount at the trailhead of the highest trail and ride it up
    const trail = await p.evaluate(() => { const F = __horse.state.F, B = __horse.hAt(0, 0); let best = 0; F.trails.forEach((t, i) => { if (t.top[2] > F.trails[best].top[2]) best = i; }); const t = F.trails[best];
      return { i: best, n: t.pts.length, head: t.head, top: [t.top[0], t.top[1], t.top[2] - B] }; });
    R.trail = trail;
    await p.evaluate(ti => { const H = __horse, S = H.state, t = S.F.trails[ti], [hx, hz] = t.head, h = S.horses[1]; for (const o of S.horses) { o.wait = 1e9; o.tgt = null; }
      h.pos.set(hx, H.hAt(hx, hz), hz); h.inPen = false; h.yaw = Math.atan2(-(t.pts[6][0] - hx), -(t.pts[6][1] - hz)); __P.pos.set(hx + 1.3, H.hAt(hx + 1.3, hz), hz); }, trail.i);
    await sleep(300); assert.ok(await p.evaluate(() => __horse.use() && !!__horse.state.mounted), 'mounted at the trailhead');
    await sleep(1500);
    const rideTo = async (frac, maxRounds) => { for (let k = 0; k < maxRounds; k++) { const r = await p.evaluate(([ti, frac]) => { const H = __horse, S = H.state, t = S.F.trails[ti].pts, h = S.mounted, B = H.hAt(0, 0), keys = __coop.keys; S.cruise = 2; keys.KeyW = true;
        let i0 = S._ti || 0, maxA = S._maxA || 0; for (let s = 0; s < 450; s++) { let bi = i0, bd = 1e9; for (let i = Math.max(0, i0 - 20); i < Math.min(t.length, i0 + 60); i++) { const d = Math.hypot(t[i][0] - h.pos.x, t[i][1] - h.pos.z); if (d < bd) { bd = d; bi = i; } } i0 = bi;
          if (i0 >= Math.floor((t.length - 1) * frac)) break; const g = t[Math.min(t.length - 1, i0 + 3)]; __P.yaw = Math.atan2(-(g[0] - h.pos.x), -(g[1] - h.pos.z)); S.lookT = 9; H.tick(1 / 30); maxA = Math.max(maxA, h.pos.y - B); }
        keys.KeyW = false; S._ti = i0; S._maxA = maxA; return { i: i0, n: t.length, alt: +(h.pos.y - B).toFixed(1), maxA: +maxA.toFixed(1), x: +h.pos.x.toFixed(1), z: +h.pos.z.toFixed(1), sp: +S.speed.toFixed(2), chunks: S.chunks.count }; }, [trail.i, frac]);
        if (r.i >= Math.floor((r.n - 1) * frac)) return r; await sleep(200); } return null; };
    const mid = await rideTo(.55, 30); assert.ok(mid, 'rode half way up the trail'); R.mid = mid;
    // look back down the trail and out over the valley (camera behind the rider, horse in view)
    await p.evaluate(ti => { const H = __horse, S = H.state, h = S.mounted, t = S.F.trails[ti].pts, i = S._ti, b = t[Math.max(0, i - 14)]; S.speed = 0; const dx = b[0] - h.pos.x, dz = b[1] - h.pos.z, gx = H.hAt(h.pos.x + 4, h.pos.z) - H.hAt(h.pos.x - 4, h.pos.z), gz = H.hAt(h.pos.x, h.pos.z + 4) - H.hAt(h.pos.x, h.pos.z - 4), l = Math.hypot(dx, dz) || 1, gl = Math.hypot(gx, gz) || 1;
      const vx = dx / l - gx / gl * .8, vz = dz / l - gz / gl * .8; h.yaw = __P.yaw = Math.atan2(-vx, -vz); __P.pitch = -.2; S.lookT = 0; H.syncCamera(0); }, trail.i);
    await sleep(mobile ? 6000 : 9000); await p.screenshot({ path: `${prefix}-${tag}-trail.png` });
    R.statsTrail = await p.evaluate(() => __horse.stats());
    const top = await rideTo(.985, 40); assert.ok(top, 'reached the summit'); R.top = top;
    assert.ok(top.maxA > Math.min(300, trail.top[2] * .85), `high elevation reached (${top.maxA} m of ${trail.top[2].toFixed(0)} m)`);
    // 3) at the peak, looking down at the valley and the pen
    await p.evaluate(ti => { const H = __horse, S = H.state, h = S.mounted, t = S.F.trails[ti].pts, b = t[Math.max(0, S._ti - 24)]; S.speed = 0; const dx = b[0] - h.pos.x, dz = b[1] - h.pos.z, l = Math.hypot(dx, dz) || 1, vx = dx / l * .7 + h.pos.x / -1400, vz = dz / l * .7 + h.pos.z / -1400;
      h.yaw = __P.yaw = Math.atan2(-vx, -vz); __P.pitch = -.42; S.zoom = 1.5; S.lookT = 0; H.syncCamera(0); }, trail.i);
    await sleep(mobile ? 6000 : 9000); await p.screenshot({ path: `${prefix}-${tag}-peak.png` });
    R.statsPeak = await p.evaluate(() => __horse.stats());
    // 4) a cliff: ride straight at it for 8 s, the horse must not climb it
    R.cliff = await p.evaluate(() => { const H = __horse, S = H.state, h = S.mounted, keys = __coop.keys; let c = null;
      for (let i = 0; i < 40000 && !c; i++) { const a = i * 2.39996, d = 500 + (i % 997) / 997 * 500, x = Math.cos(a) * d, z = Math.sin(a) * d, gx = (H.hAt(x + 3, z) - H.hAt(x - 3, z)) / 6, gz = (H.hAt(x, z + 3) - H.hAt(x, z - 3)) / 6, g = Math.hypot(gx, gz);
        if (g < 1.7 || S.F.trailDist(x, z) < 40) continue; const ux = gx / g, uz = gz / g, bx = x - ux * 6, bz = z - uz * 6, g2 = Math.hypot(H.hAt(bx + 3, bz) - H.hAt(bx - 3, bz), H.hAt(bx, bz + 3) - H.hAt(bx, bz - 3)) / 6; if (g2 < 1.3) continue; c = [bx, bz, ux, uz, g]; }
      if (!c) return { none: true }; const [bx, bz, ux, uz, g] = c; h.pos.set(bx, H.hAt(bx, bz), bz); h.yaw = Math.atan2(-ux, -uz); S.speed = 0; const y0 = h.pos.y; S.steepHits = 0; keys.KeyW = true; S.cruise = 4;
      for (let s = 0; s < 240; s++) { __P.yaw = Math.atan2(-ux, -uz); S.lookT = 9; H.tick(1 / 30); } keys.KeyW = false; S.speed = 0;
      return { grade: +g.toFixed(2), gain: +(h.pos.y - y0).toFixed(2), moved: +Math.hypot(h.pos.x - bx, h.pos.z - bz).toFixed(1), hits: S.steepHits, inside: Math.max(Math.abs(h.pos.x), Math.abs(h.pos.z)) <= 1050 }; });
    if (!R.cliff.none) { assert.ok(R.cliff.gain < 12, `cliff not climbed (gain ${R.cliff.gain} m)`); assert.ok(R.cliff.inside); }
    R.errors = errors; assert.deepEqual(errors, []);
    await p.close();
  } console.log(JSON.stringify(out, null, 1)); console.log('HORSE MOUNTAIN OK');
  } catch (e) { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exitCode = 1; } finally { await br.close(); }
})();
