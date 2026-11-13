// v36 net session races (src/horsenet.js tryJoin / host / reset / hostLeft, src/coop.js): fast hi before the join resolves,
// full room, no-hi timeout, failed join, host gone while joining, a late timer from an old attempt, hostLeft retry
// cancelled by a new session, reset clears session state, a host that never opens times out. Transport is stubbed
// (protocol test, not a WebRTC test).
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__hnet && window.__horse && __horse.state.horses.length >= 4, { timeout: 600000 });
  const R = await p.evaluate(async () => { const N = __hnet, S = N.state, net = N.net, o = {}, sleep = ms => new Promise(r => setTimeout(r, ms)), T = () => performance.now();
    const hi = (me = 'P3') => N.rx({ t: 'hi', me, ids: ['P1'] }, 'hostpeer');
    let t0 = T(); net.join = async () => { hi('P3'); }; o.fast = [await N.tryJoin('AAAAA'), S.role, S.me, Math.round(T() - t0)];
    t0 = T(); net.join = async () => { N.rx({ t: 'full' }, 'hostpeer'); }; o.full = [await N.tryJoin('BBBBB'), S.role, Math.round(T() - t0)];
    t0 = T(); net.join = async () => {}; o.timeout = [await N.tryJoin('CCCCC'), S.role, Math.round(T() - t0)];
    t0 = T(); net.join = async () => { throw new Error('nope'); }; o.failed = [await N.tryJoin('DDDDD'), S.role, Math.round(T() - t0)];
    t0 = T(); net.join = async () => { setTimeout(() => N.status('closed', 'hostpeer'), 300); }; o.hostGone = [await N.tryJoin('EEEEE'), S.role, Math.round(T() - t0)];
    // an attempt that never gets hi, replaced at once by one that does: the old attempt's timers must not touch the new session
    net.join = async () => {}; const A = N.tryJoin('FFFFF'); await sleep(50); net.join = async () => { hi('P5'); }; const B = await N.tryJoin('GGGGG'); const a = await A; await sleep(7000);
    o.late = [a, B, S.role, S.me, S.code];
    // a stray hi when not joining is ignored
    N.reset(); N.rx({ t: 'hi', me: 'P9', ids: [] }, 'x'); o.strayHi = [S.role, S.me];
    // hostLeft schedules a re-find; starting a new session cancels it
    net.join = async () => { hi('P4'); }; await N.tryJoin('HHHHH'); N.hostLeft(); o.leftTimers = S.timers.size; net.host = async () => 'ZZZZZ'; await N.host(); o.afterHost = [S.timers.size, S.role, S.code]; await sleep(1600); o.stillHost = [S.role, S.code];
    // reset clears session-owned state
    S.fwd.set('P2', { t: 'p' }); S.last = [1, 2]; S.footSp = 9; S.netT = 5; N.reset(); o.reset = [S.fwd.size, S.last, S.footSp, S.netT, S.role, S.code, net.role, net.code, net.peer, net.conns.size, net.open];
    // a host that never opens: bounded wait
    t0 = T(); net.host = () => new Promise(() => {}); o.hostHang = [await N.host(), S.role, S.status, Math.round(T() - t0)];
    return o; });
  R.errors = errors; console.log(JSON.stringify(R));
  assert.deepEqual(R.fast.slice(0, 3), [true, 'client', 'P3'], 'hi before the join resolved still joins'); assert.ok(R.fast[3] < 1500);
  assert.deepEqual(R.full.slice(0, 2), [false, 'solo']); assert.ok(R.full[2] < 1500, 'full room fails fast');
  assert.deepEqual(R.timeout.slice(0, 2), [false, 'solo']); assert.ok(R.timeout[2] > 5000 && R.timeout[2] < 8000, 'no hi -> 6 s timeout');
  assert.deepEqual(R.failed.slice(0, 2), [false, 'solo']); assert.ok(R.failed[2] < 1500);
  assert.deepEqual(R.hostGone.slice(0, 2), [false, 'solo']); assert.ok(R.hostGone[2] < 1500, 'host left while joining -> fail fast');
  assert.deepEqual(R.late, [false, true, 'client', 'P5', 'GGGGG'], 'old attempt timers do not touch the new session');
  assert.deepEqual(R.strayHi, ['solo', 'P1'], 'stray hi ignored');
  assert.equal(R.leftTimers, 1); assert.deepEqual(R.afterHost, [0, 'host', 'ZZZZZ']); assert.deepEqual(R.stillHost, ['host', 'ZZZZZ'], 'hostLeft retry cancelled');
  assert.deepEqual(R.reset, [0, null, 0, 0, 'solo', null, 'solo', null, null, 0, false], 'reset clears the session');
  assert.deepEqual(R.hostHang.slice(0, 3), [false, 'solo', 'offline']); assert.ok(R.hostHang[3] > 19000 && R.hostHang[3] < 23000, 'host creation is bounded');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE NET SESSION OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
