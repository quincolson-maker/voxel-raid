// HORSE RIDER cowboy guns: a single-action six-shooter and a lever-action rifle, on foot and on horseback.
// Started from a ChatGPT draft (cowboy-guns.mjs). Kept / adapted from it: the tunable settings table, the weapon state machine
// (six-round cylinder, one-cartridge-at-a-time reload, lever cycle that must finish before the next rifle shot, fan fire),
// the spread model (walk / horseback / speed / hip / ADS / fan), the small aim-assist cone and the horseback firing arc clamp.
// Rewritten: no CDN import (uses the game's bundled three.js), no global input listeners outside Horse Rider, no per-shot
// scene.traverse raycasts (analytic ray tests against targets, horses, trees, rocks, fences and the heightfield instead),
// realistic procedural models (extruded / lathed parts, PBR blued + case-hardened steel, brass, walnut), the gun in the rider's
// hand with 2-bone arm IK, over-the-shoulder aim camera, recoil, black-powder smoke, shooting range targets, and shot sync.
import * as THREE from 'three';

export const GUN_SETTINGS = {
  revolverRounds: 6, rifleRounds: 10,
  revolverInterval: .34, fanInterval: .14, rifleInterval: .16, leverDuration: .42,
  reloadRevolver: .5, reloadRifle: .46, drawTime: .28,
  revolverRange: 135, rifleRange: 260,
  assistAngle: 4.5, assistStrength: .38,           // degrees / blend; only while aiming and only towards targets
  swayWalk: .22, swayHorse: .45, swayHorseSpeed: .12, hipSpread: 1.7, adsSpreadMultiplier: .43, fanSpread: 3.4, // degrees
  horsebackYawLimit: 181,                           // v33: a full 360 from the saddle (your own horse is never hit: the rays skip it)
  recoilRevolver: .045, recoilRifle: .06,
  // long-range single-shot buffalo rifle with a full-length scope
  sniperRounds: 1, sniperInterval: .7, reloadSniper: 2.3, sniperRange: 420, sniperVelocity: 560, // m/s: you see the flight time at 300 m
  sniperHipSpread: 2.6, sniperScopeSpread: .25, scopeFov: 8, scopeFovMobile: 10, recoilSniper: .11,
  scopeSwayFoot: .0022, scopeSwayHorse: .0052, scopeSwayHorseSpeed: .0009, scopeLookMobile: .85, scopeTouchTau: .05, scopeEyeTau: .12, // sway radians; touch-look / eye smoothing time constants (s)
  breathHold: 4, breathRecover: .22, // radians / seconds
  sniperAssistAngle: .9, sniperSticky: .35,
  // v33: Thompson-style SMG with a 100-round drum (full auto) and the Golden Buffalo rifle (huge variable zoom, sees across the map)
  tommyRounds: 100, tommyInterval: .075, reloadTommy: 2.6, tommyRange: 170, recoilTommy: .011, tommyHipSpread: 2.3,
  goldRounds: 1, goldInterval: .7, reloadGold: 2, goldRange: 3200, goldVelocity: 900, goldFovMax: 8, goldFovMin: .22, recoilGold: .1,
  // upgrade tiers (index 0 = stock, 1 bronze, 2 silver, 3 gold): damage, magazine, reload time, time between shots
  tierDmg: [1, 1.25, 1.5, 2], tierMag: [1, 1.25, 1.5, 2], tierReload: [1, .85, .7, .55], tierRate: [1, .9, .8, .7],
};
export const PRICE = { tommy: 1500, gold: 3000 };
export const UP_COST = { revolver: [300, 800, 1800], rifle: [400, 1000, 2200], sniper: [500, 1200, 2600], tommy: [600, 1500, 3200], gold: [800, 2000, 4000] };
export const SCOPED = w => w === 'sniper' || w === 'gold';
export const WNAME = { revolver: 'SIX-SHOOTER', rifle: 'LEVER RIFLE', sniper: 'BUFFALO RIFLE', tommy: 'TOMMY GUN', gold: 'GOLDEN BUFFALO' };
export const WCODE = { revolver: 1, rifle: 2, sniper: 3, tommy: 4, gold: 5 }, WBY = ['', 'revolver', 'rifle', 'sniper', 'tommy', 'gold'];
const S = GUN_SETTINGS, D2R = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Vector3();

// ---------------- procedural textures + materials ----------------
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
function rng(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const walnut = canvasTex(256, 256, (x, w, h) => { const r = rng(5); x.fillStyle = '#4a2814'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const y0 = r() * h, a = 20 + r() * 40, l = 18 + r() * 30; x.strokeStyle = `hsla(${a * .6 + 10},${55 + r() * 20}%,${l}%,${.18 + r() * .3})`; x.lineWidth = .6 + r() * 2.2; x.beginPath(); x.moveTo(0, y0);
      for (let k = 0; k <= 8; k++) x.lineTo(k * w / 8, y0 + Math.sin(k * .9 + i) * (3 + r() * 6)); x.stroke(); }
    for (let i = 0; i < 6; i++) { const cx = r() * w, cy = r() * h; for (let k = 8; k > 0; k--) { x.strokeStyle = `rgba(30,14,6,${.08})`; x.beginPath(); x.ellipse(cx, cy, k * 5, k * 2, 0, 0, 6.28); x.stroke(); } } });
  const caseH = canvasTex(256, 256, (x, w, h) => { const r = rng(9); x.fillStyle = '#5b5550'; x.fillRect(0, 0, w, h);
    const cols = ['#2f4a7a', '#6a3f7a', '#a8822f', '#3a6a8a', '#7a5a3a', '#cfd4d8']; for (let i = 0; i < 90; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const c = cols[(r() * cols.length) | 0];
      g.addColorStop(0, c + 'aa'); g.addColorStop(1, c + '00'); x.save(); x.translate(r() * w, r() * h); x.scale(10 + r() * 40, 6 + r() * 24); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 6.28); x.fill(); x.restore(); } });
  const label = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#b8342a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f1e2b8'; x.fillRect(0, 18, w, 28); x.fillStyle = '#2c3d6a'; x.font = 'bold 22px Georgia'; x.textAlign = 'center';
    for (let i = 0; i < 2; i++) x.fillText('PRAIRIE BEANS', w * (i + .5) / 2, 40); x.fillStyle = '#e8c35a'; x.fillRect(0, 12, w, 3); x.fillRect(0, 49, w, 3); });
  const bull = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#c9b48a'; x.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(90,60,30,${.15 + r() * .2})`; x.beginPath(); const y = r() * h; x.moveTo(0, y); x.lineTo(w, y + (r() - .5) * 8); x.stroke(); }
    for (const [rr, c] of [[.96, '#f2ead6'], [.78, '#1b1b1b'], [.6, '#f2ead6'], [.42, '#1b1b1b'], [.24, '#f2ead6'], [.1, '#b3261e']]) { x.fillStyle = c; x.beginPath(); x.arc(w / 2, h / 2, rr * w / 2, 0, 6.28); x.fill(); } });
  const hole = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(.35, 'rgba(25,18,10,.95)'); g.addColorStop(.6, 'rgba(70,50,30,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const flash = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.25, 'rgba(255,200,90,.9)'); g.addColorStop(.6, 'rgba(255,120,30,.35)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,220,150,.8)'; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); x.stroke(); } });
  const P = o => new THREE.MeshPhysicalMaterial(o);
  MATS = { blued: P({ color: 0x23272e, metalness: 1, roughness: .27, clearcoat: .5, clearcoatRoughness: .2 }), caseH: P({ color: 0xffffff, map: caseH, metalness: 1, roughness: .3, clearcoat: .4 }),
    brass: P({ color: 0xc9a050, metalness: 1, roughness: .26 }), walnut: P({ color: 0xd8b8a0, map: walnut, roughness: .42, clearcoat: .45, clearcoatRoughness: .3 }), dark: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    lead: new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: .6, roughness: .5 }), tin: P({ color: 0xd8dadc, metalness: 1, roughness: .22 }), label: new THREE.MeshStandardMaterial({ map: label, roughness: .55, metalness: .2 }),
    board: new THREE.MeshStandardMaterial({ map: bull, roughness: .85 }), wood: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: .9 }), hole: new THREE.MeshBasicMaterial({ map: hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    splash: new THREE.MeshBasicMaterial({ color: 0x55585c, transparent: true, opacity: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    steel: P({ color: 0xe9e5da, roughness: .55, metalness: .25 }), chain: new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: .8, roughness: .5 }),
    flash: new THREE.MeshBasicMaterial({ map: flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }),
    glass: [0x2e6b3c, 0x7a4a16, 0xa8c8c0].map(c => P({ color: c, roughness: .06, metalness: 0, transparent: true, opacity: .62, clearcoat: 1, envMapIntensity: 1.6 })) };
  return MATS;
}

