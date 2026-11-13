// v39 THE SUN PYRAMID — the Hollow Sun's hidden prize. The model, charge, beam and flare are ChatGPT-generated code from Quin
// (createSunPyramidWeapon in src/hrsuntemple.js); this file makes it an item you hold (key 6 / the sun button on a phone),
// aims it with the camera, finds what the beam hits with our own gun ray, and blasts the dead around the impact through the
// normal host-checked zombie hits (co-op safe). Balance: 0.55 s charge, then 4.5 s before the next pulse, 90 m reach,
// up to 450 damage that falls to half at the 3.8 m edge of the blast.
import * as THREE from 'three';
import { createSunPyramidWeapon } from './hrsuntemple.js';

export const SUN = { dmg: 450, radius: 3.8, range: 90, cooldown: 4.5, beam: 1.3 };
export function createSunItem(c) {
  const { scene, H, P, camera, sfx, msg, mobile, fx } = c;
  const gun = createSunPyramidWeapon(), rgun = createSunPyramidWeapon(); scene.add(gun.mesh, rgun.mesh); rgun.mesh.userData.model.visible = false;
  const model = gun.mesh.userData.model; model.visible = false; model.scale.setScalar(.9);
  const S = { owned: (() => { try { return localStorage.getItem('hr_sun') === '1'; } catch (_) { return false; } })(), held: false, t: 0, nextT: 0, shots: 0, hits: 0, kills: 0 };
  let ticket = null, lastId = 0, pend = false, rt = null, rLast = 0, rEnd = null;
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), org = new THREE.Vector3(), tmp = new THREE.Vector3();
  let btn = null, hud = null;
  function ui() { if (!hud) { hud = document.createElement('div'); hud.id = 'hrSun'; hud.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);font:600 13px system-ui,sans-serif;color:#ffd27a;text-shadow:0 1px 3px #000;pointer-events:none;display:none;z-index:30'; document.body.appendChild(hud); }
    if (mobile && !btn && S.owned) { btn = document.createElement('button'); btn.id = 'tSun'; btn.textContent = '☀'; btn.style.cssText = 'position:fixed;right:14px;bottom:47%;width:54px;height:54px;border-radius:50%;border:2px solid #ffcf6a;background:rgba(60,40,10,.55);color:#ffd27a;font-size:26px;z-index:40;touch-action:none';
      btn.addEventListener('touchstart', e => { e.preventDefault(); if (!S.held) hold(true); else pend = true; }, { passive: false }); btn.addEventListener('click', () => { if (!S.held) hold(true); else pend = true; }); document.body.appendChild(btn); } }
  function save() { try { localStorage.setItem('hr_sun', S.owned ? '1' : '0'); } catch (_) {} }
  function give() { S.owned = true; save(); ui(); }
  function hold(on) { if (on && !S.owned) return false; if (on && H.guns && H.guns.state.weapon) H.guns.holster(); S.held = !!on; model.visible = S.held; return true; }
  addEventListener('keydown', e => { if (!H.on || e.repeat) return; if (e.code === 'Digit6' && S.owned) { hold(!S.held); if (S.held) msg('☀ The Sun Pyramid — fire to charge a sun beam', 2); } });
  addEventListener('mousedown', e => { if (e.button === 0 && S.held && H.on && !H.uiOpen) pend = true; });
  const seg = new THREE.Vector3(), rel = new THREE.Vector3();
  function blast(p, d, a) { const Z = H.zombies; if (!Z) return; let hits = 0; if (a) seg.copy(p).sub(a); const L = a ? seg.length() : 0; if (L > 1e-3) seg.divideScalar(L);
    for (const o of [...Z.list]) { if (!o.alive) continue; let mul = 0; const k = Math.hypot(o.pos.x - p.x, o.pos.y + .9 - p.y, o.pos.z - p.z) / SUN.radius; if (k <= 1) mul = 1 - .5 * k;
      if (L > 1e-3) { rel.set(o.pos.x - a.x, o.pos.y + .9 - a.y, o.pos.z - a.z); const t = Math.max(0, Math.min(L, rel.dot(seg))); if (rel.addScaledVector(seg, -t).length() < SUN.beam) mul = Math.max(mul, .6); } // the beam burns through whatever stands along it
      if (!mul) continue; hits++;
      const r = Z.onHit(o, 'sun', false, tmp.set(o.pos.x, o.pos.y + 1, o.pos.z), d, mul); if (r && r.killed && c.role() !== 'client' && H.guns) { H.guns.credit(false, o.kind); S.kills++; } }
    S.hits += hits; if (fx) { fx.debris && fx.debris(p.x, p.y, p.z, 0xffc04a, 18, 1.2); fx.muzzle && fx.muzzle(p, [1, .8, .35], 4); }
    if (sfx.at && sfx.ctx) sfx.at(p, () => { sfx.tone('sawtooth', 160, 40, .6, .8); sfx.nz('lowpass', 700, 1, .5, .7); }, .4); }
  function update(dt) { S.t += dt; ui(); gun.update(dt); rgun.update(dt);
    if (S.held && H.guns && H.guns.state.weapon) hold(false); // drawing a gun puts the pyramid away
    if (S.held) { camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize(); up.crossVectors(right, fwd).normalize(); model.position.copy(camera.position).addScaledVector(fwd, .62).addScaledVector(right, .26).addScaledVector(up, -.2); model.rotation.y += dt * (ticket && gun.state === 'charging' ? 6 : .8); }
    if (pend && S.held && S.t >= S.nextT && gun.state === 'idle') { camera.getWorldDirection(fwd); org.copy(model.position); ticket = gun.fire(org, fwd); if (ticket) { S.nextT = S.t + .55 + SUN.cooldown; S.shots++; if (sfx.tone && sfx.ctx) sfx.tone('sine', 220, 880, .55, .3); } }
    else if (pend && S.held && S.t < S.nextT) msg('☀ Recharging… ' + (S.nextT - S.t).toFixed(1) + ' s', .8);
    pend = false;
    if (ticket && ticket.ready && ticket.shotId !== lastId) { lastId = ticket.shotId; const hit = H.guns && H.guns.rayCast ? H.guns.rayCast(ticket.ray.origin, ticket.ray.direction, SUN.range) : null; const e = hit ? hit.p : tmp.copy(ticket.ray.origin).addScaledVector(ticket.ray.direction, SUN.range);
      gun.setImpact(e); blast(e, ticket.ray.direction, ticket.ray.origin); S.lastHit = hit && hit.kind; c.send && c.send({ t: 'sun', o: ticket.ray.origin.toArray().map(v => +v.toFixed(2)), e: e.toArray().map(v => +v.toFixed(2)) }); }
    if (rt && rt.ready && rt.shotId !== rLast) { rLast = rt.shotId; if (rEnd) rgun.setImpact(rEnd); }
    if (hud) { const on = S.held && H.on, txt = gun.state === 'charging' ? '☀ CHARGING…' : S.t < S.nextT ? `☀ SUN PYRAMID · ${(S.nextT - S.t).toFixed(1)} s` : '☀ SUN PYRAMID · READY'; if (hud.style.display !== (on ? '' : 'none')) hud.style.display = on ? '' : 'none'; if (on && hud.textContent !== txt) hud.textContent = txt; }
    if (btn) btn.style.display = H.on && S.owned ? '' : 'none'; }
  // another rider's beam (visual only: their blast's damage reaches the host as normal checked hits)
  function remote(m) { if (!m || !Array.isArray(m.o) || !Array.isArray(m.e) || ![...m.o, ...m.e].every(Number.isFinite)) return; const o = new THREE.Vector3().fromArray(m.o); rEnd = new THREE.Vector3().fromArray(m.e); const d = rEnd.clone().sub(o); if (d.lengthSq() < 1e-6 || d.length() > 200) return;
    rt = rgun.fire(o, d.normalize()); if (sfx.at && sfx.ctx) sfx.at(rEnd, () => sfx.tone('sawtooth', 160, 40, .5, .6), .4); }
  return { state: S, give, hold, update, remote, settings: SUN, get gun() { return gun; } };
}
