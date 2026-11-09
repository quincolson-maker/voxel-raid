// Run: node tests/squad.cjs [base]. 4-player co-op (host + 3 joiners) on Daybreak — Firebase over the ?loopnet=1 stand-in
// transport (same message protocol as PeerJS/WebRTC). Checks ids, relay, scaling, skip vote, per-player points,
// scoreboard, room-full, client-to-client revive, squad wipe. Saves shot-squad-*.png.
const puppeteer = require('puppeteer-core'); const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const errors = [], R = {};
  const page = async (mobile, tag) => { const p = await b.newPage(); p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/pointer ?lock|fullscreen|404/i.test(m.text())) errors.push(tag + ': ' + m.text()); });
    await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
    await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 }); return p; };
  const h = await page(false, 'P1'); await h.goto(base + '/?dev=1&loopnet=1&q=low', { waitUntil: 'networkidle0' }); await h.click('#zHost');
  await h.waitForFunction(() => __zombies.state.code, { polling: 100, timeout: 20000 }); const code = await h.evaluate(() => __zombies.state.code);
  const cs = [];
  for (let i = 0; i < 3; i++) { const c = await page(i === 0, 'C' + i); await c.goto(base + `/?dev=1&loopnet=1&q=low${i ? '&norender' : '&touch=1'}&join=` + code, { waitUntil: 'networkidle0' });
    await c.evaluate(() => document.getElementById('zJoin').click()); await c.waitForFunction(() => __zombies.state.role === 'client' && __zombies.state.ready, { polling: 100, timeout: 20000 }).catch(async e => { console.log('join', i, await c.evaluate(() => [__zombies.state.role, __zombies.state.ready, __zombies.net.open, document.getElementById('zJoinMsg').textContent, __G.mode]), await h.evaluate(() => [__zombies.state.remotes.size, __zombies.net.conns.size])); throw e; }); cs.push(c); }
  await h.waitForFunction(() => __zombies.state.remotes.size === 3, { polling: 100, timeout: 20000 }).catch(async e => { console.log('rem', await h.evaluate(() => [[...__zombies.state.remotes.keys()], __zombies.net.conns.size, [...__zombies.state.peers]]), await Promise.all(cs.map(c => c.evaluate(() => [__zombies.state.me, __zombies.state.role])))); throw e; });
  R.ids = await Promise.all(cs.map(c => c.evaluate(() => __zombies.state.me)));
  R.map = await Promise.all(cs.map(c => c.evaluate(() => __zombies.state.map)));
  // relay: everyone moves, each client should see 3 remotes at the right spots
  const spots = { P1: [44, 58], P2: [47, 58], P3: [50, 58], P4: [53, 58] };
  await h.evaluate(s => __P.pos.set(s[0], 1, s[1]), spots.P1); for (const [i, c] of cs.entries()) await c.evaluate(s => __P.pos.set(s[0], 1, s[1]), spots[R.ids[i]]);
  await sleep(1500);
  R.relay = await Promise.all(cs.map(c => c.evaluate(sp => { const z = __zombies.state; return z.remotes.size === 3 && [...z.remotes.values()].every(r => Math.hypot(r.pos.x - sp[r.id][0], r.pos.z - sp[r.id][1]) < .6); }, spots)));
  // 5th player -> room full
  const x = await page(false, 'X'); await x.goto(base + '/?dev=1&loopnet=1&q=low&norender&join=' + code, { waitUntil: 'networkidle0' }); await x.evaluate(() => document.getElementById('zJoin').click()); await sleep(2500);
  R.fullMsg = await x.evaluate(() => document.getElementById('zJoinMsg').textContent); await x.close();
  // skip vote: 1 of 4 not enough, 2 of 4 skips
  await cs[1].evaluate(() => __coop.act.skip()); await sleep(800); R.afterOneVote = await h.evaluate(() => __G.phase);
  await cs[2].evaluate(() => __coop.act.skip()); await h.waitForFunction(() => __G.phase !== 'zbuild', { polling: 100, timeout: 8000 }); R.afterTwoVotes = await h.evaluate(() => __G.phase);
  await h.bringToFront(); await h.waitForFunction(() => __zombies.state.round >= 1, { polling: 100, timeout: 60000 }).catch(async e => { console.log('rnd', await h.evaluate(() => [__G.phase, __G.t, __G.over, __zombies.state.breakT, __zombies.state.round])); throw e; });
  R.roundSize = await h.evaluate(() => __zombies.state.roundSize); // solo round 1 = 8
  await h.waitForFunction(() => __G.units.filter(u => u.hp > 0).length >= 3, { polling: 100, timeout: 30000 });
  R.hpScaled = await h.evaluate(() => Math.max(...__G.units.filter(u => u.hp > 0 && u.kind === 'walker').map(u => u.hp)));
  // per-player points + scoreboard
  await h.evaluate(() => { const s = __zombies.state; s.pending = Math.max(s.pending, 4); }); await h.waitForFunction(() => __G.units.filter(u => u.hp > 0).length >= 3, { polling: 100, timeout: 30000 }); await sleep(600);
  for (const [i, c] of cs.entries()) { await c.waitForFunction(i => __G.units.filter(u => u.hp > 0).length > i, { polling: 100, timeout: 15000 }, i); await c.evaluate(i => { const u = __G.units.filter(u => u.hp > 0)[i]; if (u) __zombies.damage(u, 1e7, true); }, i); }
  await sleep(1500);
  R.pts = await h.evaluate(() => ({ ...__zombies.state.pts })); R.pk = await h.evaluate(() => ({ ...__zombies.state.pk }));
  await h.evaluate(() => { __zombies.state.maxHP = 1e7; __P.hp = 1e7; __P.pos.set(48, 1, 66); __P.yaw = Math.PI; __P.pitch = -.08; });
  await cs[0].evaluate(() => { __zombies.state.maxHP = 1e7; __P.hp = 1e7; __P.pos.set(46, 1, 63); __P.yaw = Math.PI - .2; });
  await h.bringToFront(); await sleep(2500); await h.screenshot({ path: 'shot-squad-host-desktop.png' });
  await cs[0].bringToFront(); await sleep(2500); await cs[0].screenshot({ path: 'shot-squad-p2-mobile.png' });
  R.scoreRows = await cs[0].evaluate(() => document.querySelectorAll('#zScore div').length - 1);
  // client-to-client revive: P3 goes down, P2 holds E next to them
  await h.evaluate(() => { for (const u of __G.units) if (u.hp > 0) __zombies.kill(u, false, false); const s = __zombies.state; s.pending = 0; s.breakT = 999; __G.phase = 'zbreak'; });
  await cs[1].evaluate(() => { __zombies.state.maxHP = 100; __P.hp = 0; __zombies.onZeroHP(); __P.pos.set(50, 1, 60); });
  R.p3Down = await cs[1].evaluate(() => __P.downed);
  await cs[0].waitForFunction(() => { const r = __zombies.state.remotes.get('P3'); return r && r.down && Math.hypot(r.pos.x - 50, r.pos.z - 60) < .5; }, { polling: 100, timeout: 8000 });
  await cs[0].evaluate(() => { __P.pos.set(51.2, 1, 60); __coop.input.use = true; });
  await cs[1].waitForFunction(() => !__P.downed, { polling: 100, timeout: 30000 }).then(() => R.p3RevivedByP2 = true).catch(() => R.p3RevivedByP2 = false);
  R.rvIn = [await h.evaluate(() => __zombies.state.rvIn), await cs[1].evaluate(() => [__zombies.state.rvIn, __P.downed, __P.hp])];
  R.revDbg = await cs[0].evaluate(() => [__zombies.state.reviveT, !!__zombies.reviveTarget(), __P.pos.toArray(), __P.downed]);
  await cs[0].evaluate(() => { __coop.input.use = false; });
  R.notOverYet = !(await h.evaluate(() => __G.over));
  // squad wipe: everyone down -> over on all
  for (const c of cs) await c.evaluate(() => { __zombies.state.maxHP = 100; __P.hp = 0; __zombies.onZeroHP(); }); await sleep(1200);
  await h.evaluate(() => { __zombies.state.maxHP = 100; __P.hp = 0; __zombies.onZeroHP(); __sim(.2); });
  await Promise.all(cs.map(c => c.waitForFunction(() => __G.over, { polling: 100, timeout: 8000 })));
  R.wipe = await cs[2].evaluate(() => document.getElementById('endT').textContent);
  console.log(JSON.stringify(R, null, 1)); console.log('errors', JSON.stringify(errors));
  assert.deepEqual([...R.ids].sort(), ['P2', 'P3', 'P4']); assert.deepEqual(R.map, ['day', 'day', 'day']); assert.ok(R.relay.every(Boolean), 'relay');
  assert.match(R.fullMsg, /full/i); assert.equal(R.afterOneVote, 'zbuild'); assert.notEqual(R.afterTwoVotes, 'zbuild');
  assert.equal(R.roundSize, Math.round(8 * 2.5)); assert.ok(R.hpScaled > 88 * 1.5, 'hp scaled');
  for (const id of R.ids) assert.ok(R.pts[id] > 500 && R.pk[id] >= 1, 'points ' + id);
  assert.equal(R.scoreRows, 4); assert.ok(R.p3Down && R.p3RevivedByP2 && R.notOverYet); assert.equal(R.wipe, 'SQUAD WIPED'); assert.deepEqual(errors, []);
  console.log('SQUAD OK'); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