// ---------------- models (metres; origin = where the hand grips, muzzle along -Z, +Y up) ----------------
// 2D profiles: x = forward, y = up; extruded across the gun (X) and turned so +x points down the barrel (-Z)
function prof(pts, holes = []) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); for (const h of holes) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1])))); return s; }
function ext(shape, thick, bev = .0015, curve = 10) { const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: curve }); g.translate(0, 0, -thick / 2); g.rotateY(Math.PI / 2); return g; }
function tube(r, len, seg = 20, r2 = r) { const g = new THREE.CylinderGeometry(r2, r, len, seg); g.rotateX(-Math.PI / 2); return g; } // along -Z, centred
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const arc = (cx, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

export function buildRevolver() {
  const M = mats(), g = new THREE.Group(); g.name = 'SingleActionRevolver'; const BY = .066; // bore height above the hand
  // frame (case hardened) with the cylinder window, recoil shield and grip straps
  g.add(mesh(ext(prof([[-.036, .043], [.05, .043], [.05, .089], [.03, .092], [-.024, .092], [-.032, .088], [-.036, .07]], [[[-.021, .047], [.031, .047], [.031, .085], [-.021, .085]]]), .023, .0012), M.caseH));
  g.add(mesh(ext(prof([[-.036, .046], [-.012, .046], [-.008, .03], [-.016, -.01], [-.028, -.045], [-.034, -.056], [-.064, -.058], [-.06, -.03], [-.052, 0], [-.044, .024], [-.04, .04]], [[[-.03, .036], [-.018, .036], [-.024, -.04], [-.054, -.046], [-.046, -.0], [-.038, .026]]]), .014, .001), M.blued));
  // walnut one-piece grip, plow handle
  g.add(mesh(ext(prof([[-.032, .036], [-.017, .035], [-.02, .012], [-.026, -.02], [-.031, -.046], [-.035, -.055], [-.062, -.056], [-.057, -.03], [-.05, -.005], [-.043, .02], [-.038, .034]]), .03, .004, 14), M.walnut));
  // cylinder: fluted, six chambers (holes show at the front face), brass cartridge rims at the back
  const cs = new THREE.Shape(); cs.absarc(0, 0, .0195, 0, Math.PI * 2, false); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, h = new THREE.Path(); h.absarc(Math.cos(a) * .0118, Math.sin(a) * .0118, .0052, 0, Math.PI * 2, true); cs.holes.push(h); }
  const cylG = new THREE.ExtrudeGeometry(cs, { depth: .041, bevelEnabled: true, bevelThickness: .0012, bevelSize: .0012, bevelSegments: 2, curveSegments: 18 }); cylG.translate(0, 0, -.0205);
  const cyl = new THREE.Group(); cyl.position.set(0, BY, -.005); cyl.add(mesh(cylG, M.blued));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; cyl.add(mesh(tube(.0043, .036, 10), M.brass, Math.cos(a) * .0118, Math.sin(a) * .0118, .002)); cyl.add(mesh(tube(.0024, .004, 8), M.lead, Math.cos(a) * .0118, Math.sin(a) * .0118, -.0185));
    cyl.add(mesh(new THREE.BoxGeometry(.003, .004, .03), M.dark, Math.cos(a + Math.PI / 6) * .0193, Math.sin(a + Math.PI / 6) * .0193, 0)).rotation.z = a + Math.PI / 6; } // flutes
  g.add(cyl);
  // barrel (5.5"), muzzle crown + bore, ejector rod housing, base pin, front sight blade
  g.add(mesh(tube(.0074, .142, 24), M.blued, 0, BY, -.121)); g.add(mesh(tube(.0078, .006, 24), M.blued, 0, BY, -.05));
  g.add(mesh(new THREE.CircleGeometry(.0044, 16), M.dark, 0, BY, -.1925)).rotation.y = Math.PI;
  g.add(mesh(tube(.0042, .1, 12), M.blued, .0046, BY - .0122, -.1)); g.add(mesh(tube(.0028, .012, 10), M.caseH, .0046, BY - .0122, -.152)); g.add(mesh(new THREE.BoxGeometry(.004, .003, .012), M.blued, .0078, BY - .0122, -.14));
  g.add(mesh(tube(.0025, .012, 10), M.blued, 0, BY - .0125, -.057));
  g.add(mesh(ext(prof([[.18, BY + .006], [.19, BY + .006], [.19, BY + .0125], [.184, BY + .0125]]), .0022, 0), M.blued));
  // hammer (pivot so it can be cocked), trigger, brass trigger guard, screws
  const ham = new THREE.Group(); ham.position.set(0, .066, .026);
  ham.add(mesh(ext(prof([[-.004, -.012], [.006, -.012], [.004, .024], [-.004, .032], [-.022, .036], [-.026, .031], [-.012, .024], [-.006, .006]]), .0075, .0008), M.caseH)); g.add(ham);
  const trig = mesh(ext(prof([[-.006, .042], [-.002, .042], [-.005, .028], [-.012, .018], [-.014, .021], [-.009, .03]]), .005, .0006), M.blued); g.add(trig);
  const tg = new THREE.TorusGeometry(.0165, .0026, 8, 20, Math.PI * 1.15); tg.rotateY(Math.PI / 2); g.add(mesh(tg, M.brass, 0, .03, .008)).rotation.x = Math.PI * .92;
  for (const [x, y] of [[-.012, .07], [.02, .052], [-.03, .08]]) g.add(mesh(new THREE.CylinderGeometry(.0022, .0022, .0255, 10).rotateZ(Math.PI / 2), M.blued, 0, y, x));
  g.add(mesh(new THREE.BoxGeometry(.003, .016, .02), M.caseH, .0125, BY - .002, .021)); // loading gate (right side)
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, muzzle: new THREE.Vector3(0, BY, -.195), hammer: ham, cylinder: cyl, kind: 'revolver' };
}
export function buildRifle() {
  const M = mats(), g = new THREE.Group(); g.name = 'LeverActionRifle'; const BY = .043;
  // brass receiver ("yellow boy"), side plates, loading gate, blued octagon barrel + magazine tube, bands, sights
  g.add(mesh(ext(prof([[-.012, -.022], [.18, -.022], [.2, -.008], [.2, .03], [.195, .052], [.17, .057], [.02, .057], [-.004, .05], [-.012, .03]]), .036, .0018, 12), M.brass));
  g.add(mesh(ext(prof([[.03, -.01], [.15, -.01], [.15, .04], [.03, .04]]), .0385, .0006), M.brass));
  g.add(mesh(new THREE.BoxGeometry(.0024, .016, .034), M.blued, .0193, -.002, -.14));
  const oct = tube(.0108, .56, 8); oct.rotateZ(Math.PI / 8); g.add(mesh(oct, M.blued, 0, BY, -.48));
  g.add(mesh(new THREE.CircleGeometry(.0058, 16), M.dark, 0, BY, -.761)).rotation.y = Math.PI;
  g.add(mesh(tube(.0088, .51, 18), M.blued, 0, .017, -.455)); g.add(mesh(tube(.0094, .014, 18), M.blued, 0, .017, -.705));
  for (const z of [-.44, -.69]) g.add(mesh(new THREE.BoxGeometry(.026, .05, .012), M.blued, 0, .03, z));
  g.add(mesh(new THREE.BoxGeometry(.003, .01, .012), M.brass, 0, BY + .015, -.745)); // front blade
  g.add(mesh(ext(prof([[.34, BY + .009], [.37, BY + .009], [.37, BY + .02], [.364, BY + .026], [.355, BY + .016], [.346, BY + .016], [.338, BY + .026], [.334, BY + .02]]), .02, 0), M.blued)); // buckhorn rear
  // walnut forend + buttstock with a crescent butt plate
  g.add(mesh(ext(prof([[.2, -.004], [.43, -.004], [.44, .008], [.44, .034], [.2, .034]]), .04, .005, 8), M.walnut));
  g.add(mesh(ext(prof([[-.008, .05], [-.004, .028], [-.012, -.012], [-.06, -.026], [-.12, -.036], [-.25, -.068], [-.37, -.098], [-.385, -.092], [-.38, -.04], [-.385, .0], [-.378, .03], [-.36, .034], [-.2, .036], [-.06, .044]]), .04, .006, 14), M.walnut));
  g.add(mesh(ext(prof([[-.372, -.1], [-.388, -.094], [-.384, -.04], [-.39, .0], [-.382, .036], [-.368, .036], [-.374, .0], [-.37, -.04], [-.375, -.09]]), .042, .001), M.blued));
  // lever (pivots at the front of the receiver), hammer, trigger
  const lever = new THREE.Group(); lever.position.set(0, -.024, -.16);
  lever.add(mesh(ext(prof([[.0, .006], [.0, -.006], [-.13, -.008], [-.165, -.018], [-.19, -.04], [-.186, -.064], [-.16, -.072], [-.1, -.064], [-.075, -.04], [-.07, -.01], [-.04, -.004]],
    [[[-.084, -.014], [-.1, -.052], [-.155, -.06], [-.175, -.05], [-.175, -.03], [-.155, -.016]]]), .012, .001), M.blued));
  g.add(lever);
  const ham = new THREE.Group(); ham.position.set(0, .045, .004); ham.add(mesh(ext(prof([[0, -.01], [.008, -.01], [.004, .016], [-.006, .028], [-.024, .03], [-.026, .024], [-.01, .016]]), .009, .0008), M.caseH)); g.add(ham);
  g.add(mesh(ext(prof([[.004, -.022], [.008, -.022], [.002, -.04], [-.006, -.046], [-.004, -.036]]), .005, .0005), M.blued));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, muzzle: new THREE.Vector3(0, BY, -.762), lever, hammer: ham, kind: 'rifle' };
}

// Long-range single-shot "buffalo rifle" in the style of the 1870s falling-block rifles (Sharps 1874 family): heavy 30" octagon
// barrel, case-hardened receiver + side hammer + lock plate, falling breech block worked by the trigger-guard lever, double set
// triggers, walnut forend with an ebony schnabel tip, straight-wrist buttstock with a crescent butt plate, and a full-length
// brass tube scope in two mounts (rear mount with windage / elevation knobs). Original procedural model — no outside assets.
export function buildSharps() {
  const M = mats(), g = new THREE.Group(); g.name = 'BuffaloRifle'; const BY = .04, SY = .089; // bore / scope axis above the hand
  if (!M.ebony) { M.ebony = new THREE.MeshPhysicalMaterial({ color: 0x15100c, roughness: .32, clearcoat: .6, clearcoatRoughness: .25 });
    M.lens = new THREE.MeshPhysicalMaterial({ color: 0x1c2c3a, roughness: .04, metalness: .35, clearcoat: 1, envMapIntensity: 2 });
    const ct = M.caseH.map.clone(); ct.repeat.set(4, 4); ct.needsUpdate = true; M.caseS = M.caseH.clone(); M.caseS.map = ct; // case colours at the scale of a small receiver
    const wt = M.walnut.map.clone(); wt.repeat.set(2.2, 3.5); wt.needsUpdate = true; M.walnutS = M.walnut.clone(); M.walnutS.map = wt; }
  // receiver (case-hardened colours) + lock plates both sides
  g.add(mesh(ext(prof([[-.016, -.03], [.112, -.03], [.12, -.018], [.12, .058], [.108, .065], [.004, .065], [-.012, .057], [-.02, .03], [-.019, 0]]), .034, .0016, 10), M.caseS));
  for (const s of [1, -1]) { const lp = mesh(ext(prof([[-.1, .012], [-.02, .004], [.0, .01], [.0, .048], [-.02, .054], [-.085, .046], [-.11, .03]]), .004, .0008, 8), M.caseS); lp.position.x = s * .0175; g.add(lp); }
  // falling breech block (moves down with the lever) and the side hammer
  const block = new THREE.Group(); block.add(mesh(new THREE.BoxGeometry(.022, .034, .028), M.blued, 0, .046, -.03)); g.add(block);
  const ham = new THREE.Group(); ham.position.set(.021, .04, .002);
  ham.add(mesh(ext(prof([[-.006, -.012], [.008, -.012], [.006, .016], [-.004, .03], [-.026, .034], [-.03, .028], [-.014, .02], [-.008, .004]]), .007, .0008), M.caseS)); g.add(ham);
  // heavy octagon barrel (slight taper), bore, globe front sight, barrel key escutcheons, under-rib
  const oct = tube(.0158, .76, 8, .0142); oct.rotateZ(Math.PI / 8); g.add(mesh(oct, M.blued, 0, BY, -.498));
  g.add(mesh(new THREE.CircleGeometry(.0062, 16), M.dark, 0, BY, -.8795)).rotation.y = Math.PI;
  g.add(mesh(tube(.0055, .022, 12), M.blued, 0, BY + .021, -.855)); g.add(mesh(new THREE.BoxGeometry(.006, .006, .02), M.blued, 0, BY + .0155, -.855));
  g.add(mesh(tube(.0035, .3, 8), M.blued, 0, BY - .02, -.27));
  // walnut forend with an ebony schnabel tip, brass key escutcheons
  g.add(mesh(ext(prof([[.12, -.01], [.4, -.006], [.41, .004], [.41, .036], [.12, .036]]), .036, .005, 8), M.walnutS));
  g.add(mesh(ext(prof([[.41, -.006], [.425, -.004], [.434, .01], [.432, .036], [.41, .036]]), .0355, .004, 8), M.ebony));
  for (const s of [1, -1]) g.add(mesh(new THREE.CylinderGeometry(.006, .006, .002, 12).rotateZ(Math.PI / 2), M.brass, s * .0195, .016, -.3));
  // straight-wrist buttstock, crescent butt plate, sling swivels
  g.add(mesh(ext(prof([[-.012, .058], [-.018, .0], [-.026, -.024], [-.07, -.02], [-.12, -.03], [-.2, -.062], [-.3, -.092], [-.398, -.112], [-.384, -.045], [-.398, .022], [-.37, .028], [-.24, .03], [-.12, .036], [-.06, .046], [-.03, .056]]), .042, .006, 14), M.walnutS));
  g.add(mesh(ext(prof([[-.41, -.118], [-.396, -.045], [-.41, .026], [-.398, .022], [-.384, -.045], [-.398, -.112]]), .044, .001, 12), M.caseS));
  for (const [z, y] of [[-.33, -.006], [.25, -.078]]) { const t = new THREE.TorusGeometry(.009, .0018, 6, 14); t.rotateY(Math.PI / 2); g.add(mesh(t, M.blued, 0, y - .008, z)); }
  // trigger-guard lever (pivots at the front of the receiver; swings down to drop the block) + double set triggers
  const lever = new THREE.Group(); lever.position.set(0, -.028, -.1);
  lever.add(mesh(new THREE.BoxGeometry(.008, .006, .1), M.caseH, 0, -.004, .05));
  const bow = new THREE.TorusGeometry(.028, .0034, 6, 16, Math.PI); bow.rotateY(Math.PI / 2); const bw = mesh(bow, M.caseH, 0, -.004, .05); bw.rotation.x = Math.PI; lever.add(bw);
  const loop = new THREE.TorusGeometry(.02, .0042, 6, 18); loop.rotateY(Math.PI / 2); lever.add(mesh(loop, M.caseH, 0, -.03, .125));
  lever.add(mesh(new THREE.BoxGeometry(.007, .006, .05), M.caseH, 0, -.006, .14)); g.add(lever);
  for (const z of [.03, .046]) g.add(mesh(ext(prof([[-.003, -.028], [.002, -.028], [-.002, -.046], [-.008, -.05], [-.006, -.04]]), .004, .0004), M.blued, 0, 0, z));
  // full-length brass tube scope: eyepiece bell, objective, bands, rear mount with knobs, front mount on the barrel
  g.add(mesh(tube(.0095, .76, 20), M.brass, 0, SY, -.33));
  const ep = new THREE.LatheGeometry([[.0095, 0], [.0125, .012], [.0138, .04], [.0138, .055], [.0128, .058]].map(p => new THREE.Vector2(p[0], p[1])), 20); ep.rotateX(Math.PI / 2); g.add(mesh(ep, M.brass, 0, SY, .05));
  g.add(mesh(new THREE.CircleGeometry(.0112, 18), M.lens, 0, SY, .107));
  g.add(mesh(tube(.0118, .03, 20, .0122), M.brass, 0, SY, -.722)); const fl = mesh(new THREE.CircleGeometry(.0106, 18), M.lens, 0, SY, -.7375); fl.rotation.y = Math.PI; g.add(fl);
  for (const z of [.0, -.16, -.48, -.69]) g.add(mesh(tube(.0104, .005, 20), M.brass, 0, SY, z));
  const mount = (z, by, h, knobs) => { g.add(mesh(new THREE.BoxGeometry(.018, .008, .034), M.blued, 0, by + .004, z)); g.add(mesh(new THREE.BoxGeometry(.008, h, .012), M.blued, 0, by + .008 + h / 2, z));
    const ring = new THREE.TorusGeometry(.0112, .0026, 6, 18); g.add(mesh(ring, M.blued, 0, SY, z));
    if (knobs) { const kn = new THREE.CylinderGeometry(.0042, .0042, .008, 12); g.add(mesh(kn, M.brass, 0, SY - .021, z)); g.add(mesh(kn.clone().rotateZ(Math.PI / 2), M.brass, .016, SY - .016, z)); } };
  mount(-.035, .061, SY - .061 - .02, true); mount(-.58, BY + .0145, SY - BY - .0145 - .02, false);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, muzzle: new THREE.Vector3(0, BY, -.88), lever, block, hammer: ham, kind: 'sniper' };
}

