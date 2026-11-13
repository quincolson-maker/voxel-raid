// v36 Frontier characters on our proven rider rig (adapter by Grok Bot; the four character meshes are ChatGPT-generated,
// supplied by Quin, src/hrcharacters.js). The Mixamo rider keeps doing everything it did (walk / run clips, riderPose
// on the horse, saddle seat, gun aim IK, reins, FPV): its own meshes are hidden and each frame the variant's 19-bone
// skeleton is driven from it. Spine / neck / head / hips / feet copy the rest-relative world rotations (both rigs rest
// upright facing +Z); arms and legs are solved with analytic two-bone IK onto the Mixamo hands / feet (poles = elbows /
// knees), so a gun held by the Mixamo hand sits in the variant's hand and the feet stay in the stirrups.
import * as THREE from 'three';
import { createPlayerCharacter, PLAYER_VARIANTS } from './hrcharacters.js';
export const CHARACTERS = Object.freeze(['Classic', ...PLAYER_VARIANTS.map(v => v.name)]); // index 0 = our classic rider (fallback)
export const validCv = v => { v = +v; return Number.isInteger(v) && v >= 0 && v < CHARACTERS.length ? v : 0; };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), v5 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
const DELTA = ['Hips', 'Spine02', 'Spine01', 'neck', 'Head'];
export function skinRider(rider, cv, { quality = 'high', hideHead = () => false } = {}) {
  cv = validCv(cv); const B = rider && rider.userData && rider.userData.B; if (!cv || !B) return null;
  const need = ['Hips', 'LeftToeBase', 'RightToeBase', 'Spine02', 'Spine01', 'neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  if (need.some(n => !B[n] || !B[n].userData.rest)) return null;
  // Mixamo rest pose in rider-local space (rest quaternions saved by saveRest); restore the live pose afterwards
  const live = {}; for (const n in B) { live[n] = B[n].quaternion.clone(); B[n].quaternion.copy(B[n].userData.rest); }
  rider.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(rider.matrixWorld).invert(), rq = rider.getWorldQuaternion(new THREE.Quaternion()).invert();
  const restQ = {}, restP = {}; for (const n of need) { restQ[n] = B[n].getWorldQuaternion(new THREE.Quaternion()).premultiply(rq); restP[n] = B[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); }
  for (const n in B) B[n].quaternion.copy(live[n]); rider.updateWorldMatrix(true, true);
  const D = createPlayerCharacter(cv - 1, { quality }), F = D.g.userData.B; if (!F) { D.dispose(); return null; }
  D.g.updateMatrixWorld(true); const fHip = F.Hips.getWorldPosition(new THREE.Vector3()).y - D.g.getWorldPosition(new THREE.Vector3()).y, scale = restP.Hips.y / fHip; D.g.scale.setScalar(scale);
  // align at the hip joints (Mixamo's sit lower under its Hips bone): rider-local rest offset, rotated with the pelvis each frame
  const hipOff = restP.LeftUpLeg.clone().add(restP.RightUpLeg).multiplyScalar(.5).sub(restP.Hips).sub(F.LeftUpLeg.position.clone().add(F.RightUpLeg.position).multiplyScalar(.5 * scale)); hipOff.x = 0;
  { const mix = restP.RightArm.distanceTo(restP.RightForeArm) + restP.RightForeArm.distanceTo(restP.RightHand), fr = (F.RightForeArm.position.length() + F.RightHand.position.length()) * scale, k = Math.min(1.12, Math.max(1, mix / fr));
    if (k > 1) for (const n of ['LeftForeArm', 'LeftHand', 'RightForeArm', 'RightHand']) F[n].position.multiplyScalar(k); } // arms to the rig's reach (about +1.4 cm per segment) so held guns sit in the hand D.g.name = 'frontier skin'; D.g.userData.skin = true;
  // pair limbs by side, not by name (the Frontier rig's "Left" bones sit on -x)
  const side = n => Math.sign(restP[n].x) || 1, pick = (L, R) => side(L) === Math.sign(F.LeftArm.position.x) ? L : R;
  const limbs = [['LeftArm', 'LeftForeArm', 'LeftHand', pick('LeftArm', 'RightArm')], ['RightArm', 'RightForeArm', 'RightHand', pick('LeftArm', 'RightArm') === 'LeftArm' ? 'RightArm' : 'LeftArm'],
    ['LeftUpLeg', 'LeftLeg', 'LeftFoot', side('LeftUpLeg') === Math.sign(F.LeftUpLeg.position.x) ? 'LeftUpLeg' : 'RightUpLeg'], ['RightUpLeg', 'RightLeg', 'RightFoot', side('LeftUpLeg') === Math.sign(F.LeftUpLeg.position.x) ? 'RightUpLeg' : 'LeftUpLeg']]
    .map(([a, b, c, src]) => { const pre = src.startsWith('Left') ? 'Left' : 'Right', up = /UpLeg/.test(src); return { a: F[a], b: F[b], c: F[c], sa: B[src], sb: B[pre + (up ? 'Leg' : 'ForeArm')], sc: B[pre + (up ? 'Foot' : 'Hand')], foot: up ? F[c] : null, sFoot: up ? pre + 'Foot' : null,
      l1: F[b].position.length(), l2: F[c].position.length(), d1: F[b].position.clone().normalize(), d2: F[c].position.clone().normalize() }; });
  const hidden = []; rider.traverse(o => { if (o.isMesh && o.visible) { o.visible = false; hidden.push(o); } });
  rider.add(D.g); rider.userData.skin = D;
  const setWorldQ = (bone, wq) => { bone.parent.getWorldQuaternion(q3); bone.quaternion.copy(q3.invert().multiply(wq)); bone.updateWorldMatrix(false, false); };
  const aimSeg = (bone, restDir, toW) => { // rotate the bone so its rest child direction points along world vector toW
    bone.parent.getWorldQuaternion(q3); bone.quaternion.identity(); q1.copy(q3); v4.copy(restDir).applyQuaternion(q1); v5.copy(toW).normalize();
    q2.setFromUnitVectors(v4, v5); bone.quaternion.copy(q3.clone().invert().multiply(q2.multiply(q1))); bone.updateWorldMatrix(false, false); };
  const S = { D, cv, hideHead,
    sync() { if (!D.g.parent) return; rider.updateWorldMatrix(true, true); D.g.updateWorldMatrix(false, false); const rw = rider.getWorldQuaternion(new THREE.Quaternion());
      const deltaQ = n => B[n].getWorldQuaternion(new THREE.Quaternion()).multiply(q1.copy(rw).multiply(restQ[n]).invert()).multiply(rw); // (current * rest^-1) applied to the variant's upright rest
      for (const n of DELTA) { setWorldQ(F[n], deltaQ(n));
        if (n === 'Hips') { B.Hips.getWorldPosition(v1); const hq = B.Hips.getWorldQuaternion(new THREE.Quaternion()).multiply(q1.copy(rw).multiply(restQ.Hips).invert()); v1.add(v5.copy(hipOff).multiplyScalar(rider.getWorldScale(v4).x).applyQuaternion(rw).applyQuaternion(hq)); F.Hips.position.copy(D.g.worldToLocal(v1)); F.Hips.updateWorldMatrix(false, false); }
        if (n !== 'Head') for (const ch of F[n].children) ch.updateWorldMatrix(false, false); }
      F.Head.scale.setScalar(S.hideHead() ? .001 : 1); F.Head.updateWorldMatrix(false, true);
      for (const L of limbs) { L.a.updateWorldMatrix(false, false); const A = L.a.getWorldPosition(v1), T = L.sc.getWorldPosition(v2), P = L.sb.getWorldPosition(v3), ws = D.g.getWorldScale(v4).x, l1 = L.l1 * ws, l2 = L.l2 * ws;
        const ax = T.clone().sub(A); let d = ax.length(); if (d < 1e-5) continue; ax.divideScalar(d); d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, d));
        const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), pole = P.clone().sub(A); pole.addScaledVector(ax, -pole.dot(ax)); if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).applyQuaternion(rw).addScaledVector(ax, -ax.z); pole.normalize();
        const E = A.clone().addScaledVector(ax, a).addScaledVector(pole, h), Tt = A.clone().addScaledVector(ax, d);
        aimSeg(L.a, L.d1, E.clone().sub(A)); L.b.updateWorldMatrix(false, false); aimSeg(L.b, L.d2, Tt.sub(E));
        L.c.quaternion.identity(); L.c.updateWorldMatrix(false, true);
        if (L.foot) { setWorldQ(L.foot, deltaQ(L.sFoot)); L.foot.updateWorldMatrix(false, true); } } },
    dispose() { if (rider.userData.skin === D) rider.userData.skin = null; for (const o of hidden) o.visible = true; D.dispose(); } };
  S.sync(); return S;
}
