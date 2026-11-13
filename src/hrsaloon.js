// v35 saloon life (all original, procedural): Greta the barmaid, three burlesque dancers (pay 100 for a routine), bandits at
// their table (hire one for 100: follows you on foot or on its own horse, shoots zombies, can die), bar fistfights (bump a
// bandit or a random brawl), the dealer in the dark corner (snow = fast, green = slow), three slot machines upstairs (seated
// first-person view, 10/50/100 bets, jackpot 6000), swinging batwing doors, warm lamps, light shafts and dust.
import * as THREE from 'three';
import {mergeGeometries} from '../addons/utils/BufferGeometryUtils.js';
import {makeFrontierCharacter} from './hrcharacters.js';
import {createCasino} from './hrcasino.js';
import {createSaloonDecor} from './hrsaloondecor.js';
import {themeOf,themedSpin,themedMultiplier,themedRTP} from './hrcasinogames.js';
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
// ---------------- slots: pure math (tests use it) ----------------
export const SLOT = { NAMES: ['cactus', 'cherry', 'horseshoe', 'bell', 'buffalo'], W: [10, 9, 7, 4, 2], THREE: [0, 5, 10, 25, 60], TWO_CHERRY: 3, ONE_CHERRY: 1, BETS: [10, 50, 100] };
export function slotPick(rnd) { const T = SLOT.W.reduce((a, b) => a + b, 0); let r = rnd() * T; for (let i = 0; i < SLOT.W.length; i++) { if ((r -= SLOT.W[i]) < 0) return i; } return 0; }
export function slotSpin(rnd = Math.random) { return [slotPick(rnd), slotPick(rnd), slotPick(rnd)]; }
export function slotMult(r) { const [a, b, c] = r; if (a === b && b === c) return SLOT.THREE[a]; const ch = r.filter(x => x === 1).length; return ch === 2 ? SLOT.TWO_CHERRY : a === 1 ? SLOT.ONE_CHERRY : 0; }
export function slotPay(r, bet) { return slotMult(r) * bet; }
export function slotRTP() { const T = SLOT.W.reduce((a, b) => a + b, 0), n = SLOT.W.length; let e = 0; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) e += SLOT.W[a] * SLOT.W[b] * SLOT.W[c] / T ** 3 * slotMult([a, b, c]); return e; }
export const REEL_PHASE = .65; // which part of the reel texture faces the window
export const PRICES = { bandit: 100, dance: 100, snow: 150, green: 50, maxBandits: 5, banditKill: 5, fightWin: 50 };
// ---------------- symbol art (canvas) ----------------
function drawSym(x, k, cx, cy, s, theme=0) { x.save(); x.translate(cx, cy); x.scale(s / 100, s / 100); x.lineCap = 'round'; x.lineJoin = 'round';
  if(theme){const cfg=themeOf(theme),ink=theme===1?'#204b50':'#9b6626';x.fillStyle=ink;x.strokeStyle=ink;x.lineWidth=5;
    if(k===0){x.beginPath();x.arc(0,0,31,0,TAU);x.stroke();if(theme===1){x.fillStyle='#fbf4e2';x.beginPath();x.arc(15,-9,27,0,TAU);x.fill();}else for(let i=0;i<8;i++){const a=i/8*TAU;x.beginPath();x.moveTo(Math.cos(a)*35,Math.sin(a)*35);x.lineTo(Math.cos(a)*44,Math.sin(a)*44);x.stroke();}}
    if(k===1){x.beginPath();x.moveTo(0,-34);x.lineTo(31,0);x.lineTo(0,34);x.lineTo(-31,0);x.closePath();x.fill();x.strokeStyle='#d9c490';x.beginPath();x.moveTo(-28,0);x.lineTo(28,0);x.moveTo(0,-30);x.lineTo(0,30);x.stroke();if(theme===1){x.fillStyle='#202025';x.beginPath();x.ellipse(0,0,29,14,-.45,0,TAU);x.fill();x.beginPath();x.moveTo(18,-8);x.lineTo(42,-14);x.lineTo(26,1);x.fill();}}
    if(k===2){if(theme===2){x.beginPath();x.ellipse(0,0,19,30,0,0,TAU);x.fill();for(const sign of [-1,1])for(let n=0;n<3;n++){x.beginPath();x.moveTo(sign*15,-16+n*15);x.lineTo(sign*34,-23+n*22);x.stroke();}x.strokeStyle='#e1c77b';x.beginPath();x.moveTo(0,-28);x.lineTo(0,28);x.stroke();}else{x.strokeRect(-22,-24,44,53);x.fillStyle=theme===1?'#d4a14d':'#bb9448';x.fillRect(-12,-14,24,32);x.beginPath();x.arc(0,-28,13,Math.PI,TAU);x.stroke();}}
    if(k===3){x.beginPath();x.moveTo(-37,17);x.lineTo(-24,-17);x.lineTo(24,-17);x.lineTo(37,17);x.closePath();x.fill();x.strokeStyle='#e1c77b';x.stroke();if(theme===1){x.fillRect(-35,-8,70,10);x.fillRect(-20,-25,40,20);x.fillStyle='#eee1c2';x.fillRect(-18,2,36,27);x.fillStyle='#292b29';x.fillRect(-12,10,8,5);x.fillRect(5,10,8,5);}}
    if(k===4){x.beginPath();if(theme===2){x.moveTo(0,-39);x.lineTo(38,29);x.lineTo(-38,29);}else{x.moveTo(-30,34);x.lineTo(-30,-8);x.bezierCurveTo(-30,-45,30,-45,30,-8);x.lineTo(30,34);x.lineTo(10,23);x.lineTo(0,36);x.lineTo(-10,23);}x.closePath();x.fill();x.strokeStyle='#e9cd80';x.stroke();if(theme===1){x.fillStyle='#f9edcb';x.beginPath();x.arc(-10,-4,5,0,TAU);x.arc(10,-4,5,0,TAU);x.fill();}else{x.beginPath();x.moveTo(0,-32);x.lineTo(7,23);x.lineTo(32,25);x.stroke();}}
    x.restore();return;}

  if (k === 0) { x.fillStyle = '#3f8a3a'; x.fillRect(-9, -38, 18, 76); x.fillRect(-32, -14, 12, 26); x.fillRect(-32, 2, 30, 10); x.fillRect(20, -26, 12, 26); x.fillRect(4, -8, 28, 10); x.fillStyle = '#2b6a28'; x.fillRect(-2, -38, 3, 76); }
  else if (k === 1) { x.strokeStyle = '#2e6b1e'; x.lineWidth = 6; x.beginPath(); x.moveTo(-14, -4); x.quadraticCurveTo(-6, -36, 12, -40); x.moveTo(16, 0); x.quadraticCurveTo(14, -24, 12, -40); x.stroke(); x.fillStyle = '#d21d2a'; for (const [u, v] of [[-16, 14], [16, 18]]) { x.beginPath(); x.arc(u, v, 17, 0, TAU); x.fill(); } x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(-21, 8, 5, 0, TAU); x.arc(11, 12, 5, 0, TAU); x.fill(); }
  else if (k === 2) { x.strokeStyle = '#8a8f96'; x.lineWidth = 15; x.beginPath(); x.arc(0, -4, 28, Math.PI * .85, Math.PI * 2.15, false); x.stroke(); x.strokeStyle = '#c9ced4'; x.lineWidth = 5; x.beginPath(); x.arc(0, -4, 28, Math.PI * .9, Math.PI * 2.1, false); x.stroke(); x.fillStyle = '#333'; for (let i = 0; i < 6; i++) { const a = Math.PI * (.95 + i * .23); x.beginPath(); x.arc(Math.cos(a) * 28, -4 + Math.sin(a) * 28, 2.6, 0, TAU); x.fill(); } }
  else if (k === 3) { const g = x.createLinearGradient(-30, -30, 30, 30); g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#b07a10'); x.fillStyle = g; x.beginPath(); x.moveTo(-30, 26); x.quadraticCurveTo(-28, -36, 0, -36); x.quadraticCurveTo(28, -36, 30, 26); x.closePath(); x.fill(); x.fillStyle = '#7a5208'; x.fillRect(-34, 24, 68, 7); x.beginPath(); x.arc(0, 36, 7, 0, TAU); x.fill(); }
  else { const g = x.createLinearGradient(0, -40, 0, 40); g.addColorStop(0, '#fff1a0'); g.addColorStop(1, '#c8860e'); x.fillStyle = g; x.beginPath(); x.ellipse(4, 4, 34, 22, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(-28, -8, 15, 15, 0, 0, TAU); x.fill(); x.fillRect(-14, -20, 30, 18);
    for (const u of [-18, -6, 14, 26]) x.fillRect(u, 18, 7, 22); x.strokeStyle = '#fff6c8'; x.lineWidth = 4; x.beginPath(); x.moveTo(-36, -20); x.quadraticCurveTo(-44, -34, -32, -36); x.moveTo(-22, -22); x.quadraticCurveTo(-16, -36, -26, -38); x.stroke(); x.fillStyle = '#5a3a06'; x.beginPath(); x.arc(-32, -10, 2.5, 0, TAU); x.fill(); }
  x.restore(); }
const symURL = []; function symIcon(k,theme=0) { const key=theme*5+k;if (symURL[key]) return symURL[key]; const cv = document.createElement('canvas'); cv.width = cv.height = 120; const x = cv.getContext('2d'); drawSym(x, k, 60, 60, 100,theme); return (symURL[key] = cv.toDataURL()); }
function reelTex(theme=0) { const cv = document.createElement('canvas'); cv.width = 128 * 5; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#fbf4e2'; x.fillRect(0, 0, cv.width, 128); // symbols run round the reel (u)
  for (let k = 0; k < 5; k++) { x.save(); x.translate(64 + k * 128, 64); x.rotate(Math.PI / 2); drawSym(x, k, 0, 0, 84,theme); x.restore(); x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(k * 128 + 124, 0, 4, 128); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; }
function plaqueTex(lines, bg = '#3a1a10', fg = '#f3d58a', w = 256, h = 256) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); x.fillStyle = fg; x.textAlign = 'center';
  lines.forEach((l, i) => { x.font = (i ? '' : 'bold ') + (l[1] || 22) + 'px Georgia,serif'; x.fillText(l[0], w / 2, 34 + i * (h - 50) / Math.max(1, lines.length - 1) * (lines.length > 1 ? 1 : 0)); }); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function fanTex() { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); for (let i = 0; i < 14; i++) { const a = Math.PI + i / 13 * Math.PI; x.strokeStyle = i % 2 ? '#ff9ad0' : '#ffffff'; x.lineWidth = 16; x.beginPath(); x.moveTo(128, 124); x.lineTo(128 + Math.cos(a) * 120, 124 + Math.sin(a) * 120); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function tagTex(txt, col = '#e7c46a') { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 8, 256, 48); x.fillStyle = col; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 128, 44); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
// ---------------- procedural dolls (shared geometry + materials) ----------------
const GEO = new Map(), MAT = new Map();
const geo = (k, f) => GEO.get(k) || (GEO.set(k, f()), GEO.get(k));
const mat = (c, o = {}) => { const k = c + ':' + JSON.stringify(o); if (!MAT.has(k)) MAT.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: .75, ...o })); return MAT.get(k); };
const cap = (r, l) => geo('c' + r + '/' + l, () => new THREE.CapsuleGeometry(r, l, 3, 8).translate(0, -l / 2 - r * .3, 0));
const sph = (r) => geo('s' + r, () => new THREE.SphereGeometry(r, 14, 10));
function mesh(g, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; }
function ruffle(r0, r1, h, col, waves = 14) { return geo('rf' + r0 + r1 + h + waves, () => { const g = new THREE.CylinderGeometry(r0, r1, h, 36, 1, true); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), y = p.getY(i); if (y < 0) { const k = 1 + Math.sin(a * waves) * .08; p.setXYZ(i, x * k, y + Math.cos(a * waves) * .02, z * k); } } g.computeVertexNormals(); return g; }); }
function makeDoll(o) { return makeFrontierCharacter(o); }
// a doll pose for this frame: mode in idle | walk | run | sit | dance | punch | block | fight | ko | aim | cheer | lean
function poseDoll(D, dt, mode = D.mode, v = 0) { D.t += dt; const t = D.t, [aL, aR] = D.arms, [lL, lR] = D.legs, H = D.hips, S = D.spine, s = Math.sin, c = Math.cos;
  const reset = () => { H.position.x = 0; H.position.y = .93; H.rotation.set(0, 0, 0); S.rotation.set(0, 0, 0); D.head.rotation.set(0, 0, 0); for (const [a, b] of [aL, aR, lL, lR]) { a.rotation.set(0, 0, 0); b.rotation.set(0, 0, 0); } aL[0].rotation.z = -.12; aR[0].rotation.z = .12; D.g.rotation.x = 0; };
  reset(); const br = s(t * 1.7) * .02; S.rotation.x = br;
  if (mode === 'walk' || mode === 'run') { D.ph += dt * (2 + v * 1.55); const p = D.ph, k = clamp(v / 4.5, .25, 1.1), run = mode === 'run' || v > 3.2;
    lL[0].rotation.x = -s(p) * .7 * k; lR[0].rotation.x = s(p) * .7 * k; lL[1].rotation.x = Math.max(0, s(p + 1.4)) * 1.1 * k; lR[1].rotation.x = Math.max(0, -s(p + 1.4)) * 1.1 * k;
    aL[0].rotation.x = s(p) * .6 * k; aR[0].rotation.x = -s(p) * .6 * k; aL[1].rotation.x = aR[1].rotation.x = -.4 - (run ? .6 : 0); H.position.y = .93 - Math.abs(s(p)) * .04 * k + .02; S.rotation.x = run ? .18 : .04; }
  else if (mode === 'sit') { H.position.y = .55; lL[0].rotation.x = lR[0].rotation.x = -1.5; lL[1].rotation.x = lR[1].rotation.x = 1.5; aL[0].rotation.x = aR[0].rotation.x = -.7; aL[1].rotation.x = aR[1].rotation.x = -.6; S.rotation.x = .08 + s(t * .8) * .03; D.head.rotation.y = s(t * .4 + D.ph) * .4; }
  else if (mode === 'dance') { const p = t * 2.4; H.rotation.z = s(p) * .16; H.rotation.y = s(p * .5) * .35; H.position.x = s(p) * .06; S.rotation.z = -s(p) * .12; S.rotation.y = s(p * 2) * .1; D.head.rotation.z = s(p + .5) * .12;
    const beat = Math.floor(t / 1.1) % 4, ph = (t % 1.1) / 1.1, kick = s(ph * Math.PI); // can-can: alternate high kicks, a shimmy, then the fan
    if (beat === 0) { lL[0].rotation.x = -1.8 * kick; } else if (beat === 1) { lR[0].rotation.x = -1.8 * kick; } else if (beat === 2) { lL[0].rotation.x = -.9 * kick; lL[1].rotation.x = 1.4 * kick; S.rotation.x = -.1; } else { lR[0].rotation.x = -.9 * kick; lR[1].rotation.x = 1.4 * kick; }
    H.position.y = .93 - (beat < 2 ? kick * .05 : 0); aL[0].rotation.z = -1.1 - s(p) * .4; aL[1].rotation.x = -.6; aR[0].rotation.x = -1.3 + s(t * 3) * .5; aR[0].rotation.z = .6 + c(t * 3) * .4; aR[1].rotation.x = -.5;
    if (D.fan) D.fan.rotation.z = s(t * 6) * .4; D.g.rotation.y = (D.baseYaw || 0) + (Math.floor(t / 4.4) % 3 === 2 ? ((t % 4.4) / 4.4) * TAU : 0); }
  else if (mode === 'fight' || mode === 'punch' || mode === 'block') { lL[0].rotation.x = -.3; lR[0].rotation.x = .25; lL[1].rotation.x = .3; H.position.y = .9 + s(t * 6) * .015; S.rotation.x = .12;
    aL[0].rotation.x = -1.2; aL[1].rotation.x = -1.6; aR[0].rotation.x = -1.1; aR[1].rotation.x = -1.7; aL[0].rotation.z = .25; aR[0].rotation.z = -.25;
    if (mode === 'punch') { const k = s(clamp(D.pk || 0, 0, 1) * Math.PI); aR[0].rotation.x = -1.2 - k * .4; aR[1].rotation.x = -1.7 + k * 1.6; S.rotation.y = -k * .4; }
    if (mode === 'block') { aL[0].rotation.x = aR[0].rotation.x = -1.6; aL[1].rotation.x = aR[1].rotation.x = -2.2; aL[0].rotation.z = .5; aR[0].rotation.z = -.5; } }
  else if (mode === 'ko') { const k = clamp(D.koT || 0, 0, 1); D.g.rotation.x = -k * 1.45; H.position.y = .93 + k * .12; aL[0].rotation.z = -1.2 * k; aR[0].rotation.z = 1.2 * k; }
  else if (mode === 'aim') { aR[0].rotation.x = -1.5; aR[1].rotation.x = 0; aL[0].rotation.x = -1.3; aL[0].rotation.z = .5; aL[1].rotation.x = -.6; S.rotation.y = -.15; lL[0].rotation.x = -.15; lR[0].rotation.x = .15; }
  else if (mode === 'cheer') { aL[0].rotation.x = aR[0].rotation.x = -2.8 + s(t * 8) * .2; H.position.y = .93 + Math.abs(s(t * 8)) * .05; }
  else if (mode === 'lean') { S.rotation.x = .25; aL[0].rotation.x = aR[0].rotation.x = -1; aL[1].rotation.x = aR[1].rotation.x = -.8; lR[0].rotation.x = .2; lR[1].rotation.x = .3; D.head.rotation.y = s(t * .5) * .5; }
  else { aL[0].rotation.x = s(t * .9 + D.ph) * .05; aR[0].rotation.x = -s(t * .9 + D.ph) * .05; if (D.o.kind === 'dancer') { H.rotation.z = s(t * 1.6 + D.ph) * .08; aL[0].rotation.z = -.9; aL[1].rotation.x = -1.2; aR[0].rotation.x = -.6 + s(t * 2) * .2; if (D.fan) D.fan.rotation.z = s(t * 4) * .3; } }
}
const BANDIT_LOOKS = [{ coat: 0x4a3524, hatC: 0x1e1712, bandana: 0x8a1a16, top: 0x5a4a3a, hair: 0x2a1a10, skin: 0xd8a882, rifle: true }, { coat: 0x2a2624, hatC: 0x3a2a1a, bandana: 0x1a1a1a, top: 0x6a2a20, hair: 0x5a3a20, skin: 0xc89070 },
  { coat: 0x6a5a44, hatC: 0x4a3a2a, bandana: 0x2a3a6a, top: 0x8a7a5a, hair: 0x1a1210, skin: 0xa8704e, rifle: true }, { coat: 0x3a2a20, hatC: 0x111111, bandana: 0x6a1a3a, top: 0x3a3a3a, hair: 0x8a6a3a, skin: 0xe8b894 }];
