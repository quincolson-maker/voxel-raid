// Voxel Raid · HORSE RIDER (v31): the link opens straight into Horse Rider (auto shared lobby, voice, guns, zombies, rideable
// mountains). The old voxel raid / zombies modes and their menu were removed in v31; they live on in git history (<= v30).
import { createGraphics, loadPBR, pickQuality, IS_TOUCH } from './src/gfx.js';
import { FX, SFX } from './src/fx.js';
import { initTouch } from './src/touch.js';
import { createHorseRider } from './src/horse.js';
import { createHorseNet } from './src/horsenet.js';
import * as THREE from 'three';
const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
if (IS_TOUCH) document.body.classList.add('touch');
// ---------------- Graphics ----------------
const QNAME = pickQuality();
const GX = createGraphics(QNAME); const { renderer, scene, camera } = GX;
const PBRS = loadPBR(renderer, QNAME == 'high' || QNAME == 'ultra');
const sfx = new SFX();
const G = { mode: 'horse', phase: 'menu', t: 0, over: false };
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, dead: 0, onGround: false, spawn: new THREE.Vector3(), recoil: 0, bob: 0 };
const fx = new FX(scene, camera, renderer, GX.Q, () => false); fx.setScale(); addEventListener('resize', () => fx.setScale());
let msgT = 0; function msg(s, t = 2) { $('msg').textContent = s; msgT = t; }
// ---------------- Input ----------------
const keys = {};
addEventListener('keydown', e => { sfx.init(); keys[e.code] = true; onKey(e.code); }); addEventListener('keyup', e => keys[e.code] = false);
// v34: never 'stuck running': drop every held key / stick when the page loses focus, is hidden or paged out
// v36: the one reset path: keys, stick, look ownership, every touch button, fire/jump/use/ADS, queued shots / reloads / aim, pending scoped look
window.__inputResets = window.__inputResets || [];
const dropInput = () => { for (const k in keys) keys[k] = false; input.mx = input.mz = 0; input.fire = input.jump = input.use = input.ads = false; P.lookPend = null; window.__touchReset && window.__touchReset(); for (const f of window.__inputResets) { try { f(); } catch (_) {} } window.__inputDrops = (window.__inputDrops || 0) + 1; };
addEventListener('blur', dropInput); addEventListener('pagehide', dropInput); document.addEventListener('visibilitychange', () => { if (document.hidden) dropInput(); }); window.__dropInput = dropInput;
const locked = () => document.pointerLockElement === renderer.domElement;
document.addEventListener('mousemove', e => { if (!locked()) return; look(e.movementX * .0022, e.movementY * .0022); });
function look(dx, dy, src) { const ls = P.lookScale || 1; dx *= ls; dy *= ls; P.swX = (P.swX || 0) + dx; P.swY = (P.swY || 0) + dy;
  if (src === 'touch' && P.lookSmooth) { const q = P.lookPend || (P.lookPend = { x: 0, y: 0 }); q.x += dx; q.y += dy; return; } // in the rifle scope a finger's look is low-pass filtered (drained per frame by hrguns)
  P.yaw -= dx; P.pitch = Math.max(-1.553, Math.min(1.553, P.pitch - dy)); }
renderer.domElement.addEventListener('mousedown', () => { gesture(); if (!IS_TOUCH && !locked()) renderer.domElement.requestPointerLock(); });
addEventListener('contextmenu', e => e.preventDefault());
const input = { mx: 0, mz: 0, fire: false, jump: false, ads: false };
const act = { build: () => horse.use(), ads() { input.ads = !input.ads; }, help() { const k = $('keys'); k.hidden = !k.hidden; },
  fs() { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else goFullscreen(); } };
