// HORSE RIDER world graphics: large-scale terrain (domain-warped fBm hills, carved valleys, ridged-multifractal mountains out to ~4 km),
// physically based sky (Preetham Rayleigh/Mie) with layered procedural clouds, sky-driven IBL + aerial haze, slow golden-hour time of day,
// slope/height-blended PBR terrain (Poly Haven CC0), GPU instanced wind-blown grass with wildflowers, CC0 scanned boulders.
import * as THREE from 'three';
import { GLTFLoader } from '../addons/loaders/GLTFLoader.js';
const sstep = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------- noise (Perlin gradient noise, fBm, ridged multifractal) ----------------
const PERM = new Uint8Array(512); { const p = [...Array(256).keys()]; let s = 1337; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const GX_ = [1, -1, 1, -1, 1.414, -1.414, 0, 0], GZ_ = [1, 1, -1, -1, 0, 0, 1.414, -1.414];
export function pn(x, z) {
  const X = Math.floor(x), Z = Math.floor(z), xf = x - X, zf = z - Z, xi = X & 255, zi = Z & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const a = PERM[PERM[xi] + zi] & 7, b = PERM[PERM[xi + 1] + zi] & 7, c = PERM[PERM[xi] + zi + 1] & 7, d = PERM[PERM[xi + 1] + zi + 1] & 7;
  const ga = GX_[a] * xf + GZ_[a] * zf, gb = GX_[b] * (xf - 1) + GZ_[b] * zf, gc = GX_[c] * xf + GZ_[c] * (zf - 1), gd = GX_[d] * (xf - 1) + GZ_[d] * (zf - 1);
  const x1 = ga + u * (gb - ga), x2 = gc + u * (gd - gc); return (x1 + v * (x2 - x1)) * .75;
}
export function fbm(x, z, o) { let s = 0, a = .5, n = 0; for (let i = 0; i < o; i++) { s += pn(x, z) * a; n += a; a *= .5; const t = x; x = (x * .8 - z * .6) * 2.03 + 5.3; z = (t * .6 + z * .8) * 2.03 - 2.9; } return s / n; }
export function ridged(x, z, o) { let s = 0, a = .5, w = 1, n = 0; for (let i = 0; i < o; i++) { let v = 1 - Math.abs(pn(x, z)); v *= v; v *= w; w = Math.min(1, v * 1.9); s += v * a; n += a; a *= .5; const t = x; x = (x * .8 - z * .6) * 2.07 + 3.1; z = (t * .6 + z * .8) * 2.07 - 1.7; } return s / n; }
// raw height (m). EDGE = walkable half-extent; rolling meadows near the pen, bigger hills and valleys further out, mountains beyond.
export function makeRawH(EDGE) {
  return function rawH(x, z) {
    const r = Math.hypot(x, z);
    const wx = x + fbm(x * .0035 + 3.1, z * .0035 - 1.7, 3) * 110, wz = z + fbm(x * .0035 - 5.2, z * .0035 + 2.3, 3) * 110;
    const A = 9 + 24 * sstep(70, 330, r);
    let h = fbm(wx * .0042, wz * .0042, 5) * A + pn(wx * .03, wz * .03) * .7;
    const vl = 1 - Math.abs(fbm(wx * .0019 + 7.7, wz * .0019 - 3.3, 3)); h -= vl * vl * vl * vl * 24 * sstep(140, 360, r); // long valleys
    const m = sstep(EDGE - 90, EDGE + 330, r);
    if (m > 0) { const R = ridged(wx * .0011 + 1.3, wz * .0011 - .7, r > 900 ? 6 : 5); h += m * (30 + R * (150 + 560 * sstep(600, 2300, r))); }
    if (r > 600) { const k = sstep(600, 1250, r); h += k * (40 + ridged(wx * .0021 + 4.1, wz * .0021 - 2.6, 4) * 300); } // a taller second range behind the first ridge (outside the walkable area): layered skyline, snow caps
    return h;
  };
}
// ---------------- trails (polyline segments shared by the terrain shader, the grass and gameplay) ----------------
export function trailSegments(PEN, SPAWN) {
  const pts = [[PEN.x, PEN.z + PEN.hd + .5], [PEN.x + 1.5, PEN.z + 20], [SPAWN.x + 2, SPAWN.z + 6], [SPAWN.x - 3, SPAWN.z + 30], [PEN.x + 4, PEN.z + 85], [PEN.x - 6, PEN.z + 130], [PEN.x - 30, PEN.z + 175], [PEN.x - 70, PEN.z + 205]];
  const loop = [[PEN.x - PEN.hw - 3, PEN.z + PEN.hd + 3], [PEN.x - PEN.hw - 4, PEN.z - PEN.hd - 6], [PEN.x + PEN.hw + 4, PEN.z - PEN.hd - 6], [PEN.x + PEN.hw + 3, PEN.z + PEN.hd + 3], [PEN.x - PEN.hw - 3, PEN.z + PEN.hd + 3]];
  const seg = []; for (const L of [pts, loop]) for (let i = 0; i < L.length - 1; i++) seg.push([L[i][0], L[i][1], L[i + 1][0], L[i + 1][1]]);
  return seg; // 11 segments
}
export function segDist(px, pz, [ax, az, bx, bz]) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }

// ---------------- GLSL helpers ----------------
const GLSL_NOISE = `float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+1.),f.x),f.y);}
float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=vn(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p+3.1;a*=.5;}return s/.875;}`;
const GLSL_TRAIL = `uniform vec4 uSeg[11]; uniform vec4 uPen;
float trailD(vec2 p){float d=1e5;for(int i=0;i<11;i++){vec2 a=uSeg[i].xy,b=uSeg[i].zw,pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);d=min(d,length(pa-ba*h));}return d;}
float penM(vec2 p){return max(abs(p.x-uPen.x)-uPen.z,abs(p.y-uPen.y)-uPen.w);}`;

