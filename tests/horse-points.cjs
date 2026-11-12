// v33: every weapon's zombie kill awards points; the Buffalo / Golden Buffalo show hit markers, damage and points inside the
// scope (the rest of the HUD stays hidden); the Tommy gun fires full auto from a 100-round drum; 3x the dead (cap 42 / 18).
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=960,540'] });
  const out = {};
  for (const mobile of [false, true]) {
    const p = await br.newPage(); await p.setViewport({ width: 960, height: 540 }); const errors = []; p.on('pageerror', e => errors.push(String(e)));
    await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1' + (mobile ? '&touch=1' : ''), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.guns, { timeout: 300000 });
    const R = await p.evaluate(() => { const H = __horse.state, g = __horse.guns, Z = H.zombies, inp = __coop.input, o = {};
      sessionStorage.removeItem('hr_v33'); Z.clear(); Z.state.spawnT = 1e9;
      const step = (s) => { for (let i = 0; i < s * 20; i++) { __sim(.05); __coop.syncCamera(.05); if (i % 2 === 0) __horse.hud(); } };
      const ahead = (d) => { const x = __P.pos.x - Math.sin(__P.yaw) * d, z = __P.pos.z - Math.cos(__P.yaw) * d; return [x, z]; };
      const away = () => { const P0 = __horse.PEN; __P.yaw = Math.atan2(-(__P.pos.x - P0.x), -(__P.pos.z - P0.z)); };
      const killWith = (w, d) => { away(); if (!g.state.owned[w]) g.give(w); g.draw(w); step(.5); inp.ads = ['sniper', 'gold'].includes(w); step(1.2);
        const z = Z.spawn('walker', ahead(d)); z.hold = true; step(.1); const s0 = g.pts(), k0 = g.state.kills, p0 = g.state.scopePops || 0; let n = 0;
        let son = null, hid = null; while (z.alive && n++ < 40) { g.state.ammo[w] = g.maxAmmo(w); g.state.reloading = false; step(.15); if (son === null) { son = document.getElementById('hrScope').classList.contains('on'); hid = (e => { const cs = getComputedStyle(e); return cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0; })(document.getElementById('hrGun')); } g.aimAt(Z.headPos(z, z.pos.clone()), __coop.syncCamera); g.shoot(false); step(.8); }
        document.querySelectorAll('#hrScope .pops b').forEach(e => { if (!e.dataset.seen) e.dataset.n = 1; }); const pops = [...document.querySelectorAll('#hrScope .pops b')].filter(e => !e.dataset.seen).map(e => (e.dataset.seen = 1, e.textContent)), r = { w, killed: !z.alive, shots: n, pts: g.pts() - s0, kills: g.state.kills - k0, scopePops: (g.state.scopePops || 0) - p0, popsInScope: pops, scopeOn: son, ptsLabel: (document.querySelector('#hrScope .pts') || {}).textContent, hudHidden: hid };
        r.dbg = g.state.dbg; r.last = g.state.lastHit; r.ammo = g.state.ammo[w]; r.rel = g.state.reloading; inp.ads = false; step(.6); Z.clear(); return r; };
      o.revolver = killWith('revolver', 12); o.sniper = killWith('sniper', 70); o.tommy = killWith('tommy', 25); o.gold = killWith('gold', 160);
      // golden buffalo zoom range
      g.draw('gold'); step(.4); inp.ads = true; step(1.2); for (let i = 0; i < 30; i++) g.zoom(1); step(1); o.goldFov = +__cam.fov.toFixed(2); for (let i = 0; i < 30; i++) g.zoom(-1); step(1); o.goldFovOut = +__cam.fov.toFixed(2); inp.ads = false; step(.5);
      // tommy: full auto (hold fire) from a 100-round drum
      g.draw('tommy'); step(.5); g.state.ammo.tommy = g.maxAmmo('tommy'); o.drum = g.state.ammo.tommy; const s0 = g.state.shots; inp.fire = true; step(1.5); inp.fire = false; o.autoShots = g.state.shots - s0; step(.3);
      o.cap = Z.state.cap; o.leaderboard = !!document.getElementById('hrLB'); o.loopErr = window.__loopErr ? String(window.__loopErr) : null; return o; });
    R.errors = errors; out[mobile ? 'mobile' : 'desktop'] = R; await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  for (const [tag, R] of Object.entries(out)) {
    for (const w of ['revolver', 'sniper', 'tommy', 'gold']) { assert.ok(R[w].killed, tag + ' ' + w + ' kills'); assert.ok(R[w].pts >= 10 && R[w].kills === 1, tag + ' ' + w + ' kill awards points'); }
    for (const w of ['sniper', 'gold']) { assert.ok(R[w].scopeOn && R[w].scopePops >= 2, tag + ' ' + w + ' hit markers / points inside the scope'); assert.ok(R[w].popsInScope.some(t => /\+1[05]/.test(t)), tag + ' ' + w + ' points pop-up in the scope'); assert.match(R[w].ptsLabel, /pts/); assert.ok(R[w].hudHidden, 'rest of the HUD hidden in the scope'); }
    assert.ok(R.goldFov < .5 && R.goldFovOut > 7, tag + ' golden buffalo variable zoom');
    assert.equal(R.drum, 100); assert.ok(R.autoShots >= 12, tag + ' tommy full auto');
    assert.equal(R.cap, tag === 'mobile' ? 18 : 42, '3x the dead'); assert.ok(!R.loopErr && !R.errors.length, tag + ' no errors'); assert.ok(R.leaderboard, tag + ' leaderboard panel');
  }
  console.log('HORSE POINTS OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
