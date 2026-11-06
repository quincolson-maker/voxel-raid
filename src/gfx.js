// Graphics core: quality presets, procedural PBR texture atlas, sky/lighting, post-processing.
import * as THREE from 'three';
import { Sky } from '../addons/objects/Sky.js';
import { EffectComposer } from '../addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from '../addons/postprocessing/GTAOPass.js';
import { OutputPass } from '../addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../addons/postprocessing/ShaderPass.js';
import { FXAAShader } from '../addons/shaders/FXAAShader.js';

// ---------------- Quality ----------------
export const PRESETS = {
  low:    { pr: 0.75, shadow: 0,    ao: false, bloom: false, msaa: 0, fxaa: false, trees: 70,  grass: 0,    particles: 500,  dist: 70,  light: false },
  medium: { pr: 1.0,  shadow: 1024, ao: false, bloom: true,  msaa: 0, fxaa: true,  trees: 140, grass: 1500, particles: 1000, dist: 100, light: false },
  high:   { pr: 1.5,  shadow: 2048, ao: true,  bloom: true,  msaa: 4, fxaa: false, trees: 220, grass: 4000, particles: 1800, dist: 140, light: true },
  ultra:  { pr: 2.0,  shadow: 4096, ao: true,  bloom: true,  msaa: 4, fxaa: false, trees: 320, grass: 8000, particles: 2600, dist: 180, light: true },
};
export const IS_TOUCH = new URLSearchParams(location.search).get('touch') === '1' ||
  (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
export function autoQuality() {
  let gpu = '';
  try { const c = document.createElement('canvas').getContext('webgl'); const e = c.getExtension('WEBGL_debug_renderer_info'); gpu = e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
  if (/swiftshader|llvmpipe|software/i.test(gpu)) return 'low';
  if (IS_TOUCH) return (navigator.deviceMemory || 4) >= 6 && (navigator.hardwareConcurrency || 4) >= 8 ? 'medium' : 'low';
  return 'high';
}
export function pickQuality() {
  const q = new URLSearchParams(location.search).get('q') || localStorage.getItem('vr_quality') || 'auto';
  return PRESETS[q] ? q : autoQuality();
}

// ---------------- Procedural texture atlas ----------------
export const TS = 64, COLS = 16, ROWS = 4;            // tile size, atlas cols, damage rows
export const TEX = { GRASS: 0, GRASS_SIDE: 1, DIRT: 2, TIMBER: 3, COBBLE: 4, PLATE: 5, RAMPART: 6, HEART: 7, HALL: 8, FORGE: 9, TIMBER_END: 10, SHINGLE_SIDE: 11 };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, p, s) { // tileable value noise with period p
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const g = (a, b) => hash(((a % p) + p) % p, ((b % p) + p) % p, s);
  return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
}
function fbm(x, y, s, oct = 4, base = 4) { let a = 0, amp = .5, f = base; for (let i = 0; i < oct; i++) { a += amp * vnoise(x / TS * f, y / TS * f, f, s + i * 17); amp *= .5; f *= 2; } return a; }
function voronoi(x, y, n, s) { // returns [d1, d2, cellId] tileable within TS
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let i = 0; i < n; i++) { const px = hash(i, 1, s) * TS, py = hash(i, 2, s) * TS;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const dx = x - (px + ox * TS), dy = y - (py + oy * TS); const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d; } }
  return [d1, d2, id];
}
const mix = (a, b, t) => a + (b - a) * t, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
// each generator returns [r,g,b (0-255), height 0-1, rough 0-1, metal 0-1]
const GEN = {
  [TEX.GRASS]: (x, y) => { const n = fbm(x, y, 3), b = hash(x, y, 9); const t = n * .8 + b * .2; return [mix(58, 110, t), mix(128, 182, t), mix(38, 60, t), .4 + b * .4, .85, 0]; },
  [TEX.DIRT]: (x, y) => { const n = fbm(x, y, 5), p = hash(x >> 2, y >> 2, 6) > .9 ? .25 : 0; return [mix(104, 148, n) + p * 120, mix(72, 104, n) + p * 110, mix(46, 66, n) + p * 100, n * .6 + p, .95, 0]; },
  [TEX.GRASS_SIDE]: (x, y) => { const edge = 14 + fbm(x, 0, 11, 2, 8) * 10 - 4; if (y < edge) { const g = GEN[TEX.GRASS](x, y); return g; } const d = GEN[TEX.DIRT](x, y); if (y < edge + 3) { d[0] *= .7; d[1] *= .7; d[2] *= .7; } return d; },
  [TEX.TIMBER]: (x, y) => { const pw = 16, plank = Math.floor(x / pw), lx = x % pw; const off = hash(plank, 0, 21) * 64; const gap = lx < 1 || ((y + off) % 64) < 1;
    const grain = Math.sin((lx + fbm(x, y + off, 23, 3, 8) * 9) * 1.6) * .5 + .5; const tone = .75 + hash(plank, 3, 4) * .25; const k = mix(.75, 1, grain) * tone * (gap ? .35 : 1);
    const nail = (lx - 8) ** 2 + (((y + off) % 64) - 6) ** 2 < 3; if (nail) return [70, 70, 75, .9, .4, .9];
    return [196 * k, 132 * k, 74 * k, gap ? 0 : .55 + grain * .2, .78, 0]; },
  [TEX.TIMBER_END]: (x, y) => { const r = Math.hypot(x - 32, y - 32) + fbm(x, y, 31, 3, 8) * 6; const ring = Math.sin(r * 1.1) * .5 + .5; const k = mix(.75, 1, ring); return [205 * k, 150 * k, 90 * k, .5 + ring * .2, .8, 0]; },
  [TEX.COBBLE]: (x, y) => { const [d1, d2, id] = voronoi(x, y, 14, 41); const e = d2 - d1; const mortar = e < 2.2; const tone = .72 + hash(id, 5, 7) * .28, n = fbm(x, y, 43, 3, 8);
    const k = (mortar ? .45 : tone * (0.85 + n * .3)); const h = mortar ? 0 : clamp(e / 8) * .8 + n * .2; return [150 * k, 152 * k, 158 * k, h, mortar ? 1 : .82, 0]; },
  [TEX.PLATE]: (x, y) => { const lx = x % 32, ly = y % 32; const seam = lx < 1 || ly < 1; const riv = [[4, 4], [28, 4], [4, 28], [28, 28]].some(([a, b]) => (lx - a) ** 2 + (ly - b) ** 2 < 5);
    const brushed = vnoise(x / 2, y / 24, 32, 51) * .15; const k = .78 + brushed + hash(x >> 5, y >> 5, 52) * .1;
    if (riv) return [190, 196, 205, 1, .25, 1]; return [140 * k * (seam ? .5 : 1), 158 * k * (seam ? .5 : 1), 180 * k * (seam ? .5 : 1), seam ? 0 : .5, .38 + brushed, .9]; },
  [TEX.RAMPART]: (x, y) => { const row = Math.floor(y / 16), bx = (x + (row % 2) * 16) % 32, by = y % 16; const id = row * 7 + Math.floor((x + (row % 2) * 16) / 32);
    const mortar = bx < 2 || by < 2; const n = fbm(x, y, 61, 3, 8); const tone = .7 + hash(id, 9, 62) * .3; const k = mortar ? .5 : tone * (.85 + n * .3);
    const bevel = mortar ? 0 : clamp(Math.min(bx - 2, 30 - bx, by - 2, 14 - by) / 3); return [126 * k, 112 * k, 150 * k, bevel * .8 + n * .2, mortar ? 1 : .8, 0]; },
  [TEX.HEART]: (x, y) => { const d = Math.abs(x - 32) + Math.abs(y - 32); const ring = d % 16 < 2; const gem = d < 8; const n = fbm(x, y, 71, 3, 8);
    if (gem) return [255, 90, 160, 1, .15, .2]; const k = .8 + n * .25 - (ring ? .25 : 0); return [245 * k, 190 * k, 70 * k, ring ? .2 : .6 + n * .2, .3, 1]; },
  [TEX.HALL]: (x, y) => { const sh = (y % 12), row = Math.floor(y / 12), lx = (x + (row % 2) * 8) % 16; const scal = sh + Math.abs(lx - 8) * .35; const edge = scal > 11; const tone = .8 + hash(Math.floor((x + (row % 2) * 8) / 16), row, 81) * .2;
    const k = tone * (edge ? .55 : 1) * (1 - sh / 40); return [196 * k, 92 * k, 64 * k, edge ? 0 : 1 - sh / 12, .7, 0]; },
  [TEX.FORGE]: (x, y) => { const lx = x % 21, ly = y % 21; const riv = (lx - 10) ** 2 + (ly - 10) ** 2 < 6; const seam = lx < 1 || ly < 1; const n = fbm(x, y, 91, 4, 8);
    const heat = clamp((n - .62) * 4); if (riv) return [110, 110, 120, 1, .3, 1]; const k = .5 + n * .35; return [70 * k + heat * 180, 74 * k + heat * 70, 84 * k, seam ? 0 : .5, .55, .85]; },
};
GEN[TEX.SHINGLE_SIDE] = GEN[TEX.HALL];
function crack(x, y, lvl, s) { // returns darkness 0..1 for damage levels 1..3
  if (!lvl) return 0; let c = 0;
  for (let k = 0; k < lvl * 2; k++) { // procedural crack paths: distance to a jagged polyline
    let px = hash(k, 1, s) * 64, py = hash(k, 2, s) * 64, ang = hash(k, 3, s) * 6.28;
    for (let st = 0; st < 10; st++) { const nx = px + Math.cos(ang) * 6, ny = py + Math.sin(ang) * 6;
      const t = clamp(((x - px) * (nx - px) + (y - py) * (ny - py)) / 36); const d = Math.hypot(x - (px + (nx - px) * t), y - (py + (ny - py) * t));
      if (d < 1.2) c = 1; else if (d < 2.2) c = Math.max(c, .4);
      px = nx; py = ny; ang += (hash(k, st, s + 5) - .5) * 1.6; } }
  return c;
}
export function buildAtlas(renderer) {
  const W = TS * COLS, H = TS * ROWS;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const ca = mk(), cn = mk(), cr = mk();
  const A = new ImageData(W, H), N = new ImageData(W, H), R = new ImageData(W, H); const hgt = new Float32Array(W * H);
  for (const key in GEN) { const col = +key;
    for (let row = 0; row < ROWS; row++) for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const v = GEN[col](x, y); const cr_ = crack(x, y, row, col * 13 + 7) * (col <= 2 ? 0 : 1); const k = 1 - cr_ * .75 - row * .06;
      const X = col * TS + x, Y = row * TS + y, i = (Y * W + X) * 4;
      A.data[i] = clamp(v[0] * k, 0, 255); A.data[i + 1] = clamp(v[1] * k, 0, 255); A.data[i + 2] = clamp(v[2] * k, 0, 255); A.data[i + 3] = 255;
      hgt[Y * W + X] = v[3] - cr_ * .6; R.data[i] = 255; R.data[i + 1] = clamp(v[4] + cr_ * .2) * 255; R.data[i + 2] = v[5] * 255; R.data[i + 3] = 255; } }
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { // sobel within tile (wrapping)
    const tx = Math.floor(X / TS) * TS, ty = Math.floor(Y / TS) * TS; const h = (x, y) => hgt[(ty + ((y - ty + TS) % TS)) * W + tx + ((x - tx + TS) % TS)];
    const dx = (h(X + 1, Y) - h(X - 1, Y)) * 2.2, dy = (h(X, Y + 1) - h(X, Y - 1)) * 2.2; const l = Math.hypot(dx, dy, 1); const i = (Y * W + X) * 4;
    N.data[i] = (-dx / l * .5 + .5) * 255; N.data[i + 1] = (dy / l * .5 + .5) * 255; N.data[i + 2] = (1 / l * .5 + .5) * 255; N.data[i + 3] = 255; }
  ca.getContext('2d').putImageData(A, 0, 0); cn.getContext('2d').putImageData(N, 0, 0); cr.getContext('2d').putImageData(R, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
  // a standalone repeating grass texture for terrain outside the playfield
  const g = document.createElement('canvas'); g.width = g.height = TS; g.getContext('2d').drawImage(ca, 0, 0, TS, TS, 0, 0, TS, TS);
  const grass = new THREE.CanvasTexture(g); grass.colorSpace = THREE.SRGBColorSpace; grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.anisotropy = 4;
  const gn = document.createElement('canvas'); gn.width = gn.height = TS; gn.getContext('2d').drawImage(cn, 0, 0, TS, TS, 0, 0, TS, TS);
  const grassN = new THREE.CanvasTexture(gn); grassN.wrapS = grassN.wrapT = THREE.RepeatWrapping;
  return { map: tex(ca, true), normal: tex(cn), rm: tex(cr), grass, grassN, canvas: ca };
}
export function tileUV(col, row) { const e = .6 / (TS * COLS), f = .6 / (TS * ROWS); return [col / COLS + e, 1 - (row + 1) / ROWS + f, (col + 1) / COLS - e, 1 - row / ROWS - f]; }