// ---------------- sky: Preetham atmosphere + layered clouds; also renders the IBL environment and measures the haze colour ----------------
export function createSky(renderer, scene, opt) {
  const U = { uSun: { value: new THREE.Vector3(0, .2, 1) }, uSunCol: { value: new THREE.Color(1, .8, .6) }, uAmb: { value: new THREE.Color(.35, .45, .6) }, uT: { value: 0 }, uCov: { value: .6 }, uEnc: { value: 1 }, uDisk: { value: 1 },
    uK: { value: .62 }, uGround: { value: new THREE.Color(.25, .26, .24) }, turbidity: { value: 4 }, rayleigh: { value: 2.6 }, mieCoefficient: { value: .0045 }, mieDirectionalG: { value: .82 } };
  const Q = opt.hq ? 5 : 3;
  const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false, defines: { CLOUD_OCT: Q },
    vertexShader: `uniform vec3 uSun; uniform float rayleigh, turbidity, mieCoefficient; varying vec3 vWorldPosition; varying vec3 vBetaR, vBetaM; varying float vSunE;
const float e=2.718281828459045; const vec3 totalRayleigh=vec3(5.804542996261093E-6,1.3562911419845635E-5,3.0265902468824876E-5); const vec3 MieConst=vec3(1.8399918514433978E14,2.7798023919660528E14,4.0790479543861094E14);
float sunIntensity(float c){c=clamp(c,-1.,1.);return 1000.*max(0.,1.-pow(e,-((1.6110731556870734-acos(c))/1.5)));}
void main(){ vec4 wp=modelMatrix*vec4(position,1.); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z=gl_Position.w;
 vSunE=sunIntensity(normalize(uSun).y); vBetaR=totalRayleigh*rayleigh; vBetaM=.434*(.2*turbidity)*10E-18*MieConst*mieCoefficient; }`,
    fragmentShader: `uniform vec3 uSun, uSunCol, uAmb, uGround; uniform float uT, uCov, uEnc, uDisk, uK, mieDirectionalG; varying vec3 vWorldPosition; varying vec3 vBetaR, vBetaM; varying float vSunE;
const float pi=3.141592653589793;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+1.),f.x),f.y);}
float cfbm(vec2 p){float s=0.,a=.5,n=0.;for(int i=0;i<CLOUD_OCT;i++){s+=vn(p)*a;n+=a;p=mat2(1.7,1.1,-1.1,1.7)*p+vec2(3.1,1.7);a*=.5;}return s/n;}
float dens(vec2 p){ float base=cfbm(p); float d=smoothstep(uCov,uCov+.28,base+.18*vn(p*.23+7.)); return d; }
vec3 atmo(vec3 dir){ vec3 sd=normalize(uSun); float za=acos(max(0.,dir.y)); float inv=1./(cos(za)+.15*pow(93.885-za*180./pi,-1.253));
 vec3 Fex=exp(-(vBetaR*8.4E3*inv+vBetaM*1.25E3*inv)); float ct=dot(dir,sd); float rP=.05968310365946075*(1.+pow(ct*.5+.5,2.)); float g2=mieDirectionalG*mieDirectionalG;
 float mP=.07957747154594767*((1.-g2)/pow(1.-2.*mieDirectionalG*ct+g2,1.5)); vec3 bR=vBetaR*rP, bM=vBetaM*mP;
 vec3 Lin=pow(vSunE*((bR+bM)/(vBetaR+vBetaM))*(1.-Fex),vec3(1.5)); Lin*=mix(vec3(1.),pow(vSunE*((bR+bM)/(vBetaR+vBetaM))*Fex,vec3(.5)),clamp(pow(1.-sd.y,5.),0.,1.));
 vec3 L0=vec3(.1)*Fex; float disk=smoothstep(.99995,.99997,ct); L0+=vSunE*19000.*Fex*disk*uEnc*uDisk;
 vec3 c=(Lin+L0)*.04+vec3(0.,.0003,.00075); return pow(c,vec3(1./2.4)); }
void main(){ vec3 dir=normalize(vWorldPosition-cameraPosition); vec3 sd=normalize(uSun); float ct=dot(dir,sd);
 vec3 up=dir; up.y=max(dir.y,0.); vec3 sky=atmo(normalize(up+vec3(0.,.001,0.)));
 // below the horizon: haze over the ground (the distant terrain sits in front of this anyway)
 if(dir.y<0.){ sky=mix(sky,uGround,smoothstep(0.,-.25,dir.y)); }
 // low cumulus layer (2.5D): density on a slab 1.6 km up, shaded by a short march towards the sun
 if(dir.y>0.){ float t=1600./max(dir.y,.035); vec2 p=dir.xz*t*.00042+vec2(uT*.0021,uT*.0007);
  float d=dens(p);
  if(d>0.003){ vec2 ls=normalize(sd.xz+1e-4)*.06; float od=dens(p+ls)+dens(p+ls*2.)*.7+dens(p+ls*3.5)*.5; float sh=exp(-od*1.6);
   float fw=pow(max(ct,0.),6.)*2.2+pow(max(ct,0.),40.)*4.; vec3 cs=uSunCol*(.55+1.7*sh)*(1.+fw*(1.-d)); vec3 ca=uAmb*mix(1.9,1.2,d);
   vec3 cc=(ca+cs*.9)*.85; float far=1.-exp(-t*.000065); cc=mix(cc,sky,far*.8); sky=mix(sky,cc,clamp(d*1.15,0.,1.)*smoothstep(.0,.1,dir.y)); }
  // high cirrus streaks 7 km up
  float t2=7000./max(dir.y,.05); vec2 q=dir.xz*t2*.00011+vec2(uT*.0009,-uT*.0003); q=vec2(q.x*.35,q.y*1.4); float ci=smoothstep(.55,.85,cfbm(q))*.42*smoothstep(.02,.2,dir.y);
  sky=mix(sky,uSunCol*.9+uAmb*.55+sky*.4,ci*(1.-exp(-t2*.00001)*.2)); }
 gl_FragColor=vec4(sky*uK*uEnc,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}` });
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const dome = new THREE.Mesh(geo, mat); dome.scale.setScalar(4500); dome.frustumCulled = false; dome.renderOrder = -10; scene.add(dome);
  const skyScene = new THREE.Scene(), dome2 = new THREE.Mesh(geo, mat); dome2.scale.setScalar(4500); dome2.frustumCulled = false; skyScene.add(dome2);
  const pm = new THREE.PMREMGenerator(renderer);
  const probe = new THREE.WebGLCubeRenderTarget(16, { type: THREE.UnsignedByteType }), cubeCam = new THREE.CubeCamera(.1, 6000, probe); skyScene.add(cubeCam);
  const S = { dome, U, sunDir: new THREE.Vector3(), sunCol: new THREE.Color(), horizon: new THREE.Color(.7, .7, .7), zenith: new THREE.Color(.3, .45, .7), sunSide: new THREE.Color(1, .8, .6), env: null, lastEl: -9, lastAz: -9, el: 0, az: 0 };
  const buf = new Uint8Array(16 * 16 * 4);
  function measure() { // average the horizon ring and the zenith of a tiny cube render (values encoded x0.25, linear)
    U.uEnc.value = .25; U.uDisk.value = 0; cubeCam.update(renderer, skyScene); U.uEnc.value = 1; U.uDisk.value = 1;
    const ring = [0, 0, 0], zen = [0, 0, 0], sun = [0, 0, 0]; let best = -2;
    for (const f of [0, 1, 4, 5]) { renderer.readRenderTargetPixels(probe, 0, 0, 16, 16, buf, f); // row 8 = horizon, slightly above it
      const col = [0, 0, 0]; for (let x = 0; x < 16; x++) { const i = (9 * 16 + x) * 4; for (let k = 0; k < 3; k++) col[k] += buf[i + k] / 255 * 4 / 16; }
      for (let k = 0; k < 3; k++) ring[k] += col[k] / 4;
      const fd = [[1, 0, 0], [-1, 0, 0], 0, 0, [0, 0, 1], [0, 0, -1]][f], dd = fd[0] * S.sunDir.x + fd[2] * S.sunDir.z; if (dd > best) { best = dd; sun[0] = col[0]; sun[1] = col[1]; sun[2] = col[2]; } }
    renderer.readRenderTargetPixels(probe, 0, 0, 16, 16, buf, 2); for (let i = 0; i < 256; i++) for (let k = 0; k < 3; k++) zen[k] += buf[i * 4 + k] / 255 * 4 / 256;
    // the cube render is in display-ish space (pow 1/2.4 inside the shader) -> fog/ambient want the same space as lit colours: use as is
    S.horizon.setRGB(...ring); S.zenith.setRGB(...zen); S.sunSide.setRGB(...sun);
  }
  function setSun(elDeg, azRad) { const el = elDeg * Math.PI / 180; S.el = elDeg; S.az = azRad; S.sunDir.set(Math.sin(azRad) * Math.cos(el), Math.sin(el), Math.cos(azRad) * Math.cos(el)); U.uSun.value.copy(S.sunDir);
    // direct sunlight colour through the atmosphere (Rayleigh ~ lambda^-4 + aerosol), Kasten-Young air mass
    const z = Math.PI / 2 - el, zd = z * 180 / Math.PI, m = 1 / (Math.cos(z) + .50572 * Math.pow(Math.max(.1, 96.07995 - zd), -1.6364)); const tau = [.06 + .075, .12 + .085, .27 + .1];
    S.sunCol.setRGB(Math.exp(-m * tau[0]), Math.exp(-m * tau[1]), Math.exp(-m * tau[2])); const mx = Math.max(S.sunCol.r, .001); S.sunCol.multiplyScalar(1 / mx); U.uSunCol.value.copy(S.sunCol).multiplyScalar(.9 + .3 * sstep(5, 30, elDeg)); }
  function regen() { measure(); U.uAmb.value.copy(S.zenith).lerp(S.horizon, .35); const old = S.env; U.uDisk.value = 0; S.env = pm.fromScene(skyScene, 0, .1, 6000); U.uDisk.value = 1; if (old) old.dispose(); S.lastEl = S.el; S.lastAz = S.az; return S.env.texture; }
  S.update = (dt, cam, force) => { U.uT.value += dt; dome.position.copy(cam.position); if (force || Math.abs(S.el - S.lastEl) > (opt.mobile ? .8 : .35) || Math.abs(S.az - S.lastAz) > .01) return regen(); return null; };
  S.setSun = setSun; S.measure = measure;
  return S;
}

