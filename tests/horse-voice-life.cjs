// v36 voice lifecycle (src/voice.js + horsenet admission): a permission that resolves after the final shutdown is released,
// shutdown releases the mic, a room change keeps it (and keeps mute), incoming offers obey the same admission policy and link
// cap, the OS pausing the track shows up, autoplay refusal shows TAP FOR VOICE. Fake media device; no real peers.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__hnet && window.__hnet.voice, { timeout: 600000 });
  const R = await p.evaluate(async () => { const V = __hnet.voice, S = __hnet.state, o = {}, sleep = ms => new Promise(r => setTimeout(r, ms));
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices), got = []; let delay = 0;
    navigator.mediaDevices.getUserMedia = c => new Promise(res => setTimeout(() => real(c).then(s => { got.push(s); res(s); }), delay));
    // delayed permission after the final shutdown -> the tracks are stopped, no mic kept
    V.shutdown(); delay = 800; V.start([]); V.shutdown(); await sleep(1500); o.late = [V.mic, got.length, got[0] && got[0].getAudioTracks()[0].readyState];
    // normal start; a room change (stop/start) keeps the same mic + mute; shutdown releases it
    delay = 0; V.start([]); await sleep(600); const s1 = V.mic; o.live = [!!s1, V.state]; V.toggle(); o.muted = V.state; V.stop(); V.start([]); await sleep(300); o.room = [V.mic === s1, V.state, s1.getAudioTracks()[0].enabled];
    // the OS pauses the track
    V.toggle(); const t = s1.getAudioTracks()[0]; t.onmute && t.onmute(); o.paused = V.state; t.onunmute && t.onunmute(); o.unpaused = V.state;
    V.shutdown(); o.shut = [V.mic, s1.getAudioTracks()[0].readyState, V.state];
    // admission: incoming offers follow the same policy, and links are capped
    V.start([]); await sleep(300); const keepAdmit = V.admit; V.admit = () => false; V.signal({ t: 'vs', f: 'P7', to: 'P1', k: 'offer', d: { type: 'offer', sdp: 'v=0' } }); o.refused = [V.links.has('P7'), V.refused];
    V.admit = () => true; for (let i = 2; i <= 14; i++) V.peer('P' + i); o.capped = V.links.size; V.signal({ t: 'vs', f: 'P20', to: 'P1', k: 'offer', d: { type: 'offer', sdp: 'v=0' } }); o.capIn = V.links.has('P20');
    V.admit = keepAdmit; for (const id of [...V.links.keys()]) V.drop(id);
    // horsenet admission in a big lobby: near riders in, far riders out
    const keep = new Map(S.remotes); S.remotes.clear(); for (let i = 2; i <= 12; i++) S.remotes.set('P' + i, { id: 'P' + i, s: { x: __P.pos.x + (i === 2 ? 20 : 500), z: __P.pos.z } }); o.admitNear = V.admit('P2'); o.admitFar = V.admit('P9'); S.remotes.clear(); for (const [k, v] of keep) S.remotes.set(k, v);
    // autoplay refused -> TAP FOR VOICE flag
    const a = document.createElement('audio'); const L = { audio: a }; a.play = () => Promise.reject(new Error('NotAllowed')); V.links.set('PX', { ...L, pc: { close() {}, getTransceivers: () => [] } }); V.resume(); await sleep(100); o.needTap = V.needTap; V.links.delete('PX');
    V.shutdown(); return o; });
  R.errors = errors; console.log(JSON.stringify(R));
  assert.deepEqual(R.late, [null, 1, 'ended'], 'late permission released');
  assert.deepEqual(R.live, [true, 'live']); assert.equal(R.muted, 'muted'); assert.deepEqual(R.room, [true, 'muted', false], 'room change keeps the mic and the mute');
  assert.equal(R.paused, 'paused'); assert.equal(R.unpaused, 'live'); assert.deepEqual(R.shut, [null, 'ended', 'off'], 'shutdown releases the mic');
  assert.deepEqual(R.refused, [false, 1], 'incoming offer refused by policy'); assert.equal(R.capped, 8, 'at most 8 links'); assert.equal(R.capIn, false, 'cap holds for incoming offers');
  assert.ok(R.admitNear && !R.admitFar, 'big lobby: near in, far out'); assert.ok(R.needTap, 'tap for voice');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE VOICE LIFE OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
