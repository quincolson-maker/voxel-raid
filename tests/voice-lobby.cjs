// Run: node tests/voice-lobby.cjs [port]. Starts tests/serve-lobby.cjs (game + lobby API on one port), then:
// lobby API (register/heartbeat/stale/close/full/ownership), host appears in the menu list, a second client taps it
// to join, voice starts on both with fake mics, the offer/answer + ICE exchange runs over the co-op channel,
// mute toggles the outgoing track (button + V key), mic denial keeps the game running, closing the host removes
// the lobby. Screenshots: shot-voice-*.png. Uses ?loopnet=1 for game traffic (see README: box Chrome blocks UDP).
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const port = +(process.argv[2] || 8795), base = 'http://localhost:' + port;
let STEP = ''; const step = t => { STEP = t; if (process.env.VERBOSE) console.log('·', t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|ERR_|Failed to load resource/i.test(t);
const until = async (p, fn, arg, ms = 20000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
async function page(br, mobile, errors, tag, deny) {
  const p = await br.newPage();
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
  if (deny) await p.evaluateOnNewDocument(() => { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile === 'port' ? { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
  return p;
}
const api = (m, b) => fetch('http://localhost:' + (port + 1) + m, b ? { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'text/plain' } } : {}).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
(async () => {
  const R = {}, errors = [];
  const boot = (pt, stale) => { const p = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(pt)], { env: { ...process.env, STALE_MS: stale }, stdio: 'pipe' });
    return new Promise((r, j) => { p.stdout.once('data', () => r(p)); p.once('exit', c => j(new Error('lobby test server exited ' + c))); }); };
  const srv = await boot(port, '45000'), srv2 = await boot(port + 1, '6000'); // srv2: short stale window for the prune check
  try {
    // ---- lobby API unit checks ----
    step('---- lobby API unit checks ----');
    assert.equal((await api('/lobby', { code: 'TEST1', key: 'k1', host: 'Unit<script>', players: 2, max: 4 })).s, 200);
    assert.equal((await api('/lobby', { code: 'TEST1', key: 'other', host: 'x' })).s, 409, 'someone else cannot hijack a code');
    let L = (await api('/lobbies')).j.lobbies; const t1 = L.find(l => l.code === 'TEST1');
    assert.ok(t1 && t1.players === 2 && !('key' in t1) && !/[<>]/.test(t1.host)); R.apiRegister = true;
    await api('/lobby', { code: 'FULL1', key: 'k2', players: 4, max: 4 }); L = (await api('/lobbies')).j.lobbies; assert.ok(!L.find(l => l.code === 'FULL1'), 'full rooms hidden'); R.apiFullHidden = true;
    await sleep(6600); L = (await api('/lobbies')).j.lobbies; assert.ok(!L.find(l => l.code === 'TEST1'), 'stale room pruned'); R.apiStalePruned = true;

    const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 90000, args });
    const ctx = br.defaultBrowserContext(); await ctx.overridePermissions(base, ['microphone']);
    const Q = '/?dev=1&loopnet=1&zmap=night&q=low&lobby=' + encodeURIComponent(base);
    // ---- host ----
    step('---- host ----');
    const h = await page(br, false, errors, 'host'); await h.goto(base + Q, { waitUntil: 'networkidle0' });
    await h.evaluate(() => { document.getElementById('operator').value = 'KESTREL'; });
    await h.click('#zHost'); await until(h, () => __zombies.state.code); const code = await h.evaluate(() => __zombies.state.code); R.code = code;
    await until(h, () => __zombies.voice.state === 'live'); R.hostVoiceLive = true;
    // ---- client (phone, landscape) sees it in the menu list ----
    step('---- client (phone, landscape) sees it in the menu');
    const c = await page(br, true, errors, 'client'); await c.goto(base + Q + '&touch=1', { waitUntil: 'networkidle0' });
    await until(c, k => !!document.querySelector(`.lob[data-code="${k}"]`), code, 15000);
    R.listRow = await c.$eval(`.lob[data-code="${code}"]`, e => e.textContent); assert.match(R.listRow, /KESTREL/); assert.match(R.listRow, /1\/4/);
    await c.screenshot({ path: 'shot-voice-menu-mobile.png' });
    // desktop menu view of the same list
    step('desktop menu view of the same list');
    const d = await page(br, false, errors, 'viewer'); await d.goto(base + Q, { waitUntil: 'networkidle0' });
    await until(d, k => !!document.querySelector(`.lob[data-code="${k}"]`), code, 15000); await d.screenshot({ path: 'shot-voice-menu-desktop.png' });
    // tap the row to join
    step('tap the row to join');
    await c.bringToFront(); await c.tap(`.lob[data-code="${code}"]`);
    await until(c, () => __zombies.state.role === 'client' && __zombies.state.remotes.size > 0, null, 25000); R.joinedFromList = true;
    await until(h, () => __zombies.linked());
    // voice: both live, a link each way, signaling completed (offer/answer applied)
    step('voice: both live, a link each way, signaling compl');
    await until(c, () => __zombies.voice.state === 'live' && __zombies.voice.links.has('P1'));
    await until(h, () => __zombies.voice.links.has('P2'));
    await until(h, () => { const L = __zombies.voice.links.get('P2'); return L && L.pc.signalingState === 'stable' && L.pc.remoteDescription; });
    await until(c, () => { const L = __zombies.voice.links.get('P1'); return L && L.pc.signalingState === 'stable' && L.pc.remoteDescription; });
    R.voiceSignaling = await h.evaluate(() => { const L = __zombies.voice.links.get('P2'); const tr = L.pc.getTransceivers()[0]; return { dir: tr.currentDirection, sending: !!tr.sender.track, sdpAudio: /m=audio/.test(L.pc.remoteDescription.sdp) }; });
    assert.equal(R.voiceSignaling.dir, 'sendrecv'); assert.ok(R.voiceSignaling.sending && R.voiceSignaling.sdpAudio);
    // ICE: may not complete in this sandbox (managed Chrome policy disables non-proxied UDP) — recorded, not asserted
    step('ICE: may not complete in this sandbox (managed Chr');
    await sleep(6000);
    R.iceState = { host: await h.evaluate(() => __zombies.voice.links.get('P2').pc.connectionState), client: await c.evaluate(() => __zombies.voice.links.get('P1').pc.connectionState) };
    R.remoteAudioEl = await c.evaluate(() => !!document.querySelector('audio[data-voice="P1"]'));
    // player count updates in the list
    step('player count updates in the list');
    await d.bringToFront(); await until(d, k => (document.querySelector(`.lob[data-code="${k}"]`) || {}).textContent?.includes('2/4'), code, 25000); R.listCountUpdates = true;
    // mute: tap button on phone, V key on desktop
    step('mute: tap button on phone, V key on desktop');
    await c.bringToFront(); await c.tap('#vMute'); R.clientMuted = await c.evaluate(() => [__zombies.voice.state, __zombies.voice.mic.getAudioTracks()[0].enabled, document.getElementById('vMute').className]);
    assert.deepEqual(R.clientMuted, ['muted', false, 'v-muted']);
    await c.evaluate(() => { __P.pos.set(44, 1, 52); __P.yaw = 2.6; }); await sleep(900);
    await c.screenshot({ path: 'shot-voice-ingame-mobile-muted.png' });
    await c.tap('#vMute'); assert.equal(await c.evaluate(() => __zombies.voice.state), 'live');
    await sleep(500); await c.screenshot({ path: 'shot-voice-ingame-mobile.png' });
    await h.bringToFront(); await h.keyboard.press('KeyV'); assert.equal(await h.evaluate(() => __zombies.voice.state), 'muted');
    await h.keyboard.press('KeyV'); assert.equal(await h.evaluate(() => [__zombies.voice.state, __zombies.voice.mic.getAudioTracks()[0].enabled].join()), 'live,true'); R.hostVKey = true;
    await h.evaluate(() => { __P.pos.set(40, 1, 56); __P.yaw = 0; __P.pitch = -.1; }); await sleep(900);
    await h.screenshot({ path: 'shot-voice-ingame-desktop.png' });
    // ---- mic denied (portrait phone): game keeps running, button says NO MIC, hears others ----
    step('---- mic denied (portrait phone): game keeps runni');
    const n = await page(br, 'port', errors, 'denied', true); await n.goto(base + Q + '&touch=1', { waitUntil: 'networkidle0' });
    await n.bringToFront(); await until(n, k => !!document.querySelector(`.lob[data-code="${k}"]`), code, 15000); await n.evaluate(() => document.getElementById('rot').classList.contains('show') && document.getElementById('rotskip').click()); await n.screenshot({ path: 'shot-voice-menu-mobile-portrait.png' });
    await n.tap(`.lob[data-code="${code}"]`);
    await until(n, () => __zombies.state.role === 'client' && __zombies.voice.state === 'unavailable', null, 25000).catch(async e => { console.log(await n.evaluate(() => [__zombies.state.role, __zombies.voice.state, __zombies.voice.err, document.getElementById('zJoinMsg').textContent])); throw e; });
    R.denied = await n.evaluate(() => ({ state: __zombies.voice.state, err: __zombies.voice.err, label: document.getElementById('vMute').textContent, phase: __G.phase, loopErr: !!window.__loopErr }));
    assert.equal(R.denied.phase, 'zbuild'); assert.ok(!R.denied.loopErr);
    await until(n, () => __zombies.voice.links.size >= 2, null, 20000); R.deniedStillLinks = await n.evaluate(() => [...__zombies.voice.links.keys()].sort().join());
    await until(c, () => __zombies.voice.links.has('P3')); R.mesh = await c.evaluate(() => [...__zombies.voice.links.keys()].sort().join());
    await sleep(800); await n.screenshot({ path: 'shot-voice-ingame-mobile-nomic.png' });
    // ---- host closes: lobby disappears from the list right away (pagehide beacon) ----
    step('---- host closes: lobby disappears from the list r');
    await d.bringToFront(); await d.goto(base + Q, { waitUntil: 'networkidle0' });
    await h.close({ runBeforeUnload: true });
    await sleep(1500); R.apiAfterClose = (await fetch(base + '/lobbies').then(r => r.json())).lobbies.map(l => l.code);
    await until(d, k => !document.querySelector(`.lob[data-code="${k}"]`) && document.getElementById('lobbyHead').dataset.s !== 'checking…', code, 60000); R.closedRemoved = true; console.log('apiAfterClose', R.apiAfterClose);
    await until(c, () => __zombies.state.role === 'solo' && __zombies.voice.state === 'off', null, 20000); R.hostLeftVoiceOff = true;
    R.errors = errors; console.log(JSON.stringify(R, null, 1));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('VOICE+LOBBY OK'); await br.close();
  } finally { srv.kill(); srv2.kill(); }
})().catch(e => { console.error('FAILED at step:', STEP); console.error(e); process.exit(1); });
