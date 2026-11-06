// Mobile touch controls (Pointer Events, multitouch): floating joystick on the whole left half,
// right-half drag-to-look, action buttons. Each finger is tracked by pointerId so move/look/fire/jump work together.
export function initTouch(input, look, act, unlockAudio) {
  const $ = id => document.getElementById(id); const joy = $('joy'), stick = $('stick'), knob = $('knob'), lookEl = $('look');
  const R = 55, sens = () => 0.0055 * 900 / Math.max(600, innerWidth);
  const cap = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (_) {} };
  let jid = null, jx = 0, jy = 0;
  const showStick = (x, y) => { stick.style.left = x + 'px'; stick.style.top = y + 'px'; stick.classList.add('active'); knob.style.transform = ''; };
  const restStick = () => { stick.classList.remove('active'); stick.style.left = '18%'; stick.style.top = '70%'; knob.style.transform = ''; };
  restStick();
  joy.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); if (jid !== null) return; jid = e.pointerId; jx = e.clientX; jy = e.clientY; cap(joy, e); showStick(jx, jy); input.mx = input.mz = 0; });
  joy.addEventListener('pointermove', e => { if (e.pointerId !== jid) return; e.preventDefault(); let dx = e.clientX - jx, dy = e.clientY - jy; const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; const dz = l < 6 ? 0 : 1; input.mx = dz * dx / R; input.mz = dz * dy / R; });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; input.mx = input.mz = 0; restStick(); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(ev, jend);
  const lk = new Map();
  lookEl.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); cap(lookEl, e); lk.set(e.pointerId, [e.clientX, e.clientY]); });
  lookEl.addEventListener('pointermove', e => { const p = lk.get(e.pointerId); if (!p) return; e.preventDefault(); look((e.clientX - p[0]) * sens(), (e.clientY - p[1]) * sens()); lk.set(e.pointerId, [e.clientX, e.clientY]); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) lookEl.addEventListener(ev, e => lk.delete(e.pointerId));
  // buttons; FIRE also acts as a look pad while held
  const btn = (id, down, up, drag) => { const el = $(id); let pid = null, last = null;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (pid !== null) return; pid = e.pointerId; cap(el, e); el.classList.add('down'); last = [e.clientX, e.clientY]; down(); });
    if (drag) el.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; e.preventDefault(); look((e.clientX - last[0]) * sens(), (e.clientY - last[1]) * sens()); last = [e.clientX, e.clientY]; });
    const u = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('down'); up && up(); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, u); };
  btn('tFire', () => input.fire = true, () => input.fire = false, true);
  btn('tJump', () => input.jump = true, () => input.jump = false);
  btn('tBuild', () => { input.use = true; act.build(); }, () => input.use = false); btn('tReload', act.reload); btn('tPiece', act.piece); btn('tMat', act.mat); btn('tSkip', act.skip); btn('tAds', act.ads); btn('tSwap', act.swap);
  // block page scroll/zoom gestures that would otherwise steal touches (iOS Safari)
  document.addEventListener('touchmove', e => { if (e.target.closest && e.target.closest('#touch')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  addEventListener('blur', () => { input.mx = input.mz = 0; input.fire = input.jump = input.use = false; });
}