// v33: Thompson-style submachine gun (original procedural model): finned barrel + Cutts-style compensator, flat-top receiver,
// walnut fore grip / pistol grip / stock, 100-round drum
export function buildTommy() {
  const M = mats(), g = new THREE.Group(); g.name = 'TommyGun'; const BY = .045;
  g.add(mesh(new THREE.BoxGeometry(.038, .055, .27), M.blued, 0, .03, -.075)); // receiver
  g.add(mesh(new THREE.BoxGeometry(.03, .012, .2), M.blued, 0, .062, -.08)); // top rib
  const bolt = mesh(new THREE.SphereGeometry(.009, 10, 8), M.blued, 0, .072, -.02); g.add(bolt); // cocking knob on top
  g.add(mesh(tube(.0105, .3, 14), M.blued, 0, BY, -.36));
  for (let i = 0; i < 12; i++) g.add(mesh(tube(.0175, .005, 14), M.blued, 0, BY, -.225 - i * .011)); // cooling fins
  g.add(mesh(tube(.0145, .055, 14), M.blued, 0, BY, -.535)); g.add(mesh(new THREE.BoxGeometry(.006, .006, .03), M.dark, 0, BY + .014, -.54)); // compensator + its ports
  g.add(mesh(new THREE.CircleGeometry(.006, 12), M.dark, 0, BY, -.5635)).rotation.y = Math.PI;
  g.add(mesh(new THREE.BoxGeometry(.004, .016, .006), M.blued, 0, .074, .03)); // rear sight
  const pg = mesh(new THREE.BoxGeometry(.028, .085, .034), M.walnut, 0, -.04, .02); pg.rotation.x = -.25; g.add(pg); // pistol grip
  const fg = mesh(new THREE.BoxGeometry(.026, .08, .03), M.walnut, 0, -.035, -.25); fg.rotation.x = .12; g.add(fg); // vertical fore grip
  for (const z of [-.25]) g.add(mesh(new THREE.BoxGeometry(.03, .008, .036), M.blued, 0, .0, z));
  const tg = new THREE.TorusGeometry(.016, .003, 6, 14, Math.PI); tg.rotateY(Math.PI / 2); const tgm = mesh(tg, M.blued, 0, -.0, -.03); tgm.rotation.x = Math.PI; g.add(tgm); // trigger guard
  g.add(mesh(ext(prof([[-.06, .055], [-.06, -.0], [-.1, -.012], [-.33, -.06], [-.34, -.06], [-.345, .04], [-.33, .05], [-.12, .05]]), .036, .003, 10), M.walnut)); // stock
  const drum = new THREE.Group(); drum.position.set(0, -.045, -.14); const dg = new THREE.CylinderGeometry(.088, .088, .05, 28); dg.rotateZ(Math.PI / 2); drum.add(mesh(dg, M.blued));
  const dc = new THREE.CylinderGeometry(.03, .03, .056, 18); dc.rotateZ(Math.PI / 2); drum.add(mesh(dc, M.brass)); const rim = new THREE.TorusGeometry(.086, .004, 6, 28); rim.rotateY(Math.PI / 2); for (const x of [.025, -.025]) drum.add(mesh(rim.clone(), M.blued, x, 0, 0)); g.add(drum);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, muzzle: new THREE.Vector3(0, BY, -.565), drum, bolt, kind: 'tommy' };
}
// v33: the Golden Buffalo: the buffalo rifle in polished gold with ivory-white stock furniture kept walnut
export function buildGold() { const m = buildSharps(), gold = new THREE.MeshPhysicalMaterial({ color: 0xffc23a, metalness: 1, roughness: .2, clearcoat: .6, clearcoatRoughness: .15, envMapIntensity: 1.6 }), M = mats();
  m.group.traverse(o => { if (o.isMesh && (o.material === M.blued || o.material === M.caseS || o.material === M.caseH || o.material === M.brass)) o.material = gold; }); m.group.name = 'GoldenBuffalo'; m.kind = 'gold'; return m; }

// ---------------- shooting range: bottles on a rail, tin cans on a stump, bullseye boards ----------------
function lathe(pts, seg = 16) { return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); }
function buildRange(scene, hAt, R, obst) {
  const M = mats(), T = [], grp = new THREE.Group(); grp.name = 'ShootingRange'; scene.add(grp);
  const post = (x, z, h, r = .07) => { const m = mesh(new THREE.CylinderGeometry(r * .9, r, h, 8), M.wood, x, hAt(x, z) + h / 2 - .05, z); m.receiveShadow = true; grp.add(m); obst.push([x, z, r + .15, h]); return m; };
  // bottle rail 12 m out
  const bx = R.x - 12, bz = R.z, y0 = hAt(bx, bz); post(bx, bz - 1.6, 1.15); post(bx, bz + 1.6, 1.15);
  const rail = mesh(new THREE.BoxGeometry(.12, .07, 3.5), M.wood, bx, y0 + 1.06, bz); rail.receiveShadow = true; grp.add(rail);
  const bottleG = lathe([[0, 0], [.034, 0], [.036, .01], [.036, .16], [.03, .19], [.013, .215], [.012, .26], [.015, .265], [.011, .27], [0, .27]], 14);
  for (let i = 0; i < 6; i++) { const z = bz - 1.25 + i * .5, m = mesh(bottleG, M.glass[i % 3], bx, y0 + 1.095, z); grp.add(m); T.push({ kind: 'bottle', mesh: m, home: m.position.clone(), c: new THREE.Vector3(bx, y0 + 1.095 + .12, z), r: .055, alive: true, t: 0, col: M.glass[i % 3].color.getHex() }); }
  // tin cans on a stump 20 m out
  const cx = R.x - 20, cz = R.z + 2.5, y1 = hAt(cx, cz), stump = mesh(new THREE.CylinderGeometry(.42, .5, .55, 12), M.wood, cx, y1 + .27, cz); grp.add(stump); obst.push([cx, cz, .6, .55]);
  const canG = new THREE.CylinderGeometry(.034, .034, .12, 18), canTop = new THREE.CylinderGeometry(.035, .035, .006, 18);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .4, x = cx + Math.cos(a) * .2, z = cz + Math.sin(a) * .2, g = new THREE.Group(); g.position.set(x, y1 + .55 + .06, z);
    g.add(mesh(canG, M.label)); g.add(mesh(canTop, M.tin, 0, .061, 0)); g.add(mesh(canTop, M.tin, 0, -.061, 0)); grp.add(g);
    T.push({ kind: 'can', mesh: g, home: g.position.clone(), c: g.position, r: .055, alive: true, t: 0, v: new THREE.Vector3(), w: new THREE.Vector3(), fly: false }); }
  // three bullseye boards facing the shooting line (30 / 42 / 58 m)
  for (const [d, dz, s] of [[30, -3, .55], [42, 2.5, .6], [58, -1, .7]]) { const x = R.x - d, z = R.z + dz, y = hAt(x, z); post(x + .06, z - s * .7, 1.3 + s, .05); post(x + .06, z + s * .7, 1.3 + s, .05);
    const disc = new THREE.CylinderGeometry(s, s, .05, 32); disc.rotateZ(Math.PI / 2); const b = new THREE.Mesh(disc, [M.wood, M.board, M.wood]); b.position.set(x, y + 1.1 + s, z); b.castShadow = b.receiveShadow = true; grp.add(b);
    T.push({ kind: 'board', mesh: b, c: b.position, n: new THREE.Vector3(1, 0, 0), r: s, alive: true, holes: [], hi: 0 }); }
  // long-range painted steel gongs (150-300 m) hung on chains from timber frames, raised so the hills never hide them from the line
  const E = { x: R.x - 1, z: R.z }; E.y = hAt(E.x, E.z) + 1.6; const [lx, lz] = R.lane || [-1, 0], nx = -lx, nz = -lz, th = Math.atan2(-nz, nx), px = -nz, pz = nx; // the lane runs off south-west where the ground stays in view
  for (const [d, off, r] of [[150, -4, .45], [200, 5, .5], [245, -6, .55], [300, 3, .65]]) { const x = E.x + lx * d + px * off, z = E.z + lz * d + pz * off, g0 = hAt(x, z); let need = g0 + 1.2 + r;
    for (let s = .03; s < .97; s += .01) { const gx = E.x + (x - E.x) * s, gz = E.z + (z - E.z) * s, gy = hAt(gx, gz) + .35; need = Math.max(need, E.y + (gy - E.y) / s); }
    const cy = Math.min(need, g0 + 9), top = cy + r + .55, w2 = r + .5; post(x - px * w2, z - pz * w2, top - g0 + .05, .07); post(x + px * w2, z + pz * w2, top - g0 + .05, .07);
    const bar = mesh(new THREE.BoxGeometry(.12, .12, r * 2 + 1.2), M.wood, x, top, z); bar.rotation.y = th; grp.add(bar);
    const piv = new THREE.Group(); piv.position.set(x, top - .06, z); piv.rotation.y = th; grp.add(piv); const L = top - .06 - cy;
    for (const s of [-1, 1]) piv.add(mesh(new THREE.CylinderGeometry(.008, .008, L - r * .7, 4), M.chain, 0, -(L - r * .7) / 2, s * r * .55));
    const pg = new THREE.CylinderGeometry(r, r, .03, 28); pg.rotateZ(Math.PI / 2); const plate = mesh(pg, M.steel, 0, -L, 0); piv.add(plate);
    T.push({ kind: 'gong', mesh: piv, plate, c: new THREE.Vector3(x, cy, z), n: new THREE.Vector3(nx, 0, nz), r, d, alive: true, holes: [], hi: 0, sw: 0, sv: 0 }); }
  // a small painted sign at the shooting line
  const sign = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#6a4a2a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f0e0b8'; x.font = 'bold 34px Georgia'; x.textAlign = 'center'; x.fillText('SHOOTING', w / 2, 42); x.fillText('RANGE', w / 2, 82); });
  const sp = mesh(new THREE.PlaneGeometry(1, .38), new THREE.MeshStandardMaterial({ map: sign, roughness: .9 }), R.x - .6, hAt(R.x - .6, R.z - 4) + 1.35, R.z - 4); sp.rotation.y = -Math.PI / 2; grp.add(sp); post(R.x - .55, R.z - 4, 1.2, .05);
  return { T, grp };
}