// ---------------- terrain material: grass / dirt / trail / rock (triplanar) / snow blended by slope, height and masks ----------------
export function terrainMaterial(T, PEN, SEG, BASE, hq = true, o = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, normalMap: T.grass.n }); m.normalScale.set(1, 1); m.defines = {}; if (hq) m.defines.TERRAIN_HQ = '';
  if (o.hole) { m.defines.CHUNK_HOLE = ''; m.defines.CH_SIZE = o.CH.toFixed(1); m.defines.CH_LIM = o.LIM.toFixed(1); } // coarse terrain: sink + discard where the detail chunks are
  const XU = { uMask: { value: o.mask || null }, uMH: { value: o.maskHalf || 1 }, uChunk: o.chunkU || { value: new THREE.Vector4(0, 0, -1, 0) } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { tG: { value: T.grass.d }, tGa: { value: T.grass.a }, tG2: { value: T.grass2.d }, tD: { value: T.dirt.d }, tDn: { value: T.dirt.n }, tTr: { value: T.trail.d },
      tR: { value: T.rock.d }, tRn: { value: T.rock.n }, tS: { value: T.snow.d }, tSn: { value: T.snow.n }, uPen: { value: new THREE.Vector4(PEN.x, PEN.z, PEN.hw, PEN.hd) }, uSeg: { value: SEG.map(s => new THREE.Vector4(...s)) }, uBase: { value: BASE } }, XU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform vec4 uChunk;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef CHUNK_HOLE
{ vec2 cc=floor(position.xz/CH_SIZE); vec2 dc=abs(cc-uChunk.xy); if(uChunk.w>.5&&max(dc.x,dc.y)<=uChunk.z&&cc.x>=-CH_LIM&&cc.x<CH_LIM&&cc.y>=-CH_LIM&&cc.y<CH_LIM) transformed.y-=4.; }
#endif
vWP=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*normal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform sampler2D tG,tGa,tG2,tD,tDn,tTr,tR,tRn,tS,tSn,uMask; uniform float uBase,uMH; uniform vec4 uChunk;
${GLSL_NOISE}
${GLSL_TRAIL}
vec3 tri(sampler2D t, vec3 p, vec3 w){ return texture2D(t,p.zy).rgb*w.x+texture2D(t,p.xz).rgb*w.y+texture2D(t,p.xy).rgb*w.z; }`)
      .replace('#include <map_fragment>', `
#ifdef CHUNK_HOLE
{ vec2 cc=floor(vWP.xz/CH_SIZE); vec2 dc=abs(cc-uChunk.xy); if(uChunk.w>.5&&max(dc.x,dc.y)<=uChunk.z&&cc.x>=-CH_LIM&&cc.x<CH_LIM&&cc.y>=-CH_LIM&&cc.y<CH_LIM) discard; }
#endif
float dist=length(vWP-cameraPosition); vec2 xz=vWP.xz; float slope=1.-vWN.y; float hgt=vWP.y-uBase; float r0=length(xz);
float mv=vn(xz*.035)*.55+vn(xz*.17)*.3+vn(xz*.9)*.15; float macro=fbm3(xz*.0035);
vec2 uvG=xz/3.2; vec3 gA=texture2D(tG,uvG).rgb, gB=texture2D(tG,mat2(.8,-.6,.6,.8)*xz/11.+.37).rgb, g2=texture2D(tG2,xz/4.3).rgb;
vec3 grass=mix(gA,g2*vec3(.95,1.08,.78),.35+.3*(mv-.5)); grass=mix(grass,gB,smoothstep(15.,90.,dist)*.65);
grass*=mix(.84,1.1,mv)*vec3(.95,1.05,.82); grass=mix(grass,grass*vec3(1.22,1.06,.7),smoothstep(.55,.8,macro)*.55); grass=mix(grass,grass*vec3(.8,1.03,.82),smoothstep(.45,.2,macro)*.5);
float sunny=clamp(dot(vWN.xz,vec2(-.6,-.55))*3.,0.,1.); grass=mix(grass,grass*vec3(1.18,1.04,.72),sunny*smoothstep(.06,.25,slope)*.6); grass=mix(grass,grass*vec3(.82,1.06,.84),smoothstep(6.,-10.,hgt)*.55); grass*=mix(1.,.86,smoothstep(.1,.32,slope));
vec3 tw=pow(abs(vWN),vec3(4.)); tw/=tw.x+tw.y+tw.z; float slTri=smoothstep(.08,.24,slope); // v32: banks and cuts sample triplanar too (no stretched streaks)
vec3 dirt=texture2D(tD,xz/3.).rgb; if(slTri>0.){ dirt=mix(dirt,tri(tD,vWP/3.,tw),slTri); grass=mix(grass,tri(tG,vWP/3.2,tw)*mix(.84,1.1,mv)*vec3(.95,1.05,.82),slTri); } dirt*=vec3(.95,.9,.84); vec3 trail=texture2D(tTr,xz/2.6).rgb*vec3(1.02,.96,.88); vec3 rock=tri(tR,vWP/7.,tw)*vec3(.92,.9,.88); vec3 rockF=tri(tR,vWP/41.,tw); rock=mix(rock,rockF*vec3(.9,.88,.86),smoothstep(60.,400.,dist)*.7);
vec3 snow=texture2D(tS,xz/4.).rgb*vec3(.98,1.,1.04); rock=mix(rock,vec3(dot(rock,vec3(.3,.4,.3))),.4)*vec3(.9,.9,.95);
float pen=1.-smoothstep(-1.,1.3,penM(xz)+(vn(xz*.6)-.5)*1.6); float td=trailD(xz); float path=1.-smoothstep(.7,2.1,td+(vn(xz*.5)-.5)*1.4);
float worn=smoothstep(.7,.92,vn(xz*.08)*.7+vn(xz*.35)*.3)*(1.-smoothstep(200.,400.,r0)); float dm=max(pen*.95,worn*.6);
vec2 mk=texture2D(uMask,xz/(2.*uMH)+.5).rg; float tdM=(1.-mk.r)*8.; float path2=(1.-smoothstep(1.3,3.3,tdM+(vn(xz*.5)-.5)*1.5))*step(.004,mk.r); path=max(path,path2*.96);
float wd=(1.-mk.g)*30.; float moist=(1.-smoothstep(1.5,22.,wd))*step(.004,mk.g); float bank=(1.-smoothstep(.3,2.6,wd+(vn(xz*.45)-.5)*3.2))*step(.004,mk.g);
grass=mix(grass,grass*vec3(.74,1.12,.78),moist*.65); float speck=smoothstep(.74,.86,vn(xz*.85)+vn(xz*3.3)*.2)*(1.-moist)*(1.-smoothstep(10.,40.,dist)); dm=max(dm,speck*.55);
float rockW=smoothstep(.17,.34,slope+(mv-.5)*.12)+smoothstep(70.,150.,hgt+(macro-.5)*60.)*.7; rockW=clamp(rockW,0.,1.)*(1.-path2*.85)*(1.-bank*.6);
float sLine=355.-smoothstep(900.,2600.,r0)*90.+(vn(xz*.012)-.5)*55.-clamp(-vWN.z,0.,1.)*25.-(1.-smoothstep(.08,.4,slope))*28.; float snowW=smoothstep(sLine,sLine+45.,hgt+(macro-.5)*70.)*mix(1.,smoothstep(.15,.65,vn(xz*.05+vWP.y*.02)),smoothstep(.45,.78,slope))*(1.-smoothstep(.78,.92,slope)); 
rock*=mix(.86,1.08,vn(vec2(vWP.y*.07,macro*4.+xz.x*.002)))*mix(vec3(.86,.86,.9),vec3(1.04,.97,.88),vn(xz*.008)); rock*=mix(.62,1.,smoothstep(.25,.6,vn(vWP.xz*.06+vWP.y*.03)))*mix(1.,.8,smoothstep(.55,.9,slope));
// v32: sedimentary strata (warped height bands) + erosion gullies running down steep faces
float steep=smoothstep(.32,.62,slope); vec2 dh=normalize(vWN.xz+vec2(1e-4)); vec2 perp=vec2(-dh.y,dh.x);
float bandY=vWP.y+(vn(xz*.011)-.5)*26.+(vn(xz*.05)-.5)*5.; float st1=sin(bandY*.52)*.5+.5, st2=sin(bandY*2.1+vn(xz*.2)*3.)*.5+.5;
vec3 strata=mix(vec3(.84,.85,.9),vec3(1.1,1.,.86),smoothstep(.35,.75,st1))*mix(.86,1.08,st2);
float gully=smoothstep(.5,.82,vn(vec2(dot(xz,perp)*.32,vWP.y*.012+macro))*.7+vn(vec2(dot(xz,perp)*1.3,vWP.y*.05))*.3);
rock*=mix(vec3(1.),strata,steep*smoothstep(25.,70.,hgt)*.85)*mix(1.,.66,gully*steep); rock=mix(rock,rock*vec3(1.05,.98,.9),smoothstep(.6,.9,vn(xz*.004+3.))*.4);
float forest=smoothstep(380.,560.,r0)*(1.-smoothstep(.36,.55,slope))*(1.-smoothstep(110.,175.,hgt+(macro-.5)*50.))*smoothstep(.3,.55,fbm3(xz*.006+2.)); forest=max(forest,smoothstep(380.,520.,r0)*(1.-smoothstep(.45,.62,slope))*(1.-smoothstep(130.,175.,hgt))*smoothstep(25.,60.,hgt)*.85);
vec3 litter=mix(vec3(.085,.12,.065)*(.65+.7*vn(xz*.11))*(.85+.3*macro),dirt*vec3(.62,.55,.45)*(.8+.4*vn(xz*.6)),1.-smoothstep(30.,120.,dist)); // forest floor: needle litter up close
vec3 col=mix(grass,dirt,dm); col=mix(col,trail,path*.92); col=mix(col,litter,forest*.8); col=mix(col,rock,rockW); col=mix(col,mix(dirt*vec3(.5,.47,.44),trail*vec3(.8,.78,.74),vn(xz*.9)),bank*.7);
float belt=smoothstep(420.,560.,r0)*(1.-smoothstep(.42,.6,slope))*smoothstep(15.,45.,hgt)*(1.-smoothstep(120.,175.,hgt+(macro-.5)*60.))*smoothstep(.25,.5,fbm3(xz*.005+7.)); col=mix(col,vec3(.07,.1,.06)*(.7+.6*vn(xz*.09)),belt*.85); // conifer belt on the lower mountain flanks
snowW*=1.-path2*.45; col=mix(col,snow,snowW); col*=mix(1.,.82+.36*vn(xz*2.7),(1.-smoothstep(5.,28.,dist))*(1.-snowW)); // micro variation up close
vec4 gArm=texture2D(tGa,uvG); float ao=mix(gArm.r,1.,max(max(dm,path),rockW)); col*=mix(1.,ao,.8);
float tRough=mix(mix(mix(gArm.g,.97,dm),.98,path),.84,rockW); tRough=mix(tRough,.62,snowW); tRough=mix(tRough,.5,bank*.7); tRough=max(tRough,mix(.6,.96,smoothstep(40.,350.,dist))); // far, grazing terrain must not mirror the bright sky (white valley floors)
vec3 nG=texture2D(normalMap,vNormalMapUv*1.28).xyz*2.-1.; nG=normalize(nG+(texture2D(normalMap,xz/.85).xyz*2.-1.)*vec3(.7,.7,0.)*(1.-smoothstep(6.,26.,dist))); vec3 nD=texture2D(tDn,xz/3.).xyz*2.-1., nR=texture2D(tRn,xz/7.).xyz*2.-1., nS=texture2D(tSn,xz/4.).xyz*2.-1.;
vec3 tN=normalize(mix(mix(mix(nG,nD,max(dm,path)),nR*vec3(1.3,1.3,1.),rockW),nS,snowW)); float cliffW=smoothstep(.3,.55,slope)*rockW*(1.-snowW*.6)*(1.-smoothstep(150.,600.,dist)); tN.xy*=1.-smoothstep(60.,260.,dist)*.7;
#ifdef TERRAIN_HQ
float fd=smoothstep(30.,260.,dist); if(fd>0.){ vec2 q=xz*.022; float c0=fbm3(q), cx=fbm3(q+vec2(.12,0.)), cz=fbm3(q+vec2(0.,.12)); tN.xy+=vec2(cx-c0,cz-c0)*(5.+9.*rockW)*fd; tN=normalize(tN); }
#else
{ float fd=smoothstep(30.,260.,dist); vec2 q=xz*.022; float c0=vn(q*2.), cx=vn(q*2.+vec2(.24,0.)), cz=vn(q*2.+vec2(0.,.24)); tN.xy+=vec2(cx-c0,cz-c0)*(4.+6.*rockW)*fd; tN=normalize(tN); }
#endif
diffuseColor.rgb*=col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;').replace('#include <opaque_fragment>', `#if NUM_DIR_LIGHTS > 0
 { vec3 cell=floor(vWP*26.); float hs=fract(sin(dot(cell,vec3(12.9898,78.233,37.719)))*43758.5453); vec3 Vd=normalize(cameraPosition-vWP);
   float vk=fract(hs*91.7+dot(Vd,vec3(3.1,5.7,2.3))*1.6); float spk=step(.975,hs)*smoothstep(.9,1.,vk)*snowW*(1.-smoothstep(5.,55.,dist))*max(0.,dot(normal,directionalLights[0].direction));
   outgoingLight+=spk*directionalLights[0].color*.9; } // v32: snow glints that twinkle as the view moves
#endif
#include <opaque_fragment>`)
      .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP_TANGENTSPACE
 vec3 mapN = tN; mapN.xy *= normalScale; normal = normalize( tbn * mapN );
 float triW=max(cliffW,slTri*.9*(1.-smoothstep(150.,600.,dist)));
 if (triW > .01) { vec3 tw3=pow(abs(vWN),vec3(4.)); tw3/=tw3.x+tw3.y+tw3.z; vec3 N=vWN; // v32: triplanar (whiteout) rock / dirt normals on cliffs and banks, no stretching
  vec3 nx=texture2D(tRn,vWP.zy/6.).xyz*2.-1., ny=texture2D(tRn,vWP.xz/6.).xyz*2.-1., nz=texture2D(tRn,vWP.xy/6.).xyz*2.-1.;
  vec3 dx=texture2D(tDn,vWP.zy/3.).xyz*2.-1., dy=texture2D(tDn,vWP.xz/3.).xyz*2.-1., dz=texture2D(tDn,vWP.xy/3.).xyz*2.-1.; float rk=clamp(rockW*1.4,0.,1.);
  nx=mix(dx,nx,rk); ny=mix(dy,ny,rk); nz=mix(dz,nz,rk);
  nx=vec3(nx.xy*1.35+N.zy,abs(nx.z)*N.x); ny=vec3(ny.xy*1.35+N.xz,abs(ny.z)*N.y); nz=vec3(nz.xy*1.35+N.xy,abs(nz.z)*N.z);
  vec3 wn=normalize(nx.zyx*tw3.x+ny.xzy*tw3.y+nz.xyz*tw3.z); normal=normalize(mix(normal,normalize((viewMatrix*vec4(wn,0.)).xyz),triW)); }
#endif`); };
  return m;
}
export function loadTerrainTextures(renderer, hd) {
  const L = new THREE.TextureLoader(), aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()), sz = hd ? '1k' : '512';
  const ld = (id, k, srgb) => { const t = L.load(`assets/tex/${id}_${k}_${sz}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { grass: { d: ld('leafy_grass', 'diff', true), n: ld('leafy_grass', 'nor'), a: ld('leafy_grass', 'arm') }, grass2: { d: ld('sparse_grass', 'diff', true) }, dirt: { d: ld('dirt', 'diff', true), n: ld('dirt', 'nor') },
    trail: { d: ld('rocky_trail', 'diff', true) }, rock: { d: ld('rock_face', 'diff', true), n: ld('rock_face', 'nor') }, snow: { d: ld('snow_02', 'diff', true), n: ld('snow_02', 'nor') } };
}
// inner terrain (square, +-HALF m) + far ring out to ~4.2 km for the mountain silhouettes; returns the inner heightmap for the GPU grass
export function buildTerrain(scene, mat, hAt, HALF, seg, farRings, farSegs, holeMat = mat) { // inner + far use holeMat (they make way for the streamed detail chunks)
  const step = HALF * 2 / seg, BASE = hAt(0, 0);
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = hAt(x, z); p.setY(i, y); uv.setXY(i, x / 2.5, z / 2.5); }
  geo.computeVertexNormals(); const inner = new THREE.Mesh(geo, holeMat); inner.receiveShadow = true; scene.add(inner);
  { // skirt: a 40 m curtain hanging from the inner square's rim, so no sky shows through where it meets the far ring
    const sp = [], si = [], sn = []; const rim = []; for (let i = 0; i <= seg; i++) rim.push([-HALF + i * step, -HALF]); for (let i = 1; i <= seg; i++) rim.push([HALF, -HALF + i * step]); for (let i = 1; i <= seg; i++) rim.push([HALF - i * step, HALF]); for (let i = 1; i <= seg; i++) rim.push([-HALF, HALF - i * step]);
    for (const [x, z] of rim) { const y = hAt(x, z), l = Math.hypot(x, z); sp.push(x, y, z, x, y - 40, z); sn.push(x / l, .3, z / l, x / l, .3, z / l); }
    for (let i = 0; i < rim.length - 1; i++) { const a = i * 2; si.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(sp.length / 3 * 2), 2)); sg.setIndex(si);
    const sk = new THREE.Mesh(sg, mat); sk.material = mat.clone(); sk.material.side = THREE.DoubleSide; sk.material.onBeforeCompile = mat.onBeforeCompile; sk.frustumCulled = false; scene.add(sk); }
  // far ring: polar grid, exponential radial spacing; sunk a little where it overlaps the inner square so the two never fight
  const r0 = HALF * .96, r1 = 4300, pos = [], uvs = [], idx = [];
  for (let j = 0; j <= farRings; j++) { const r = r0 * Math.pow(r1 / r0, j / farRings); for (let i = 0; i <= farSegs; i++) { const a = i / farSegs * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const inSq = Math.max(Math.abs(x), Math.abs(z)) < HALF + 2; pos.push(x, hAt(x, z) - (inSq ? 1.2 : 0), z); uvs.push(x / 2.5, z / 2.5); } }
  for (let j = 0; j < farRings; j++) for (let i = 0; i < farSegs; i++) { const a = j * (farSegs + 1) + i, b = a + farSegs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); } // CCW from above (the old order faced down, so only far-side slopes drew and valleys showed sky)
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.setIndex(idx); fg.computeVertexNormals();
  const far = new THREE.Mesh(fg, holeMat); far.receiveShadow = false; far.frustumCulled = false; scene.add(far);
  return { inner, far, BASE, HALF };
}
function toHalf(f) { const o = new Uint16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = THREE.DataUtils.toHalfFloat(f[i]); return o; }

// ---------------- GPU grass: tufts of blades on a camera-following world grid (stable, no CPU scatter), wind, wildflowers, distance fade ----------------
function tuftGeometry(blades) {
  const pos = [], hgt = [], nor = [], head = [], idx = []; let v = 0; const r = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let b = 0; b < blades; b++) { const a = r() * Math.PI * 2, ox = Math.cos(a) * Math.sqrt(r()) * .26, oz = Math.sin(a) * Math.sqrt(r()) * .26, w = .03 + r() * .026, lean = (r() - .5) * .7, dir = r() * Math.PI * 2, H = .42 + r() * .6;
    const cx = Math.cos(dir), cz = Math.sin(dir), segs = 3;
    for (let s = 0; s <= segs; s++) { const t = s / segs, ww = w * (1 - t * .92), bx = ox + Math.sin(dir + 1.57) * lean * t * t * H, bz = oz + Math.cos(dir + 1.57) * lean * t * t * H;
      for (const sd of [-1, 1]) { pos.push(bx + cx * ww * sd, t * H, bz + cz * ww * sd); hgt.push(t); nor.push(-cz, .6, cx); head.push(0); } }
    for (let s = 0; s < segs; s++) { const q = v + s * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } v += (segs + 1) * 2;
    if (b === 0) { const tx = ox + Math.sin(dir + 1.57) * lean * H, tz = oz + Math.cos(dir + 1.57) * lean * H, R = .05; // flower head (only shown on flower tufts)
      for (const [dx, dy, dz] of [[R, 0, 0], [0, R, 0], [-R, 0, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]]) { pos.push(tx + dx, H + dy, tz + dz); hgt.push(1); nor.push(0, 1, 0); head.push(1); }
      idx.push(v, v + 1, v + 4, v + 1, v + 2, v + 4, v + 2, v + 3, v + 4, v + 3, v, v + 4, v, v + 1, v + 5, v + 1, v + 2, v + 5, v + 2, v + 3, v + 5, v + 3, v, v + 5); v += 6; } }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1)); g.setAttribute('aHead', new THREE.Float32BufferAttribute(head, 1)); g.setIndex(idx); return g;
}
export function createGrass(scene, T, PEN, SEG, opt) {
  const N = opt.N, R = opt.R, cell = R * 2 / N, g = tuftGeometry(opt.blades || 4); g.instanceCount = N * N; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  // local height map that follows the camera (HM x HM texels over 2*(R+24) m), rebuilt a few rows per frame into a back buffer, then swapped in
  const HM = 128, SPAN = 2 * (R + 24), hAt = opt.hAt, bufs = [0, 1].map(() => new Uint16Array(HM * HM)), texs = bufs.map(b => { const t = new THREE.DataTexture(b, HM, HM, THREE.RedFormat, THREE.HalfFloatType); t.minFilter = t.magFilter = THREE.LinearFilter; return t; });
  const LH = { cur: -1, back: 0, row: HM + 1, ox: 0, oz: 0, nx: 0, nz: 0, off: 0 };
  const fill = (rows) => { const b = bufs[LH.back], px = SPAN / (HM - 1); for (let n = 0; n < rows && LH.row < HM; n++, LH.row++) { const j = LH.row; for (let i = 0; i < HM; i++) b[j * HM + i] = THREE.DataUtils.toHalfFloat(hAt(LH.nx + i * px, LH.nz + j * px) - LH.off); } // relative to the map centre: half floats stay cm-accurate up in the mountains
    if (LH.row >= HM) { texs[LH.back].needsUpdate = true; U.uHm.value = texs[LH.back]; U.uHmO.value.set(LH.nx, LH.nz, SPAN, LH.off); LH.cur = LH.back; LH.back = 1 - LH.back; LH.row = HM + 1; } };
  const U = { uHm: { value: texs[0] }, uHmO: { value: new THREE.Vector4(-1e5, -1e5, SPAN, 0) }, uMask: { value: opt.mask || null }, uMH: { value: opt.maskHalf || 1 }, uBase: { value: T.BASE }, uCam: { value: new THREE.Vector3() }, uN: { value: N }, uCell: { value: cell }, uR: { value: R }, uTime: { value: 0 },
    uCave: { value: opt.cave ? new THREE.Vector4(...opt.cave) : new THREE.Vector4(1e6, 1e6, 0, 0) }, uPen: { value: new THREE.Vector4(PEN.x, PEN.z, PEN.hw, PEN.hd) }, uSeg: { value: SEG.map(s => new THREE.Vector4(...s)) }, uSunV: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color() }, uWind: { value: 1 } };
  const m = new THREE.MeshStandardMaterial({ roughness: .78, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform vec4 uCave; attribute float aH; attribute float aHead; uniform sampler2D uHm, uMask; uniform float uBase, uN, uCell, uR, uTime, uWind, uMH; uniform vec3 uCam; uniform vec4 uHmO; varying vec3 vGC; varying float vTr;
${GLSL_NOISE}
${GLSL_TRAIL}
float hgt(vec2 p){ return texture2D(uHm,((p-uHmO.xy)/uHmO.z*127.+.5)/128.).r+uHmO.w; }
float h1(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}`)
      .replace('#include <beginnormal_vertex>', `float fi=float(gl_InstanceID); vec2 ij=vec2(mod(fi,uN),floor(fi/uN)); vec2 c0=floor(uCam.xz/uCell)-floor(uN*.5); vec2 cw=c0+ij;
vec2 jit=vec2(h1(cw),h1(cw+17.3)); vec2 base=(cw+jit)*uCell; float dCam=length(base-uCam.xz); float rnd=h1(cw+5.1), rot=h1(cw+9.7)*6.2832;
float pen=penM(base); float td=trailD(base); vec2 lq=(base-uHmO.xy)/uHmO.z-vec2(.004); float e=min(min(lq.x,lq.y),1.-max(lq.x,lq.y)); vec2 mk=texture2D(uMask,base/(2.*uMH)+.5).rg; float tdM=mix(99.,(1.-mk.r)*8.,step(.004,mk.r)), wd=mix(99.,(1.-mk.g)*30.,step(.004,mk.g));
float hC=hgt(base), hX=hgt(base+vec2(1.,0.)), hZ=hgt(base+vec2(0.,1.)); float slope=length(vec2(hX-hC,hZ-hC));
float macro=fbm3(base*.0035); float keep=step(rnd,1.-smoothstep(uR*.45,uR,dCam)*.75)*step(.4,pen)*step(1.05+h1(cw+3.)*.6,td)*step(slope,.5)*step(hC-uBase,185.+vn(base*.01)*50.)*step(0.,e)*step(2.2+h1(cw+6.)*.8,tdM)*step(1.6,wd)*step(.5,max(abs(base.x-uCave.x)-uCave.z,abs(base.y-uCave.y)-uCave.w)); // none inside Bandit Falls
keep*=1.-step(h1(cw+8.),smoothstep(.7,.92,vn(base*.08)*.7+vn(base*.35)*.3)*.85); // worn patches
float sc=keep*(1.-smoothstep(uR*.72,uR,dCam))*(.55+h1(cw+1.)*.75)*mix(.7,1.25,smoothstep(.3,.7,macro))*mix(1.,1.3,1.-smoothstep(2.,14.,wd))*mix(1.,.6,smoothstep(90.,170.,hC-uBase)); float flower=step(h1(cw+11.),.03+.17*smoothstep(.62,.85,vn(base*.022+3.1))); // patchy wildflower meadows
float cr=cos(rot), sr=sin(rot); vec3 lp=vec3(position.x*cr-position.z*sr, position.y, position.x*sr+position.z*cr)*sc; lp.y*=mix(.75,1.35,vn(base*.11));
// wind: travelling gusts + per-tuft flutter; bend grows with height^2
float gust=sin(dot(base,vec2(.13,.07))-uTime*1.9)*.5+.5; gust=gust*gust*(.6+.8*vn(base*.03+uTime*.15)); float flut=sin(uTime*4.3+rnd*30.)*.12;
float bend=(gust*.55+.12+flut)*uWind*aH*aH; lp.x+=bend*.55*sc; lp.z+=bend*.28*sc; lp.y-=bend*bend*.18*sc;
vec3 objectNormal=normalize(vec3(normal.x*cr-normal.z*sr,normal.y,normal.x*sr+normal.z*cr)+vec3(0.,1.2,0.));
vec3 gpos=vec3(base.x,hC-.04,base.y)+lp*(1.-aHead*(1.-flower));
vec3 dry=mix(vec3(.17,.24,.06),vec3(.36,.32,.12),smoothstep(.5,.8,macro)); vec3 tip=mix(vec3(.38,.5,.15),vec3(.62,.56,.28),smoothstep(.48,.78,macro));
vGC=mix(dry,tip,aH)*mix(.82,1.15,h1(cw+4.)); vec3 fc=h1(cw+12.)<.4?vec3(.95,.92,.8):h1(cw+12.)<.7?vec3(.95,.75,.1):vec3(.55,.35,.85); vGC=mix(vGC,fc,aHead*flower); vTr=aH;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = gpos;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vTr; uniform vec3 uSunV; uniform vec3 uSunC;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vGC;')
      .replace('#include <opaque_fragment>', 'float bk=pow(max(dot(normalize(-vViewPosition),uSunV),0.),3.); outgoingLight += vGC*uSunC*bk*vTr*1.6; outgoingLight*=mix(.55,1.,vTr);\n#include <opaque_fragment>'); };
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; scene.add(mesh);
  const v = new THREE.Vector3();
  return { mesh, U, LH, bufs, update(dt, cam, sunDir, sunCol, wind) { U.uTime.value += dt; U.uCam.value.copy(cam.position);
    { const cx = cam.position.x - SPAN / 2, cz = cam.position.z - SPAN / 2; if (LH.row > HM && (LH.cur < 0 || Math.max(Math.abs(cx - LH.ox), Math.abs(cz - LH.oz)) > 14)) { LH.nx = Math.round(cx); LH.nz = Math.round(cz); LH.off = Math.round(hAt(cam.position.x, cam.position.z)); LH.row = 0; } if (LH.row < HM) { fill(LH.cur < 0 || Math.max(Math.abs(cx - LH.ox), Math.abs(cz - LH.oz)) > SPAN * .3 ? HM : opt.mobile ? 10 : 18); /* teleports / respawns: all at once */ if (LH.row > HM) { LH.ox = LH.nx; LH.oz = LH.nz; } } } U.uSunV.value.copy(sunDir).transformDirection(cam.matrixWorldInverse); U.uSunC.value.copy(sunCol); U.uWind.value = wind; }, tris: g.index.count / 3 * N * N };
}
// ---------------- CC0 scanned boulders (Poly Haven) ----------------
export function loadRockModels() {
  const L = new GLTFLoader(), ids = ['namaqualand_boulder_02', 'namaqualand_boulder_04', 'namaqualand_boulder_05'];
  return Promise.all(ids.map(id => L.loadAsync(`assets/models/rock_${id}.glb`))).then(gs => gs.map(g => { let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); mesh.updateWorldMatrix(true, false);
    const src = mesh.geometry, geo = new THREE.BufferGeometry(); geo.setIndex(src.index);
    for (const [k, a] of Object.entries(src.attributes)) { const n = a.count, s = a.itemSize, f = new Float32Array(n * s), get = ['getX', 'getY', 'getZ', 'getW']; for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) f[i * s + c] = a[get[c]](i); geo.setAttribute(k, new THREE.BufferAttribute(f, s)); }
    geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox(); const bb = geo.boundingBox, sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z; geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const s = 1 / Math.max(sx, sz); geo.scale(s, s, s); geo.computeBoundingSphere(); mesh.material.envMapIntensity = 1; return { geo, mat: mesh.material, h: (bb.max.y - bb.min.y) * s }; }));
}
