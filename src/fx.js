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
    const nd = Math.round(Q.particles / 4); this.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(.22, .22, .22), new THREE.MeshStandardMaterial({ roughness: .8 }), nd);
    this.deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.deb.castShadow = false; this.deb.frustumCulled = false; scene.add(this.deb);
    this.d = Array.from({ length: nd }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0, s: 1 })); this.di = 0;
    const c = new THREE.Color(1, 1, 1); for (let i = 0; i < nd; i++) { this.deb.setColorAt(i, c); this.deb.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
    this.tracers = []; this.trMat = {}; this.light = Q.light ? new THREE.PointLight(0xffb060, 0, 14, 2) : null; if (this.light) scene.add(this.light); this.lightT = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion();
    this.nums = []; this.numLayer = document.getElementById('nums');
  }
  setScale() { const h = this.renderer.domElement.height; this.add.mat.uniforms.scale.value = this.smoke.mat.uniforms.scale.value = h * .5 / Math.tan(this.camera.fov * Math.PI / 360); }
  debris(x, y, z, color, n = 6, force = 1) { const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) { const i = this.di; this.di = (this.di + 1) % this.d.length; const d = this.d[i];
      d.p.set(x + Math.random(), y + Math.random(), z + Math.random()); d.v.set((Math.random() - .5) * 5 * force, (2 + Math.random() * 4) * force, (Math.random() - .5) * 5 * force);
      d.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10); d.life = 1.6 + Math.random(); d.s = .6 + Math.random() * .9;
      this.deb.setColorAt(i, c.clone().multiplyScalar(.75 + Math.random() * .4)); }
    this.deb.instanceColor.needsUpdate = true;
    for (let k = 0; k < 4; k++) this.smoke.emit(x + .5, y + .5, z + .5, (Math.random() - .5) * 2, Math.random() * 1.5, (Math.random() - .5) * 2, .75, .7, .62, 1.2, .9, 2.5, 0, .5); }
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
    this.add.update(dt); this.smoke.update(dt);
    let any = false; for (let i = 0; i < this.d.length; i++) { const d = this.d[i]; if (d.life <= 0) continue; any = true; d.life -= dt; d.v.y -= 18 * dt; d.p.addScaledVector(d.v, dt);
      if (this.solid(d.p.x, d.p.y - .1, d.p.z)) { d.p.y = Math.floor(d.p.y - .1) + 1.1; d.v.y *= -.3; d.v.x *= .6; d.v.z *= .6; d.w.multiplyScalar(.6); }
      d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; const s = d.life > 0 ? d.s * Math.min(1, d.life * 2) : 0;
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
    const n = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, n, n); const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.last = {}; }
  ok(name, gap = .03) { if (!this.ctx) return false; const t = this.ctx.currentTime; if (this.last[name] && t - this.last[name] < gap) return false; this.last[name] = t; return true; }
  env(g, t, a, peak, dec) { peak = Math.max(.0002, peak); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  nz(type, freq, q, peak, dec, vol = 1, dur) { const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = .7 + Math.random() * .6;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); this.env(g, t, .004, peak * vol, dec); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * .5, dur || dec + .05); }
  tone(type, f0, f1, peak, dec, vol = 1) { const c = this.ctx, t = c.currentTime, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dec);
    const g = c.createGain(); this.env(g, t, .004, peak * vol, dec); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dec + .05); }
  shot() { if (!this.ok('shot')) return; this.nz('bandpass', 2400, .8, .5, .09); this.tone('square', 900, 120, .18, .08); this.tone('sine', 140, 50, .5, .12); }
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
