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
  horsebackYawLimit: 110,                           // fire to the front and sides of the horse, never over its rump
  recoilRevolver: .045, recoilRifle: .06,
};
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
  const state = { weapon: null, last: 'revolver', aiming: false, ammo: { revolver: S.revolverRounds, rifle: S.rifleRounds }, cocked: true, chambered: true, reloading: false, cycling: false, shots: 0, hits: 0, score: 0, lastHit: null, blocked: false, draw: 0, aimK: 0 };
  const clock = { cooldown: 0, reload: 0, lever: 0, cock: 0, flash: 0, recoil: 0, rec: 0, sway: 0, idle: 0, draw: 0 };
  const models = { revolver: buildRevolver(), rifle: buildRifle() }; for (const m of Object.values(models)) { m.group.visible = false; scene.add(m.group); }
  const range = buildRange(scene, hAt, c.RANGE, H.obst); const targets = range.T;
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mats().flash), flash2 = flash.clone(); flash2.rotation.y = Math.PI / 2; flash.add(flash2); flash.visible = false; flash.renderOrder = 5; scene.add(flash);
  const light = mobile ? null : new THREE.PointLight(0xffb060, 0, 9, 2); if (light) scene.add(light); // always in the scene (intensity 0) so firing never recompiles shaders
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), aimDir = new THREE.Vector3(0, 0, -1), muz = new THREE.Vector3();
  const remote = new Map(); let fireHeld = false, firePend = false, lastFire = false, aimHeld = false, reloadHeld = false, toast = 0, toastTxt = '';
  const gun = () => state.weapon && models[state.weapon], maxAmmo = w => w === 'rifle' ? S.rifleRounds : S.revolverRounds;
  const tone = (...a) => { if (sfx.ctx) sfx.tone(...a); }, nz = (...a) => { if (sfx.ctx) sfx.nz(...a); };
  const click = (f = 3200, v = .14) => nz('highpass', f, .7, v, .03);
  const say = t => { toastTxt = t; toast = 1.6; };

  function draw(w) { if (w !== 'revolver' && w !== 'rifle') return false; if (H.mountT > 0 || H.dismT > 0) return false; if (state.weapon === w) return true;
    state.weapon = w; state.last = w; state.reloading = false; state.cycling = false; clock.cooldown = .15; clock.draw = S.drawTime; state.cocked = true; state.chambered = state.ammo.rifle > 0;
    click(2400, .12); setTimeout(() => click(4200, .08), 120); syncUI(); return true; }
  function holster() { if (!state.weapon) return; state.weapon = null; state.aiming = false; state.reloading = false; input.ads = false; click(1800, .1); syncUI(); }
  function cycle() { if (!state.weapon) draw(state.last || 'revolver'); else if (state.weapon === 'revolver') draw('rifle'); else holster(); } // phone: holstered -> six-shooter -> rifle -> holstered
  function reload() { const w = state.weapon; if (!w || state.reloading || state.cycling || state.ammo[w] >= maxAmmo(w)) return false; state.reloading = true; clock.reload = w === 'rifle' ? S.reloadRifle : S.reloadRevolver; click(1500, .1); return true; }

  // ChatGPT's horseback arc clamp (kept): a direction behind the horse is turned back to the limit; returns whether it was clamped
  function clampHorse(dir) { const h = H.mounted; if (!h) return false; const fx_ = -Math.sin(h.yaw), fz = -Math.cos(h.yaw), hx = dir.x, hz = dir.z, l = Math.hypot(hx, hz); if (l < 1e-4) return false;
    const signed = Math.atan2(fx_ * hz / l - fz * hx / l, fx_ * hx / l + fz * hz / l), lim = S.horsebackYawLimit * D2R; if (Math.abs(signed) <= lim) return false;
    const a = Math.atan2(fx_, fz) - Math.sign(signed) * lim, hor = Math.sqrt(Math.max(0, 1 - dir.y * dir.y)); dir.set(Math.sin(a) * hor, dir.y, Math.cos(a) * hor).normalize(); return true; }
  function horseRel() { const h = H.mounted; if (!h) return 0; camera.getWorldDirection(v1); const a = Math.atan2(-v1.x, -v1.z); let d = a - h.yaw; return Math.atan2(Math.sin(d), Math.cos(d)); }

  // world ray: targets, horses (block, no damage), trees / rocks / posts, fence rails, terrain heightfield
  function cast(o, d, maxT) { let best = { t: maxT, kind: null };
    for (const T of targets) { if (!T.alive) continue; let t; if (T.kind === 'board') { const dn = d.x * T.n.x + d.y * T.n.y + d.z * T.n.z; if (Math.abs(dn) < 1e-4) continue; t = ((T.c.x - o.x) * T.n.x + (T.c.y - o.y) * T.n.y + (T.c.z - o.z) * T.n.z) / dn;
        if (t <= 0 || t >= best.t) continue; v3.copy(d).multiplyScalar(t).add(o); if (v3.distanceTo(T.c) > T.r) continue; } else t = raySphere(o, d, T.c, T.r);
      if (t > 0 && t < best.t) best = { t, kind: 'target', T }; }
    for (const h of H.horses) { if (h === H.mounted) continue; const fx_ = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
      for (const [f, y, r] of [[0, 1.3, .62], [.75, 1.35, .5], [1.25, 1.65, .32]]) { v3.set(h.pos.x + fx_ * f, h.pos.y + y, h.pos.z + fz * f); const t = raySphere(o, d, v3, r); if (t > 0 && t < best.t) best = { t, kind: 'horse' }; } }
    for (const ob of H.obst) { if (Math.abs(ob[0] - o.x) > maxT + 3 || Math.abs(ob[1] - o.z) > maxT + 3) continue; const g = hAt(ob[0], ob[1]), t = rayCyl(o, d, ob[0], ob[1], ob[2], g - .5, g + (ob[3] || 3)); if (t > 0 && t < best.t) best = { t, kind: (ob[3] || 3) > 4 ? 'tree' : 'rock' }; }
    for (const f of H.fence) { const t = raySeg(o, d, f[0], f[1], f[2], f[3], c.BASE, c.BASE + 1.45); if (t > 0 && t < best.t) best = { t, kind: 'wood' }; }
    let pt = 0, ph = o.y - hAt(o.x, o.z); for (let t = 1; t <= best.t; t += t < 40 ? 1 : 2.5) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, hh = y - hAt(x, z);
      if (hh < 0) { let a = pt, b = t; for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (o.y + d.y * m - hAt(o.x + d.x * m, o.z + d.z * m) < 0) b = m; else a = m; } if (b < best.t) best = { t: b, kind: 'ground' }; break; } pt = t; ph = hh; }
    best.p = new THREE.Vector3().copy(d).multiplyScalar(best.t).add(o); return best; }

  function spreadDeg(fan) { const m = !!H.mounted, sp = Math.abs(m ? H.speed : H.fv.length()); let s = m ? S.swayHorse + sp * S.swayHorseSpeed : sp * S.swayWalk;
    s += state.aiming ? 0 : S.hipSpread; if (state.aiming) s *= S.adsSpreadMultiplier; if (fan) s += S.fanSpread; return s; }
  // ChatGPT's aim-assist cone (kept): a small, gentle pull towards a target near the crosshair, only while aiming
  function assist(o, dir) { if (!state.aiming) return dir; const lim = Math.cos(S.assistAngle * D2R * (mobile ? 1.4 : 1)); let best = null, sc = -1e9;
    for (const T of targets) { if (!T.alive) continue; v3.copy(T.c).sub(o); const dist = v3.length(); if (dist < .5 || dist > (state.weapon === 'rifle' ? S.rifleRange : S.revolverRange)) continue; v3.multiplyScalar(1 / dist); const dt = v3.dot(dir);
      if (dt > lim && dt - dist * .00003 > sc) { sc = dt - dist * .00003; best = v3.clone(); } }
    if (!best) return dir; const err = Math.acos(Math.min(1, best.dot(dir))) / D2R; // inside a small 'sticky' cone the sights settle on the target; further out it only nudges
    return dir.clone().lerp(best, err < (mobile ? 2.4 : 1.4) ? .92 : S.assistStrength).normalize(); }

  function canFire() { const w = state.weapon; if (!w || clock.draw > 0 || state.cycling || clock.cooldown > 0 || H.mountT > 0 || H.dismT > 0 || H.wantOff) return false;
    if (H.mounted && Math.abs(horseRel()) > S.horsebackYawLimit * D2R) { state.blocked = true; return false; } return true; }
  function shoot(fan) {
    const w = state.weapon; if (!canFire()) return false;
    if (state.ammo[w] <= 0) { click(900, .2); clock.cooldown = .25; if (!state.reloading) reload(); return false; }
    if (state.reloading) state.reloading = false; // firing interrupts the reload (one round at a time)
    state.ammo[w]--; state.shots++; clock.cooldown = w === 'revolver' ? (fan ? S.fanInterval : S.revolverInterval) : S.rifleInterval;
    if (w === 'revolver') clock.cock = clock.cooldown * .85; else { state.chambered = false; if (state.ammo.rifle > 0) { state.cycling = true; clock.lever = S.leverDuration; } }
    // crosshair ray from the camera (skip the player in front of a third-person camera), then the real bullet from the muzzle
    camera.getWorldDirection(v1); const o = camera.position.clone(), eye = H.mounted ? H.mounted.pos : P.pos; const skip = Math.max(0, v2.copy(eye).sub(o).dot(v1) + .6);
    o.addScaledVector(v1, skip); let dir = assist(o, v1.clone()); const sw = swayVec(); dir.x += sw.x; dir.y += sw.y; dir.z += sw.z; dir.normalize();
    const sp = spreadDeg(fan) * D2R, r = Math.random() * sp, a = Math.random() * 6.283; const rt = v2.crossVectors(dir, UP).normalize(), up2 = v3.crossVectors(rt, dir).normalize(); dir.addScaledVector(rt, Math.cos(a) * Math.tan(r)).addScaledVector(up2, Math.sin(a) * Math.tan(r)).normalize();
    clampHorse(dir);
    const maxR = w === 'rifle' ? S.rifleRange : S.revolverRange, aim = cast(o, dir, maxR); state.dbg = { aim: aim.kind, t: +aim.t.toFixed(1) }; const m = gun(); m.group.updateMatrixWorld(true); muz.copy(m.muzzle).applyMatrix4(m.group.matrixWorld);
    const bd = aim.p.clone().sub(muz); const L = bd.length(); bd.multiplyScalar(1 / Math.max(L, .001)); const hit = L > .3 ? cast(muz.clone().addScaledVector(bd, .05), bd, L + .5) : aim;
    effects(w, muz, bd, hit.p); impact(hit, bd); state.lastHit = { kind: hit.kind, target: hit.T ? hit.T.kind : null, point: hit.p.toArray().map(v => +v.toFixed(2)), mounted: !!H.mounted, weapon: w };
    clock.recoil = 1; const k = w === 'rifle' ? S.recoilRifle : S.recoilRevolver; P.pitch += k; clock.rec += k; H.shake = Math.max(H.shake || 0, w === 'rifle' ? .25 : .15);
    if (c.send) c.send({ t: 'sh', w: w === 'rifle' ? 2 : 1, o: muz.toArray().map(v => +v.toFixed(2)), e: hit.p.toArray().map(v => +v.toFixed(2)) });
    if (H.mounted && H.speed < .5) H.mounted.g.userData.spook = .4; // the horse flinches a little at the report
    return true; }

  function effects(w, p, d, end, remoteShot) {
    flash.position.copy(p).addScaledVector(d, .06); flash.lookAt(camera.position); flash.scale.setScalar((w === 'rifle' ? .34 : .26) * (.8 + Math.random() * .4)); flash.rotation.z = Math.random() * 6.28; flash.visible = true; clock.flash = .05;
    if (light) { light.position.copy(p); light.intensity = 14; }
    if (fx) { fx.tracer && fx.tracer(p.clone().addScaledVector(d, .4), end, 0xffd890, .05); fx.muzzle && fx.muzzle(p, [1, .75, .4], 1.2);
      if (fx.smoke) for (let i = 0; i < 3; i++) fx.smoke.emit(p.x + d.x * (.15 + i * .3), p.y + d.y * (.15 + i * .3), p.z + d.z * (.15 + i * .3), d.x * (1.6 - i * .4) + (Math.random() - .5) * .3, .2 + Math.random() * .2, d.z * (1.6 - i * .4) + (Math.random() - .5) * .3, .78, .76, .72, .18 + i * .08, 1.4 + i * .4, .8, -.04, .32); } // black-powder smoke
    const shot = () => sfx.shot(w === 'rifle' ? [1300, 95, .8] : [1650, 120, .65]); if (remoteShot && sfx.at) sfx.at(p, shot, .6); else if (sfx.shot) shot(); }

  function impact(hit, d) {
    const p = hit.p;
    if (hit.kind === 'target') { const T = hit.T; state.hits++;
      if (T.kind === 'bottle') { T.alive = false; T.mesh.visible = false; T.t = 0; if (fx) { fx.debris && fx.debris(p.x, p.y, p.z, T.col, 10, .8); fx.impact && fx.impact(p, [.8, 1, .9]); }
        for (let i = 0; i < 4; i++) setTimeout(() => tone('sine', 2600 + Math.random() * 2600, 1800, .08, .12), i * 35); state.score += 5; say('Bottle smashed  +5');
        if (targets.every(t => t.kind !== 'bottle' || !t.alive)) setTimeout(() => { for (const t of targets) if (t.kind === 'bottle') { t.alive = true; t.mesh.visible = true; } say('Fresh bottles on the rail'); }, 3000); }
      else if (T.kind === 'can') { T.fly = true; T.t = 0; T.v.set(d.x * 4.5 + (Math.random() - .5), 3.2 + Math.random() * 1.6, d.z * 4.5 + (Math.random() - .5)); T.w.set(Math.random() * 20 - 10, Math.random() * 8, Math.random() * 20 - 10);
        tone('triangle', 2300, 1500, .12, .25); tone('square', 900, 700, .04, .1); if (fx && fx.impact) fx.impact(p, [1, .9, .7]); state.score += 3; say('Ping!  +3'); }
      else { const lp = T.mesh.worldToLocal(p.clone()), rr = Math.hypot(lp.y, lp.z) / T.r, pts = rr < .12 ? 10 : rr < .27 ? 8 : rr < .45 ? 6 : rr < .62 ? 4 : 2; state.score += pts; say(pts === 10 ? "Bull's-eye!  +10" : 'Hit  +' + pts);
        let hm = T.holes[T.hi]; if (!hm) { hm = new THREE.Mesh(new THREE.PlaneGeometry(.05, .05), mats().hole); hm.rotation.y = Math.PI / 2; T.mesh.add(hm); T.holes[T.hi] = hm; } T.hi = (T.hi + 1) % 30; hm.position.set(.027, lp.y, lp.z);
        tone('sine', 220, 120, .25, .12); nz('lowpass', 500, 1, .25, .08); if (fx && fx.debris) fx.debris(p.x, p.y, p.z, 0xc9b48a, 4, .4); }
      return; }
    if (!fx) return;
    if (hit.kind === 'ground') { fx.debris && fx.debris(p.x, p.y + .03, p.z, 0x7d6a4c, 5, .55); fx.smoke && fx.smoke.emit(p.x, p.y + .05, p.z, 0, .4, 0, .55, .47, .36, .2, 1, .7, -.05, .45); }
    else if (hit.kind === 'rock') { fx.impact && fx.impact(p); fx.debris && fx.debris(p.x, p.y, p.z, 0x8a8478, 4, .6); tone('triangle', 3400, 1200, .05, .08); }
    else if (hit.kind === 'tree' || hit.kind === 'wood') { fx.debris && fx.debris(p.x, p.y, p.z, 0x6a4a2a, 5, .5); nz('bandpass', 900, 2, .12, .05); }
  }
  function updateTargets(dt) { for (const T of targets) {
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
      if (k > .3) { m1.lookAt(ZERO, dir, UP); q1.setFromRotationMatrix(m1); const fore = tgt.clone().add(new THREE.Vector3(0, -.01, -.36).applyQuaternion(q1)); ik(root, B, 'Left', fore, v3.set(0, -1, 0).addScaledVector(right, -.5).clone()); } }
    root.updateMatrixWorld(true); const hand = B.RightHand.getWorldPosition(new THREE.Vector3());
    m1.lookAt(ZERO, gd, UP); g.quaternion.setFromRotationMatrix(m1); g.position.copy(hand).add(new THREE.Vector3(0, -.01, -.035).applyQuaternion(g.quaternion)); g.scale.setScalar(1.3); g.visible = true; return true; } // a touch over life-size so it reads from the chase camera
  function poseFP(model, k) { const g = model.group; camera.updateMatrixWorld(); const w = model.kind; const off = w === 'rifle' ? [.11 * (1 - k), -.11 + .065 * k - .04 * (1 - k), -.32 - .05 * k] : [.16 * (1 - k), -.2 + .135 * k, -.4 - .05 * k];
    g.position.set(...off).applyMatrix4(camera.matrixWorld); g.quaternion.copy(camera.quaternion); g.scale.setScalar(1); if (k < 1) { q1.setFromAxisAngle(v1.set(1, 0, 0), -.35 * (1 - k)); g.quaternion.multiply(q1); } g.visible = true; }
  function animParts(m, rec, cock, lever) { if (m.kind === 'revolver') { m.hammer.rotation.x = cock ? -.55 : 0; m.cylinder.rotation.z = (state.shots % 6) * Math.PI / 3 * -1; m.group.rotateX(rec * .35); }
    else { m.lever.rotation.x = lever * .95; m.hammer.rotation.x = -.45; m.group.rotateX(rec * .15); m.group.translateZ(rec * .04); } }

  const swV = new THREE.Vector3();
  function swayVec() { const m = !!H.mounted, sp = Math.abs(m ? H.speed : H.fv.length()), amp = (m ? .0025 + sp * .0011 : .0006 + sp * .0005) * (state.aiming ? 1 : 2) * (state.weapon === 'rifle' ? .8 : 1);
    camera.getWorldDirection(v1); const rt = v2.crossVectors(v1, UP).normalize(); return swV.copy(rt).multiplyScalar(Math.sin(clock.sway * 1.7) * amp).addScaledVector(UP, Math.sin(clock.sway * 2.9 + 1) * amp * .8); }

  // ---- input (only while Horse Rider runs; nothing global outside the mode) ----
  const onKey = e => { if (!H.on || e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.code === 'Digit1') draw('revolver'); else if (e.code === 'Digit2') draw('rifle'); else if (e.code === 'KeyQ') { if (state.weapon) draw(state.weapon === 'revolver' ? 'rifle' : 'revolver'); else draw(state.last); }
    else if (e.code === 'KeyX') holster(); else if (e.code === 'KeyR') { reloadHeld = true; reload(); } };
  const onKeyUp = e => { if (e.code === 'KeyR') reloadHeld = false; };
  const okPointer = () => H.on && !mobile && (document.pointerLockElement || c.dev);
  const onDown = e => { if (!okPointer()) return; if (e.button === 0) { if (!state.weapon && !H.mountT) { draw(state.last); return; } fireHeld = true; firePend = true; } if (e.button === 2) aimHeld = true; };
  const onUp = e => { if (e.button === 0) fireHeld = false; if (e.button === 2) aimHeld = false; };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); c.renderer.domElement.addEventListener('mousedown', onDown); addEventListener('mouseup', onUp); addEventListener('blur', () => { fireHeld = aimHeld = reloadHeld = false; });

  // ---- HUD + phone buttons ----
  const $ = id => document.getElementById(id); let hudEl = null, crossEl = null;
  function syncUI() { document.body.classList.toggle('hr-gun', !!state.weapon); const b = $('tGun'); if (b) b.innerHTML = !state.weapon ? '🔫<small>DRAW</small>' : state.weapon === 'revolver' ? '🔫<small>RIFLE</small>' : '🔫<small>HOLSTER</small>'; if (!state.weapon) input.ads = false; }
  if (mobile && $('tGun')) { const b = $('tGun'); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycle(); }); }
  if (mobile && $('tFire')) $('tFire').addEventListener('pointerdown', () => { if (H.on && state.weapon) firePend = true; }); // a quick tap between two frames still fires
  function hud() {
    if (!hudEl) { hudEl = document.createElement('div'); hudEl.id = 'hrGun'; document.body.appendChild(hudEl); crossEl = document.createElement('div'); crossEl.id = 'hrCross'; crossEl.innerHTML = '<i></i>'; document.body.appendChild(crossEl); }
    const w = state.weapon; hudEl.hidden = !w && toast <= 0; crossEl.hidden = !w;
    if (w) { const n = state.ammo[w], mx = maxAmmo(w); let pips = ''; for (let i = 0; i < mx; i++) pips += `<b class="${i < n ? 'f' : ''}"></b>`;
      hudEl.innerHTML = `<span class="w">${w === 'revolver' ? 'SIX-SHOOTER' : 'LEVER RIFLE'}</span><span class="pips ${w}">${pips}</span>${state.reloading ? '<span class="rl">reloading…</span>' : n === 0 ? `<span class="rl">${mobile ? 'empty — reloading' : 'R to reload'}</span>` : ''}<span class="sc">🎯 ${state.hits} · ${state.score} pts</span>${toast > 0 ? `<em>${toastTxt}</em>` : ''}`;
      }
    else if (toast > 0) hudEl.innerHTML = `<em>${toastTxt}</em>`;
  }

  function cross() { if (!crossEl || crossEl.hidden) return; const sp = spreadDeg(false) * D2R, px = innerHeight / (2 * Math.tan(camera.fov * D2R / 2)), sw = swayVec(); camera.getWorldDirection(v1); const rt = v2.crossVectors(v1, UP).normalize();
    crossEl.style.transform = `translate(calc(-50% + ${(sw.dot(rt) * px).toFixed(1)}px), calc(-50% - ${(sw.dot(UP) * px).toFixed(1)}px))`; crossEl.firstChild.style.width = crossEl.firstChild.style.height = Math.max(6, Math.min(80, Math.tan(sp) * px * 2)).toFixed(0) + 'px';
    crossEl.classList.toggle('aim', state.aiming); crossEl.classList.toggle('no', state.blocked); }
  // ---- per frame (after the rider has been animated for this frame) ----
  function update(dt) {
    state.upd = (state.upd || 0) + 1; dt = Math.min(dt || 0, .1); for (const k of ['cooldown', 'flash', 'draw']) clock[k] = Math.max(0, clock[k] - dt); clock.sway += dt * (H.mounted ? 1 + Math.abs(H.speed) * .12 : 1); toast -= dt;
    clock.recoil = Math.max(0, clock.recoil - dt * 6); if (clock.rec > 0) { const r = Math.min(clock.rec, clock.rec * dt * 7 + dt * .01); P.pitch -= r * .8; clock.rec -= r; }
    if (clock.cock > 0) { clock.cock -= dt; if (clock.cock <= 0) click(3600, .1); }
    flash.visible = clock.flash > 0; if (light) light.intensity = clock.flash > 0 ? 14 * clock.flash / .05 : 0;
    updateTargets(dt);
    const w = state.weapon; if (w && (H.mountT > 0 || H.dismT > 0)) { for (const m of Object.values(models)) m.group.visible = false; state.aiming = false; H.gunAim = false; H.gunFace = null; return; }
    if (!w) { for (const m of Object.values(models)) m.group.visible = false; state.aiming = false; state.aimK += (0 - state.aimK) * Math.min(1, dt * 10); H.aimK = state.aimK; H.gunFace = null; return; }
    state.aiming = !!(aimHeld || input.ads); state.blocked = H.mounted ? Math.abs(horseRel()) > S.horsebackYawLimit * D2R : false;
    state.aimK += ((state.aiming ? 1 : 0) - state.aimK) * Math.min(1, dt * 12); H.aimK = state.aimK;
    if (H.mounted && state.aiming) { H.lookT = 0; H.recenter = true; } // aiming from the saddle = free look; the horse keeps its line
    H.gunFace = !H.mounted && (state.aiming || clock.cooldown > 0) ? P.yaw + (w === 'rifle' ? .3 : .12) : null;
    if (state.reloading) { clock.reload -= dt; if (clock.reload <= 0) { state.ammo[w] = Math.min(maxAmmo(w), state.ammo[w] + 1); click(2000 + Math.random() * 400, .12); state.reloading = false; // exactly one cartridge per cycle
        if (state.ammo[w] < maxAmmo(w) && (reloadHeld || mobile || state.autoRl)) reload(); else { state.autoRl = false; if (w === 'rifle' && !state.chambered) { state.cycling = true; clock.lever = S.leverDuration; } } } }
    if (state.cycling) { clock.lever -= dt; if (clock.lever <= 0) { state.cycling = false; state.chambered = state.ammo.rifle > 0; click(2600, .1); if (fx && fx.shell) { const m = models.rifle; v3.set(.03, .03, -.1).applyMatrix4(m.group.matrixWorld); fx.shell(v3.clone(), new THREE.Vector3(1.2, 2, .3).applyQuaternion(m.group.quaternion)); } }
      else if (Math.abs(clock.lever - S.leverDuration * .5) < dt) click(1700, .1); }
    const fh = !!(fireHeld || input.fire), fan = w === 'revolver' && (keys.KeyF || (mobile && !state.aiming)), want = firePend || (fh && (!lastFire || fan)), fired = want ? shoot(fan) : false; lastFire = fh; if (fired || !state.weapon) firePend = false; else if (firePend && clock.cooldown <= 0 && !state.cycling && clock.draw <= 0) firePend = false;
    if (fired) clock.idle = 0; else clock.idle += dt;
    if (state.ammo[w] === 0 && !state.reloading && !state.cycling && clock.cooldown <= 0) { state.autoRl = true; reload(); }
    if (mobile && clock.idle > 2.5 && !state.reloading && state.ammo[w] < maxAmmo(w) && !state.aiming) { state.autoRl = true; reload(); }
    // pose the gun
    const m = models[w], other = models[w === 'revolver' ? 'rifle' : 'revolver']; other.group.visible = false; const k = Math.min(1, state.aimK + (clock.cooldown > 0 ? .7 : 0)) * (1 - clock.draw / S.drawTime * .9);
    camera.getWorldDirection(aimDir); const lim = H.mounted && clampHorse(aimDir); state.clamped = !!lim;
    const rig = c.rig && c.rig();
    if (H.fp && !H.mounted) poseFP(m, k); else if (!rig || !poseOn(rig, w, m, aimDir, k, !!H.mounted, horseRel())) poseFP(m, k);
    animParts(m, clock.recoil, clock.cock <= 0, state.cycling ? Math.sin((1 - clock.lever / S.leverDuration) * Math.PI) : 0); m.group.updateMatrixWorld(true); cross();
  }

  // ---- multiplayer: show other riders' guns and shots (visual only — nobody can hurt anybody) ----
  const fin = (a, n) => Array.isArray(a) && a.length === n && a.every(v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 6000);
  function remoteShot(id, msg) { if (!msg || !fin(msg.o, 3) || !fin(msg.e, 3) || (msg.w !== 1 && msg.w !== 2)) return; const R = remote.get(id) || {}; const now = performance.now(); if (R.t && now - R.t < 90) return; R.t = now; remote.set(id, R);
    const o = new THREE.Vector3(...msg.o), e = new THREE.Vector3(...msg.e); if (o.distanceTo(camera.position) > 400) return; const d = e.clone().sub(o).normalize(); effects(msg.w === 2 ? 'rifle' : 'revolver', o, d, e, true); state.remoteShots = (state.remoteShots || 0) + 1; }
  function netState() { return { g: state.weapon === 'revolver' ? 1 : state.weapon === 'rifle' ? 2 : 0, a: state.aiming ? 1 : 0, ap: +P.pitch.toFixed(2) }; }
  function poseRemote(av, s, root, mounted) { // av: remote avatar; s: last net state
    if (!av.guns) { av.guns = { revolver: { ...models.revolver, group: models.revolver.group.clone() }, rifle: { ...models.rifle, group: models.rifle.group.clone() } }; for (const m of Object.values(av.guns)) { m.group.visible = false; scene.add(m.group); } }
    const w = s && s.g === 1 ? 'revolver' : s && s.g === 2 ? 'rifle' : null; for (const [k, m] of Object.entries(av.guns)) if (k !== w) m.group.visible = false; if (!w || !root || !root.visible) { if (w) av.guns[w].group.visible = false; return; }
    const yaw = typeof s.yw === 'number' ? s.yw : 0, pt = typeof s.ap === 'number' ? Math.max(-1.2, Math.min(1.2, s.ap)) : 0, dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt));
    if (!poseOn(root, w, av.guns[w], dir, s.a ? 1 : 0, mounted, 0)) av.guns[w].group.visible = false; }
  function disposeRemote(av) { if (av.guns) for (const m of Object.values(av.guns)) scene.remove(m.group); }
  // dev / test helper: point the camera so the crosshair sits on a world point
  function aimAt(p, sync) { for (let i = 0; i < 4; i++) { if (sync) sync(0); const d = v1.copy(p).sub(camera.position).normalize(); camera.getWorldDirection(v2);
      P.yaw += Math.atan2(-d.x, -d.z) - Math.atan2(-v2.x, -v2.z); P.yaw = Math.atan2(Math.sin(P.yaw), Math.cos(P.yaw)); P.pitch += Math.asin(Math.max(-1, Math.min(1, d.y))) - Math.asin(Math.max(-1, Math.min(1, v2.y))); } }

  return { state, settings: S, models, targets, range, update, hud, draw, holster, cycle, reload, shoot, netState, remoteShot, poseRemote, disposeRemote, aimAt, cast, syncUI };
}
