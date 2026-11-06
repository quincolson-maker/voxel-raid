// Graphics core: quality presets, procedural PBR texture atlas, sky/lighting, post-processing.
import * as THREE from 'three';
import { RGBELoader } from '../addons/loaders/RGBELoader.js';
import { EffectComposer } from '../addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from '../addons/postprocessing/GTAOPass.js';
import { OutputPass } from '../addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../addons/postprocessing/ShaderPass.js';
import { FXAAShader } from '../addons/shaders/FXAAShader.js';

// ---------------- Quality ----------------
export const PRESETS = {
  low:    { pr: 0.75, shadow: 0,    ao: false, bloom: false, msaa: 0, fxaa: false, trees: 70,  grass: 600,  particles: 500,  dist: 90,  light: false },
  medium: { pr: 1.0,  shadow: 1024, ao: false, bloom: true,  msaa: 0, fxaa: true,  trees: 140, grass: 2500, particles: 1000, dist: 130, light: false },
  high:   { pr: 1.5,  shadow: 2048, ao: true,  bloom: true,  msaa: 4, fxaa: false, trees: 220, grass: 9000, particles: 1800, dist: 190, light: true },
  ultra:  { pr: 2.0,  shadow: 4096, ao: true,  bloom: true,  msaa: 4, fxaa: false, trees: 320, grass: 16000, particles: 2600, dist: 250, light: true },
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

// ---------------- CC0 PBR material library (Poly Haven, see CREDITS.md) ----------------
const TL = new THREE.TextureLoader();
export const MATDEF = { // name -> [Poly Haven id, tile size in metres, extra]
  grass: ['sparse_grass', 2.5], dirt: ['dirt', 3], rock: ['aerial_rocks_02', 5], wall: ['concrete_wall_008', 3], concrete: ['concrete', 2.5],
  brick: ['red_brick_03', 2], hesco: ['hessian_230', 1.2], corrugated: ['corrugated_iron_02', 2], steel: ['metal_plate_02', 2, { metal: 1 }], timber: ['brown_planks_05', 2], bark: ['bark_brown_02', 1.5] };
export function loadPBR(renderer, hd) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()); const out = {};
  const ld = (id, k, size, srgb) => { const t = TL.load(`assets/tex/${id}_${k}_${size}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  for (const [name, [id, tile, ex]] of Object.entries(MATDEF)) {
    const set = { map: ld(id, 'diff', 512, true), normalMap: ld(id, 'nor', 512), arm: ld(id, 'arm', 512), tile, metal: ex?.metal || 0 };
    out[name] = set;
    if (hd) setTimeout(() => { for (const [k, key, srgb] of [['diff', 'map', true], ['nor', 'normalMap', false], ['arm', 'arm', false]]) TL.load(`assets/tex/${id}_${k}_1k.webp`, t => { set[key].image = t.image; set[key].needsUpdate = true; }); }, 1500);
  }
  return out;
}
export function pbrMaterial(set, o = {}) {
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, aoMap: set.arm, roughnessMap: set.arm, metalnessMap: set.arm, roughness: 1, metalness: set.metal ? 1 : 0, aoMapIntensity: .8, ...o });
}
// ---------------- Renderer, sky, lights, post ----------------
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying float vFogH;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z;\n vec4 fogWP = vec4( transformed, 1.0 );\n #ifdef USE_INSTANCING\n fogWP = instanceMatrix * fogWP;\n #endif\n vFogH = ( modelMatrix * fogWP ).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying float vFogH;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif';
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n #ifdef FOG_EXP2\n float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n fogFactor *= mix( 0.45, 1.0, exp( - max( vFogH - 1.0, 0.0 ) * 0.07 ) );\n #else\n float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n #endif\n gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif';
// cinematic lens pass: chromatic aberration, vignette, film grain (after tone mapping)
const LensShader = { uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uCA: { value: .0015 }, uGrain: { value: .04 }, uVig: { value: .35 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT,uCA,uGrain,uVig; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uT)*43758.5453);}
  void main(){ vec2 d=vUv-.5; float r2=dot(d,d); vec2 o=d*uCA*(1.+r2*4.); vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
  c*=1.-uVig*smoothstep(.1,.75,r2*2.2); c+=(h(vUv*1000.)-.5)*uGrain; gl_FragColor=vec4(c,1.); }` };
export const LIGHTING = {
  day:      { sun: [-.55, .62, -.56], col: 0xfff0dc, I: 3.2, hemi: .35, exp: .9, fog: 0xb4c2cc, fogK: 1, bg: .9, env: .7 },
  golden:   { sun: [-.8, .2, -.55], col: 0xffb070, I: 3.0, hemi: .25, exp: .95, fog: 0xd8b898, fogK: 1.2, bg: .75, env: .55 },
  overcast: { sun: [-.3, .9, -.3], col: 0xdde4ee, I: .8, hemi: .9, exp: 1.0, fog: 0x9aa4ac, fogK: 1.9, bg: .55, env: .9 },
  dusk:     { sun: [-.85, .08, -.5], col: 0xff7a40, I: 1.6, hemi: .18, exp: .8, fog: 0x6a6070, fogK: 1.5, bg: .3, env: .35 },
};
export function createGraphics(qname) {
  const Qp = { ...PRESETS[qname] };
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('auto') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Qp.pr)); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = Qp.shadow > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const FOG = new THREE.Color(0xb4c2cc); scene.fog = new THREE.FogExp2(FOG, 1.3 / Qp.dist); scene.background = FOG.clone();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
  const sunDir = new THREE.Vector3(-.55, .62, -.56).normalize();
  const pm = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load('assets/hdri/kloofendal_1k.hdr', hdr => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pm.fromEquirectangular(hdr).texture; scene.background = hdr; scene.backgroundIntensity = .9; scene.environmentIntensity = .7; scene.backgroundBlurriness = 0; });
  const hemi = new THREE.HemisphereLight(0xc8d8e8, 0x4a4a3a, .35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.2); sun.position.copy(sunDir).multiplyScalar(80); scene.add(sun); scene.add(sun.target);
  if (Qp.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(Qp.shadow, Qp.shadow); const s = sun.shadow.camera; const R = Qp.shadow >= 4096 ? 60 : 40; s.left = s.bottom = -R; s.right = s.top = R; s.near = 1; s.far = 220; sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; }
  // post
  let composer = null, aoPass = null, fxaa = null, lens = null;
  if (Qp.bloom || Qp.ao || Qp.fxaa) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Qp.msaa });
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
    if (Qp.ao) { aoPass = new GTAOPass(scene, camera, innerWidth, innerHeight); aoPass.updateGtaoMaterial({ radius: .6, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: qname === 'ultra' ? 16 : 10 }); aoPass.blendIntensity = .9; composer.addPass(aoPass); }
    if (Qp.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .18, .4, .95));
    composer.addPass(new OutputPass()); lens = new ShaderPass(LensShader); composer.addPass(lens);
    if (Qp.fxaa) { fxaa = new ShaderPass(FXAAShader); composer.addPass(fxaa); }
  }
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
    if (fxaa) { const pr = renderer.getPixelRatio(); fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr)); } };
  addEventListener('resize', resize); resize();
  function render() { return this.composer ? this.composer.render() : renderer.render(scene, camera); }
  const followSun = p => { sun.position.copy(p).addScaledVector(sunDir, 90); sun.target.position.copy(p); };
  const mats = new Set();
  function setLighting(name, wet) { const L = LIGHTING[name] || LIGHTING.day; sunDir.set(...L.sun).normalize(); sun.color.set(L.col); sun.intensity = L.I * (wet ? .45 : 1); hemi.intensity = L.hemi * (wet ? 1.4 : 1);
    renderer.toneMappingExposure = L.exp; scene.fog.color.set(L.fog); scene.fog.density = 1.3 / Qp.dist * L.fogK * (wet ? 1.5 : 1); scene.backgroundIntensity = L.bg * (wet ? .6 : 1); scene.environmentIntensity = L.env;
    hemi.color.set(L.fog); scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.isMeshStandardMaterial && m.userData.baseRough == null) { m.userData.baseRough = m.roughness; } for (const m of ms) if (m.isMeshStandardMaterial) m.roughness = wet ? m.userData.baseRough * .45 : m.userData.baseRough; }); }
  function setLens(on) { if (lens) lens.enabled = !!on; }
  return { setLighting, setLens, lens: () => lens, renderer, scene, camera, sun, sunDir, hemi, composer, aoPass, render, resize, Q: Qp, followSun,
    setPR(pr) { renderer.setPixelRatio(pr); resize(); }, disableAO() { if (aoPass) { aoPass.enabled = false; } } };
}
