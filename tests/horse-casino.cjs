// Run: node tests/horse-casino.cjs [base]. v36 casino in the saloon (desktop + phone): walk-up USE label, poker hand played to
// the end with real button clicks (bots act on their own), blackjack deal / stand to a result; practice chips only (game points
// never change), LEAVE TABLE closes, phone panel fits the screen.
const assert = require('assert'); const puppeteer = require('puppeteer-core'); const base = process.argv[2] || 'http://localhost:8767', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const out = {};
  for (const tag of ['desktop', 'mobile']) { const mobile = tag === 'mobile', p = await br.newPage(), errors = []; p.on('pageerror', e => errors.push(String(e)));
    await p.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 1280, height: 720 });
    await p.goto(base + '/?dev=1&solo=1&zombies=0&q=low&norender=1&prochorse=1' + (mobile ? '&touch=1' : ''), { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__horse && __horse.state.saloon && __horse.state.guns && __horse.state.town2, { timeout: 600000 });
    const R = out[tag] = {};
    const open = async k => p.evaluate(k => { const H = __horse.state, S = H.saloon; if (S.isOpen()) S.close(); H.guns.state.score = 777; H.guns.state.spent = 0; const o = H.town2.spots.find(o => o.kind === k); __P.pos.set(o.x, o.y, o.z); H.fv.set(0, 0); __sim(.3); const lbl = __horse.touchLabel ? __horse.touchLabel() : ''; H.cd = 0; __horse.use(); __sim(.1); const el = document.getElementById('hrCasino'); return { spot: H.spot && H.spot.kind, lbl, open: !!el && !el.hidden }; }, k);
    const btns = () => p.evaluate(() => [...document.querySelectorAll('#hrCasino button')].filter(b => !b.disabled).map(b => b.dataset.a));
    const click = a => p.evaluate(a => { const b = [...document.querySelectorAll('#hrCasino button')].find(b => b.dataset.a === a && !b.disabled); if (!b) return false; b.click(); return true; }, a);
    const sim = s => p.evaluate(s => { __sim(s); }, s);
    R.poker = await open('poker'); let acts = 0, done = false;
    for (let i = 0; i < 200 && !done; i++) { const b = await btns(); if (b.includes('next')) { done = true; break; } const a = b.includes('check') ? 'check' : b.includes('call') ? 'call' : null; if (a) { await click(a); acts++; } await sim(1.5); }
    R.pokerDone = done; R.pokerActs = acts; R.pokerText = await p.evaluate(() => document.getElementById('hrCasino').textContent.slice(0, 400));
    R.fit = await p.evaluate(() => { const b = document.getElementById('hrCasino').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 1; });
    await click('exit'); R.closed = await p.evaluate(() => document.getElementById('hrCasino').hidden);
    R.bj = await open('blackjack'); const chips0 = await p.evaluate(() => (document.getElementById('hrCasino').textContent.match(/YOUR CHIPS:\s*(\d+)/i) || [])[1]);
    await click('bet'); await sim(.5); let res = false; for (let i = 0; i < 20; i++) { const b = await btns(); if (b.includes('bet')) { res = true; break; } if (b.includes('stand')) await click('stand'); await sim(1); }
    R.bjChips = [chips0, await p.evaluate(() => (document.getElementById('hrCasino').textContent.match(/YOUR CHIPS:\s*(\d+)/i) || [])[1])]; R.bjDone = res;
    R.points = await p.evaluate(() => __horse.state.guns.state.score - (__horse.state.guns.state.spent || 0)); await click('exit');
    R.errors = errors; await p.close(); }
  console.log(JSON.stringify(out));
  for (const R of Object.values(out)) { assert.equal(R.poker.spot, 'poker'); assert.ok(R.poker.open, 'poker opens'); assert.ok(/PLAY/i.test(R.poker.lbl), 'USE label ' + R.poker.lbl); assert.ok(R.pokerDone, 'hand completes'); assert.ok(R.fit, 'panel fits');
    assert.ok(R.closed); assert.ok(R.bj.open); assert.ok(R.bjDone, 'blackjack round resolves'); assert.ok(R.bjChips[0] && R.bjChips[1] && R.bjChips[0] !== R.bjChips[1] || R.bjDone, 'chips'); assert.equal(R.points, 777, 'game points untouched'); assert.equal(R.errors.length, 0, R.errors.join('\n')); }
  console.log('PASS horse-casino'); await br.close(); })().catch(e => { console.error(e); process.exit(1); });
