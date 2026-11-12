// v34 reopen: the world is playable at once even when the lobby server is down / cold (joins in the background), and
// points / guns / jacket survive closing and reopening the app (localStorage).
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = []; const R = { opens: [] };
  const open = async () => { const p = await br.newPage(); p.on('pageerror', e => errors.push(String(e))); await p.setViewport({ width: 960, height: 540 }); const t0 = Date.now();
    await p.goto(base + '/?dev=1&q=low&prochorse=1&lobby=http://127.0.0.1:9', { waitUntil: 'load', timeout: 300000 }); const tl = Date.now() - t0;
    await p.waitForFunction(() => window.__horse && __horse.state.on && (window.__frames || 0) > 3, { timeout: 600000, polling: 100 }); const tp = Date.now() - t0;
    const st = await p.evaluate(() => ({ pts: __horse.state.guns.pts(), jacket: !!__horse.state.town2.jacket, owned: Object.keys(__horse.state.guns.state.owned || {}).filter(k => __horse.state.guns.state.owned[k]), role: window.__hnet ? __hnet.state.role : '?' }));
    R.opens.push({ loadMs: tl, playableMs: tp, ...st }); return p; };
  let p = await open(); await p.evaluate(() => { const G = __horse.state.guns; G.state.score = 345; G.state.spent = 0; G.state.owned.tommy = true; __horse.state.town2.jacket = true; __horse.state.town2.save(); });
  await p.close(); p = await open(); // close and reopen
  // walk right away (no lobby, no tap)
  R.moves = await p.evaluate(() => { const a = __P.pos.clone(); __coop.keys.KeyW = true; for (let i = 0; i < 20; i++) __horse.tick(.05); __coop.keys.KeyW = false; return +__P.pos.distanceTo(a).toFixed(2); });
  // back-forward cache restore -> fresh start
  R.bfReload = await Promise.all([p.waitForNavigation({ timeout: 300000 }).then(() => true).catch(() => false), p.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))]).then(a => a[0]);
  R.errors = errors.filter(e => !/127\.0\.0\.1:9|Failed to fetch|peer/i.test(e)); console.log(JSON.stringify(R));
  const [a, b] = R.opens; assert.equal(b.pts, 345, 'points kept after reopen'); assert.ok(b.jacket && b.owned.includes('tommy'), 'jacket + guns kept');
  assert.ok(R.moves > 1, 'playable at once without the lobby'); assert.ok(R.bfReload, 'bfcache restore reloads'); assert.ok(!R.errors.length, R.errors.join('\n'));
  console.log('HORSE REOPEN OK'); await br.close();
})().catch(e => { console.error(e); process.exit(1); });
