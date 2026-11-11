// Run: node tests/horse-voice.cjs [port]. Starts tests/serve-lobby.cjs (game + lobby API on one port), then checks the
// automatic Horse Rider multiplayer lobby + always-on voice:
//  - player 1 taps HORSE RIDER with no open lobby -> hosts one and advertises it with mode 'horse'
//  - the menu lobby list shows it marked 🐎 HORSE RIDER (not mixed with zombies rooms); player 2 (phone) taps the row -> joins
//  - player 3 (desktop) just taps HORSE RIDER -> auto-joins the same lobby (no codes)
//  - voice starts on its own on both sides: offer/answer applied over the co-op channel, sendrecv audio
//  - mute: phone taps the speaker button, desktop presses V
//  - sync: player 2 mounts and rides a horse -> the host sees that horse ridden and moving; dismount releases it
//  - a zombies room in the same list stays a zombies row; leaving updates the player count
// Screenshots: shot-horserider-voice-*.png. Uses ?loopnet=1 for game traffic (box Chrome blocks non-proxied UDP).
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const port = +(process.argv[2] || 8797), base = 'http://localhost:' + port;
let STEP = ''; const step = t => { STEP = t; if (process.env.VERBOSE) console.log('·', t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const ignorable = t => /pointer ?lock|requestPointerLock|fullscreen|favicon|WebGL|GPU stall|404|ERR_|Failed to load resource/i.test(t);
const until = async (p, fn, arg, ms = 25000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
async function page(br, mobile, errors, tag) {
  const p = await br.newPage();
  await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) window.__sim(dt); }, 50); });
  p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(tag + ': ' + m.text()); });
  await p.setViewport(mobile ? { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true } : { width: 1280, height: 720 });
  return p;
}
(async () => {
  const R = {}, errors = [];
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(port)], { stdio: 'pipe' });
  await new Promise((r, j) => { srv.stdout.once('data', r); srv.once('exit', c => j(new Error('lobby test server exited ' + c))); });
  const api = (m, b) => fetch(base + m, b ? { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'text/plain' } } : {}).then(r => r.json());
  let br;
  try {
    step('lobby API keeps the mode'); await api('/lobby', { code: 'ZOMB1', key: 'kz', host: 'ZedSquad', players: 2, max: 4, map: 'night' });
    let L = (await api('/lobbies')).lobbies; assert.equal(L.find(l => l.code === 'ZOMB1').mode, 'zombies', 'old/zombies adverts default to zombies');
    br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 120000, args });
    await br.defaultBrowserContext().overridePermissions(base, ['microphone']);
    const Q = '/?dev=1&zombies=0&loopnet=1&q=low&lobby=' + encodeURIComponent(base);
    step('player 1 taps HORSE RIDER -> hosts');
    const h = await page(br, false, errors, 'host'); await h.goto(base + Q, { waitUntil: 'networkidle0' });
    await h.evaluate(() => { document.getElementById('operator').value = 'NOMAD'; });
    await h.click('#horseBtn'); await until(h, () => __hnet.state.role === 'host' && !!__hnet.state.code, null, 30000);
    const code = await h.evaluate(() => __hnet.state.code); R.code = code;
    await until(h, () => __hnet.voice.state === 'live'); R.hostVoiceLive = true;
    L = (await api('/lobbies')).lobbies; const adv = L.find(l => l.code === code); assert.ok(adv && adv.mode === 'horse' && adv.players === 1, 'host advertises a horse lobby'); R.advert = adv;
    step('player 2 (phone) sees the Horse Rider lobby in the menu');
    const c = await page(br, true, errors, 'p2'); await c.goto(base + Q + '&touch=1', { waitUntil: 'networkidle0' });
    await until(c, k => !!document.querySelector(`.lob[data-mode="horse"][data-code="${k}"]`), code, 20000);
    R.row = await c.$eval(`.lob[data-code="${code}"]`, e => e.textContent); assert.match(R.row, /HORSE RIDER/); assert.match(R.row, /NOMAD/); assert.match(R.row, /1\/4/);
    R.zombiesRow = await c.$eval('.lob[data-code="ZOMB1"]', e => [e.dataset.mode, e.textContent]); assert.equal(R.zombiesRow[0], 'zombies'); assert.doesNotMatch(R.zombiesRow[1], /HORSE/);
    await c.bringToFront(); await sleep(300); await c.screenshot({ path: 'shot-horserider-voice-menu-mobile.png' });
    step('player 2 taps the row -> joins');
    await c.tap(`.lob[data-code="${code}"]`);
    await until(c, k => __G.mode === 'horse' && __hnet.state.role === 'client' && __hnet.state.code === k && __hnet.state.remotes.has('P1'), code, 30000); R.p2Joined = await c.evaluate(() => __hnet.state.me);
    await until(h, () => __hnet.state.remotes.has('P2'));
    step('voice starts on both (offer/answer)');
    await until(c, () => __hnet.voice.state === 'live' && __hnet.voice.links.has('P1'));
    await until(h, () => { const L = __hnet.voice.links.get('P2'); return L && L.pc.signalingState === 'stable' && !!L.pc.remoteDescription; });
    await until(c, () => { const L = __hnet.voice.links.get('P1'); return L && L.pc.signalingState === 'stable' && !!L.pc.remoteDescription; });
    R.voice = await h.evaluate(() => { const L = __hnet.voice.links.get('P2'), tr = L.pc.getTransceivers()[0]; return { dir: tr.currentDirection, sending: !!tr.sender.track, sdpAudio: /m=audio/.test(L.pc.remoteDescription.sdp), localType: L.pc.localDescription.type }; });
    assert.equal(R.voice.dir, 'sendrecv'); assert.ok(R.voice.sending && R.voice.sdpAudio);
    R.voiceClient = await c.evaluate(() => __hnet.voice.links.get('P1').pc.localDescription.type); // one side offered, the other answered
    assert.notEqual(R.voice.localType, R.voiceClient);
    step('player 3 (desktop) taps HORSE RIDER -> auto-joins the same lobby');
    const d = await page(br, false, errors, 'p3'); await d.goto(base + Q, { waitUntil: 'networkidle0' }); await until(d, k => !!document.querySelector(`.lob[data-code="${k}"]`), code, 20000);
    await d.bringToFront(); await sleep(300); await d.screenshot({ path: 'shot-horserider-voice-menu-desktop.png' });
    await d.click('#horseBtn'); await until(d, k => __hnet.state.role === 'client' && __hnet.state.code === k && __hnet.state.remotes.size === 2, code, 30000); R.p3 = await d.evaluate(() => __hnet.state.me);
    await until(h, () => __hnet.state.remotes.size === 2); await until(c, () => __hnet.state.remotes.has('P3'));
    await until(d, () => __hnet.voice.links.has('P1') && __hnet.voice.links.has('P2'));
    L = (await api('/lobbies')).lobbies; R.listedPlayers = L.find(l => l.code === code).players; assert.equal(R.listedPlayers, 3);
    step('sync: player 2 mounts and rides; host sees it');
    await c.bringToFront();
    await c.evaluate(() => { const H = __horse, h = H.state.horses[2]; for (const o of H.state.horses) o.wait = 1e9; __P.pos.set(h.pos.x + 1.2, h.pos.y, h.pos.z); });
    await until(c, () => !!__horse.state.near, null, 10000); await c.tap('#tAct'); await until(c, () => !!__horse.state.mounted, null, 20000);
    R.p2Horse = await c.evaluate(() => __horse.state.mounted.id);
    await until(h, id => __horse.state.ridden.get(__horse.state.horses[id]) === 'P2', R.p2Horse, 15000); R.hostSeesRidden = true;
    await c.evaluate(() => { const h = __horse.state.mounted; __P.yaw = Math.PI; h.yaw = Math.PI; h.pos.x = __horse.PEN.x; h.pos.z = __horse.PEN.z + __horse.PEN.hd + 3; });
    const cj = await c.$eval('#joy', e => { const r = e.getBoundingClientRect(); return [r.left + r.width * .3, r.top + r.height * .7]; }); const cdp = await c.target().createCDPSession();
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await tp('touchStart', cj[0], cj[1]); await tp('touchMove', cj[0], cj[1] - 60);
    await until(c, () => __horse.state.speed > 6 && __horse.state.mounted.pos.z > __horse.PEN.z + 24, null, 60000).catch(async e => { console.log(await c.evaluate(() => JSON.stringify({ sp: __horse.state.speed, pos: __horse.state.mounted && __horse.state.mounted.pos, yaw: __P.yaw, inp: [__horse.state.t] }))); throw e; });
    await sleep(400); await c.screenshot({ path: 'shot-horserider-voice-riding-mobile.png' });
    R.muteBtnRiding = await c.$eval('#vMute', e => { const r = e.getBoundingClientRect(); return { visible: !e.hidden && r.width > 0, label: e.textContent, left: Math.round(r.left), top: Math.round(r.top) }; });
    assert.ok(R.muteBtnRiding.visible && /MIC ON/.test(R.muteBtnRiding.label));
    await tp('touchEnd');
    const p2z = await c.evaluate(() => __horse.state.mounted.pos.z);
    await until(h, ([id, z]) => Math.abs(__horse.state.horses[id].pos.z - z) < 4, [R.p2Horse, p2z], 20000); R.hostSeesHorseMove = true;
    step('mute: phone button, desktop V key');
    await c.tap('#vMute'); R.p2Muted = await c.evaluate(() => [__hnet.voice.state, __hnet.voice.mic.getAudioTracks()[0].enabled, document.getElementById('vMute').className]);
    assert.deepEqual(R.p2Muted, ['muted', false, 'v-muted']); await sleep(300); await c.screenshot({ path: 'shot-horserider-voice-riding-mobile-muted.png' });
    await c.tap('#vMute'); assert.equal(await c.evaluate(() => __hnet.voice.state), 'live');
    await h.bringToFront(); await h.keyboard.press('KeyV'); assert.equal(await h.evaluate(() => __hnet.voice.state), 'muted');
    await h.keyboard.press('KeyV'); assert.equal(await h.evaluate(() => [__hnet.voice.state, __hnet.voice.mic.getAudioTracks()[0].enabled].join()), 'live,true'); R.hostVKey = true;
    step('host view of the remote rider');
    await h.evaluate(id => { const H = __horse, o = H.state.horses[id]; __P.pos.set(o.pos.x + 3.5, H.hAt(o.pos.x + 3.5, o.pos.z + 4.5), o.pos.z + 4.5); __P.yaw = Math.atan2(3.5, 4.5); __P.pitch = -.15; }, R.p2Horse);
    await sleep(1500); await h.screenshot({ path: 'shot-horserider-voice-remote-desktop.png' });
    R.hostAvatar = await h.evaluate(() => { const r = __hnet.state.remotes.get('P2'); return { sitterOnHorse: !!(r.av.sitter && r.av.sitter.parent), walkerHidden: !r.av.walker.visible }; });
    // P2 draws the six-shooter in the saddle and fires: the host sees the gun in P2's hand and the shot (tracer / flash / smoke / sound)
    await c.evaluate(() => { __horse.guns.draw('revolver'); __P.yaw = __horse.state.mounted.yaw; }); await until(c, () => { const g = __horse.guns; return g.state.weapon === 'revolver' && g.shoot(false); }, null, 30000);
    await until(h, () => (__horse.guns.state.remoteShots || 0) >= 1, null, 20000); R.hostSeesShot = true;
    await until(h, () => { const r = __hnet.state.remotes.get('P2'); return !!(r && r.av.guns && r.av.guns.revolver.group.visible); }, null, 20000); R.hostSeesGun = true;
    await c.evaluate(() => __horse.guns.draw('sniper')); await until(c, () => { const g = __horse.guns; return g.state.weapon === 'sniper' && g.shoot(false); }, null, 30000);
    await until(h, () => (__horse.guns.state.remoteShots || 0) >= 2, null, 20000); R.hostSeesBuffaloShot = true;
    await until(h, () => { const r = __hnet.state.remotes.get('P2'); return !!(r && r.av.guns && r.av.guns.sniper && r.av.guns.sniper.group.visible); }, null, 20000); R.hostSeesBuffaloRifle = true;
    await c.evaluate(() => __horse.guns.holster());
    assert.ok(R.hostAvatar.sitterOnHorse && R.hostAvatar.walkerHidden);
    step('dismount releases the horse for everyone');
    await c.bringToFront(); await c.tap('#tAct'); await until(c, () => !__horse.state.mounted, null, 5000);
    await until(h, id => !__horse.state.ridden.has(__horse.state.horses[id]), R.p2Horse, 15000); R.released = true;
    step('player 3 leaves -> count drops');
    await d.close({ runBeforeUnload: true }); await until(h, () => __hnet.state.remotes.size === 1, null, 30000); R.afterLeave = await h.evaluate(() => __hnet.state.remotes.size + 1);
    R.errors = errors; console.log(JSON.stringify(R, null, 1));
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('HORSE VOICE OK');
  } finally { if (br) await br.close(); srv.kill(); }
})().catch(e => { console.error('FAILED at step:', STEP); console.error(e); process.exit(1); });
