// Effects: GPU point particles, instanced debris chunks, tracers, damage numbers, synthesized WebAudio SFX.
import * as THREE from 'three';
const VS = `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/max(.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FS = `varying float vA; varying vec3 vC; uniform float soft; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); if(d>.5) discard; float a=vA*smoothstep(.5,.5-soft,d); gl_FragColor=vec4(vC,a); }`;
class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0; const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.a0 = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { scale: { value: 400 }, soft: { value: additive ? .5 : .25 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g; this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, r, gg, b, size, life, grow = 0, grav = 0, a0 = 1) { const i = this.i; this.i = (this.i + 1) % this.n; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz; this.col[k] = r; this.col[k + 1] = gg; this.col[k + 2] = b;
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.grav[i] = grav; this.a0[i] = a0; this.alpha[i] = a0; this.active = 2; }
  update(dt) { if (!this.active) return; let any = 0;
    for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) { if (this.alpha[i]) this.alpha[i] = 0; continue; } any = 1; this.life[i] -= dt; const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt; const drag = 1 - Math.min(1, dt * 1.5); this.vel[k] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt; this.size[i] += this.grow[i] * dt;
      this.alpha[i] = Math.max(0, this.a0[i] * this.life[i] / this.max[i]); }
    for (const a of ['position', 'color', 'size', 'alpha']) this.g.attributes[a].needsUpdate = true; if (!any) this.active--; }
}
export class FX {
  constructor(scene, camera, renderer, Q, solid) {
    this.scene = scene; this.camera = camera; this.renderer = renderer; this.solid = solid;
    this.add = new Pool(scene, Math.round(Q.particles * .6), true); this.smoke = new Pool(scene, Math.round(Q.particles * .4), false);
    const nd = Math.round(Q.particles / 4); this.deb = new THREE.InstancedMesh(shardGeo(), new THREE.MeshStandardMaterial({ roughness: .8 }), nd);
    this.deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.deb.castShadow = false; this.deb.frustumCulled = false; scene.add(this.deb);
    this.d = Array.from({ length: nd }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0, s: 1 })); this.di = 0;
    const c = new THREE.Color(1, 1, 1); for (let i = 0; i < nd; i++) { this.deb.setColorAt(i, c); this.deb.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
    this.tracers = []; this.trMat = {}; this.light = Q.light ? new THREE.PointLight(0xffb060, 0, 14, 2) : null; if (this.light) scene.add(this.light); this.lightT = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion();
    this.nums = []; this.numLayer = document.getElementById('nums');
    // decals: bullet holes + scorch marks (instanced quads, procedural textures), tracked per voxel cell so they vanish with it
    const mkDecal = (tex, n, op) => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: .9, opacity: op }), n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.renderOrder = 2; const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) m.setMatrixAt(i, z); scene.add(m); return { m, i: 0, cells: new Array(n) }; };
    this.holes = mkDecal(holeTex(), Q.particles > 900 ? 300 : 120, 1); this.scorch = mkDecal(scorchTex(), 40, .85);
    // ejected brass
    this.shellM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.006, .006, .03, 6), new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: .3 }), 40); this.shellM.frustumCulled = false; scene.add(this.shellM);
    this.shells = Array.from({ length: 40 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), life: 0 })); this.si = 0;
    for (let i = 0; i < 40; i++) this.shellM.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.rain = null; this.Q = Q;
  }
  decal(kind, p, n, size, cell) { const D = kind == 'hole' ? this.holes : this.scorch; const i = D.i; D.i = (D.i + 1) % D.cells.length; D.cells[i] = cell;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
    this.m4.compose(p.clone().addScaledVector(n, .012), q, new THREE.Vector3(size, size, size)); D.m.setMatrixAt(i, this.m4); D.m.instanceMatrix.needsUpdate = true; }
  clearCell(key) { for (const D of [this.holes, this.scorch]) { let ch = false; D.cells.forEach((c, i) => { if (c === key) { D.m.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); D.cells[i] = null; ch = true; } }); if (ch) D.m.instanceMatrix.needsUpdate = true; } }
  impactMat(p, n, kind) { // material-specific impact particles
    const e = (k, cnt, sp, col, size, life, grav, pool = this.smoke, a0 = .7, up = 1) => { for (let i = 0; i < cnt; i++) pool.emit(p.x + n.x * .05, p.y + n.y * .05, p.z + n.z * .05, n.x * sp * up + (Math.random() - .5) * sp, n.y * sp * up + Math.random() * sp * .6, n.z * sp * up + (Math.random() - .5) * sp, ...col, size * (.6 + Math.random() * .8), life * (.6 + Math.random() * .8), size * 1.5, grav, a0); };
    if (kind == 'steel' || kind == 'corrugated') { e(0, 10, 6, [1, .75, .35], .06, .25, 12, this.add, 1, 1.4); e(0, 1, .6, [.5, .5, .5], .25, .4, 0); }
    else if (kind == 'timber') { e(0, 3, 1, [.45, .35, .22], .3, .7, 0); this.debrisRaw(p, 0x8a6a48, 3, .5, .35); }
    else if (kind == 'grass' || kind == 'hesco') { e(0, 4, 1.4, [.42, .36, .26], .45, .9, 1); }
    else if (kind == 'flesh') { e(0, 4, 1.2, [.35, .03, .03], .18, .35, 4, this.smoke, .85); }
    else { e(0, 4, 1.2, [.62, .6, .56], .4, 1.1, -.1); this.debrisRaw(p, 0x9a9890, 3, .5, .3); e(0, 3, 4, [1, .85, .6], .04, .12, 10, this.add, 1, 1); } }
  debrisRaw(p, color, n, force, sc = 1) { const c = new THREE.Color(color); for (let k = 0; k < n; k++) { const i = this.di; this.di = (this.di + 1) % this.d.length; const d = this.d[i];
    d.p.copy(p); d.v.set((Math.random() - .5) * 4 * force, (1 + Math.random() * 3) * force, (Math.random() - .5) * 4 * force); d.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); d.life = 3; d.s = sc * (.3 + Math.random() * .5); this.deb.setColorAt(i, c); } this.deb.instanceColor.needsUpdate = true; }
  shell(p, v) { const s = this.shells[this.si]; this.si = (this.si + 1) % this.shells.length; s.p.copy(p); s.v.copy(v); s.r.set(Math.random() * 3, 0, Math.random() * 3); s.life = 2.5; }
  setRain(on, cam) { if (on && !this.rain) { const N = this.Q.particles > 1500 ? 6000 : 2500; const pos = new Float32Array(N * 6); for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 60, y = Math.random() * 30, z = (Math.random() - .5) * 60; pos.set([x, y, z, x + .03, y - .55, z], i * 6); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: .35, depthWrite: false })); this.rain.frustumCulled = false; this.scene.add(this.rain); this.rainY = 0; }
    if (!on && this.rain) { this.scene.remove(this.rain); this.rain = null; } }
  setScale() { const h = this.renderer.domElement.height; this.add.mat.uniforms.scale.value = this.smoke.mat.uniforms.scale.value = h * .5 / Math.tan(this.camera.fov * Math.PI / 360); }
  debris(x, y, z, color, n = 6, force = 1) { const c = new THREE.Color(color); n = Math.round(n * 1.6);
    for (let k = 0; k < n; k++) { const i = this.di; this.di = (this.di + 1) % this.d.length; const d = this.d[i];
      d.p.set(x + Math.random(), y + Math.random(), z + Math.random()); d.v.set((Math.random() - .5) * 5 * force, (2 + Math.random() * 4) * force, (Math.random() - .5) * 5 * force);
      d.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10); d.life = 12 + Math.random() * 8; d.s = .35 + Math.random() * Math.random() * 1.8;
      this.deb.setColorAt(i, c.clone().multiplyScalar(.75 + Math.random() * .4)); }
    this.deb.instanceColor.needsUpdate = true;
    const cc = new THREE.Color(color); for (let k = 0; k < 7; k++) this.smoke.emit(x + Math.random(), y + Math.random(), z + Math.random(), (Math.random() - .5) * 2.5, Math.random() * 1.2, (Math.random() - .5) * 2.5, cc.r * .5 + .3, cc.g * .5 + .28, cc.b * .5 + .25, 1.2, 2.2 + Math.random() * 1.5, 2.6, -.05, .6); }
  muzzle(p, col = [.5, .85, 1]) { for (let k = 0; k < 3; k++) this.add.emit(p.x, p.y, p.z, (Math.random() - .5), (Math.random() - .5), (Math.random() - .5), ...col, .5, .06, 2); if (this.light) { this.light.color.setRGB(...col); this.light.position.copy(p); this.light.intensity = 6; this.lightT = .05; } }
  impact(p, col = [1, .85, .5]) { for (let k = 0; k < 6; k++) this.add.emit(p.x, p.y, p.z, (Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 6, ...col, .12, .3, 0, 14); }
  explosion(p, r) { for (let k = 0; k < 26; k++) { const a = Math.random() * 6.28, u = Math.random() * 2 - 1, s = (2 + Math.random() * 6) * r / 2;
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.sqrt(1 - u * u) * s, Math.abs(u) * s + 2, Math.sin(a) * Math.sqrt(1 - u * u) * s, 1, .55 + Math.random() * .3, .15, .9 + Math.random() * .8, .45 + Math.random() * .3, 2, 4); }
    for (let k = 0; k < 14; k++) this.smoke.emit(p.x + (Math.random() - .5) * r, p.y + Math.random() * r * .5, p.z + (Math.random() - .5) * r, (Math.random() - .5) * 3, 1 + Math.random() * 2.5, (Math.random() - .5) * 3, .25, .23, .22, 1.5 + Math.random(), 1.6 + Math.random(), 2.2, -.4, .8);
    this.add.emit(p.x, p.y, p.z, 0, 0, 0, 1, .8, .5, r * 2.2, .18, r * 6, 0, 1);
    if (this.light) { this.light.color.setRGB(1, .6, .3); this.light.position.copy(p); this.light.intensity = 30; this.lightT = .15; } }
  smokePuff(x, y, z, fire) { this.smoke.emit(x + (Math.random() - .5), y, z + (Math.random() - .5), (Math.random() - .5) * .5, 1.2 + Math.random(), (Math.random() - .5) * .5, .2, .2, .2, 1, 2.2, 1.4, -.2, .55);
    if (fire) this.add.emit(x + (Math.random() - .5), y, z + (Math.random() - .5), 0, 1.5 + Math.random(), 0, 1, .45, .1, .8, .5, -.6, 0, .9); }
  tracer(a, b, color, life = .07) { let m = this.trMat[color]; if (!m) m = this.trMat[color] = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const L = a.distanceTo(b); if (L < .01) return; const g = new THREE.Mesh(this.trGeo || (this.trGeo = new THREE.BoxGeometry(.035, .035, 1)), m);
    g.position.copy(a).lerp(b, .5); g.lookAt(b); g.scale.z = L; this.scene.add(g); this.tracers.push({ g, life }); }
  number(p, v, crit, color) { if (!this.numLayer) return; let n = this.nums.find(n => n.life <= 0);
    if (!n) { if (this.nums.length > 24) return; const el = document.createElement('div'); el.className = 'dmg'; this.numLayer.appendChild(el); n = { el, p: new THREE.Vector3(), life: 0 }; this.nums.push(n); }
    n.p.copy(p); n.life = .8; n.el.textContent = Math.round(v); n.el.style.color = color || (crit ? '#ffd34a' : '#fff'); n.el.style.fontSize = crit ? '1.5em' : '1.1em'; n.el.style.display = ''; n.dx = (Math.random() - .5) * 30; }
  update(dt) {
    if (this.rain) { this.rainY = (this.rainY + dt * 22) % 30; this.rain.position.set(this.camera.position.x, this.camera.position.y + 12 - this.rainY, this.camera.position.z); }
    let sh = false; for (let i = 0; i < this.shells.length; i++) { const s = this.shells[i]; if (s.life <= 0) continue; sh = true; s.life -= dt; s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt);
      if (this.solid(s.p.x, s.p.y - .02, s.p.z)) { s.p.y = Math.floor(s.p.y - .02) + 1.01; s.v.multiplyScalar(-.25); s.v.y = Math.abs(s.v.y); }
      s.r.x += dt * 20; s.r.z += dt * 13; const k = s.life > 0 ? 1 : 0; this.m4.compose(s.p, this.q.setFromEuler(s.r), new THREE.Vector3(k, k, k)); this.shellM.setMatrixAt(i, this.m4); }
    if (sh || this._sh) this.shellM.instanceMatrix.needsUpdate = true; this._sh = sh;
    this.add.update(dt); this.smoke.update(dt);
    let any = false; for (let i = 0; i < this.d.length; i++) { const d = this.d[i]; if (d.life <= 0) continue; any = true; d.life -= dt; d.v.y -= 18 * dt; d.p.addScaledVector(d.v, dt);
      if (this.solid(d.p.x, d.p.y - .1, d.p.z)) { d.p.y = Math.floor(d.p.y - .1) + 1.1; d.v.y *= -.3; d.v.x *= .6; d.v.z *= .6; d.w.multiplyScalar(.6); }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; const s = d.life > 0 ? d.s * Math.min(1, d.life * .5) : 0; if (Math.abs(d.v.y) < .3 && this.solid(d.p.x, d.p.y - .15, d.p.z)) { d.v.set(0, 0, 0); d.w.set(0, 0, 0); }
      this.m4.compose(d.p, this.q.setFromEuler(d.r), new THREE.Vector3(s, s, s)); this.deb.setMatrixAt(i, this.m4); }
    if (any || this._dAny) this.deb.instanceMatrix.needsUpdate = true; this._dAny = any;
    for (const t of this.tracers) { t.life -= dt; if (t.life <= 0) this.scene.remove(t.g); } this.tracers = this.tracers.filter(t => t.life > 0);
    if (this.light && this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) this.light.intensity = 0; }
    const v = new THREE.Vector3(); for (const n of this.nums) { if (n.life <= 0) continue; n.life -= dt; if (n.life <= 0) { n.el.style.display = 'none'; continue; }
      v.copy(n.p); v.y += (.8 - n.life) * 1.2; v.project(this.camera); if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = ''; n.el.style.transform = `translate(${(v.x * .5 + .5) * innerWidth + n.dx * (.8 - n.life)}px,${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-50%)`; n.el.style.opacity = Math.min(1, n.life * 3); }
  }
}
// ---------------- Synthesized audio ----------------
export class SFX {
  constructor() { this.ctx = null; this.vol = .5; }
  init() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    // generated impulse response -> convolution reverb send (outdoor slap/echo)
    const sr = this.ctx.sampleRate, L = sr * 2.2, ir = this.ctx.createBuffer(2, L, sr); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < L; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.6) * (t < .02 ? 0 : 1) + (Math.abs(t - .35 - ch * .03) < .01 ? (Math.random() - .5) * 1.5 : 0); } }
    this.verb = this.ctx.createConvolver(); this.verb.buffer = ir; this.send = this.ctx.createGain(); this.send.gain.value = .35; this.send.connect(this.verb); this.verb.connect(this.master); this.dest = null;
    const n = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, n, n); const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.last = {}; }
  ok(name, gap = .03) { if (!this.ctx) return false; const t = this.ctx.currentTime; if (this.last[name] && t - this.last[name] < gap) return false; this.last[name] = t; return true; }
  env(g, t, a, peak, dec) { peak = Math.max(.0002, peak); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  nz(type, freq, q, peak, dec, vol = 1, dur) { const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = .7 + Math.random() * .6;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); this.env(g, t, .004, peak * vol, dec); s.connect(f); f.connect(g); this.route(g); s.start(t, Math.random() * .5, dur || dec + .05); }
  tone(type, f0, f1, peak, dec, vol = 1) { const c = this.ctx, t = c.currentTime, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dec);
    const g = c.createGain(); this.env(g, t, .004, peak * vol, dec); o.connect(g); this.route(g); o.start(t); o.stop(t + dec + .05); }
  route(g) { const d = this.dest || this.master; g.connect(d); if (this.send && this.wet > 0) { const w = this.ctx.createGain(); w.gain.value = this.wet; g.connect(w); w.connect(this.send); } }
  listen(cam) { if (!this.ctx) return; const L = this.ctx.listener, p = cam.position, f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); } this.cam = p; }
  at(pos, fn, wet = .5) { if (!this.ctx) return; const pn = this.ctx.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 4; pn.rolloffFactor = 1.1; pn.maxDistance = 200;
    if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
    const dist = this.cam ? this.cam.distanceTo(pos) : 10; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(900, 16000 - dist * 220); pn.connect(lp); lp.connect(this.master);
    const prev = this.dest, pw = this.wet; this.dest = pn; this.wet = Math.min(1, wet + dist / 80); try { fn(); } finally { this.dest = prev; this.wet = pw; setTimeout(() => { try { pn.disconnect(); lp.disconnect(); } catch (e) {} }, 3000); } }
  step(hard) { if (!this.ok('step', .2)) return; const w = this.wet; this.wet = 0; if (hard) { this.nz('bandpass', 1800, 2, .12, .05); this.nz('lowpass', 300, 1, .15, .06); } else { this.nz('highpass', 2500, .5, .07, .09); this.nz('lowpass', 400, 1, .1, .07); } this.wet = w; }
  rainLoop(on) { if (!this.ctx) return; if (on && !this.rainSrc) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = .4; const g = this.ctx.createGain(); g.gain.value = .07; s.connect(f); f.connect(g); g.connect(this.master); s.start(); this.rainSrc = s; }
    if (!on && this.rainSrc) { this.rainSrc.stop(); this.rainSrc = null; } }
  shot(p = [2400, 140, .5]) { if (!this.ok('shot', .02)) return; const [f, lo, v] = p; const pw = this.wet; this.wet = .45; this.nz('bandpass', f, .7, v, .07 + v * .08); this.nz('lowpass', 700, .7, v * .8, .12 + v * .2); this.tone('sine', lo, 40, v * .9, .1 + v * .1); this.tone('square', f / 3, 90, .08, .05); this.nz('lowpass', 250, .5, v * .5, .4, 1, .5); this.wet = pw; }
  enemyShot(v) { if (v < .05 || !this.ok('es', .06)) return; this.nz('bandpass', 1800, 1.2, .35, .07, v); this.tone('triangle', 700, 200, .1, .06, v); }
  zap(v) { if (v < .05 || !this.ok('zap', .08)) return; this.tone('sawtooth', 1600, 300, .2, .15, v); this.nz('highpass', 3000, .5, .2, .08, v); }
  hit(kill) { if (!this.ok('hit', .02)) return; this.tone('square', kill ? 1300 : 1900, kill ? 600 : 1500, .15, kill ? .18 : .05); }
  hurt() { if (!this.ok('hurt', .15)) return; this.tone('sawtooth', 220, 80, .35, .2); this.nz('lowpass', 600, 1, .4, .15); }
  boom(v) { if (v < .03 || !this.ok('boom', .05)) return; this.nz('lowpass', 500, .7, 1.2, .9, v, 1.2); this.tone('sine', 90, 30, 1, .6, v); }
  brk(mat, v = 1) { if (v < .05 || !this.ok('brk', .04)) return; const f = { 2: 700, 3: 1300, 4: 2600 }[mat] || 1000; this.nz('bandpass', f, 1.5, .5, .18, v); if (mat == 4) this.tone('triangle', 1800, 900, .15, .2, v); }
  chip(v = 1) { if (!this.ok('chip', .03)) return; this.nz('bandpass', 1500, 3, .2, .05, v); }
  place() { if (!this.ok('place', .05)) return; this.tone('sine', 300, 140, .4, .1); this.nz('lowpass', 900, 1, .25, .06); }
  reload() { if (!this.ctx) return; this.nz('bandpass', 3000, 4, .3, .04); setTimeout(() => this.ctx && this.nz('bandpass', 2200, 4, .35, .05), 600); setTimeout(() => this.ctx && (this.tone('square', 600, 1200, .12, .08)), 1300); }
  ui() { if (this.ok('ui', .05)) this.tone('triangle', 660, 990, .2, .08); }
  horn() { if (!this.ctx) return; this.tone('sawtooth', 196, 196, .25, 1.2); this.tone('sawtooth', 294, 294, .18, 1.2); }
}

function shardGeo() { const g = new THREE.DodecahedronGeometry(.13, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 2.3) * .35), p.getY(i) * .6 * (1 + Math.cos(i * 1.7) * .3), p.getZ(i) * (1 + Math.sin(i * 3.1) * .3)); g.computeVertexNormals(); return g; }
function holeTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(8,8,8,1)'); g.addColorStop(.18, 'rgba(15,14,12,.95)'); g.addColorStop(.32, 'rgba(60,55,50,.6)'); g.addColorStop(.6, 'rgba(90,85,80,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(20,20,20,.6)'; x.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28; x.beginPath(); x.moveTo(32 + Math.cos(a) * 5, 32 + Math.sin(a) * 5); x.lineTo(32 + Math.cos(a + .2) * (12 + Math.random() * 14), 32 + Math.sin(a + .2) * (12 + Math.random() * 14)); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function scorchTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 40; i++) { const r = 20 + Math.random() * 40, a = Math.random() * 6.28, d = Math.random() * 25; const g = x.createRadialGradient(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 0, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r);
    g.addColorStop(0, 'rgba(10,9,8,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