// ---------------- analytic ray tests ----------------
function raySphere(o, d, c, r) { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; }
function rayCyl(o, d, x, z, r, y0, y1) { const ox = o.x - x, oz = o.z - z, a = d.x * d.x + d.z * d.z; if (a < 1e-8) return -1; const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, h = b * b - a * c; if (h < 0) return -1;
  const t = (-b - Math.sqrt(h)) / a; if (t <= 0) return -1; const y = o.y + d.y * t; return y >= y0 && y <= y1 ? t : -1; }
function raySeg(o, d, ax, az, bx, bz, y0, y1) { const ex = bx - ax, ez = bz - az, den = d.x * ez - d.z * ex; if (Math.abs(den) < 1e-8) return -1; const t = ((ax - o.x) * ez - (az - o.z) * ex) / den, u = ((ax - o.x) * d.z - (az - o.z) * d.x) / den;
  if (t <= 0 || u < 0 || u > 1) return -1; const y = o.y + d.y * t; return y >= y0 && y <= y1 ? t : -1; }

// ---------------- controller ----------------
// c: { scene, camera, P, H, hAt, sfx, fx, msg, mobile, input, keys, rig(), aimBone, twistBone, RANGE, BASE, dev, send(m), renderer }
export function createGuns(c) {
  const { scene, camera, P, H, hAt, sfx, fx, mobile, input, keys } = c;
  const state = { weapon: null, last: 'revolver', aiming: false, ammo: { revolver: S.revolverRounds, rifle: S.rifleRounds, sniper: S.sniperRounds, tommy: S.tommyRounds, gold: S.goldRounds }, owned: { revolver: true, rifle: true, sniper: true, tommy: false, gold: false }, up: { revolver: 0, rifle: 0, sniper: 0, tommy: 0, gold: 0 }, gz: S.goldFovMax, spent: 0, kills: 0, cocked: true, chambered: true, reloading: false, cycling: false, shots: 0, hits: 0, score: 0, lastHit: null, blocked: false, draw: 0, aimK: 0, scopeK: 0, breath: 1, winded: false, steady: false, scoped: false, scopeT: 0 };
  const clock = { cooldown: 0, reload: 0, lever: 0, cock: 0, flash: 0, recoil: 0, rec: 0, sway: 0, idle: 0, draw: 0 };
  const models = { revolver: buildRevolver(), rifle: buildRifle(), sniper: buildSharps(), tommy: buildTommy(), gold: buildGold() }; for (const m of Object.values(models)) { m.group.visible = false; scene.add(m.group); } // v33 regression fix: the held guns must be in the scene
  try { const sv = JSON.parse(localStorage.getItem('hr_v33') || sessionStorage.getItem('hr_v33') || 'null'); if (sv) { state.score = +sv.score || 0; state.kills = +sv.kills || 0; state.spent = +sv.spent || 0; Object.assign(state.owned, sv.owned || {}); Object.assign(state.up, sv.up || {}); } } catch (_) {} // points, guns and upgrades last the session for (const m of Object.values(models)) { m.group.visible = false; scene.add(m.group); }
  const range = buildRange(scene, hAt, c.RANGE, H.obst); const targets = range.T;
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mats().flash), flash2 = flash.clone(); flash2.rotation.y = Math.PI / 2; flash.add(flash2); flash.visible = false; flash.renderOrder = 5; scene.add(flash);
  const light = mobile ? null : new THREE.PointLight(0xffb060, 0, 9, 2); if (light) scene.add(light); // always in the scene (intensity 0) so firing never recompiles shaders
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), aimDir = new THREE.Vector3(0, 0, -1), muz = new THREE.Vector3();
  const remote = new Map(); let fireHeld = false, firePend = false, lastFire = false, aimHeld = false, reloadHeld = false, toast = 0, toastTxt = '';
  const gun = () => state.weapon && models[state.weapon], baseAmmo = w => w === 'rifle' ? S.rifleRounds : w === 'sniper' ? S.sniperRounds : w === 'tommy' ? S.tommyRounds : w === 'gold' ? S.goldRounds : S.revolverRounds, tier = w => state.up[w] | 0,
    maxAmmo = w => Math.max(1, Math.round(baseAmmo(w) * S.tierMag[tier(w)] - (SCOPED(w) && tier(w) < 3 ? .49 : 0))), rangeOf = w => w === 'rifle' ? S.rifleRange : w === 'sniper' ? S.sniperRange : w === 'tommy' ? S.tommyRange : w === 'gold' ? S.goldRange : S.revolverRange, dmgMul = w => S.tierDmg[tier(w)];
  const flights = []; // buffalo-rifle bullets in the air (impact after the flight time)
  const tone = (...a) => { if (sfx.ctx) sfx.tone(...a); }, nz = (...a) => { if (sfx.ctx) sfx.nz(...a); };
  const click = (f = 3200, v = .14) => nz('highpass', f, .7, v, .03);
  const say = t => { toastTxt = t; toast = 1.6; scopePop(t, /\+\d/.test(t) ? 'k' : ''); };
  // v33: inside the scope (where the rest of the HUD is hidden) hit markers, damage and points pop up beside the reticle
  const pops = []; function scopePop(t, cls = '') { if (!scopeEl || state.scopeK < .5) return; const box = scopeEl.querySelector('.pops'); if (!box) return; const e = document.createElement('b'); e.textContent = t; if (cls) e.className = cls; box.appendChild(e); pops.push(e); state.scopePops = (state.scopePops || 0) + 1; state.lastPop = t;
    setTimeout(() => { e.remove(); pops.splice(pops.indexOf(e), 1); }, 1400); while (pops.length > 4) pops.shift().remove(); }
  function hitMark(head) { if (!scopeEl || state.scopeK < .5) return; const hx = scopeEl.querySelector('.hx'); if (!hx) return; hx.classList.remove('on', 'hd'); void hx.offsetWidth; hx.classList.add('on'); if (head) hx.classList.add('hd'); }
  const role = () => (H.netRole ? H.netRole() : 'solo');
  function award(head) { const pts = head ? 15 : 10; state.score += pts; state.kills = (state.kills || 0) + 1; say(head ? `Headshot! Zombie down  +${pts}` : `Zombie down  +${pts}`); save(); return pts; } // host-authoritative in co-op (the host sends 'zk')
  function save() { try { localStorage.setItem('hr_v33', JSON.stringify({ score: state.score, kills: state.kills || 0, spent: state.spent || 0, owned: state.owned, up: state.up })); } catch (_) {} }

  function draw(w) { if (!models[w] || !state.owned[w]) return false; if (H.mountT > 0 || H.dismT > 0) return false; if (state.weapon === w) return true;
    state.weapon = w; state.last = w; state.reloading = false; state.cycling = false; clock.cooldown = .15; clock.draw = S.drawTime; state.cocked = true; state.chambered = state.ammo.rifle > 0; state.breath = 1; if (w === 'gold') state.gz = S.goldFovMax; state.winded = false;
    click(2400, .12); setTimeout(() => click(4200, .08), 120); syncUI(); return true; }
  function holster() { if (!state.weapon) return; state.weapon = null; state.aiming = false; state.reloading = false; input.ads = false; click(1800, .1); syncUI(); }
  const ORDER = ['revolver', 'rifle', 'sniper', 'tommy', 'gold'], owned = () => ORDER.filter(w => state.owned[w]);
  function cycle() { const o = owned(); if (!state.weapon) draw(o[0]); else { const i = o.indexOf(state.weapon); if (i < 0 || i === o.length - 1) holster(); else draw(o[i + 1]); } } // phone: holstered -> six-shooter -> rifle -> buffalo -> (tommy, golden buffalo once owned) -> holstered
  function reload() { const w = state.weapon; if (!w || state.reloading || state.cycling || state.ammo[w] >= maxAmmo(w)) return false; state.reloading = true; clock.reload = (H.reloadMul || 1) * (w === 'rifle' ? S.reloadRifle : w === 'sniper' ? S.reloadSniper : w === 'tommy' ? S.reloadTommy : w === 'gold' ? S.reloadGold : S.reloadRevolver) * S.tierReload[tier(w)]; state.rlLen = clock.reload; state.rlStep = 0; click(1500, .1); return true; }

  // ChatGPT's horseback arc clamp (kept): a direction behind the horse is turned back to the limit; returns whether it was clamped
  function clampHorse(dir) { const h = H.mounted; if (!h) return false; const fx_ = -Math.sin(h.yaw), fz = -Math.cos(h.yaw), hx = dir.x, hz = dir.z, l = Math.hypot(hx, hz); if (l < 1e-4) return false;
    const signed = Math.atan2(fx_ * hz / l - fz * hx / l, fx_ * hx / l + fz * hz / l), lim = S.horsebackYawLimit * D2R; if (Math.abs(signed) <= lim) return false;
    const a = Math.atan2(fx_, fz) - Math.sign(signed) * lim, hor = Math.sqrt(Math.max(0, 1 - dir.y * dir.y)); dir.set(Math.sin(a) * hor, dir.y, Math.cos(a) * hor).normalize(); return true; }
  function horseRel() { const h = H.mounted; if (!h) return 0; camera.getWorldDirection(v1); const a = Math.atan2(-v1.x, -v1.z); let d = a - h.yaw; return Math.atan2(Math.sin(d), Math.cos(d)); }

  // world ray: targets, horses (block, no damage), trees / rocks / posts, fence rails, terrain heightfield
  function cast(o, d, maxT) { let best = { t: maxT, kind: null };
    for (const T of targets) { if (!T.alive) continue; let t; if (T.n) { const dn = d.x * T.n.x + d.y * T.n.y + d.z * T.n.z; if (Math.abs(dn) < 1e-4) continue; t = ((T.c.x - o.x) * T.n.x + (T.c.y - o.y) * T.n.y + (T.c.z - o.z) * T.n.z) / dn;
        if (t <= 0 || t >= best.t) continue; v3.copy(d).multiplyScalar(t).add(o); if (v3.distanceTo(T.c) > T.r) continue; } else t = raySphere(o, d, T.c, T.r);
      if (t > 0 && t < best.t) best = { t, kind: 'target', T }; }
    for (const h of H.horses) { if (h === H.mounted) continue; const fx_ = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
      for (const [f, y, r] of [[0, 1.3, .62], [.75, 1.35, .5], [1.25, 1.65, .32]]) { v3.set(h.pos.x + fx_ * f, h.pos.y + y, h.pos.z + fz * f); const t = raySphere(o, d, v3, r); if (t > 0 && t < best.t) best = { t, kind: 'horse' }; } }
    const zs = c.zombies && c.zombies(); if (zs) { const zh = zs.rayHit(o, d, best.t, raySphere, rayCyl); if (zh) best = { t: zh.t, kind: 'zombie', Z: zh.Z, head: zh.head }; } // the walking dead (head sphere + body)
    for (const ob of H.obst) { if (Math.abs(ob[0] - o.x) > maxT + 3 || Math.abs(ob[1] - o.z) > maxT + 3) continue; const g = hAt(ob[0], ob[1]), t = rayCyl(o, d, ob[0], ob[1], ob[2], g - .5, g + (ob[3] || 3)); if (t > 0 && t < best.t) best = { t, kind: (ob[3] || 3) > 4 ? 'tree' : 'rock' }; }
    for (const f of H.fence) { const t = raySeg(o, d, f[0], f[1], f[2], f[3], c.BASE, c.BASE + 1.45); if (t > 0 && t < best.t) best = { t, kind: 'wood' }; }
    let pt = 0, ph = o.y - hAt(o.x, o.z); for (let t = 1; t <= best.t; t += t < 40 ? 1 : 2.5) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, hh = y - hAt(x, z);
      if (hh < 0) { let a = pt, b = t; for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (o.y + d.y * m - hAt(o.x + d.x * m, o.z + d.z * m) < 0) b = m; else a = m; } if (b < best.t) best = { t: b, kind: 'ground' }; break; } pt = t; ph = hh; }
    best.p = new THREE.Vector3().copy(d).multiplyScalar(best.t).add(o); return best; }

  function spreadDeg(fan) { const m = !!H.mounted, sp = Math.abs(m ? H.speed : H.fv.length()); let s = m ? S.swayHorse + sp * S.swayHorseSpeed : sp * S.swayWalk;
    if (state.weapon === 'tommy') { s += state.aiming ? .25 : S.tommyHipSpread; return s * (state.aiming ? S.adsSpreadMultiplier * 1.3 : 1); }
    if (SCOPED(state.weapon)) { s += state.aiming ? 0 : S.sniperHipSpread; if (state.weapon === 'gold' && state.aiming) s *= .4; if (state.aiming) s *= S.sniperScopeSpread * (state.steady ? .5 : 1); return s; }
    s += state.aiming ? 0 : S.hipSpread; if (state.aiming) s *= S.adsSpreadMultiplier; if (fan) s += S.fanSpread; return s; }
  // ChatGPT's aim-assist cone (kept): a small, gentle pull towards a target near the crosshair, only while aiming
  function assist(o, dir) { if (!state.aiming) return dir; const sn = SCOPED(state.weapon), lim = Math.cos((sn ? S.sniperAssistAngle : S.assistAngle) * D2R * (mobile ? 1.4 : 1)); let best = null, sc = -1e9;
    for (const T of targets) { if (!T.alive) continue; v3.copy(T.c).sub(o); const dist = v3.length(); if (dist < .5 || dist > rangeOf(state.weapon)) continue; v3.multiplyScalar(1 / dist); const dt = v3.dot(dir);
      const scr = dt - (sn ? 0 : dist * .00003); if (dt > lim && scr > sc) { sc = scr; best = v3.clone(); } }
    const zs = c.zombies && c.zombies(); if (zs) for (const q of zs.assistPoints()) { v3.copy(q.c).sub(o); const dist = v3.length(); if (dist < .5 || dist > rangeOf(state.weapon)) continue; v3.multiplyScalar(1 / dist); const dt = v3.dot(dir), scr = dt - (sn ? 0 : dist * .00003); if (dt > lim && scr > sc) { sc = scr; best = v3.clone(); } } // through the scope: the target nearest the reticle, not the nearest in metres
    if (!best) return dir; const err = Math.acos(Math.min(1, best.dot(dir))) / D2R; // inside a small 'sticky' cone the sights settle on the target; further out it only nudges
    return dir.clone().lerp(best, err < (sn ? S.sniperSticky * (mobile ? 1.8 : 1) : mobile ? 2.4 : 1.4) ? .92 : S.assistStrength).normalize(); }

  function canFire() { const w = state.weapon; if (!w || H.dead || clock.draw > 0 || state.cycling || clock.cooldown > 0 || H.mountT > 0 || H.dismT > 0 || H.wantOff) return false;
    if (H.mounted && Math.abs(horseRel()) > S.horsebackYawLimit * D2R) { state.blocked = true; return false; } return true; }
  function shoot(fan) {
    const w = state.weapon; if (!canFire()) return false;
    if (state.ammo[w] <= 0) { click(900, .2); clock.cooldown = .25; if (!state.reloading) reload(); return false; }
    if (state.reloading) state.reloading = false; // firing interrupts the reload (one round at a time)
    state.ammo[w]--; state.shots++; clock.cooldown = (w === 'revolver' ? (fan ? S.fanInterval : S.revolverInterval) : w === 'sniper' ? S.sniperInterval : w === 'gold' ? S.goldInterval : w === 'tommy' ? S.tommyInterval : S.rifleInterval) * S.tierRate[tier(w)];
    if (w === 'revolver') clock.cock = clock.cooldown * .85; else if (w === 'tommy') { if (models.tommy.bolt) models.tommy.bolt.position.z = .02; } else if (SCOPED(w)) state.cocked = false; else { state.chambered = false; if (state.ammo.rifle > 0) { state.cycling = true; clock.lever = S.leverDuration; } }
    // crosshair ray from the camera (skip the player in front of a third-person camera), then the real bullet from the muzzle
    camera.getWorldDirection(v1); const o = camera.position.clone(), eye = H.mounted ? H.mounted.pos : P.pos; const skip = Math.max(0, v2.copy(eye).sub(o).dot(v1) + .6);
    o.addScaledVector(v1, skip); let dir = assist(o, v1.clone()); const sw = swayVec(); dir.x += sw.x; dir.y += sw.y; dir.z += sw.z; dir.normalize();
    const sp = spreadDeg(fan) * D2R, r = Math.random() * sp, a = Math.random() * 6.283; const rt = v2.crossVectors(dir, UP).normalize(), up2 = v3.crossVectors(rt, dir).normalize(); dir.addScaledVector(rt, Math.cos(a) * Math.tan(r)).addScaledVector(up2, Math.sin(a) * Math.tan(r)).normalize();
    clampHorse(dir);
    const maxR = rangeOf(w), aim = cast(o, dir, maxR); state.dbg = { aim: aim.kind, t: +aim.t.toFixed(1), fov: +camera.fov.toFixed(1), scoped: state.scoped, aiming: state.aiming, spread: +spreadDeg(fan).toFixed(3), fan: !!fan }; const m = gun(); m.group.updateMatrixWorld(true); muz.copy(m.muzzle).applyMatrix4(m.group.matrixWorld);
    const bd = aim.p.clone().sub(muz); const L = bd.length(); bd.multiplyScalar(1 / Math.max(L, .001)); const hit = L > .3 ? cast(muz.clone().addScaledVector(bd, .05), bd, L + .5) : aim;
    const mounted = !!H.mounted, land = () => { impact(hit, bd, w); state.lastHit = { kind: hit.kind, target: hit.T ? hit.T.kind : hit.kind === 'zombie' ? hit.Z.kind : null, head: !!hit.head, zr: hit.zr || null, point: hit.p.toArray().map(v => +v.toFixed(2)), mounted, weapon: w, dist: +hit.p.distanceTo(muz).toFixed(1) }; };
    if (SCOPED(w)) { const tt = hit.p.distanceTo(muz) / (w === 'gold' ? S.goldVelocity : S.sniperVelocity); effects(w, muz, bd, hit.p, false, tt); flights.push({ t: tt, land }); } else { effects(w, muz, bd, hit.p); land(); }
    clock.recoil = 1; const k = w === 'rifle' ? S.recoilRifle : w === 'tommy' ? S.recoilTommy * (state.aiming ? .6 : 1) : SCOPED(w) ? (w === 'gold' ? S.recoilGold : S.recoilSniper) * (state.scoped ? .6 : 1) : S.recoilRevolver; P.pitch += k; clock.rec += k; H.shake = Math.max(H.shake || 0, SCOPED(w) ? .35 : w === 'rifle' ? .25 : w === 'tommy' ? .08 : .15);
    if (c.send) c.send({ t: 'sh', w: WCODE[w] || 1, o: muz.toArray().map(v => +v.toFixed(2)), e: hit.p.toArray().map(v => +v.toFixed(2)) });
    if (H.mounted && H.speed < .5) H.mounted.g.userData.spook = SCOPED(w) ? .7 : w === 'tommy' ? .25 : .4; // the horse flinches a little at the report
    return true; }

  function effects(w, p, d, end, remoteShot, tt) {
    const big = SCOPED(w);
    flash.position.copy(p).addScaledVector(d, .06); flash.lookAt(camera.position); flash.scale.setScalar((big ? .55 : w === 'rifle' ? .34 : .26) * (.8 + Math.random() * .4)); flash.rotation.z = Math.random() * 6.28; flash.visible = true; clock.flash = .05;
    if (light) { light.position.copy(p); light.intensity = 14; }
    if (fx && big) { fx.tracer && fx.tracer(p.clone().addScaledVector(d, .4), end, w === 'gold' ? 0xffe28a : 0xfff0c0, Math.max(.06, tt || p.distanceTo(end) / S.sniperVelocity)); fx.muzzle && fx.muzzle(p, [1, .78, .45], 2);
      const f0 = !remoteShot && state.scoped ? 1.4 : .1, wx = -d.z * .9, wz = d.x * .9; // a light cross-wind carries the cloud off the line of sight
      if (fx.smoke) { for (let i = 0; i < 9; i++) { const f = f0 + i * .32, sp = 2.6 - i * .26; fx.smoke.emit(p.x + d.x * f, p.y + d.y * f + .02 * i, p.z + d.z * f, d.x * sp + wx + (Math.random() - .5) * .5, .25 + Math.random() * .3, d.z * sp + wz + (Math.random() - .5) * .5, .8, .78, .74, .3 + i * .09, 2.6 + i * .35, 1.1, -.03, .42); }
        for (let i = 0; i < 4; i++) fx.smoke.emit(p.x - d.x * .5 - wx * .4, p.y - .3, p.z - d.z * .5 - wz * .4, wx + (Math.random() - .5) * .6, .15, wz + (Math.random() - .5) * .6, .76, .74, .7, .45, 3.2, 1, -.02, .28); } } // big black-powder cloud that hangs around the shooter
    else if (fx) { fx.tracer && fx.tracer(p.clone().addScaledVector(d, .4), end, 0xffd890, .05); fx.muzzle && fx.muzzle(p, [1, .75, .4], 1.2);
      if (fx.smoke) for (let i = 0; i < 3; i++) fx.smoke.emit(p.x + d.x * (.15 + i * .3), p.y + d.y * (.15 + i * .3), p.z + d.z * (.15 + i * .3), d.x * (1.6 - i * .4) + (Math.random() - .5) * .3, .2 + Math.random() * .2, d.z * (1.6 - i * .4) + (Math.random() - .5) * .3, .78, .76, .72, .18 + i * .08, 1.4 + i * .4, .8, -.04, .32); } // black-powder smoke
    const shot = () => { sfx.shot(big ? [800, 55, 1] : w === 'rifle' ? [1300, 95, .8] : w === 'tommy' ? [1900, 140, .38] : [1650, 120, .65]); if (big) { tone('sine', 90, 38, .7, .5); nz('lowpass', 420, .8, .45, .9); setTimeout(() => nz('lowpass', 520, .7, .18, .7), 420); setTimeout(() => nz('lowpass', 380, .7, .1, .9), 1100); } }; // deep boom + valley echoes
    if (remoteShot && sfx.at) sfx.at(p, shot, .6); else if (sfx.shot) shot(); }

  function impact(hit, d, w) {
    const p = hit.p, heavy = SCOPED(w), dist = p.distanceTo(camera.position), ring = (fn) => setTimeout(fn, Math.min(1500, dist / 343 * 1000)); // a far hit is heard after the speed of sound
    if (hit.kind === 'target') { const T = hit.T; state.hits++;
      if (T.kind === 'gong') { T.sv -= (heavy ? 3.2 : 1.6) / Math.max(.4, T.r); const pts = Math.round(T.d / 10) * (heavy ? 1 : 2); state.score += pts; say(`Steel at ${T.d} m!  +${pts}`);
        ring(() => { tone('sine', 640 + T.r * 200, 600, .5, .9); tone('sine', 1490, 1400, .18, .6); tone('triangle', 2210, 2150, .08, .4); });
        if (fx) { fx.impact && fx.impact(p, [1, .95, .8]); fx.smoke && fx.smoke.emit(p.x + .1, p.y, p.z, .3, .4, 0, .85, .82, .78, .25, 1.2, .8, 0, .4); } // lead splash
        let hm = T.holes[T.hi]; if (!hm) { hm = new THREE.Mesh(new THREE.CircleGeometry(.04, 10), mats().splash); hm.rotation.y = Math.PI / 2; T.plate.add(hm); T.holes[T.hi] = hm; } T.hi = (T.hi + 1) % 12; const lp = T.plate.worldToLocal(p.clone()); hm.position.set(.016, lp.y, lp.z);
        return; }
      if (T.kind === 'bottle') { T.alive = false; T.mesh.visible = false; T.t = 0; if (fx) { fx.debris && fx.debris(p.x, p.y, p.z, T.col, 10, .8); fx.impact && fx.impact(p, [.8, 1, .9]); }
        for (let i = 0; i < 4; i++) setTimeout(() => tone('sine', 2600 + Math.random() * 2600, 1800, .08, .12), i * 35); state.score += 5; say('Bottle smashed  +5');
        if (targets.every(t => t.kind !== 'bottle' || !t.alive)) setTimeout(() => { for (const t of targets) if (t.kind === 'bottle') { t.alive = true; t.mesh.visible = true; } say('Fresh bottles on the rail'); }, 3000); }
      else if (T.kind === 'can') { T.fly = true; T.t = 0; const kk = heavy ? 2.2 : 1; T.v.set(d.x * 4.5 * kk + (Math.random() - .5), (3.2 + Math.random() * 1.6) * kk, d.z * 4.5 * kk + (Math.random() - .5)); T.w.set(Math.random() * 20 - 10, Math.random() * 8, Math.random() * 20 - 10);
        tone('triangle', 2300, 1500, .12, .25); tone('square', 900, 700, .04, .1); if (fx && fx.impact) fx.impact(p, [1, .9, .7]); state.score += 3; say('Ping!  +3'); }
      else { const lp = T.mesh.worldToLocal(p.clone()), rr = Math.hypot(lp.y, lp.z) / T.r, pts = rr < .12 ? 10 : rr < .27 ? 8 : rr < .45 ? 6 : rr < .62 ? 4 : 2, q = heavy ? pts * 2 : pts; state.score += q; say(pts === 10 ? `Bull's-eye!  +${q}` : 'Hit  +' + q);
        let hm = T.holes[T.hi]; if (!hm) { hm = new THREE.Mesh(new THREE.PlaneGeometry(.05, .05), mats().hole); hm.rotation.y = Math.PI / 2; T.mesh.add(hm); T.holes[T.hi] = hm; } T.hi = (T.hi + 1) % 30; hm.position.set(.027, lp.y, lp.z);
        tone('sine', 220, 120, .25, .12); nz('lowpass', 500, 1, .25, .08); if (fx && fx.debris) fx.debris(p.x, p.y, p.z, 0xc9b48a, 4, .4); }
      return; }
    if (hit.kind === 'zombie') { const zs = c.zombies && c.zombies(); if (zs) { state.hits++; const r = hit.zr = zs.onHit(hit.Z, w, hit.head, p, d, dmgMul(w)); if (r) { hitMark(hit.head); scopePop('-' + r.dmg + (hit.head ? ' ◉' : ''), hit.head ? 'h' : ''); if (r.killed && role() !== 'client') award(hit.head); else if (hit.head && !r.killed) say('Headshot!');
        nz('lowpass', 700, 1, .2, .12); if (hit.head) tone('square', 1600, 900, .05, .08); } } return; }
    if (!fx) return;
    if (hit.kind === 'ground') { fx.debris && fx.debris(p.x, p.y + .03, p.z, 0x7d6a4c, 5, .55); fx.smoke && fx.smoke.emit(p.x, p.y + .05, p.z, 0, .4, 0, .55, .47, .36, .2, 1, .7, -.05, .45); }
    else if (hit.kind === 'rock') { fx.impact && fx.impact(p); fx.debris && fx.debris(p.x, p.y, p.z, 0x8a8478, 4, .6); tone('triangle', 3400, 1200, .05, .08); }
    else if (hit.kind === 'tree' || hit.kind === 'wood') { fx.debris && fx.debris(p.x, p.y, p.z, 0x6a4a2a, 5, .5); nz('bandpass', 900, 2, .12, .05); }
  }
  function updateTargets(dt) {
  for (let i = flights.length - 1; i >= 0; i--) { const f = flights[i]; if ((f.t -= dt) <= 0) { flights.splice(i, 1); f.land(); } }
  for (const T of targets) {
    if (T.kind === 'gong') { if (T.sv || T.sw) { T.sv -= (T.sw * 9 + T.sv * .7) * dt; T.sw += T.sv * dt; if (Math.abs(T.sw) < 1e-4 && Math.abs(T.sv) < 1e-3) T.sw = T.sv = 0; T.mesh.rotation.z = T.sw; } continue; }
    if (T.kind === 'bottle' && !T.alive && (T.t += dt) > 20) { T.alive = true; T.mesh.visible = true; }
    if (T.kind === 'can') { if (T.fly) { T.v.y -= 9.8 * dt; T.mesh.position.addScaledVector(T.v, dt); T.mesh.rotation.x += T.w.x * dt; T.mesh.rotation.y += T.w.y * dt; T.mesh.rotation.z += T.w.z * dt;
        const g = hAt(T.mesh.position.x, T.mesh.position.z) + .035; if (T.mesh.position.y < g) { T.mesh.position.y = g; if (Math.abs(T.v.y) > 1.2) { T.v.y *= -.32; T.v.x *= .55; T.v.z *= .55; T.w.multiplyScalar(.5); tone('triangle', 1700, 1100, .05, .08); } else { T.fly = false; T.v.set(0, 0, 0); T.mesh.rotation.set(Math.PI / 2, T.mesh.rotation.y, 0); } } }
      if (T.mesh.position.distanceToSquared(T.home) > .01 && (T.t += dt) > 9) { T.mesh.position.copy(T.home); T.mesh.rotation.set(0, 0, 0); T.fly = false; T.t = 0; } } } }

  // ---- posing: the gun in the right hand, 2-bone arm IK, over-the-shoulder aim ----
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tE = new THREE.Vector3(), rq = new THREE.Quaternion();
  function ik(root, B, side, target, pole) { const U = B[side + 'Arm'], F = B[side + 'ForeArm'], Hd = B[side + 'Hand']; if (!U || !F || !Hd) return;
    root.updateMatrixWorld(true); const Sp = U.getWorldPosition(new THREE.Vector3()), a = Sp.distanceTo(F.getWorldPosition(tA)), b = tA.distanceTo(Hd.getWorldPosition(tB));
    const dv = tB.copy(target).sub(Sp); let dist = dv.length(); if (dist < 1e-4) return; dv.multiplyScalar(1 / dist); dist = Math.min(dist, (a + b) * .999);
    const ca = (a * a + dist * dist - b * b) / (2 * a * dist), along = a * ca, hh = Math.sqrt(Math.max(0, a * a - along * along)); const pd = tE.copy(pole).addScaledVector(dv, -pole.dot(dv)).normalize();
    const E = Sp.clone().addScaledVector(dv, along).addScaledVector(pd, hh), Tg = Sp.clone().addScaledVector(dv, dist); root.getWorldQuaternion(rq).invert();
    const toR = w => w.applyQuaternion(rq).toArray(); c.aimBone(root, U, F, toR(E.clone().sub(Sp))); c.aimBone(root, F, Hd, toR(Tg.sub(E))); }
  function poseOn(root, w, model, dir, k, mounted, rel) { const B = root.userData.B; if (!B || !B.RightHand) return false;
    root.updateMatrixWorld(true); root.getWorldQuaternion(q1); const fwd = v1.set(0, 0, 1).applyQuaternion(q1).setY(0).normalize(), right = v2.set(-1, 0, 0).applyQuaternion(q1).setY(0).normalize();
    if (mounted && rel && c.twistBone && B.Spine02) c.twistBone(root, B.Spine02, Math.max(-1.1, Math.min(1.1, rel)) * .45 * k);
    const sh = B.RightArm.getWorldPosition(new THREE.Vector3()); const g = model.group; const low = new THREE.Vector3().copy(fwd).multiplyScalar(.9).add(v3.set(0, -.55, 0)).normalize();
    const gd = low.clone().lerp(dir, k).normalize();
    if (w === 'revolver') { const tgt = sh.clone().addScaledVector(gd, .55 - .1 * (1 - k)).addScaledVector(right, .04 * (1 - k)).addScaledVector(UP, -.05 * k - .2 * (1 - k)).addScaledVector(fwd, .12 * (1 - k));
      ik(root, B, 'Right', tgt, new THREE.Vector3().copy(right).multiplyScalar(.6).add(v3.set(0, -1, 0))); }
    else { const grip = k > .01 ? sh.clone().addScaledVector(dir, .34).addScaledVector(UP, -.05).addScaledVector(right, -.07) : sh.clone().addScaledVector(fwd, .25).addScaledVector(UP, -.35).addScaledVector(right, .05);
      const tgt = sh.clone().lerp(grip, 1); tgt.copy(sh.clone().addScaledVector(fwd, .25).addScaledVector(UP, -.35).addScaledVector(right, .05).lerp(grip.clone(), k)); ik(root, B, 'Right', tgt, new THREE.Vector3().copy(right).add(v3.set(0, -.8, 0)));
      if (k > .3) { m1.lookAt(ZERO, dir, UP); q1.setFromRotationMatrix(m1); const fore = tgt.clone().add(new THREE.Vector3(0, -.01, SCOPED(w) ? -.42 : w === 'tommy' ? -.25 : -.36).applyQuaternion(q1)); ik(root, B, 'Left', fore, v3.set(0, -1, 0).addScaledVector(right, -.5).clone()); } }
    root.updateMatrixWorld(true); const hand = B.RightHand.getWorldPosition(new THREE.Vector3());
    m1.lookAt(ZERO, gd, UP); g.quaternion.setFromRotationMatrix(m1); g.position.copy(hand).add(new THREE.Vector3(0, -.01, -.035).applyQuaternion(g.quaternion)); g.scale.setScalar(SCOPED(w) ? 1.15 : 1.3); g.visible = true; return true; } // a touch over life-size so it reads from the chase camera
  function poseFP(model, k) { const g = model.group; camera.updateMatrixWorld(); const w = model.kind; const off = w !== 'revolver' ? [.11 * (1 - k), -.11 + .065 * k - .04 * (1 - k), -.32 - .05 * k] : [.16 * (1 - k), -.2 + .135 * k, -.4 - .05 * k];
    g.position.set(...off).applyMatrix4(camera.matrixWorld); g.quaternion.copy(camera.quaternion); g.scale.setScalar(1); if (k < 1) { q1.setFromAxisAngle(v1.set(1, 0, 0), -.35 * (1 - k)); g.quaternion.multiply(q1); } g.visible = true; }
  function animParts(m, rec, cock, lever) { if (m.kind === 'revolver') { m.hammer.rotation.x = cock ? -.55 : 0; m.cylinder.rotation.z = (state.shots % 6) * Math.PI / 3 * -1; m.group.rotateX(rec * .35); }
    else if (m.kind === 'tommy') { if (m.bolt) m.bolt.position.z += (-.02 - m.bolt.position.z) * .35; m.group.rotateX(rec * .06); m.group.translateZ(rec * .015); }
    else if (m.kind === 'sniper' || m.kind === 'gold') { m.lever.rotation.x = lever * .75; m.block.position.y = -.024 * lever; m.hammer.rotation.x = state.cocked || lever > 0 ? -.5 : 0; m.group.rotateX(rec * .2); m.group.translateZ(rec * .06); }
    else { m.lever.rotation.x = lever * .95; m.hammer.rotation.x = -.45; m.group.rotateX(rec * .15); m.group.translateZ(rec * .04); } }

  const swV = new THREE.Vector3();
  function swayVec() { if (SCOPED(state.weapon) && state.scoped) return swV.set(0, 0, 0); const m = !!H.mounted, sp = Math.abs(m ? H.speed : H.fv.length()), amp = (m ? .0025 + sp * .0011 : .0006 + sp * .0005) * (state.aiming ? 1 : 2) * (H.swayMul || 1) * (state.weapon === 'rifle' || state.weapon === 'tommy' ? .8 : SCOPED(state.weapon) ? 1.3 : 1);
    camera.getWorldDirection(v1); const rt = v2.crossVectors(v1, UP).normalize(); return swV.copy(rt).multiplyScalar(Math.sin(clock.sway * 1.7) * amp).addScaledVector(UP, Math.sin(clock.sway * 2.9 + 1) * amp * .8); }

  // ---- input (only while Horse Rider runs; nothing global outside the mode) ----
  const onKey = e => { if (!H.on || e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return; if (H.noGun || H.tool) return; // v35: fists / slots / dances / axe / build own the keys
    if (e.code === 'Digit1') draw('revolver'); else if (e.code === 'Digit2') draw('rifle'); else if (e.code === 'Digit3') draw('sniper'); else if (e.code === 'Digit4') draw('tommy'); else if (e.code === 'Digit5') draw('gold'); else if (e.code === 'KeyQ') { const o = owned(); if (state.weapon) draw(o[(o.indexOf(state.weapon) + 1) % o.length]); else draw(state.last); }
    else if ((e.code === 'Equal' || e.code === 'NumpadAdd') && state.weapon === 'gold') zoom(1); else if ((e.code === 'Minus' || e.code === 'NumpadSubtract') && state.weapon === 'gold') zoom(-1);
    else if (e.code === 'KeyX') holster(); else if (e.code === 'KeyR') { reloadHeld = true; reload(); } };
  const onKeyUp = e => { if (e.code === 'KeyR') reloadHeld = false; };
  const okPointer = () => H.on && !mobile && (document.pointerLockElement || c.dev);
  const onDown = e => { if (!okPointer() || H.uiOpen || H.noGun || H.tool) return; if (e.button === 0) { if (!state.weapon && !H.mountT) { draw(state.last); return; } fireHeld = true; firePend = true; } if (e.button === 2) aimHeld = true; };
  const onUp = e => { if (e.button === 0) fireHeld = false; if (e.button === 2) aimHeld = false; };
  addEventListener('wheel', e => { if (H.on && state.weapon === 'gold' && state.scopeK > .5) zoom(e.deltaY < 0 ? 1 : -1, 1.18); }, { passive: true });
  { let pd = 0; addEventListener('touchmove', e => { if (!(H.on && state.weapon === 'gold' && state.scopeK > .5) || e.touches.length !== 2) { pd = 0; return; } const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pd && Math.abs(d - pd) > 14) { zoom(d > pd ? 1 : -1, 1.12); pd = d; } else if (!pd) pd = d; }, { passive: true }); }
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); c.renderer.domElement.addEventListener('mousedown', onDown); addEventListener('mouseup', onUp); const resetInput = () => { fireHeld = aimHeld = reloadHeld = false; firePend = false; lastFire = false; }; addEventListener('blur', resetInput); (window.__inputResets = window.__inputResets || []).push(resetInput); // v36: no queued shot fires after an app switch

  // ---- HUD + phone buttons ----
  const $ = id => document.getElementById(id); let hudEl = null, crossEl = null, scopeEl = null;
  function syncUI() { document.body.classList.toggle('hr-gun', !!state.weapon); const b = $('tGun'); if (b) b.innerHTML = !state.weapon ? '🔫<small>DRAW</small>' : state.weapon === 'revolver' ? '🔫<small>RIFLE</small>' : state.weapon === 'rifle' ? '🔭<small>BUFFALO</small>' : (() => { const o = owned(), n = o[o.indexOf(state.weapon) + 1]; return n === 'tommy' ? '🔫<small>TOMMY</small>' : n === 'gold' ? '🔭<small>GOLD</small>' : '🔫<small>HOLSTER</small>'; })(); if (!state.weapon) input.ads = false; }
  if (mobile && $('tGun')) { const b = $('tGun'); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycle(); }); }
  if (mobile && $('tFire')) $('tFire').addEventListener('pointerdown', () => { if (H.on && state.weapon) firePend = true; }); // a quick tap between two frames still fires
  function hud() {
    if (!hudEl) { hudEl = document.createElement('div'); hudEl.id = 'hrGun'; document.body.appendChild(hudEl); crossEl = document.createElement('div'); crossEl.id = 'hrCross'; crossEl.innerHTML = '<i></i>'; document.body.appendChild(crossEl); }
    const w = state.weapon; hudEl.hidden = !w && toast <= 0; crossEl.hidden = !w || state.scopeK > .5;
    if (!scopeEl) { scopeEl = document.createElement('div'); scopeEl.id = 'hrScope'; scopeEl.innerHTML = '<div class="ret"><i class="h"></i><i class="v"></i><i class="dot"></i><i class="s1"></i><i class="s2"></i><i class="s3"></i></div><div class="br"><b></b></div><div class="tip"></div><div class="hx"><i></i><i></i><i></i><i></i></div><div class="pops"></div><div class="pts"></div><div class="zm"><button data-z="1">+</button><span></span><button data-z="-1">−</button></div>';
      scopeEl.querySelectorAll('.zm button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); zoom(+b.dataset.z); })); document.body.appendChild(scopeEl); }
    const so = state.scopeK > .75; scopeEl.classList.toggle('on', so); scopeEl.classList.toggle('gold', so && w === 'gold'); if (so && w === 'gold') { const z = scopeEl.querySelector('.zm span'), zt = (S.scopeFov * 4 / state.gz).toFixed(0) + '×'; if (z.textContent !== zt) z.textContent = zt; } document.body.classList.toggle('hr-scoped', so);
    if (so) { scopeEl.querySelector('.br b').style.width = (state.breath * 100).toFixed(0) + '%'; scopeEl.classList.toggle('steady', state.steady); scopeEl.classList.toggle('winded', state.winded);
      scopeEl.querySelector('.tip').textContent = ''; const pe = scopeEl.querySelector('.pts'), pt = `${pts()} pts · ${state.kills || 0} ☠`; if (pe.textContent !== pt) pe.textContent = pt; } // no writing in the scope (Quin); the breath bar colour shows steady / winded
    if (w) { const n = state.ammo[w], mx = maxAmmo(w); let pips = ''; if (mx <= 12) for (let i = 0; i < mx; i++) pips += `<b class="${i < n ? 'f' : ''}"></b>`;
      hudEl.innerHTML = `<span class="w">${WNAME[w]}${tier(w) ? ' ' + ['', '🥉', '🥈', '🥇'][tier(w)] : ''}</span>${mx > 12 ? `<span class="cnt">${n} / ${mx}</span>` : `<span class="pips ${w === 'revolver' ? 'revolver' : 'rifle'}">${pips}</span>`}${state.reloading ? '<span class="rl">reloading…</span>' : n === 0 ? `<span class="rl">${mobile || w === 'sniper' ? 'reloading…' : 'R to reload'}</span>` : ''}<span class="sc">🎯 ${state.hits} · ${pts()} pts</span>${toast > 0 ? `<em>${toastTxt}</em>` : ''}`;
      }
    else if (toast > 0) hudEl.innerHTML = `<em>${toastTxt}</em>`;
  }

  function cross() { if (!crossEl || crossEl.hidden) return; const sp = spreadDeg(false) * D2R, px = innerHeight / (2 * Math.tan(camera.fov * D2R / 2)), sw = swayVec(); camera.getWorldDirection(v1); const rt = v2.crossVectors(v1, UP).normalize();
    crossEl.style.transform = `translate(calc(-50% + ${(sw.dot(rt) * px).toFixed(1)}px), calc(-50% - ${(sw.dot(UP) * px).toFixed(1)}px))`; crossEl.firstChild.style.width = crossEl.firstChild.style.height = Math.max(6, Math.min(80, Math.tan(sp) * px * 2)).toFixed(0) + 'px';
    crossEl.classList.toggle('aim', state.aiming); crossEl.classList.toggle('no', state.blocked); }
  // ---- per frame (after the rider has been animated for this frame) ----
  function update(dt) {
    state.upd = (state.upd || 0) + 1; dt = Math.min(dt || 0, .1);
    { P.lookSmooth = mobile && state.scopeK > 0; const q = P.lookPend; // drain the filtered finger look (scope on phones); instant otherwise
      if (q && (q.x || q.y)) { const f = P.lookSmooth ? ease(dt, S.scopeTouchTau) : 1, ax = q.x * f, ay = q.y * f; P.yaw -= ax; P.pitch = Math.max(-1.553, Math.min(1.553, P.pitch - ay)); q.x -= ax; q.y -= ay; if (Math.abs(q.x) + Math.abs(q.y) < 1e-6) q.x = q.y = 0; } } for (const k of ['cooldown', 'flash', 'draw']) clock[k] = Math.max(0, clock[k] - dt); clock.sway += dt * (H.mounted ? 1 + Math.abs(H.speed) * .12 : 1); toast -= dt;
    clock.recoil = Math.max(0, clock.recoil - dt * 6); if (clock.rec > 0) { const r = Math.min(clock.rec, clock.rec * dt * 7 + dt * .01); P.pitch -= r * .8; clock.rec -= r; }
    if (clock.cock > 0) { clock.cock -= dt; if (clock.cock <= 0) click(3600, .1); }
    flash.visible = clock.flash > 0; if (light) light.intensity = clock.flash > 0 ? 14 * clock.flash / .05 : 0;
    updateTargets(dt);
    const w = state.weapon; if (w && (H.mountT > 0 || H.dismT > 0)) { for (const m of Object.values(models)) m.group.visible = false; state.aiming = false; H.scoped = false; H.gunAim = false; H.gunFace = null; return; }
    if (w && (H.noGun || H.tool)) holster();
    if (!state.weapon) { for (const m of Object.values(models)) m.group.visible = false; state.aiming = false; H.scoped = false; state.aimK += (0 - state.aimK) * Math.min(1, dt * 10); H.aimK = state.aimK; H.gunFace = null; return; }
    state.aiming = !!(aimHeld || input.ads);
    const scoping = SCOPED(w) && state.aiming; state.scopeT = scoping ? state.scopeT + dt : 0;
    const wantSteady = scoping && (mobile ? state.scopeT > .7 : !!(keys.ShiftLeft || keys.ShiftRight)); // phones settle by themselves after a moment in the scope
    if (wantSteady && !state.winded && (mobile || state.breath > 0)) { state.steady = true; if (!mobile) { state.breath = Math.max(0, state.breath - dt / S.breathHold); if (state.breath <= 0) { state.winded = true; state.steady = false; } } }
    else { state.steady = false; state.breath = Math.min(1, state.breath + dt * S.breathRecover); if (state.winded && state.breath > .45) state.winded = false; }
    H.scoped = scoping; state.blocked = H.mounted ? Math.abs(horseRel()) > S.horsebackYawLimit * D2R : false;
    state.aimK += ((state.aiming ? 1 : 0) - state.aimK) * Math.min(1, dt * 12); H.aimK = state.aimK;
    if (H.mounted && state.aiming) { H.lookT = 0; H.recenter = true; } // aiming from the saddle = free look; the horse keeps its line
    H.gunFace = !H.mounted && (state.aiming || clock.cooldown > 0) ? P.yaw + (w !== 'revolver' ? .3 : .12) : null;
    if (state.reloading && SCOPED(w)) { const ph = 1 - clock.reload / (state.rlLen || S.reloadSniper); // lever down + block drops, case out, fresh cartridge in, lever up
      if (state.rlStep === 0 && ph > .08) { state.rlStep = 1; click(1400, .16); } if (state.rlStep === 1 && ph > .25) { state.rlStep = 2; click(2600, .1); if (fx && fx.shell) { const g = models.sniper.group; v3.set(0, .05, -.03).applyMatrix4(g.matrixWorld); fx.shell(v3.clone(), new THREE.Vector3(.2, 1.4, 1.6).applyQuaternion(g.quaternion)); } }
      if (state.rlStep === 2 && ph > .6) { state.rlStep = 3; click(1900, .12); } if (state.rlStep === 3 && ph > .88) { state.rlStep = 4; click(3200, .14); state.cocked = true; } }
    if (state.reloading) { clock.reload -= dt; if (clock.reload <= 0) { state.ammo[w] = w === 'tommy' ? maxAmmo(w) : Math.min(maxAmmo(w), state.ammo[w] + 1); click(2000 + Math.random() * 400, .12); state.reloading = false; if (SCOPED(w)) state.cocked = true; // exactly one cartridge per cycle
        if (state.ammo[w] < maxAmmo(w) && (reloadHeld || mobile || state.autoRl)) reload(); else { state.autoRl = false; if (w === 'rifle' && !state.chambered) { state.cycling = true; clock.lever = S.leverDuration; } } } }
    if (state.cycling) { clock.lever -= dt; if (clock.lever <= 0) { state.cycling = false; state.chambered = state.ammo.rifle > 0; click(2600, .1); if (fx && fx.shell) { const m = models.rifle; v3.set(.03, .03, -.1).applyMatrix4(m.group.matrixWorld); fx.shell(v3.clone(), new THREE.Vector3(1.2, 2, .3).applyQuaternion(m.group.quaternion)); } }
      else if (Math.abs(clock.lever - S.leverDuration * .5) < dt) click(1700, .1); }
    const fh = !!(fireHeld || input.fire), fan = w === 'revolver' && (keys.KeyF || (mobile && !state.aiming)), want = firePend || (fh && (!lastFire || fan || w === 'tommy')), fired = want ? shoot(fan) : false; lastFire = fh; if (fired || !state.weapon) firePend = false; else if (firePend && clock.cooldown <= 0 && !state.cycling && clock.draw <= 0) firePend = false;
    if (fired) clock.idle = 0; else clock.idle += dt;
    if (state.ammo[w] === 0 && !state.reloading && !state.cycling && clock.cooldown <= 0) { state.autoRl = true; reload(); }
    if (mobile && clock.idle > 2.5 && !state.reloading && state.ammo[w] < maxAmmo(w) && !state.aiming) { state.autoRl = true; reload(); }
    // pose the gun
    const m = models[w]; for (const [kk, o] of Object.entries(models)) if (kk !== w) o.group.visible = false; const k = Math.min(1, state.aimK + (clock.cooldown > 0 ? .7 : 0)) * (1 - clock.draw / S.drawTime * .9);
    camera.getWorldDirection(aimDir); const lim = H.mounted && clampHorse(aimDir); state.clamped = !!lim;
    const rig = c.rig && c.rig();
    if (H.fp && !H.mounted) poseFP(m, k); else if (!rig || !poseOn(rig, w, m, aimDir, k, !!H.mounted, horseRel())) poseFP(m, k);
    let lv = state.cycling ? Math.sin((1 - clock.lever / S.leverDuration) * Math.PI) : 0;
    if (SCOPED(w) && state.reloading) { const ph = 1 - clock.reload / (state.rlLen || S.reloadSniper); lv = ph < .15 ? ph / .15 : ph > .82 ? Math.max(0, (1 - ph) / .18) : 1; }
    animParts(m, clock.recoil, clock.cock <= 0, lv); m.group.updateMatrixWorld(true); if (state.scopeK > .5) m.group.visible = false; cross();
  }

  // ---- scope: after the chase camera is placed, move it to the shooting eye behind the scope, zoom, and add sway + breathing ----
  const eye = new THREE.Vector3(), qS = new THREE.Quaternion(), eS = new THREE.Euler(0, 0, 0, 'YXZ'), fwdS = new THREE.Vector3();
  const sm = { amp: -1, br: 1, eye: new THREE.Vector3(), eyeOn: false }, eyeB = new THREE.Vector3(), eyeO = new THREE.Vector3();
  const ease = (dt, tau) => 1 - Math.exp(-Math.max(0, dt) / tau); // frame-rate independent low-pass factor
  function scopeSway(dt) { const m = !!H.mounted, sp = Math.abs(m ? H.speed : H.fv.length()), t = clock.sway;
    let amp = m ? S.scopeSwayHorse + sp * S.scopeSwayHorseSpeed : S.scopeSwayFoot + sp * .0006; amp *= state.steady ? (mobile ? .3 : .14) : state.winded ? 1.6 : 1;
    // steadying / breathing changes fade in and out (no step in the picture when the breath is held or let go)
    if (sm.amp < 0) sm.amp = amp; sm.amp += (amp - sm.amp) * ease(dt, .35); sm.br += ((state.steady ? 0 : 1) - sm.br) * ease(dt, .35); amp = sm.amp;
    const br = sm.br; return [ (Math.sin(t * .83) * .7 + Math.sin(t * 2.3 + 1.3) * .25) * amp, (Math.sin(t * 1.45) * .9 * br + Math.sin(t * 1.1 + .5) * .35) * amp ]; }
  function scopeCam(dt) {
    const on = SCOPED(state.weapon) && state.aiming && !(H.mountT > 0 || H.dismT > 0) && !state.reloading;
    dt = Math.min(dt || 0, .1); state.scopeK += ((on ? 1 : 0) - state.scopeK) * ease(dt || .016, 1 / 9); if (on && state.scopeK > .97) state.scopeK = 1; if (!on && state.scopeK < .02) state.scopeK = 0; state.scoped = state.scopeK > .6;
    if (state.scopeK <= 0) { P.lookScale = 1; sm.amp = -1; sm.eyeOn = false; return; }
    const k = state.scopeK * state.scopeK * (3 - 2 * state.scopeK), rig = c.rig && c.rig(), B = rig && rig.userData.B;
    fwdS.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
    if (B && B.Head) { rig.updateMatrixWorld(true); B.Head.getWorldPosition(eye); eye.y += .07; } else if (H.mounted) eye.set(H.mounted.pos.x, H.mounted.pos.y + 2.35, H.mounted.pos.z); else eye.set(P.pos.x, P.pos.y + 1.62, P.pos.z);
    // the head bobs with the gait: low-pass the head's offset from the body (not its world position, so nothing lags at a gallop)
    if (H.mounted) eyeB.set(H.mounted.pos.x, H.mounted.pos.y, H.mounted.pos.z); else eyeB.copy(P.pos); eyeO.copy(eye).sub(eyeB);
    if (!sm.eyeOn) { sm.eye.copy(eyeO); sm.eyeOn = true; } else sm.eye.lerp(eyeO, ease(dt, S.scopeEyeTau)); eye.copy(eyeB).add(sm.eye);
    eye.addScaledVector(fwdS, .32).add(v3.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw)).multiplyScalar(.03)); // the right eye at the eyepiece, a little in front of the face
    const [sx, sy] = scopeSway(dt); eS.set(Math.max(-1.553, Math.min(1.553, P.pitch + sy)), P.yaw + sx, 0); qS.setFromEuler(eS);
    camera.position.lerp(eye, k); camera.quaternion.slerp(qS, k); H.fovSave = camera.fov; const sf = state.weapon === 'gold' ? state.gz : mobile ? S.scopeFovMobile : S.scopeFov; camera.fov += (sf - camera.fov) * k; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    P.lookScale = 1 - (1 - (state.weapon === 'gold' ? Math.max(.004, state.gz / 60) * (mobile ? S.scopeLookMobile : 1) : mobile ? S.scopeFovMobile / 60 * S.scopeLookMobile : S.scopeFov / 60)) * k; }
  // Golden Buffalo zoom: wheel / pinch / +- buttons, 8 deg down to ~0.2 deg (about 36x more than the buffalo scope): a rider across the map fills the reticle
  function zoom(dir, f = 1.35) { if (state.weapon !== 'gold') return false; state.gz = Math.max(S.goldFovMin, Math.min(S.goldFovMax, state.gz * (dir > 0 ? 1 / f : f))); return true; } // slower look in the scope (in step with the zoom)

  // ---- multiplayer: show other riders' guns and shots (visual only — nobody can hurt anybody) ----
  const fin = (a, n) => Array.isArray(a) && a.length === n && a.every(v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 6000);
  function remoteShot(id, msg) { if (!msg || !fin(msg.o, 3) || !fin(msg.e, 3) || !WBY[msg.w]) return; const R = remote.get(id) || {}; const now = performance.now(); if (R.t && now - R.t < 90) return; R.t = now; remote.set(id, R);
    const o = new THREE.Vector3(...msg.o), e = new THREE.Vector3(...msg.e); if (o.distanceTo(camera.position) > 600) return; const d = e.clone().sub(o).normalize(); effects(WBY[msg.w], o, d, e, true); state.remoteShots = (state.remoteShots || 0) + 1; }
  function netState() { return { g: WCODE[state.weapon] || 0, k: state.kills || 0, pt: state.score, a: state.aiming ? 1 : 0, ap: +P.pitch.toFixed(2) }; }
  function poseRemote(av, s, root, mounted) { // av: remote avatar; s: last net state
    if (!av.guns) { av.guns = {}; for (const k of ORDER) av.guns[k] = { ...models[k], group: models[k].group.clone() }; for (const m of Object.values(av.guns)) { m.group.visible = false; scene.add(m.group); } }
    const w = s && WBY[s.g] || null; for (const [k, m] of Object.entries(av.guns)) if (k !== w) m.group.visible = false; if (!w || !root || !root.visible) { if (w) av.guns[w].group.visible = false; return; }
    const yaw = typeof s.yw === 'number' ? s.yw : 0, pt = typeof s.ap === 'number' ? Math.max(-1.2, Math.min(1.2, s.ap)) : 0, dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt));
    if (!poseOn(root, w, av.guns[w], dir, s.a ? 1 : 0, mounted, 0)) av.guns[w].group.visible = false; }
  function disposeRemote(av) { if (av.guns) for (const m of Object.values(av.guns)) scene.remove(m.group); }
  // dev / test helper: point the camera so the crosshair sits on a world point
  function aimAt(p, sync) { for (let i = 0; i < 4; i++) { if (sync) sync(0); const d = v1.copy(p).sub(camera.position).normalize(); camera.getWorldDirection(v2);
      P.yaw += Math.atan2(-d.x, -d.z) - Math.atan2(-v2.x, -v2.z); P.yaw = Math.atan2(Math.sin(P.yaw), Math.cos(P.yaw)); P.pitch += Math.asin(Math.max(-1, Math.min(1, d.y))) - Math.asin(Math.max(-1, Math.min(1, v2.y))); } }

  // v33: pick up / buy guns, buy upgrade tiers (points = zombie kills and range score)
  const pts = () => state.score - (state.spent || 0);
  function give(w) { if (!models[w]) return false; state.owned[w] = true; state.ammo[w] = maxAmmo(w); save(); syncUI(); return true; }
  function buy(cost, fn) { if (pts() < cost) { say('Not enough points'); return false; } state.spent = (state.spent || 0) + cost; fn(); save(); syncUI(); return true; }
  function upgrade(w) { const t = tier(w); if (t >= 3 || !state.owned[w]) return false; return buy(UP_COST[w][t], () => { state.up[w] = t + 1; state.ammo[w] = maxAmmo(w); say(`${WNAME[w]} → ${['', 'BRONZE', 'SILVER', 'GOLD'][t + 1]}`); }); }
  function purchase(w) { if (state.owned[w]) return false; return buy(PRICE[w], () => { give(w); say(`${WNAME[w]} bought`); }); }
  function credit(head) { return award(head); }
  return { state, settings: S, models, save, give, upgrade, purchase, credit, pts, tier, maxAmmo, zoom, scopePop, PRICE, UP_COST, targets, range, update, scopeCam, hud, draw, holster, cycle, reload, shoot, netState, remoteShot, poseRemote, disposeRemote, aimAt, cast, syncUI };
}
