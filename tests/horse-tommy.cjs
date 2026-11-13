// Run: node tests/horse-tommy.cjs [base URL]. v36 Tommy (Frontier pack): replica model in hand, brass ejected per accepted
// shot (visual only), the old synth Tommy report no longer plays (no double), damage / ammo / cadence unchanged, suppressor
// store item: needs the Tommy, costs 900, saved in hr_v33, toggles visibility + muzzle, sent in netState (sp) and shots.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(base + '/?dev=1&solo=1&zombies=0&q=low&norender=1&prochorse=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.horses.length >= 4 && __horse.state.guns && __horse.state.town2, { timeout: 600000 });
  const R = await p.evaluate(() => { const H = __horse.state, g = H.guns, m = g.models.tommy, step = t => { for (let i = 0; i < t / .05; i++) __sim(.05); };
    const out = { replica: m.group.name, hasSup: !!m.setSuppressor };
    localStorage.removeItem('hr_v33'); g.state.score = 1000; g.state.spent = 0; g.state.owned.tommy = false;
    out.buyNoTommy = H.tommySup.buy(); out.spentNoTommy = g.state.spent;
    let synth = 0; if (window.__sfx) { __sfx.init(); } const shotFn = window.__sfx && __sfx.shot; if (window.__sfx) __sfx.shot = function () { synth++; return shotFn.apply(this, arguments); };
    g.give('tommy'); step(.5); out.drawn = g.draw('tommy'); step(1.2); out.weapon = g.state.weapon;
    const cases = g.tommyFx.group.children.find(c => c.isInstancedMesh), M = new (m.group.matrix.constructor)(), live = () => { let n = 0; for (let i = 0; i < cases.count; i++) { cases.getMatrixAt(i, M); if (Math.abs(M.elements[0]) + Math.abs(M.elements[5]) > 1e-6) n++; } return n; };
    const a0 = g.state.ammo.tommy; let shots = 0; const sent = []; const oldSend = H.netShot; H.netShot = mm => sent.push(mm);
    for (let i = 0; i < 40 && shots < 6; i++) { if (g.shoot ? g.shoot() : false) shots++; step(.05); }
    out.shots = shots; out.ammoUsed = a0 - g.state.ammo.tommy; out.brassLive = live(); out.synthCalls = synth; out.sfxHooked = !!window.__sfx; out.spSent0 = sent.some(s => s.sp);
    step(5); out.brassAfter = live();
    out.buy = H.tommySup.buy(); out.spent = g.state.spent; out.suppressed = m.suppressed; out.supVisible = m.suppressor.visible; out.muzzleZ = +m.muzzle.z.toFixed(3);
    out.saved = JSON.parse(localStorage.getItem('hr_v33')).att; out.net = g.netState().sp;
    sent.length = 0; for (let i = 0; i < 30 && sent.length < 2; i++) { g.shoot && g.shoot(); step(.05); } out.spSent = sent.some(s => s.sp === 1);
    out.buyAgain = H.tommySup.buy(); out.spentAgain = g.state.spent; out.toggle = H.tommySup.toggle(); out.afterToggle = { s: m.suppressed, net: g.netState().sp || 0, saved: JSON.parse(localStorage.getItem('hr_v33')).att.tsup };
    H.tommySup.toggle(); H.netShot = oldSend; return out; });
  console.log(JSON.stringify(R));
  // reload: the suppressor is still fitted (saved)
  await p.reload({ waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__horse && __horse.state.guns && __horse.state.town2, { timeout: 600000 });
  const R2 = await p.evaluate(() => { const g = __horse.state.guns; return { owned: g.state.att.tsup, suppressed: g.models.tommy.suppressed, item: __horse.state.tommySup.state }; });
  console.log(JSON.stringify(R2), 'errors', JSON.stringify(errors.slice(0, 5)));
  assert.ok(R.hasSup && /Thompson/.test(R.replica), 'replica model'); assert.equal(R.buyNoTommy, false); assert.equal(R.spentNoTommy, 0);
  assert.equal(R.weapon, 'tommy'); assert.ok(R.shots >= 3, 'fires'); assert.equal(R.ammoUsed, R.shots, 'one round per shot');
  assert.ok(R.brassLive >= Math.min(R.shots, 3), 'brass ejected'); assert.equal(R.brassAfter, 0, 'brass expires');
  if (R.sfxHooked) assert.equal(R.synthCalls, 0, 'old Tommy synth report silenced');
  assert.equal(R.buy, true); assert.equal(R.spent, 900); assert.ok(R.suppressed && R.supVisible && R.muzzleZ < -.8);
  assert.deepEqual(R.saved.tsup, { owned: true, equipped: true }); assert.equal(R.net, 1); assert.ok(R.spSent, 'shot carries sp'); assert.equal(R.spSent0, false);
  assert.equal(R.buyAgain, false); assert.equal(R.spentAgain, 900); assert.ok(R.toggle && !R.afterToggle.s && !R.afterToggle.net && R.afterToggle.saved.equipped === false);
  assert.ok(R2.owned.owned && R2.owned.equipped && R2.suppressed && R2.item.owned, 'saved across reload');
  assert.equal(errors.length, 0, errors.join('\n')); console.log('PASS horse-tommy'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
