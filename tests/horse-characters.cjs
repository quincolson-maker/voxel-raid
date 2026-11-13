// Run: node tests/horse-characters.cjs [port]. v36 character picker: Classic + 4 Frontier variants skinned onto the rider rig.
// Each variant: saved (hr_char), the classic meshes hidden, the variant's hands land on the rig's hands (where the guns are
// held) and its feet on the rig's feet (stirrups when mounted), hips on the saddle, no NaN, head hidden in first person,
// Classic restores the original meshes. Settings panel buttons. Net: the choice goes out as join metadata ('meta'), the
// host relays it under the authenticated peer id, remote avatars wear it (walker + seated copy), changes propagate.
const puppeteer = require('puppeteer-core'); const assert = require('node:assert/strict'); const { spawn } = require('child_process'); const path = require('path');
const port = +(process.argv[2] || 8799), base = 'http://localhost:' + port, sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const until = async (p, fn, arg, ms = 60000) => { try { return await p.waitForFunction(fn, { timeout: ms, polling: 200 }, arg); } catch (e) { throw new Error('until timeout :: ' + fn); } };
(async () => { const errors = [], R = {};
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve-lobby.cjs'), String(port)], { stdio: 'pipe' }); await new Promise((r, j) => { srv.stdout.once('data', r); srv.once('exit', c => j(new Error('lobby exited ' + c))); });
  const br = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, protocolTimeout: 900000, args });
  try {
    const page = async (tag, q) => { const p = await br.newPage(); await p.evaluateOnNewDocument(() => { let last = performance.now(); setInterval(() => { const n = performance.now(), dt = Math.min(.25, (n - last) / 1000); last = n; if (document.hidden && window.__sim) { window.__sim(dt); window.__horse && __horse.preRender(); } }, 50); }); p.on('pageerror', e => errors.push(tag + ': ' + e.message)); p.on('console', m => { if (/character/.test(m.text())) errors.push(tag + ': ' + m.text()); });
      await p.setViewport({ width: 1280, height: 720 }); await p.goto(base + '/?dev=1&q=low&norender=1&zombies=0' + q, { waitUntil: 'load', timeout: 300000 });
      await until(p, () => window.__horse && __horse.state.models === 'real' && __horse.state.guns && __horse.state.town2, null, 600000); return p; };
    // ---- single rider checks
    const s = await page('solo', '&solo=1');
    R.solo = await s.evaluate(() => { const H = __horse.state, me = H.person, out = {}, V = () => new (__cam.position.constructor)();
      const rig = () => { let r = null; me.body.traverse(o => { if (!r && o.userData && o.userData.B && o.userData.kind === 'real') r = o; }); if (!r && H.mounted) H.mounted.g.traverse(o => { if (!r && o.userData && o.userData.B && o.userData.kind === 'real') r = o; }); return r; };
      const measure = () => { __horse.preRender(); const r = rig(), D = r && r.userData.skin; if (!D) return null; const F = D.g.userData.B, B = r.userData.B, d = (a, b) => +a.getWorldPosition(V()).distanceTo(b.getWorldPosition(V())).toFixed(3);
        const hands = Math.max(...['LeftHand', 'RightHand'].map(n => Math.min(d(F.LeftHand, B[n]), d(F.RightHand, B[n])))), feet = Math.max(...['LeftFoot', 'RightFoot'].map(n => Math.min(d(F.LeftFoot, B[n]), d(F.RightFoot, B[n])))); let nan = false; D.g.traverse(o => { if (o.isBone && (o.quaternion.toArray().some(Number.isNaN) || o.position.toArray().some(Number.isNaN))) nan = true; });
        let classicShown = 0; r.traverse(o => { if (o.isMesh && o.visible && !(o.parent && (o === D.body))) { let p = o, inSkin = false; for (; p; p = p.parent) if (p === D.g) inSkin = true; if (!inSkin) classicShown++; } });
        return { hands, feet, hips: d(F.Hips, B.Hips), nan, classicShown, head: +F.Head.scale.x.toFixed(3), h: +(F.Head.getWorldPosition(V()).y - F.LeftFoot.getWorldPosition(V()).y).toFixed(2) }; };
      const step = t => { for (let i = 0; i < t / .05; i++) __sim(.05); };
      for (let cv = 1; cv <= 4; cv++) { H.setCharacter(cv); H.fp = false; const x = -40, z = 30; __P.pos.set(x, __horse.hAt(x, z), z); H.fv.set(0, 0); step(.5); H.guns.give('tommy'); H.guns.draw('tommy'); step(1.2);
        const o = { saved: localStorage.getItem('hr_char'), foot: measure() };
        const h = H.horses[0]; h.pos.set(__P.pos.x + 1.2, __horse.hAt(__P.pos.x + 1.2, __P.pos.z), __P.pos.z); h.speed = 0; H.cd = 0; __horse.use(); step(3); H.guns.draw('tommy'); step(1.2); H.fp = false; o.mounted = !!H.mounted; o.ride = measure();
        __horse.state.keys = __horse.state.keys; H.fp = true; o.fpHead = measure().head; H.fp = false; __horse.dismount(); step(2); out['cv' + cv] = o; }
      H.setCharacter(0); __horse.preRender(); const r = rig(); let vis = 0; r.traverse(o => { if (o.isMesh && o.visible) vis++; }); out.classic = { skin: !!r.userData.skin, vis, saved: localStorage.getItem('hr_char') };
      // settings panel buttons
      document.getElementById('setBtn').click(); const btns = [...document.querySelectorAll('#charRow button')]; out.buttons = btns.map(b => b.textContent); btns[3].click(); out.afterClick = { cv: H.cv, on: btns.findIndex(b => b.classList.contains('on')) }; document.getElementById('setClose').click(); H.setCharacter(0);
      return out; });
    console.log(JSON.stringify(R.solo));
    for (let cv = 1; cv <= 4; cv++) { const o = R.solo['cv' + cv]; assert.equal(o.saved, String(cv)); for (const k of ['foot', 'ride']) { const m = o[k]; assert.ok(m, 'skin ' + cv + ' ' + k); assert.ok(!m.nan, 'no NaN'); assert.equal(m.classicShown, 0, 'classic meshes hidden');
      assert.ok(m.hands < .03, `cv${cv} ${k}: hands on the rig hands (${m.hands})`); assert.ok(m.feet < .04, `cv${cv} ${k}: feet on the rig feet (${m.feet})`); assert.ok(m.hips < .1, `cv${cv} ${k}: hips (${m.hips})`); assert.equal(m.head, 1); }
      assert.ok(o.mounted, 'mounted'); assert.ok(o.foot.h > 1.3 && o.foot.h < 1.9, 'standing height ' + o.foot.h); assert.ok(o.fpHead < .01, 'head hidden in first person'); }
    assert.ok(!R.solo.classic.skin && R.solo.classic.vis > 0 && R.solo.classic.saved === '0', 'Classic restores the rider');
    assert.deepEqual(R.solo.buttons, ['Classic', 'Isaiah', 'Cole', 'June', 'Clara']); assert.deepEqual(R.solo.afterClick, { cv: 3, on: 3 });
    await s.close();
    // ---- net: join metadata
    const Q = '&loopnet=1&lobby=' + encodeURIComponent(base);
    const h = await page('host', Q + '&char=2'); await until(h, () => __hnet.state.role === 'host' && !!__hnet.state.code);
    const c = await page('p2', Q + '&char=4'); await until(c, () => __hnet.state.role === 'client' && __hnet.state.remotes.has('P1')); await until(h, () => __hnet.state.remotes.has('P2'));
    await until(h, () => __horse.state.remoteCvs.get('P2') === 4); await until(c, () => __horse.state.remoteCvs.get('P1') === 2);
    await sleep(1500); R.hostAv = await h.evaluate(() => { const R = __hnet.state.remotes.get('P2'); return { cv: R.av.cv, skins: R.av.skins.length }; });
    await c.evaluate(() => __horse.state.setCharacter(1)); await until(h, () => __horse.state.remoteCvs.get('P2') === 1); await sleep(1200);
    R.hostAv2 = await h.evaluate(() => { const R = __hnet.state.remotes.get('P2'); return { cv: R.av.cv, skins: R.av.skins.length }; });
    await c.evaluate(() => __horse.state.setCharacter(0)); await until(h, () => !__horse.state.remoteCvs.has('P2')); await sleep(1200);
    R.hostAv3 = await h.evaluate(() => { const R = __hnet.state.remotes.get('P2'); let vis = 0; R.av.walker.traverse(o => { if (o.isMesh && o.visible) vis++; }); return { cv: R.av.cv, skins: R.av.skins.length, vis }; });
    console.log(JSON.stringify({ hostAv: R.hostAv, hostAv2: R.hostAv2, hostAv3: R.hostAv3 }));
    assert.deepEqual(R.hostAv, { cv: 4, skins: 2 }); assert.deepEqual(R.hostAv2, { cv: 1, skins: 2 }); assert.ok(R.hostAv3.cv === 0 && R.hostAv3.skins === 0 && R.hostAv3.vis > 0);
    assert.equal(errors.length, 0, errors.join('\n')); console.log('PASS horse-characters');
  } catch (e) { console.error(e, errors.slice(0, 5)); process.exitCode = 1; } finally { await br.close(); srv.kill(); } })();