// ---------------- Renderer, sky, lights, post ----------------
export function createGraphics(qname) {
  const Qp = { ...PRESETS[qname] };
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('auto') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Qp.pr)); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = Qp.shadow > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const FOG = new THREE.Color(0xa9cbe8); scene.fog = new THREE.FogExp2(FOG, 1.3 / Qp.dist); scene.background = FOG.clone();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
  // sky
  const sky = new Sky(); sky.scale.setScalar(500); const su = sky.material.uniforms;
  su.turbidity.value = 4; su.rayleigh.value = 1.4; su.mieCoefficient.value = .004; su.mieDirectionalG.value = .85;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(215)); su.sunPosition.value.copy(sunDir);
  // environment map from sky (PBR reflections)
  const pm = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(500); sky2.material.uniforms.sunPosition.value.copy(sunDir);
  Object.assign(sky2.material.uniforms.turbidity, { value: 4 }); envScene.add(sky2); scene.environment = pm.fromScene(envScene, .04).texture; scene.environmentIntensity = .55;
  scene.add(sky); sky.material.fog = false;
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5c7a3a, .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6); sun.position.copy(sunDir).multiplyScalar(80); scene.add(sun); scene.add(sun.target);
  if (Qp.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(Qp.shadow, Qp.shadow); const s = sun.shadow.camera; s.left = s.bottom = -45; s.right = s.top = 45; s.near = 1; s.far = 220; sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; }
  // post
  let composer = null, aoPass = null, fxaa = null;
  if (Qp.bloom || Qp.ao || Qp.fxaa) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Qp.msaa });
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
    if (Qp.ao) { aoPass = new GTAOPass(scene, camera, innerWidth, innerHeight); aoPass.updateGtaoMaterial({ radius: .6, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: qname === 'ultra' ? 16 : 10 }); aoPass.blendIntensity = .9; composer.addPass(aoPass); }
    if (Qp.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .35, .5, .92));
    composer.addPass(new OutputPass());
    if (Qp.fxaa) { fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa); }
  }
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
    if (fxaa) { const pr = renderer.getPixelRatio(); fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); } };
  addEventListener('resize', resize); resize();
  function render() { return this.composer ? this.composer.render() : renderer.render(scene, camera); }
  const followSun = p => { sun.position.copy(p).addScaledVector(sunDir, 90); sun.target.position.copy(p); sky.position.copy(camera.position); };
  return { renderer, scene, camera, sun, sunDir, hemi, composer, aoPass, render, resize, Q: Qp, followSun,
    setPR(pr) { renderer.setPixelRatio(pr); resize(); }, disableAO() { if (aoPass) { aoPass.enabled = false; } } };
}
