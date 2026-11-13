// v36 failure screen (index.html boot guard, main.js): WebGL disabled -> "3D graphics are turned off" + retry (not a black page);
// a broken game script -> "error while starting"; a normal start shows nothing; the 3D view lost once reloads, lost again
// within a minute shows "keeps resetting" instead of reloading forever.
const assert = require('assert'); const puppeteer = require('puppeteer-core');
const base = process.argv[2] || 'http://localhost:8767', url = base + '/?dev=1&solo=1&q=low&prochorse=1', sleep = ms => new Promise(r => setTimeout(r, ms));
const launch = extra => puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000, args: ['--no-sandbox', ...extra] });
const screen = p => p.evaluate(() => { const d = document.getElementById('bootFail'); return d ? { h: d.querySelector('h2').textContent, retry: !!d.querySelector('#bfRetry'), low: !!d.querySelector('#bfLow'), kind: window.__bootFailed, diag: d.querySelector('pre').textContent.slice(0, 80) } : null; });
(async () => { const R = {};
  { const br = await launch(['--disable-3d-apis']); const p = await br.newPage(); await p.goto(url, { waitUntil: 'load', timeout: 300000 }); await sleep(3000); R.nogl = await screen(p); await br.close(); }
  { const br = await launch(['--use-gl=swiftshader', '--enable-unsafe-swiftshader']); const p = await br.newPage(); await p.setRequestInterception(true);
    p.on('request', q => q.url().includes('game.min.js') ? q.respond({ status: 200, contentType: 'text/javascript', body: 'export const broken = ;' }) : q.continue());
    await p.goto(url, { waitUntil: 'load', timeout: 300000 }); await sleep(2000); R.broken = await screen(p); await br.close(); }
  { const br = await launch(['--use-gl=swiftshader', '--enable-unsafe-swiftshader']); const p = await br.newPage(); await p.goto(url, { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__booted && window.__horse, { timeout: 600000 }); R.normal = await screen(p);
    const nav = p.waitForNavigation({ timeout: 120000 }).then(() => true).catch(() => false); await p.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); gl.getExtension('WEBGL_lose_context').loseContext(); }); R.reloaded = await nav;
    await p.waitForFunction(() => window.__booted, { timeout: 600000 }); let renav = false; p.once('framenavigated', () => { renav = true; });
    await p.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); gl.getExtension('WEBGL_lose_context').loseContext(); }); await sleep(3000); R.second = await screen(p); R.noLoop = !renav; await br.close(); }
  console.log(JSON.stringify(R));
  assert.ok(R.nogl && /turned off/.test(R.nogl.h) && R.nogl.retry && R.nogl.low && R.nogl.kind === 'nogl', 'WebGL off -> explained, with retry');
  assert.ok(R.broken && /error while starting/.test(R.broken.h) && R.broken.retry, 'broken script -> app error screen');
  assert.equal(R.normal, null, 'normal start: no screen'); assert.ok(R.reloaded, 'first loss reloads');
  assert.ok(R.second && /keeps resetting/.test(R.second.h) && R.noLoop, 'second loss: screen, no reload loop');
  console.log('HORSE WEBGL FAIL OK');
})().catch(e => { console.error(e); process.exit(1); });