function onKey(c) { if (G.phase == 'menu') return; if (c == 'KeyE') horse.use(); if (c == 'KeyH') act.help(); if (c == 'KeyV') hnet.voice.toggle(); }
// first tap / click / key: unlock audio, re-ask for the mic if it was refused without a gesture, phones go fullscreen
let gestured = false; function gesture() { sfx.init(); if (gestured) return; gestured = true; hnet.prime(); if (IS_TOUCH) goFullscreen(); }
addEventListener('pointerdown', gesture, true); addEventListener('keydown', gesture, true);
if (IS_TOUCH) initTouch(input, look, act, gesture);
// ---------------- Horse Rider ----------------
const horse = createHorseRider({ scene, GX, P, keys, input, camera, sfx, fx, msg, PBRS, mobile: IS_TOUCH });
const hnet = createHorseNet({ horse, P, msg });
function update(dt) { if (G.phase == 'menu') return; G.t += dt; horse.tick(dt); hnet.tick(dt); if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').textContent = ''; } }
// ---------------- HUD ----------------
let hudT = 0, hurtFlash = 0;
const CMP = (() => { let h = ''; for (let d = -360; d <= 720; d += 15) { const n = ((d % 360) + 360) % 360; const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[n]; h += `<span class="${lab ? 'c' : ''}">${lab || n}</span>`; } return h; })();
function compass() { const el = $('cstrip'); if (!el) return; if (!el.innerHTML) el.innerHTML = CMP; const hd = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360; el.style.transform = `translateX(${-(hd + 360) / 15 * 40 - 20}px)`; $('chead').textContent = Math.round(hd); }
function hud(dt) { compass(); hurtFlash = Math.max(0, hurtFlash - dt * 1.5); $('vign').style.opacity = hurtFlash;
  hudT -= dt; if (hudT > 0) return; hudT = .1; uiSync(); horse.hud(); }
function uiSync() { if (!IS_TOUCH) return; const a = $('tAct'), lab = horse.touchLabel(); a.hidden = !lab; if (lab && a.innerHTML !== lab) a.innerHTML = lab; }
// ---------------- Screen ----------------
function goFullscreen() { const e = document.documentElement; const rq = e.requestFullscreen || e.webkitRequestFullscreen || e.webkitRequestFullScreen || e.mozRequestFullScreen || e.msRequestFullscreen;
  if (!rq || document.fullscreenElement || document.webkitFullscreenElement) return; try { const r = rq.call(e, { navigationUI: 'hide' }); r && r.then && r.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (_) {} }
// orientation: robust across old phones (window.orientation, matchMedia, size compare), never blocks forever
let rotSkipped = false;
function isLandscape() { const vv = window.visualViewport; const w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
  if (Math.abs(w - h) > 40) return w > h; if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90;
  if (screen.orientation && screen.orientation.type) return screen.orientation.type.startsWith('landscape'); return matchMedia('(orientation: landscape)').matches; }
function checkRot() { $('rot').classList.toggle('show', IS_TOUCH && !rotSkipped && !isLandscape()); }
const recheck = () => { checkRot(); setTimeout(checkRot, 250); setTimeout(checkRot, 800); GX.resize(); fx.setScale(); };
addEventListener('resize', recheck); addEventListener('orientationchange', recheck); window.visualViewport?.addEventListener('resize', recheck); screen.orientation?.addEventListener?.('change', recheck);
$('rotskip').onclick = () => { rotSkipped = true; checkRot(); }; setTimeout(() => { if ($('rot').classList.contains('show')) $('rotskip').textContent = 'Play anyway (portrait)'; }, 4000); checkRot();
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
if (isIOS && !standalone && !document.documentElement.requestFullscreen && !localStorage.getItem('vr_ioshint')) $('ioshint').classList.add('show');
$('ioshintx').onclick = () => { localStorage.setItem('vr_ioshint', '1'); $('ioshint').classList.remove('show'); };
$('vMute').onclick = e => { e.preventDefault(); hnet.voice.toggle(); };
$('vMute').addEventListener('pointerdown', e => e.stopPropagation());
$('fps').hidden = !(localStorage.getItem('vr_fps') === '1' || Q.get('fps') === '1');
const KEYS = IS_TOUCH ? 'CONTROLS\nLeft side: move / steer · right side: look\nRIDE / GET OFF appears near a horse · 🔫 draws a gun, FIRE shoots, ADS aims\n⋯ menu: controls, fullscreen\nTap here to close'
  : 'CONTROLS\nWASD walk / ride · mouse look · E mount / dismount · Shift faster (hold: gallop) · C slower\nF draw / cycle guns · LMB fire · RMB aim · wheel zoom · V mute voice · H this help · Esc release mouse';
$('keys').textContent = KEYS; $('keys').onclick = () => { $('keys').hidden = true; };
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('mFs').style.display = 'none';
// ---------------- Start: the link opens straight into Horse Rider (joins an open room with a free slot, else hosts one) ----------------
function start() { G.phase = 'ride'; document.body.classList.add('ingame', 'horse-mode'); $('hud').style.display = ''; horse.init(); }
hnet.prime(); start(); hnet.auto(Q.get('room') || undefined);
window.__t0 = performance.now(); // v34 reopen: the world is playable at once; the lobby joins / rejoins in the background
// iOS / Android resume: a page restored from the back-forward cache (or a home-screen app brought back) has dead WebGL / WebRTC
// state, so start fresh; after a long background stay, re-find a lobby if the link dropped
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
let hiddenAt = 0; document.addEventListener('visibilitychange', () => { if (document.hidden) { hiddenAt = performance.now(); return; } last = performance.now(); // no giant dt after a pause
  if (hiddenAt && performance.now() - hiddenAt > 20000 && hnet.state.role !== 'solo' && !(hnet.net && hnet.net.open)) hnet.auto(); });
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); if (!document.hidden) setTimeout(() => location.reload(), 300); else document.addEventListener('visibilitychange', () => location.reload(), { once: true }); });
// test hooks
const syncCamera = dt => horse.syncCamera(dt);
window.__sim = secs => { for (let i = 0; i < secs * 20; i++) update(.05); };
if (Q.get('dev') === '1') { window.__horse = horse; window.__hnet = hnet; window.__coop = { act, syncCamera, keys, input }; }
window.__cam = camera; window.__G = G; window.__P = P; window.__Q = QNAME;
// ---------------- Loop with adaptive resolution ----------------
const NORENDER = Q.has('norender'); const TSCALE = +(Q.get('ts') || 1); let last = performance.now(), fAcc = 0, fN = 0, lowT = 0, hiT = 0, pr = renderer.getPixelRatio(); const PR_MAX = Math.min(devicePixelRatio || 1, /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? Math.max(pr, 1.5) : Math.max(pr, 2));
function loop(t) { requestAnimationFrame(loop); window.__frames = (window.__frames || 0) + 1; const rdt = Math.max(0, Math.min(.1, (t - last) / 1000)); last = t; const dt = Math.min(.05, rdt);
  try {
  for (let k = 0; k < TSCALE; k++) update(dt);
  if (G.phase != 'menu') { syncCamera(dt); sfx.listen(camera); hud(dt); }
  const lp = GX.lens(); if (lp) lp.uniforms.uT.value = (t % 1000);
  const gmat = scene.userData.grassMat; if (gmat && gmat.userData.sh) gmat.userData.sh.uniforms.uT.value = performance.now() / 1000;
  if (!NORENDER) { fx.update(dt); GX.followSun(P.pos); GX.render(); }
  } catch (e) { if (!window.__loopErr) { window.__loopErr = e; console.error('frame error', e); } if (/render|WebGL|shader/i.test(String(e && e.stack)) && GX.composer) { GX.composer = null; } }
  fAcc += rdt; fN++; if (fAcc > 2) { const fps = fN / fAcc; $('fps').textContent = Math.round(fps) + ' fps · ' + QNAME;
    if (fps > 55 && pr < PR_MAX - .01) { if (++hiT >= 3) { hiT = 0; pr = Math.min(PR_MAX, pr + .1); GX.setPR(pr); fx.setScale(); } } else hiT = 0; // v33: adaptive both ways (sharper when there is headroom)
    if (fps < 28) { lowT++; if (lowT >= 2) { lowT = 0; if (GX.aoPass && GX.aoPass.enabled) GX.disableAO(); else if (pr > .55) { pr = Math.max(.5, pr - .15); GX.setPR(pr); fx.setScale(); } } } else lowT = 0;
    fAcc = 0; fN = 0; }
  }
requestAnimationFrame(loop);
