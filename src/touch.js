// Mobile touch controls: floating left joystick, right-side drag-to-look, action buttons.
export function initTouch(input, look, act, unlockAudio) {
  const $ = id => document.getElementById(id); const joy = $('joy'), stick = $('stick'), knob = $('knob'), lookEl = $('look');
  let jid = null, jx = 0, jy = 0; const R = 55;
  joy.addEventListener('touchstart', e => { unlockAudio(); const t = e.changedTouches[0]; jid = t.identifier; jx = t.clientX; jy = t.clientY; stick.style.display = 'block'; stick.style.left = jx + 'px'; stick.style.top = jy + 'px'; knob.style.transform = ''; e.preventDefault(); }, { passive: false });
  joy.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === jid) { let dx = t.clientX - jx, dy = t.clientY - jy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; input.mx = dx / R; input.mz = dy / R; } e.preventDefault(); }, { passive: false });
  const jend = e => { for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; input.mx = input.mz = 0; stick.style.display = 'none'; } };
  joy.addEventListener('touchend', jend); joy.addEventListener('touchcancel', jend);
  const lk = {}; const sens = () => 0.0055 * 900 / Math.max(600, innerWidth);
  lookEl.addEventListener('touchstart', e => { unlockAudio(); for (const t of e.changedTouches) lk[t.identifier] = [t.clientX, t.clientY]; e.preventDefault(); }, { passive: false });
  lookEl.addEventListener('touchmove', e => { for (const t of e.changedTouches) { const p = lk[t.identifier]; if (!p) continue; look((t.clientX - p[0]) * sens(), (t.clientY - p[1]) * sens()); lk[t.identifier] = [t.clientX, t.clientY]; } e.preventDefault(); }, { passive: false });
  const lend = e => { for (const t of e.changedTouches) delete lk[t.identifier]; }; lookEl.addEventListener('touchend', lend); lookEl.addEventListener('touchcancel', lend);
  // buttons; FIRE also acts as a look pad while held so you can aim and shoot with one thumb
  const btn = (id, down, up, drag) => { const el = $(id); let last = null;
    el.addEventListener('touchstart', e => { unlockAudio(); el.classList.add('down'); const t = e.changedTouches[0]; last = [t.clientX, t.clientY]; down(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    if (drag) el.addEventListener('touchmove', e => { const t = e.changedTouches[0]; if (last) look((t.clientX - last[0]) * sens(), (t.clientY - last[1]) * sens()); last = [t.clientX, t.clientY]; e.preventDefault(); }, { passive: false });
    const u = e => { el.classList.remove('down'); last = null; up && up(); e.preventDefault(); }; el.addEventListener('touchend', u, { passive: false }); el.addEventListener('touchcancel', u); };
  btn('tFire', () => input.fire = true, () => input.fire = false, true);
  btn('tJump', () => input.jump = true, () => input.jump = false);
  btn('tBuild', act.build); btn('tReload', act.reload); btn('tPiece', act.piece); btn('tMat', act.mat); btn('tSkip', act.skip);
}
