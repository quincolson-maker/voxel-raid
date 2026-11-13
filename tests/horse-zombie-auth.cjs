// v36 zombie authority (src/hrzombies.js remoteHit / onHit / apply / confirmKill, horsenet 'zk'): the host validates client hits
// (weapon, max damage, fire rate, range, duplicate shot ids), kills pay once, a client's predicted kill comes back to life when the
// host still has it up, malformed snapshot rows are ignored.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__hnet && window.__horse && __horse.state.zombies, { timeout: 600000 });
  const R = await p.evaluate(async () => { const H = __horse.state, Zm = H.zombies, Z = Zm.state, o = {}, sleep = ms => new Promise(r => setTimeout(r, ms)); Zm.clear(); Z.spawnT = 1e9; Z.hp = 1e9;
    const at = [__P.pos.x + 40, __P.pos.z + 40], sent = [], keepTo = H.zSendTo, keepR = H.netRemotes; H.zSendTo = (id, m) => sent.push([id, m]);
    let rx = at[0] - 20, rz = at[1]; H.netRemotes = () => [{ id: 'P2', s: { x: rx, z: rz } }];
    const z1 = Zm.spawn('walker', at); z1.hold = true; z1.pos.set(at[0], __horse.hAt(at[0], at[1]), at[1]); const id = z1.id;
    o.valid = [Zm.remoteHit({ id, d: 50, h: 0, w: 'revolver', s: 1 }, 'P2'), z1.hp]; o.dupe = [Zm.remoteHit({ id, d: 50, h: 0, w: 'revolver', s: 1 }, 'P2'), z1.hp];
    o.badWeapon = [Zm.remoteHit({ id, d: 10, h: 0, w: 'laser', s: 2 }, 'P2'), z1.hp]; o.malformed = [Zm.remoteHit({ id: NaN, d: 10, w: 'revolver' }, 'P2'), Zm.remoteHit({ id, d: -5, w: 'revolver', s: 3 }, 'P2'), z1.hp];
    rx = at[0] - 400; o.range = [Zm.remoteHit({ id, d: 10, h: 0, w: 'revolver', s: 4 }, 'P2'), z1.hp]; rx = at[0] - 20;
    // way too much damage is cut to the weapon's best (brute: lots of hp)
    const b = Zm.spawn('brute', [at[0] + 3, at[1]]); b.hold = true; b.hp = 5000; Zm.remoteHit({ id: b.id, d: 99999, h: 0, w: 'rifle', s: 5 }, 'P2'); o.clamped = 5000 - b.hp;
    // fire rate: 20 tommy hits at once -> the bucket lets 8 through
    let ok = 0; for (let i = 0; i < 20; i++) if (Zm.remoteHit({ id: b.id, d: 10, h: 0, w: 'tommy', s: 100 + i }, 'P2')) ok++; o.rateOk = ok; await sleep(600); o.rateLater = Zm.remoteHit({ id: b.id, d: 10, h: 0, w: 'tommy', s: 200 }, 'P2');
    // the kill is reported once with the zombie id
    sent.length = 0; Zm.remoteHit({ id, d: 200, h: 1, w: 'rifle', s: 6 }, 'P2'); Zm.remoteHit({ id, d: 200, h: 1, w: 'rifle', s: 7 }, 'P2'); o.zk = sent.filter(([, m]) => m.t === 'zk').map(([to, m]) => [to, m.z === id, m.h]); o.rejected = Z.rejected;
    H.zSendTo = keepTo; H.netRemotes = keepR; Zm.clear();
    // client: a predicted kill the host disagrees with comes back
    const keepRole = H.netRole, keepSend = H.zSend, out = []; H.netRole = () => 'client'; H.zSend = m => out.push(m);
    Zm.apply({ t: 'zs', w: 1, z: [[900, 0, at[0], at[1], 0, 0, 100, 0]] }); const c1 = Z.list.find(q => q.id === 900); o.mirrored = !!c1;
    const r = Zm.onHit(c1, 'gold', true, c1.pos.clone(), c1.pos.clone().set(1, 0, 0)); o.predicted = [r.killed, c1.alive, out[0] && out[0].w, out[0] && Number.isFinite(out[0].s)];
    Zm.apply({ t: 'zs', w: 1, z: [[900, 0, at[0], at[1], 0, 0, 100, 0]] }); o.stillDeadEarly = !c1.alive; await sleep(1000);
    Zm.apply({ t: 'zs', w: 1, z: [[900, 0, at[0], at[1], 0, 0, 100, 0]] }); o.revived = [c1.alive, c1.hp, Math.abs(c1.g.rotation.x) < 1e-6, Z.revived];
    // malformed rows
    const n0 = Z.list.length; Zm.apply({ t: 'zs', w: 1, z: [[900, 0, at[0], at[1], 0, 0, 100, 0], [901, 0, NaN, 1, 0, 0, 100, 0], [902, 0, 1e7, 1, 0, 0, 100, 0], [903, 0, 1, 1, 0, 7, 100, 0], 'junk', [904]] }); o.badRows = [Z.list.length - n0, Z.badRows];
    // kills pay once (horsenet 'zk' -> confirmKill -> points)
    const hs = __hnet.state, keepS = hs.role; hs.role = 'client'; const k0 = Z.kills, s0 = H.guns.state.score; __hnet.rx({ t: 'zk', h: 1, z: 777 }, 'hostpeer'); __hnet.rx({ t: 'zk', h: 1, z: 777 }, 'hostpeer'); __hnet.rx({ t: 'zk', h: 0, z: 778 }, 'hostpeer');
    o.paid = [Z.kills - k0, H.guns.state.score - s0 > 0]; const s1 = H.guns.state.score; __hnet.rx({ t: 'zk', h: 1, z: 777 }, 'hostpeer'); o.paidAgain = H.guns.state.score - s1;
    hs.role = keepS; H.netRole = keepRole; H.zSend = keepSend; Zm.clear(); return o; });
  R.errors = errors; console.log(JSON.stringify(R));
  assert.deepEqual(R.valid, [true, 50]); assert.deepEqual(R.dupe, [false, 50], 'duplicate shot id ignored'); assert.deepEqual(R.badWeapon, [false, 50]); assert.deepEqual(R.malformed, [false, false, 50]);
  assert.deepEqual(R.range, [false, 50], 'out of range'); assert.equal(R.clamped, 141, 'damage capped at the weapon best'); assert.equal(R.rateOk, 8, 'fire-rate bucket'); assert.ok(R.rateLater, 'bucket refills');
  assert.equal(R.zk.length, 1, 'one kill report'); assert.deepEqual(R.zk[0], ['P2', true, 1]);
  assert.ok(R.mirrored); assert.deepEqual(R.predicted, [true, false, 'gold', true]); assert.ok(R.stillDeadEarly, 'grace before revive'); assert.deepEqual(R.revived.slice(0, 3), [true, 100, true], 'predicted kill revived');
  assert.equal(R.badRows[0], 0, 'malformed rows ignored'); assert.ok(R.badRows[1] >= 3);
  assert.equal(R.paid[0], 2, 'two distinct kills, the duplicate ignored'); assert.ok(R.paid[1]); assert.equal(R.paidAgain, 0, 'no double pay');
  assert.ok(!errors.length, errors.join('\n')); console.log('HORSE ZOMBIE AUTH OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