const DANCERS = [{ name: 'Ruby', top: 0xb01030, skirt: 0xc81a3a, trim: 0x111111, feather: 0xff3a6a, hair: 0x7a1a10, long: true, skin: 0xf0c4a4, legs: 0x18121a, shoe: 0x111111 },
  { name: 'Lola', top: 0x1a1a1a, skirt: 0x1a1a1a, trim: 0xd8a040, feather: 0xffd24a, hair: 0x140c08, long: true, skin: 0xc8946c, legs: 0x221a22, shoe: 0x7a1010 },
  { name: 'Belle', top: 0x5a1a8a, skirt: 0x7a2aa8, trim: 0x111111, feather: 0xc88aff, hair: 0xe8c878, long: true, skin: 0xf4d0b4, legs: 0x1a121a, shoe: 0x2a0a3a }];
export function createSaloon(c) {
  const { scene, H, P, T, camera, sfx, msg, mobile, input, keys } = c, s = T.town, S = { bandits: [], seated: [], dancers: [], remote: new Map(), fight: null, seat: null, dance: null, buzz: { snow: 0, crash: 0, green: 0 }, req: 0, pend: new Map(), slotsPlayed: 0, last: null };
  if (!s) return null;
  const makeDoll = o => makeFrontierCharacter({...o,quality:mobile?'low':'high'});
  const ownedNodes=new Set(),ownedDolls=new Set(),sceneBefore=new Set(scene.children),ownSpots=new Set(),originalTownUse=T.onUse;let disposed=false;
  // Construction nodes are recorded explicitly below; no global scene patching.
  H.saloon = S; const F = s.F, Y2 = s.Y2, W = (x, z) => T.toW(s, x, z), Lh = (x, y, z) => { const [wx, wz] = W(x, z); return new THREE.Vector3(wx, s.y0 + y, wz); }, rot = s.rot;
  const place = (D, x, y, z, yaw) => { ownedDolls.add(D); const p = Lh(x, y, z); D.g.position.copy(p); D.g.rotation.y = rot + yaw; D.baseYaw = rot + yaw; scene.add(D.g); };
  const G = () => H.guns, pts = () => G() ? G().pts() : 0, spend = n => { const g = G(); if (!g || g.pts() < n) { msg('Not enough points (' + n + ' needed)', 1.6); return false; } g.state.spent += n; g.save && g.save(); return true; }, earn = n => { const g = G(); if (!g) return; g.state.score += n; g.save && g.save(); };
  const ring = (f0, f1, d, v, type = 'sine') => { if(disposed)return;if (sfx.tone && sfx.ctx) sfx.tone(type, f0, f1, d, v); };
  // ---- NPCs ----
  const bartable = [[-13.4, 6.2, -Math.PI / 2], [-14.2, 7.05, Math.PI], [-15.05, 6.2, Math.PI / 2], [-14.2, 5.35, 0]]; // seated round the bandits' table (local, facing in)
  bartable.forEach((_, i) => { const a = i / 4 * TAU + .4, x = -14.2 + Math.cos(a) * .85, z = 6.2 + Math.sin(a) * .85, D = makeDoll({ kind: 'bandit', ...BANDIT_LOOKS[i] }); D.mode = 'sit'; place(D, x, F, z, Math.atan2(-Math.cos(a), -Math.sin(a))); S.seated.push(D); });
  S.drifters = [[-4.6, 4.75, 0, 'lean'], [-12.6, 8.2, -2.2, 'idle']].map(([x, z, y, m], i) => { const D = makeDoll({ kind: 'bandit', ...BANDIT_LOOKS[(i + 2) % 4] }); D.mode = m; D.home = [x, z, y, m]; place(D, x, F, z, y); D.hp = 100; return D; });
  S.dancers = DANCERS.map((o, i) => { const D = makeDoll({ kind: 'dancer', ...o }); D.mode = 'idle'; D.home = [-16.2 + i * .9, 1.4 + (i % 2) * .5]; place(D, D.home[0], F + .4, D.home[1], Math.PI / 2 + .3); return D; });
  const greta = makeDoll({ kind: 'barmaid', top: 0xf6f2ea, bust: 0xf6f2ea, sleeve: 0xf6f2ea, bodice: 0x2f5e2c, skirt: 0x8a1e22, hair: 0xe0b860, skin: 0xf2c8a8, legs: 0xf6f2ea, shoe: 0x3a2414, name: 'Greta' }); greta.route = [[-4.2,3.1],[-3,4.8],[-6,4.2],[-8.6,4.5],[-9.2,3.8],[-6,3.4]]; greta.ri = 0; greta.wait = 2; place(greta, -6, F, 4.2, 0); S.greta = greta;
  const dealer = makeDoll({ kind: 'dealer', top: 0x1c1a1c, hair: 0x111111, skin: 0xb88a6a, legs: 0x1c1a1c }); place(dealer, -16.45, F, 8.2, Math.PI / 2); dealer.mode = 'lean'; S.dealer = dealer;
  const staticNPCs=[...S.seated,...S.drifters,...S.dancers,greta,dealer];
  const npcAll=()=>staticNPCs;
  // spots (the town's E / tap prompt)
  const sp = (x, y, z, kind, label, r) => { const o = { x: 0, z: 0, y: s.y0 + y, kind, label, r, s }; [o.x, o.z] = W(x, z); T.spots.push(o);ownSpots.add(o);return o; };
  sp(-12.9, F, 6.2, 'bandits', 'Hire a gunslinger (100 pts)', 1.5); sp(-13.2, F, 1.9, 'dance', 'Pay a dancer (100 pts)', 1.7); sp(-15.4, F, 8.5, 'dealer', 'Talk to the man in the corner', 1.4);
  const gretaSpot = sp(-6, F, 4.2, 'drink', 'Order a beer from Greta', 1.3);
  const slotZ = [3, 5.2, 7.4]; S.slots = slotZ.map((z, i) => ({ i, z, theme:i, spot: sp(-15.25, Y2, z, 'slot', 'Sit down and play slots', 1.1) }));
  // ---- slot machines (3D): cabinet, arch sign, three reels, lever, paytable plaque ----
  const gold = mat(0xd4a83a, { roughness:.3, metalness:.9 });
  for (const M of S.slots) { const theme=themeOf(M.theme),reelMat=new THREE.MeshStandardMaterial({map:reelTex(M.theme),roughness:.45}),cab=mat(theme.color,{roughness:.42,metalness:.25});
    const payTex=plaqueTex([['PAYS × BET',20],...theme.names.map((name,i)=>[name.toUpperCase()+' ×3 · '+theme.triples[i],14]),['2 '+theme.names[1].toUpperCase()+' · '+theme.two,13],['FIRST '+theme.names[1].toUpperCase()+' · '+theme.first,13]],'#21170f','#e5c184',256,512);
    const archTex=plaqueTex([[theme.name,30],[theme.subtitle,13]],'#1e1915','#e7c17a',512,128);
    const g=new THREE.Group();g.name=theme.name+' cabinet';g.position.copy(Lh(-16.55,Y2,M.z));g.rotation.y=rot+Math.PI/2;scene.add(g);ownedNodes.add(g);M.g=g;
    g.add(mesh(new THREE.BoxGeometry(.8, 1.35, .6), cab, 0, .68, 0)); g.add(mesh(new THREE.BoxGeometry(.86, .06, .66), gold, 0, 1.38, 0)); g.add(mesh(new THREE.BoxGeometry(.86, .06, .66), gold, 0, .02, 0));
    const ar = new THREE.Mesh(new THREE.PlaneGeometry(.78, .26), new THREE.MeshBasicMaterial({ map: archTex })); ar.position.set(0, 1.56, .2); g.add(ar); g.add(mesh(new THREE.BoxGeometry(.8, .3, .1), cab, 0, 1.56, .14));
    const win = mesh(new THREE.BoxGeometry(.66, .3, .02), mat(0x111111), 0, 1.02, .3); g.add(win); M.reels = [];
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(geo('reel', () => new THREE.CylinderGeometry(.1, .1, .17, 20, 1, true).rotateZ(Math.PI / 2)), reelMat.clone()); r.material.map = reelMat.map.clone(); r.material.map.needsUpdate = true; r.position.set(-.2 + k * .2, 1.02, .24); g.add(r); M.reels.push(r); r.userData.off = Math.random(); r.material.map.offset.x = r.userData.off; }
    const pq = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ map: payTex })); pq.position.set(0, .55, .305); g.add(pq);
    const lever = new THREE.Group(); lever.position.set(.43, .95, 0); g.add(lever); lever.add(mesh(new THREE.CylinderGeometry(.015, .015, .4), gold, 0, .2, 0)); lever.add(mesh(sph(.045), mat(theme.accent, { roughness: .3 }), 0, .42, 0)); M.lever = lever;
    M.light = mesh(sph(.03), new THREE.MeshBasicMaterial({ color: 0xffd76a }), 0, 1.7, .2); g.add(M.light); M.spin=null;
    // Carved cabinet cheeks, brass window bezel, scalloped crown and unique finial.
    for(const x of [-.385,.385]){g.add(mesh(new THREE.CylinderGeometry(.035,.045,1.22,12),gold,x,.73,.32));g.add(mesh(new THREE.SphereGeometry(.046,10,6),gold,x,1.37,.32));}
    for(const y of [.845,1.195])g.add(mesh(new THREE.BoxGeometry(.72,.035,.045),gold,0,y,.325));
    const crown=mesh(new THREE.TorusGeometry(.34,.023,6,30,Math.PI),gold,0,1.57,.23);g.add(crown);
    if(M.theme===2){const fin=mesh(new THREE.ConeGeometry(.12,.23,4),gold,0,1.98,.15);fin.rotation.y=Math.PI/4;g.add(fin);}
    else if(M.theme===1){g.add(mesh(new THREE.TorusGeometry(.10,.025,8,24,Math.PI*1.65),gold,0,1.96,.15));}
    else{g.add(mesh(new THREE.SphereGeometry(.065,12,8),gold,0,1.97,.15,1.4,.8,.8));}
    mergeCabinetStatic(M);
  }
  // ---- swinging batwing doors, lamps, light shafts, dust ----
  S.doors = [[-6.8, 1], [-5.2, -1]].map(([x, sd]) => { const hinge = new THREE.Group(); hinge.position.copy(Lh(x, F + 1.25, 0)); hinge.rotation.y = rot; const leaf = mesh(new THREE.BoxGeometry(.78, 1.05, .04), mat(0x5a3a22), sd * .39, 0, 0); hinge.add(leaf); scene.add(hinge); return { hinge, sd, a: 0, v: 0 }; });
  const lampLights = (mobile ? [[-7, F + 2.9, 3]] : [[-7, F + 2.9, 3], [-14.2, Y2 - .7, 6.2]]).map(([x, y, z]) => { const L = new THREE.PointLight(0xffb060, mobile ? 4 : 5, 13, 1.6); L.position.copy(Lh(x, y, z)); scene.add(L); return L; });
  { const shaftM = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const x of [-15.4, -2.6]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2), shaftM); sh.position.copy(Lh(x, F + 1.2, 1.3)); sh.rotation.set(-.75, rot, 0); scene.add(sh); } }
  const DN = mobile ? 50 : 140, dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffe8c0, size: .03, transparent: true, opacity: .55, depthWrite: false })); const dp = new Float32Array(DN * 3), dseed = [];
  for (let i = 0; i < DN; i++) { dseed.push([-16 + Math.random() * 15, F + .3 + Math.random() * 3.5, .5 + Math.random() * 9, Math.random() * 6]); } dust.geometry.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dust.frustumCulled = false; scene.add(dust);
  // ---- UI ----
  const ui = document.createElement('div'); ui.id = 'hrSaloon'; ui.hidden = true; document.body.appendChild(ui); ui.addEventListener('pointerdown', e => e.stopPropagation()); ui.addEventListener('mousedown', e => e.stopPropagation());
  const css = document.createElement('style'); css.textContent = `#hrSaloon{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:45;background:rgba(28,14,8,.92);color:#f3e2b8;border:2px solid #c9a245;border-radius:14px;padding:10px 14px;font:600 15px system-ui,sans-serif;min-width:300px;max-width:96vw;text-align:center;box-shadow:0 6px 30px rgba(0,0,0,.6)}
#hrSaloon h3{margin:2px 0 6px;font:700 18px Georgia,serif;color:#ffd76a;letter-spacing:1px}#hrSaloon button{font:700 16px system-ui,sans-serif;border-radius:10px;border:2px solid #c9a245;background:#4a2414;color:#ffe9b0;padding:10px 14px;margin:4px;min-width:64px;touch-action:manipulation}
#hrSaloon button.on{background:#c9a245;color:#2a1408}#hrSaloon button.big{font-size:24px;padding:14px 34px;background:#b01e1e;border-color:#ffd76a}#hrSaloon button:disabled{opacity:.4}#hrSaloon .x{position:absolute;right:6px;top:4px;min-width:0;padding:4px 10px;background:#2a1408}
#hrSaloon .reels{display:flex;gap:8px;justify-content:center;margin:6px 0}#hrSaloon .reels div{width:78px;height:78px;background:#fbf4e2;border-radius:10px;border:3px solid #7a5208;display:flex;align-items:center;justify-content:center;overflow:hidden}#hrSaloon .reels img{width:72px;height:72px}
#hrSaloon .reels div.win{border-color:#ffe24a;box-shadow:0 0 18px #ffd24a;animation:hrw .25s infinite alternate}@keyframes hrw{to{transform:scale(1.08)}}#hrSaloon .row{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:4px 0}
#hrSaloon .bal{font-size:18px}#hrSaloon .won{font-size:20px;color:#7dff7a;min-height:24px}#hrSaloon .pay{font-size:11px;opacity:.75;margin-top:4px}#hrFight{position:fixed;right:96px;bottom:24px;align-items:center;display:flex;flex-direction:column;gap:12px;z-index:44;pointer-events:none}
#hrFight button{pointer-events:auto;width:96px!important;height:96px!important;min-width:0!important;max-width:96px;flex:0 0 96px;padding:0;border-radius:50%!important;font:800 17px system-ui;border:3px solid #ffd76a;background:rgba(150,20,20,.75);color:#fff;touch-action:none}#hrFight button.blk{background:rgba(30,60,140,.75)}
#hrFightBar{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:44;font:700 14px system-ui;color:#fff;text-shadow:0 1px 3px #000;width:min(520px,90vw)}#hrFightBar .b{height:12px;background:#300;border:1px solid #fff4;margin:3px 0 8px}#hrFightBar .b i{display:block;height:100%;background:#e33}
#hrBuzz{position:fixed;inset:0;pointer-events:none;z-index:38;opacity:0;transition:opacity .6s}`; document.head.appendChild(css);
  const buzzEl = document.createElement('div'); buzzEl.id = 'hrBuzz'; document.body.appendChild(buzzEl);
  let panel = null; const open = (kind, data) => { panel = { kind, data }; ui.hidden = false; H.uiOpen = kind !== 'slot'; if (H.uiOpen && document.pointerLockElement) document.exitPointerLock(); render(); };
  const close = () => { if (panel && panel.kind === 'slot') stand(); panel = null; ui.hidden = true; H.uiOpen = false; };
  S.close=()=>{if(casino.opened)casino.close();close();};S.isOpen=()=>!!panel||!!casino.opened;
  Object.assign(T.TL, { slot: 'SIT &amp; PLAY<small>SLOTS</small>', dance: `PAY DANCER<small>${PRICES.dance} PTS</small>`, bandits: `HIRE<small>GUNSLINGER ${PRICES.bandit}</small>`, dealer: 'TALK<small>DEALER</small>', drink: 'DRINK' });
  S.inside = () => { const [lx, lz] = T.toL(s, P.pos.x, P.pos.z); return lx > -17.1 && lx < -.9 && lz > -.1 && lz < 10.1 && P.pos.y < s.y0 + Y2 + 3 && P.pos.y > s.y0 - 1; }; // hotfix: the local player is in the saloon (either floor)
  function render() { if (!panel) return; let h = '<button class="x" data-a="x">✕ EXIT</button>'; const p = pts();
    if (panel.kind === 'bandits') { const n = S.bandits.length; h += `<h3>THE GUNSLINGERS' TABLE</h3><div class="bal">${p} points · ${n}/${PRICES.maxBandits} riding with you</div><div style="font-size:13px;margin:6px">They follow you (on their own horses when you ride), shoot zombies (+${PRICES.banditKill} per kill for you) and never shoot riders or horses.</div><button class="big" data-a="hire" ${p < PRICES.bandit || n >= PRICES.maxBandits ? 'disabled' : ''}>HIRE ONE · ${PRICES.bandit}</button>` + (n ? '<button data-a="fire">LET THEM GO</button>' : ''); }
    else if (panel.kind === 'dance') { h += `<h3>THE RED GARTER REVUE</h3><div class="bal">${p} points</div><div style="font-size:13px;margin:4px">Pay a dancer ${PRICES.dance} points for a can-can + feather-fan routine on the stage.</div>` + DANCERS.map((d, i) => `<button data-a="dance" data-i="${i}" ${p < PRICES.dance || S.dance ? 'disabled' : ''}>${d.name}</button>`).join(''); }
    else if (panel.kind === 'dealer') { h += `<h3>"PSST… OVER HERE"</h3><div class="bal">${p} points</div><div class="row"><span>❄ Mountain Snow — 60 s of real speed (then a crash)</span><button data-a="snow" ${p < PRICES.snow ? 'disabled' : ''}>${PRICES.snow}</button></div><div class="row"><span>🌿 Prairie Green — 90 s mellow and slow, steady aim</span><button data-a="green" ${p < PRICES.green ? 'disabled' : ''}>${PRICES.green}</button></div>`; }
    else if (panel.kind === 'slot') { const M = panel.data, r = M.res || M.show || [4, 4, 4], wl = M.winLine; h += `<h3>${themeOf(M.theme).name} · #${M.i + 1}</h3><div class="row"><span class="bal">💰 ${p}</span><span class="won">${M.msg || ''}</span></div><div class="reels">${r.map((k, i) => `<div class="${wl && wl[i] ? 'win' : ''}"><img src="${symIcon(k,M.theme)}" alt="${themeOf(M.theme).names[k]}"></div>`).join('')}</div>` +
      `<div>${SLOT.BETS.map(b => `<button data-a="bet" data-b="${b}" class="${S.bet === b ? 'on' : ''}">BET ${b}</button>`).join('')}</div><button class="big" data-a="spin" ${M.spin || p < S.bet ? 'disabled' : ''}>${M.spin ? 'SPINNING…' : 'SPIN'}</button><button data-a="spin" ${M.spin || p < S.bet ? 'disabled' : ''}>PULL LEVER</button>` +
      `<div class="pay">${themeOf(M.theme).names.map((name,i)=>'3 '+name.toUpperCase()+' '+themeOf(M.theme).triples[i]+'×').join(' · ')}<br>2 ${themeOf(M.theme).names[1]} ${themeOf(M.theme).two}× · first ${themeOf(M.theme).names[1]} ${themeOf(M.theme).first}× · mathematical return ${(themedRTP(M.theme)*100).toFixed(1)}%<br>${mobile?'Drag to look around':'SPACE spin · 1/2/3 bet · Esc stand up'}</div>`; }
    ui.innerHTML = h; }
  ui.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'x') return close(); if (a === 'hire') hire(); if (a === 'fire') { for (const B of S.bandits) dropBandit(B, true); S.bandits.length = 0; msg('The gunslingers tip their hats and ride off', 2); }
    if (a === 'dance') startDance(+b.dataset.i, true); if (a === 'snow' || a === 'green') buy(a); if (a === 'bet') { S.bet = +b.dataset.b; } if (a === 'spin') spin(); render(); });
  S.bet = 10;

  // ---- the town's E / tap hook ----
  T.onUse = o => { if (o.kind === 'bandits') { open('bandits'); return true; } if (o.kind === 'dance') { open('dance'); return true; } if (o.kind === 'dealer') { open('dealer'); return true; } if (o.kind === 'slot') { sit(S.slots.find(M => M.spot === o)); return true; } return false; };
  const casino=createCasino({scene,H,P,T,camera,mobile,msg,beforeOpen:()=>{close();endDance();endFight(false,true);}});S.casino=casino;
  const decor=createSaloonDecor({scene,T,mobile});
  // ---- slots: seated first-person view with limited free look ----
  function sit(M) { if (!M) return; S.seat = M; S.fpSave = H.fp; H.fp = true; H.seated = true; H.noGun = true; if (G()) G().holster(); const p = Lh(-15.25, Y2, M.z); P.pos.set(p.x, p.y, p.z); H.fv.set(0, 0); S.seatYaw = rot + Math.PI / 2; P.yaw = S.seatYaw; P.pitch = -.12; open('slot', M); }
  function stand() { if (!S.seat) return; const M = S.seat; S.seat = null; H.seated = false; H.noGun = false; H.fp = !!S.fpSave; const p = Lh(-14.4, Y2, M.z); P.pos.set(p.x, p.y, p.z); }
  S.sit = i => sit(S.slots[i]); S.stand = () => close();
  function spin() { const M = panel && panel.kind === 'slot' ? panel.data : S.seat; if (!M || M.spin) return false; const bet = S.bet; if (!spend(bet)) return false; S.slotsPlayed++; M.msg = ''; M.winLine = null; M.res = null; M.bet = bet; M.spin = { t: 0, stop: [1.1, 1.6, 2.1], res: null };
    ring(220, 330, .18, .12, 'square'); M.lever.rotation.x = .9; const role = H.netRole ? H.netRole() : 'solo';
    if (role === 'client' && H.zSend) { const n = ++S.req; S.pend.set(n, M); H.zSend({t:'sv',k:'slot',bet,n,machine:M.i});setTimeout(()=>{if(S.pend.has(n)){S.pend.delete(n);if(M.spin){M.spin=null;earn(M.bet);M.msg='Host timeout — stake returned';render();}}},8000); } // the host draws the reels
    else M.spin.res = themedSpin(Math.random,M.theme); return true; }
  S.spin = spin; S.setBet = b => { if (SLOT.BETS.includes(b)) S.bet = b; render(); };
  function slotTick(dt) { for (const M of S.slots) { if (M.lever.rotation.x > 0) M.lever.rotation.x = Math.max(0, M.lever.rotation.x - dt * 2.5); const sp = M.spin; if (!sp) { M.light.material.color.setHex(M.winT > 0 ? ((M.winT * 8 | 0) % 2 ? 0xffffff : 0xff3030) : 0xffd76a); M.winT = Math.max(0, (M.winT || 0) - dt); continue; } sp.t += dt;
      M.reels.forEach((r, k) => { const done = sp.res && sp.t > sp.stop[k]; if (!done) { r.userData.off = (r.userData.off + dt * (3 + k)) % 1; if (Math.random() < dt * 14) M.show = [0, 1, 2].map(() => (Math.random() * 5) | 0); } else r.userData.off = ((REEL_PHASE - sp.res[k] * .2) % 1 + 1) % 1; r.material.map.offset.x = r.userData.off; });
      if (Math.random() < dt * 12) ring((M.theme===1?420:M.theme===2?1100:700)+Math.random()*180,650,.03,.035,M.theme===1?'sine':'triangle');
      if (sp.res && sp.t > sp.stop[2] + .15) { const r = sp.res, win = themedMultiplier(r,M.theme)*M.bet; M.res = r; M.spin = null; M.show = r;
        if (win > 0) { earn(win); const m = themedMultiplier(r,M.theme); M.winLine = r[0] === r[1] && r[1] === r[2] ? [1, 1, 1] : r.map(x => x === 1 ? 1 : 0); M.msg = (m >= 60 ? '🦬 JACKPOT! ' : 'WIN ') + '+' + win; M.winT = m >= 60 ? 6 : 1.8;
          for (let i = 0; i < (m >= 60 ? 12 : 3); i++) setTimeout(() => ring((M.theme===1?392:M.theme===2?659:523) * (1 + (i % 4) * .25), 784, .12, .12, 'triangle'), i * 110); if (m >= 60) msg('JACKPOT! '+themeOf(M.theme).name+' — +' + win + ' points', 4); }
        else { M.msg = 'No luck'; ring(300, 180, .2, .07, 'sawtooth'); } S.last = { r, bet: M.bet, win }; if (panel && panel.data === M) render(); } } }
  // ---- co-op: the host draws reels for clients; saloon state rides along in each player's 'p' message ----
  const slotRequests=new Map();
  S.netIn=(m,from)=>{if(m.k==='casino')return casino.handleRequest(m,from);if(m.k!=='slot'||!H.zSendTo||!Number.isSafeInteger(m.n)||!SLOT.BETS.includes(m.bet)||!Number.isInteger(m.machine)||m.machine<0||m.machine>=3)return;const key=from+':'+m.n;let response=slotRequests.get(key);if(!response){response={t:'svr',n:m.n,r:themedSpin(Math.random,m.machine),machine:m.machine};slotRequests.set(key,response);if(slotRequests.size>256)slotRequests.delete(slotRequests.keys().next().value);}H.zSendTo(from,response);};
  S.netRes = m => { if(m.k==='casino')return casino.handleResponse(m); const M = S.pend.get(m.n); if(!M||!M.spin||!Array.isArray(m.r)||m.r.length!==3||m.r.some(v=>!Number.isInteger(v)||v<0||v>4)||m.machine!==M.i)return; S.pend.delete(m.n); M.spin.res=m.r.slice(); };
  S.netState = () => { const o = {}; if (S.bandits.length) o.bd = S.bandits.map(B => [+B.D.g.position.x.toFixed(1), +B.D.g.position.y.toFixed(2), +B.D.g.position.z.toFixed(1), +B.D.g.rotation.y.toFixed(2), B.anim === 'walk' ? 1 : B.anim === 'aim' ? 2 : B.dead ? 3 : 0, B.horse ? 1 : 0, B.look]); if (S.dance) o.dn = [S.dance.i, +S.dance.t.toFixed(1)]; if (S.buzz.snow > 0) o.bz = 1; else if (S.buzz.green > 0) o.bz = 2; if (S.fight) o.ft = [S.fight.di, S.fight.opp.D.mode === 'ko' ? 1 : 0]; return o; };
  function remoteTick(dt) { const seen = new Set(); for (const R of (H.netRemotes ? H.netRemotes() : [])) { const st = R.s; if (!st || !R.id) continue; seen.add(R.id); let E = S.remote.get(R.id); if (!E) S.remote.set(R.id, E = { list: [] });
      const bd = Array.isArray(st.bd) ? st.bd.slice(0, PRICES.maxBandits) : []; while (E.list.length > bd.length) { const B = E.list.pop(); B.D.dispose?.();ownedDolls.delete(B.D);scene.remove(B.D.g); if (B.hz) scene.remove(B.hz); }
      bd.forEach((q, i) => { let B = E.list[i]; if (!B) { const D = makeDoll({ kind: 'bandit', ...BANDIT_LOOKS[(q[7] ?? i) % 4] }); ownedDolls.add(D);scene.add(D.g); D.g.add(tagSprite(R.id)); B = { D }; E.list.push(B); }
        const g = B.D.g; g.position.lerp(tmpV.set(q[0], q[1], q[2]), Math.min(1, dt * 8)); g.rotation.y = q[3]; const mode = q[4] === 1 ? 'walk' : q[4] === 2 ? 'aim' : q[4] === 3 ? 'ko' : 'idle'; if (mode === 'ko') B.D.koT = Math.min(1, (B.D.koT || 0) + dt * 2); poseDoll(B.D, dt, q[5] ? 'sit' : mode, 3); });
      if (Array.isArray(st.dn) && !S.dance) { const D = S.dancers[st.dn[0] | 0]; if (D) D.remoteDance = 1; } }
    for (const [id, E] of S.remote) if (!seen.has(id)) { for (const B of E.list) scene.remove(B.D.g); S.remote.delete(id); } }
  const tagSprite = txt => { const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(txt), depthTest: false, transparent: true })); sp2.scale.set(.8, .2, 1); sp2.position.y = 2.15; sp2.renderOrder = 9; return sp2; };
  // ---- bandits for hire ----
  function hire() { if (S.bandits.length >= PRICES.maxBandits) { msg('Five is a posse — that is the limit', 2); return false; } if (!spend(PRICES.bandit)) return false; const look = S.bandits.length % 4, D = makeDoll({ kind: 'bandit', ...BANDIT_LOOKS[look] }); const p = Lh(-12.6, F, 6.2 + (S.bandits.length - 2) * .5);
    D.g.position.copy(p); ownedDolls.add(D);scene.add(D.g); D.g.add(tagSprite((H.me || 'P1') + "'s gun")); const B = { D, hp: 100, cd: 1 + Math.random(), look, slot: S.bandits.length, stuckT: 0, anim: 'idle', kills: 0 }; S.bandits.push(B); S.hired = (S.hired || 0) + 1;
    msg(['"Lead the way, boss."', '"I\'ve got your back."', '"Point me at the dead."'][S.bandits.length % 3], 2); ring(180, 140, .2, .1, 'sawtooth'); return B; }
  S.hire = hire;
  function dropBandit(B, quiet) { B.D.dispose?.();ownedDolls.delete(B.D);scene.remove(B.D.g); if (B.hz) scene.remove(B.hz); if (!quiet) msg('One of your gunslingers went down', 2); }
  const tmpV = new THREE.Vector3();
  function banditTick(B, dt, i) { const D = B.D, g = D.g, me = H.mounted ? H.mounted.pos : P.pos; if (B.dead) { D.koT = Math.min(1, (D.koT || 0) + dt * 2); poseDoll(D, dt, 'ko'); B.deadT += dt; return B.deadT < 6; }
    const n = S.bandits.length, back = H.mounted ? 4.5 : 2.4 + (i % 2) * .8, lat = (i - (n - 1) / 2) * 1.3; // a loose formation behind you
    const want = [me.x + Math.sin(P.yaw) * back + Math.cos(P.yaw) * lat, me.z + Math.cos(P.yaw) * back - Math.sin(P.yaw) * lat];
    const dx = want[0] - g.position.x, dz = want[1] - g.position.z, d = Math.hypot(dx, dz), far = Math.hypot(me.x - g.position.x, me.z - g.position.z);
    // a horse of their own when you ride (and they are out of town)
    const ride = !!H.mounted; if (ride && !B.hz && c.makeHorse) { B.hz = c.makeHorse(); B.hz.scale.setScalar(.95); scene.add(B.hz); } if (!ride && B.hz) { scene.remove(B.hz); B.hz = null; }
    const maxV = ride ? Math.max(6, Math.abs(H.speed) * 1.15 + 3) : Math.max(4.5, H.fv.length() * 1.2 + 1.5), v = d > .6 ? Math.min(maxV, d * 1.8) : 0;
    if (far > 45 || (B.stuckT > 4 && far > 6)) { const p = [me.x - Math.sin(P.yaw) * -3 + (i - 2) * .8, me.z - Math.cos(P.yaw) * -3]; g.position.set(p[0], c.groundAt(p[0], p[1], me.y + 1), p[1]); B.stuckT = 0; B.tp = (B.tp || 0) + 1; } // teleport to you
    else if (v > 0) { const ox = g.position.x, oz = g.position.z; let hd = Math.atan2(dx, dz); for (const tr of [0, .7, -.7, 1.4, -1.4]) { const h2 = hd + tr, sx = Math.sin(h2) * v * dt, sz = Math.cos(h2) * v * dt; if (!c.blocked(ox + sx, oz + sz, ride ? .7 : .3)) { g.position.x += sx; g.position.z += sz; hd = h2; break; } }
      const moved = Math.hypot(g.position.x - ox, g.position.z - oz); B.stuckT = moved < v * dt * .3 ? B.stuckT + dt : 0; g.rotation.y = lerpA(g.rotation.y, hd, Math.min(1, dt * 8)); g.position.y = c.groundAt(g.position.x, g.position.z, g.position.y + .5); } else B.stuckT = 0;
    // shoot the nearest zombie in range
    let tgt = null, best = B.look % 2 ? 32 : 48; const Zs = H.zombies; if (Zs) for (const o of Zs.list) { if (!o.alive) continue; const dd = Math.hypot(o.pos.x - g.position.x, o.pos.z - g.position.z); if (dd < best) { best = dd; tgt = o; } if (dd < 1.4) B.hp -= (o.K ? o.K.dmg : 10) * dt * .8; }
    B.cd -= dt; B.anim = v > .5 ? 'walk' : 'idle';
    if (tgt) { B.anim = v > 2.5 ? 'walk' : 'aim'; if (v <= 2.5) g.rotation.y = lerpA(g.rotation.y, Math.atan2(tgt.pos.x - g.position.x, tgt.pos.z - g.position.z), Math.min(1, dt * 10));
      if (B.cd <= 0) { B.cd = (B.look % 2 ? .8 : 1.3) * (.8 + Math.random() * .4); const hit = Math.random() < (best < 15 ? .85 : .6), dmg = B.look % 2 ? 45 : 85; shotFx(g.position, tgt);
        if (hit) { const role = H.netRole ? H.netRole() : 'solo'; if (role === 'client') { H.zSend && H.zSend({ t: 'zh', id: tgt.id, d: dmg, h: 0, b: 1, w: 'bandit', s: Zs.state ? ++Zs.state.shotSeq : 0 }); } else { const was = tgt.alive; Zs.damage(tgt, dmg, false, null, tmpV.set(tgt.pos.x - g.position.x, 0, tgt.pos.z - g.position.z).normalize(), 'bandit'); if (was && !tgt.alive) { B.kills++; S.banditKill(); } } } } }
    if (B.hp <= 0) { B.dead = true; B.deadT = 0; dropMsg(); }
    if (B.hz) { B.hz.position.copy(g.position); B.hz.rotation.y = g.rotation.y + Math.PI; if (c.procAnim) c.procAnim(B.hz, dt, v, false); poseDoll(D, dt, 'sit'); } else poseDoll(D, dt, B.anim, v);
    if (B.hz) g.position.y = c.groundAt(g.position.x, g.position.z, g.position.y) + 1.05;
    return true; }
  const dropMsg = () => msg('One of your gunslingers went down', 2);
  S.banditKill = () => { earn(PRICES.banditKill); S.bKills = (S.bKills || 0) + 1; };
  const lerpA = (a, b, t) => { let d = ((b - a) % TAU + TAU * 1.5) % TAU - Math.PI; return a + d * t; };
  function shotFx(p, o) { if (sfx.at && sfx.ctx) sfx.at(p, () => { sfx.tone('square', 180, 60, .09, .25); sfx.tone('sawtooth', 900, 120, .05, .12); }, .5); if (c.fx && c.fx.flash) c.fx.flash(p.x, p.y + 1.4, p.z); void o; }
  // ---- dancers ----
  function startDance(i, paid) { if (S.dance) return false; if (paid && !spend(PRICES.dance)) return false; const D = S.dancers[i]; if (!D) return false; S.dance = { i, t: 0, len: 26 }; D.mode = 'dance'; const p = Lh(-15.4, F + .4, 1.9); D.g.position.copy(p); D.baseYaw = rot + Math.PI / 2; D.g.rotation.y = D.baseYaw; S.danced = (S.danced || 0) + 1;
    close(); H.noGun = true; if (G()) G().holster(); msg(DANCERS[i].name + ' takes the stage — press E / tap EXIT to leave', 3); music(true); showExit(true); return true; }
  S.startDance = startDance;
  function endDance() { if (!S.dance) return; const D = S.dancers[S.dance.i]; D.mode = 'idle'; const p = Lh(D.home[0], F + .4, D.home[1]); D.g.position.copy(p); S.dance = null; H.noGun = false; music(false); showExit(false); }
  S.endDance = endDance;
  let mus = null; function music(on) { if (mus) { clearInterval(mus); mus = null; } if (!on || !sfx.tone || !sfx.ctx) return; const notes = [392, 523, 659, 523, 587, 494, 392, 440, 523, 659, 784, 659, 587, 523, 494, 523]; let k = 0;
    mus = setInterval(() => { const n = notes[k++ % notes.length]; sfx.tone('triangle', n, n, .16, .07); if (k % 2) sfx.tone('square', n / 4, n / 4, .1, .03); if (k % 4 === 0) sfx.tone('triangle', n * 1.26, n * 1.26, .1, .04); }, 190); }
  let exitEl = null; function showExit(on) { if (!exitEl) { exitEl = document.createElement('button'); exitEl.textContent = '✕ EXIT'; exitEl.style.cssText = 'position:fixed;right:14px;top:110px;z-index:46;font:800 18px system-ui;padding:12px 18px;border-radius:12px;border:2px solid #ffd76a;background:#4a1414;color:#fff'; exitEl.onclick = e => { e.stopPropagation(); endDance(); endFight(false, true); }; exitEl.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(exitEl); } exitEl.hidden = !on; }
  // ---- the dealer ----
  function buy(k) { if (!spend(PRICES[k])) return false; close(); const B = S.buzz; if (k === 'snow') { B.snow = 60; B.crash = 0; msg('*sniff* — your heart is pounding. EVERYTHING IS FAST.', 3); ring(1200, 300, .25, .08, 'sawtooth'); }
    else { B.green = 90; msg('*puff* … the colours are so… nice. You feel very, very calm.', 3); ring(200, 120, .6, .06, 'sine'); setTimeout(() => B.green > 0 && msg('The munchies hit. You could eat a whole horse. (Please don\'t.)', 4), 25000); } S.bought = (S.bought || 0) + 1; return true; }
  S.buy = buy;
  function buzzTick(dt) { const B = S.buzz; if (B.snow > 0) { B.snow -= dt; if (B.snow <= 0) { B.crash = 20; msg('The crash. Everything feels heavy.', 3); } } else if (B.crash > 0) B.crash -= dt; if (B.green > 0) B.green -= dt;
    const fast = B.snow > 0 ? 1.55 : 1, slow = B.green > 0 ? .7 : B.crash > 0 ? .78 : 1; H.speedMul = fast * slow; H.horseMul = (B.snow > 0 ? 1.3 : 1) * (B.green > 0 ? .8 : B.crash > 0 ? .85 : 1); H.reloadMul = B.snow > 0 ? .6 : 1; H.swayMul = B.green > 0 ? .45 : B.snow > 0 ? 1.4 : 1; H.timeFeel = B.green > 0 ? .85 : 1;
    if (B.snow > 0 && (S.hbT = (S.hbT || 0) - dt) <= 0) { S.hbT = .45; ring(70, 50, .08, .25, 'sine'); setTimeout(() => ring(60, 45, .07, .18, 'sine'), 140); }
    const on = B.snow > 0 || B.green > 0 || B.crash > 0; buzzEl.style.opacity = on ? 1 : 0; if (on) buzzEl.style.background = B.snow > 0 ? `radial-gradient(ellipse at center, transparent 45%, rgba(255,40,60,${.25 + Math.sin(H.t * 14) * .08}) 100%)` : B.green > 0 ? 'radial-gradient(ellipse at center, rgba(120,255,140,.08) 20%, rgba(170,60,220,.28) 100%)' : 'radial-gradient(ellipse at center, transparent 30%, rgba(40,40,60,.45) 100%)';
    const cv = c.canvas; if (cv && !H.drunkPass) { const f = B.green > 0 ? 'saturate(1.7) hue-rotate(-8deg)' : B.crash > 0 ? 'blur(1.2px) saturate(.6)' : ''; if (!(H.drunkK > .3) && cv.style.filter !== f) cv.style.filter = f; } }
  S.camFx = () => { const B = S.buzz; if (B.snow > 0) { camera.rotateZ((Math.random() - .5) * .006); camera.rotateX((Math.random() - .5) * .004); } if (B.green > 0) camera.rotateZ(Math.sin(H.t * .5) * .02); };
  // ---- fistfights ----
  let fightUI = null, barEl = null; const punchFlag = { p: false, b: false };
  function fightButtons(on) { if (!fightUI) { fightUI = document.createElement('div'); fightUI.id = 'hrFight'; fightUI.innerHTML = '<button class="blk" id="hrBlock">BLOCK</button><button id="hrPunch">PUNCH</button>'; document.body.appendChild(fightUI);
      const pb = fightUI.querySelector('#hrPunch'), bb = fightUI.querySelector('#hrBlock'); pb.addEventListener('pointerdown', e => { e.stopPropagation(); punchFlag.p = true; }); bb.addEventListener('pointerdown', e => { e.stopPropagation(); punchFlag.b = true; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bb.addEventListener(ev, () => { punchFlag.b = false; });
      barEl = document.createElement('div'); barEl.id = 'hrFightBar'; document.body.appendChild(barEl); }
    fightUI.style.display = on && mobile ? 'flex' : 'none'; barEl.hidden = !on; }
  const resetFight=()=>{punchFlag.p=punchFlag.b=false;},fightDown=e=>{if(!S.fight)return;if(e.button===0)punchFlag.p=true;if(e.button===2)punchFlag.b=true;},fightUp=e=>{if(e.button===2)punchFlag.b=false;};
  (window.__inputResets=window.__inputResets||[]).push(resetFight);addEventListener('mousedown',fightDown,true);addEventListener('mouseup',fightUp,true);addEventListener('blur',resetFight);

  function startFight(D, why) { if (!D || S.fight || S.seat || S.dance || H.mounted || H.dead || H.seated || H.uiOpen || D.downT > 0) return false; const B = { D }; S.fight = { opp: B, me: 100, op: 100, t: 0, cd: 1.2, wind: 0, my: 0, dodge: 0, di: S.drifters.indexOf(D) }; D.mode = 'fight'; H.noGun = true; if (G()) G().holster(); S.fpSave2 = H.fp; H.fp = true;
    msg(why || '"Hey! Watch where you\'re going, partner!" — FIGHT! (click / PUNCH, hold right-click / BLOCK, Space dodges)', 3.5); fightButtons(true); showExit(true); S.fights = (S.fights || 0) + 1; return true; }
  S.startFight = i => startFight(S.drifters[i || 0], '"You spilled my drink!" — FIGHT!');
  function endFight(won, quit) { const F2 = S.fight; if (!F2) return; S.fight = null; H.noGun = false; H.fp = !!S.fpSave2; fightButtons(false); showExit(!!S.dance); const D = F2.opp.D;
    if (won) { earn(PRICES.fightWin); msg(`Knockout! +${PRICES.fightWin} points`, 3); D.mode = 'ko'; D.koT = 0; D.downT = 6; S.fightWins = (S.fightWins || 0) + 1; for (const o of S.seated) o.cheerT = 3; }
    else if (!quit) { msg('You got knocked down… the bandit laughs', 3); H.fallD = H.fallT = 2.6; H.fallYaw = 1; D.mode = D.home[3]; D.cheerT = 2.5; S.fightLosses = (S.fightLosses || 0) + 1; } else { D.mode = D.home[3]; } }
  S.endFight = endFight;
  function fightTick(dt) { const F2 = S.fight; if (!F2) return; const B = F2.opp, g = B.D.g, me = P.pos, dx = me.x - g.position.x, dz = me.z - g.position.z, d = Math.hypot(dx, dz), dk = H.drunkK || 0; F2.t += dt;
    g.rotation.y = lerpA(g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 6)); P.yaw = lerpA(P.yaw, Math.atan2(-dx, -dz) + Math.sin(H.t * 1.3) * Math.min(.25, dk * .03), Math.min(1, dt * 3));
    if (d > 1.15) { const v = Math.min(2.6, (d - 1.05) * 3); const ox = g.position.x, oz = g.position.z; if (!c.blocked(ox + dx / d * v * dt, oz + dz / d * v * dt, .3)) { g.position.x += dx / d * v * dt; g.position.z += dz / d * v * dt; } }
    if (d > 8) return endFight(false, true);
    // me: punch / block / dodge
    const blocking = punchFlag.b || !!input.ads || !!keys.KeyQ; F2.blk = blocking; F2.my = Math.max(0, F2.my - dt); if (punchFlag.p && F2.my <= 0 && !blocking) { F2.my = .42; F2.fist = 0; const acc = clamp(.9 - dk * .06, .35, .9), hit = d < 1.7 && Math.random() < acc && B.D.mode !== 'block';
      if (hit) { F2.op -= 14 + Math.random() * 6; ring(140, 70, .08, .3, 'square'); B.D.hitT = .2; H.shake = Math.max(H.shake, .15); } else ring(500, 300, .05, .05, 'sine'); }
    punchFlag.p = false; if ((keys.Space || input.jump) && F2.dodge <= 0) { F2.dodge = 1; const sx = Math.cos(P.yaw) * (Math.random() < .5 ? 1 : -1) * 1.2, sz = -Math.sin(P.yaw) * 1.2 * 0; if (!c.blocked(me.x + sx, me.z + sz, .35)) { me.x += sx; me.z += sz; } F2.dodged = .45; } F2.dodge = Math.max(0, F2.dodge - dt); F2.dodged = Math.max(0, (F2.dodged || 0) - dt);
    // the bandit: telegraphed swings, sometimes blocks
    F2.cd -= dt; if (F2.wind > 0) { F2.wind -= dt; B.D.mode = 'punch'; B.D.pk = 1 - F2.wind / .38; if (F2.wind <= 0) { const land = d < 1.75 && !(F2.dodged > 0); if (land) { const dmg = blocking ? 3 : 11 + Math.random() * 5; F2.me -= dmg; H.shake = Math.max(H.shake, blocking ? .1 : .35); ring(blocking ? 300 : 110, 60, .1, .3, 'square'); } F2.cd = .9 + Math.random() * 1.1; } }
    else { B.D.mode = Math.random() < dt * .5 ? 'block' : B.D.mode === 'block' && Math.random() < dt * 2 ? 'fight' : B.D.mode === 'punch' ? 'fight' : B.D.mode; if (F2.cd <= 0 && d < 2) F2.wind = .38; }
    poseDoll(B.D, dt, B.D.mode === 'ko' ? 'ko' : B.D.mode); if (barEl) barEl.innerHTML = `YOU<div class="b"><i style="width:${Math.max(0, F2.me)}%;background:#3c3"></i></div>BANDIT<div class="b"><i style="width:${Math.max(0, F2.op)}%"></i></div>`;
    if (F2.op <= 0) endFight(true); else if (F2.me <= 0) endFight(false); }
  // first-person fists (after the camera moves)
  const fists = [-1, 1].map(sd => { const f = new THREE.Group(); f.add(mesh(sph(.06), mat(0xe0b08c), 0, 0, 0, 1, .85, 1.2)); f.add(mesh(cap(.045, .2), mat(0x6a2a20), 0, 0, .14, 1, 1, 1)); f.children[1].rotation.x = Math.PI / 2; f.visible = false; scene.add(f); f.userData.sd = sd; return f; });
  S.postCam = () => { S.camFx(); const F2 = S.fight; for (const f of fists) { f.visible = !!F2; if (!F2) continue; const sd = f.userData.sd, pk = sd > 0 && F2.my > 0 ? Math.sin((1 - F2.my / .42) * Math.PI) : 0, bl = F2.blk ? 1 : 0;
      tmpV.set(sd * (.2 - bl * .1), -.2 + bl * .12 + Math.sin(H.t * 5 + sd) * .01, -.42 - pk * .35); f.position.copy(tmpV.applyMatrix4(camera.matrixWorld)); f.quaternion.copy(camera.quaternion); } };
  // ---- frame ----
  let near = false;
  S.tick = dt => { if(disposed)return;const dTown = Math.min(Math.hypot(camera.position.x - s.cx, camera.position.z - s.cz), Math.hypot(P.pos.x - s.cx, P.pos.z - s.cz)); near = dTown < (mobile ? 60 : 90); for (const D of npcAll()) D.g.visible = near; dust.visible = near && dTown < 30; for (const L of lampLights) L.visible = dTown < 45; for (const M of S.slots) M.g.visible = near;
    casino.tick(dt);decor.update(H.t||0,near);slotTick(dt);buzzTick(dt);fightTick(dt);
    if(panel?.kind==='slot'&&panel.data.spin){S.slotUIT=(S.slotUIT||0)+dt;if(S.slotUIT>.1){S.slotUIT=0;render();}}
    for (let i = S.bandits.length - 1; i >= 0; i--) if (!banditTick(S.bandits[i], dt, i)) { dropBandit(S.bandits[i], true); S.bandits.splice(i, 1); }
    remoteTick(dt);
    if (S.seat) { P.yaw = S.seatYaw + clamp(((P.yaw - S.seatYaw + Math.PI * 3) % TAU) - Math.PI, -1.25, 1.25); P.pitch = clamp(P.pitch, -.7, .55); const p = Lh(-15.25, Y2, S.seat.z); P.pos.set(p.x, p.y, p.z); H.fv.set(0, 0);
      if (keys.Space && !S.spaceDown) spin(); S.spaceDown = !!keys.Space; for (const [k, b] of [['Digit1', 10], ['Digit2', 50], ['Digit3', 100]]) if (keys[k]) S.setBet(b); if (keys.Escape) close(); }
    if (S.dance) { S.dance.t += dt; const D = S.dancers[S.dance.i], p = D.g.position, dx = p.x - P.pos.x, dz = p.z - P.pos.z; P.yaw = lerpA(P.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 2)); if (S.dance.t > S.dance.len || Math.hypot(dx, dz) > 12) endDance(); else if (S.dance.t > 1 && (Math.abs(H.fv.length()) > 1.5)) endDance(); }
    if (!near) return;
    // NPC motion: seated bandits, drifters, dancers, Greta's rounds, the dealer
    for (const D of S.seated) poseDoll(D, dt, D.cheerT > 0 ? 'cheer' : 'sit'), D.cheerT = Math.max(0, (D.cheerT || 0) - dt);
    for (const D of S.drifters) { if (S.fight && S.fight.opp.D === D) continue; if (D.downT > 0) { D.downT -= dt; D.koT = Math.min(1, (D.koT || 0) + dt * 2); poseDoll(D, dt, 'ko'); if (D.downT <= 0) { D.mode = D.home[3]; D.koT = 0; const p = Lh(D.home[0], F, D.home[1]); D.g.position.copy(p); } continue; } if (D.cheerT > 0) { D.cheerT -= dt; poseDoll(D, dt, 'cheer'); continue; }
      poseDoll(D, dt, D.brawl > 0 ? 'punch' : D.home[3]); if (D.brawl > 0) { D.brawl -= dt; D.pk = (D.t * 1.6) % 1; }
      const dd = Math.hypot(P.pos.x - D.g.position.x, P.pos.z - D.g.position.z); if (dd < .75 && H.fv.length() > 1.4 && Math.abs(P.pos.y - D.g.position.y) < 1 && !H.mounted) startFight(D); }
    for (const D of S.dancers) { if (S.dance && S.dancers[S.dance.i] === D) { poseDoll(D, dt, 'dance'); continue; } poseDoll(D, dt, D.remoteDance ? 'dance' : 'idle'); D.remoteDance = 0; }
    { const D = greta, r = D.route[D.ri], tgt = Lh(r[0], F, r[1]), dx = tgt.x - D.g.position.x, dz = tgt.z - D.g.position.z, d = Math.hypot(dx, dz); if (D.wait > 0) { D.wait -= dt; poseDoll(D, dt, 'idle'); } else if (d < .2) { D.wait = 3 + Math.random() * 4; D.ri = (D.ri + 1) % D.route.length; } else { const v = 1.1; D.g.position.x += dx / d * v * dt; D.g.position.z += dz / d * v * dt; D.g.rotation.y = lerpA(D.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 6)); poseDoll(D, dt, 'walk', v); }
      gretaSpot.x = D.g.position.x; gretaSpot.z = D.g.position.z; }
    poseDoll(dealer, dt, 'lean');
    // random brawl between the two drifters (rare), dust, doors
    if ((S.brawlT = (S.brawlT ?? 120 + Math.random() * 120) - dt) <= 0) { S.brawlT = 150 + Math.random() * 200; if (!S.fight) { for (const D of S.drifters) D.brawl = 6; msg('A brawl breaks out at the bar!', 2.5); S.brawls = (S.brawls || 0) + 1; } }
    if (dust.visible) { for (let i = 0; i < DN; i++) { const q = dseed[i], t = H.t * .08 + q[3]; const lx=q[0]+Math.sin(t)*.4,lz=q[2]+Math.cos(t*.7)*.4;const v=tmpV.set(s.cx+lx*s.c+lz*s.s,s.y0+q[1]+Math.sin(t*1.3)*.2,s.cz-lx*s.s+lz*s.c); dp[i * 3] = v.x; dp[i * 3 + 1] = v.y; dp[i * 3 + 2] = v.z; } dust.geometry.attributes.position.needsUpdate = true; }
    for (const Dr of S.doors) { const hp = Dr.hinge.position, dd = Math.hypot(P.pos.x - hp.x, P.pos.z - hp.z); if (dd < 1.2 && H.fv.length() > .5) Dr.v += H.fv.length() * 4 * dt * Dr.sd; Dr.v += (-Dr.a * 40 - Dr.v * 4) * dt; Dr.a = clamp(Dr.a + Dr.v * dt, -1.4, 1.4); Dr.hinge.rotation.y = rot + Dr.a; } };
  S.math = { slotSpin, slotPay, slotMult, slotRTP, SLOT, themeOf, themedSpin, themedMultiplier, themedRTP }; S.near = () => near; S.dolls = npcAll; S.SLOT = SLOT; S.PRICES = PRICES; S.makeDoll = makeDoll; S.poseDoll = poseDoll;
  const sceneOwned=scene.children.filter(n=>!sceneBefore.has(n));
  S.dispose=()=>{if(disposed)return;for(const M of S.slots)if(M.spin){earn(M.bet);M.spin=null;}S.pend.clear();casino.dispose();decor.dispose();close();endDance();endFight(false,true);disposed=true;removeEventListener('mousedown',fightDown,true);removeEventListener('mouseup',fightUp,true);removeEventListener('blur',resetFight);const ri=window.__inputResets?.indexOf(resetFight);if(ri>=0)window.__inputResets.splice(ri,1);for(const b of S.bandits)if(b.hz)b.hz.removeFromParent();S.buzz.snow=S.buzz.green=S.buzz.crash=0;if(mus)clearInterval(mus);
    const gg=new Set(),mm=new Set(),tt=new Set(),cachedG=new Set(GEO.values()),cachedM=new Set(MAT.values());
    for(const node of sceneOwned){node.traverse(o=>{if(o.geometry&&!cachedG.has(o.geometry))gg.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(!cachedM.has(m)){mm.add(m);if(m.map)tt.add(m.map);}});node.removeFromParent();}
    for(const D of ownedDolls)D.dispose?.();ownedDolls.clear();for(const g of gg)g.dispose();for(const m of mm)m.dispose();for(const t of tt)t.dispose();for(const spot of ownSpots){const i=T.spots.indexOf(spot);if(i>=0)T.spots.splice(i,1);}T.onUse=originalTownUse;
    ui.remove();css.remove();buzzEl.remove();exitEl?.remove();fightUI?.remove();barEl?.remove();if(H.saloon===S)H.saloon=null;
  };
  return S;
}
export { makeDoll, poseDoll };

function mergeCabinetStatic(M){
 const groups=new Map(),excluded=new Set([...M.reels,M.light]);
 for(const o of M.g.children){if(!o.isMesh||excluded.has(o)||Array.isArray(o.material))continue;o.updateMatrix();const g=o.geometry.clone().applyMatrix4(o.matrix);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push({o,g});}
 const shared=new Set(GEO.values());for(const [material,list] of groups){const geometry=mergeGeometries(list.map(p=>p.g));for(const p of list)p.g.dispose();if(!geometry)continue;for(const {o} of list){M.g.remove(o);if(!shared.has(o.geometry))o.geometry.dispose();}const merged=new THREE.Mesh(geometry,material);merged.castShadow=true;merged.receiveShadow=true;M.g.add(merged);}
}
