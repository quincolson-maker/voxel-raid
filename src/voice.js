// Always-on squad voice chat. One audio-only RTCPeerConnection per teammate (full mesh, max 3 links),
// signaled over the existing co-op data channel (the host relays offers/answers/ICE between players).
// Mic denied or missing: you still hear everyone; the button shows "mic unavailable" and retries on tap.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }] };
// send(msg) delivers {t:'vs', to, ...} toward player `to`; me() returns this player's id (P1..P4).
export function createVoice({ send, me, onChange, admit, max = 8 }) {
  const V = { on: false, mic: null, state: 'off', muted: false, links: new Map(), level: 0, err: '', gen: 0, refused: 0, sysMute: false, needTap: false, max, admit };
  let asking = null; const early = [];
  const emit = () => { V.state = !V.on ? 'off' : !V.mic ? (V.err ? 'unavailable' : 'starting') : V.muted ? 'muted' : V.sysMute ? 'paused' : 'live'; onChange && onChange(V); };
  const track = () => (V.mic && V.mic.getAudioTracks()[0]) || null;
  function getMic() {
    if (V.mic) return Promise.resolve(V.mic); if (asking) return asking;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { V.err = 'Voice needs HTTPS and a mic'; emit(); return Promise.resolve(null); }
    const g = V.gen; asking = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      .then(s => { if (g !== V.gen) { for (const t of s.getTracks()) t.stop(); return null; } /* v36: permission came after a final shutdown: release it */ V.mic = s; V.err = ''; const t = track(); if (t) { t.enabled = !V.muted; t.onended = () => { V.mic = null; emit(); if (V.on) { if (document.hidden) V.needMic = true; else setTimeout(() => V.on && !V.mic && getMic(), 600); } }; /* v34: the browser / OS took the mic: grab it again by itself */ t.onmute = () => { V.sysMute = true; emit(); }; t.onunmute = () => { V.sysMute = false; emit(); }; }
        for (const L of V.links.values()) attach(L); emit(); return s; })
      .catch(e => { if (g !== V.gen) return null; V.err = (e && e.name === 'NotAllowedError') ? 'Mic blocked — allow it in browser settings' : 'No mic found'; emit(); return null; })
      .finally(() => { asking = null; });
    return asking;
  }
  function attach(L) { const t = track(); const tr = L.pc.getTransceivers()[0]; if (!tr) return; try { tr.direction = 'sendrecv'; } catch (_) {} if (tr.sender.track !== t) tr.sender.replaceTrack(t).catch(() => {}); }
  const play = L => L.audio.play().then(() => { if (V.needTap && ![...V.links.values()].some(q => q.audio && q.audio.paused)) { V.needTap = false; emit(); } }).catch(() => { if (!V.needTap) { V.needTap = true; emit(); } }); // v36: autoplay refused -> 'tap for voice'
  const unlock = () => { for (const L of V.links.values()) L.audio && L.audio.paused && play(L); };
  addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
  function link(id) {
    let L = V.links.get(id); if (L) return L;
    const pc = new RTCPeerConnection(ICE); L = { id, pc, pend: [], audio: null, tries: 0, state: 'new' }; V.links.set(id, L);
    pc.onicecandidate = e => { if (e.candidate) send({ t: 'vs', to: id, k: 'ice', d: e.candidate.toJSON() }); };
    pc.ontrack = e => { if (!L.audio) { L.audio = document.createElement('audio'); L.audio.autoplay = true; L.audio.setAttribute('playsinline', ''); L.audio.hidden = true; L.audio.dataset.voice = id; document.body.appendChild(L.audio); }
      L.audio.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]); play(L); };
    pc.onconnectionstatechange = () => { L.state = pc.connectionState; emit();
      if (pc.connectionState === 'failed' && initiator(id) && L.tries < 3 && V.links.get(id) === L) { L.tries++; setTimeout(() => { if (V.links.get(id) === L) { const n = L.tries; drop(id); const N = link(id); N.tries = n; offer(N); } }, 1500); } };
    return L;
  }
  const initiator = id => String(me()) < String(id);
  function offer(L) { const pc = L.pc; pc.addTransceiver('audio', { direction: 'sendrecv' }); attach(L);
    pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => send({ t: 'vs', to: L.id, k: 'offer', d: pc.localDescription.toJSON() })).catch(() => {});
    // no answer / never connected (lost signal, teammate still loading): retry a few times
    setTimeout(() => { if (V.links.get(L.id) === L && pc.connectionState !== 'connected' && L.tries < 3) { const n = L.tries + 1; drop(L.id); const N = link(L.id); N.tries = n; offer(N); } }, 15000); }
  const flush = L => { for (const c of L.pend.splice(0)) L.pc.addIceCandidate(c).catch(() => {}); };
  V.peer = id => { if (!V.on || !id || id === me() || V.links.has(id) || V.links.size >= V.max) return; if (initiator(id)) offer(link(id)); };
  V.signal = m => {
    if (!m.f || m.f === me()) return; if (!V.on) { if (early.length < 60) early.push(m); return; } let L = V.links.get(m.f);
    if (m.k === 'offer') { if (L && L.pc.signalingState !== 'stable') return; if (!L && ((V.admit && !V.admit(m.f)) || V.links.size >= V.max)) { V.refused++; return; } // v36: same admission policy both ways
      if (L) drop(m.f); L = link(m.f); const pc = L.pc;
      pc.setRemoteDescription(m.d).then(() => { attach(L); return pc.createAnswer(); }).then(a => pc.setLocalDescription(a))
        .then(() => { send({ t: 'vs', to: m.f, k: 'answer', d: pc.localDescription.toJSON() }); flush(L); }).catch(() => {}); }
    else if (m.k === 'answer' && L && L.pc.signalingState === 'have-local-offer') L.pc.setRemoteDescription(m.d).then(() => flush(L)).catch(() => {});
    else if (m.k === 'ice' && L) { if (L.pc.remoteDescription) L.pc.addIceCandidate(m.d).catch(() => {}); else L.pend.push(m.d); }
  };
  function drop(id) { const L = V.links.get(id); if (!L) return; V.links.delete(id); try { L.pc.close(); } catch (_) {} if (L.audio) { L.audio.srcObject = null; L.audio.remove(); } emit(); }
  // v34: switching apps never mutes voice. Nothing stops the track on blur / hidden; when you come back, a mic the browser
  // ended (iOS suspends it in the background) is re-acquired and put back on every link, and paused peer audio plays again
  V.resume = () => { if (!V.on) return; const t = track(); if (!t || t.readyState === 'ended' || V.needMic) { V.needMic = false; if (t && t.readyState === 'ended') V.mic = null; getMic(); }
    for (const L of V.links.values()) if (L.audio && L.audio.paused) play(L); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) V.resume(); }); addEventListener('pageshow', () => V.resume()); addEventListener('focus', () => V.resume());
  V.drop = drop;
  // Join/host: turn voice on (asks for the mic once) and link to everyone already known.
  V.start = ids => { V.on = true; emit(); getMic(); (ids || []).forEach(V.peer); early.splice(0).forEach(V.signal); };
  V.stop = () => { for (const id of [...V.links.keys()]) drop(id); V.on = false; early.length = 0; emit(); }; // a room change: the mic stays ready (and muted stays muted)
  V.shutdown = () => { V.gen++; V.stop(); if (V.mic) { for (const t of V.mic.getTracks()) { t.onended = t.onmute = t.onunmute = null; t.stop(); } V.mic = null; } emit(); }; // v36: final: release the microphone
  addEventListener('pagehide', e => { if (!e.persisted) V.shutdown(); });
  V.toggle = () => { if (!V.on) return; if (!V.mic) { V.err = ''; emit(); getMic(); return; } V.muted = !V.muted; const t = track(); if (t) t.enabled = !V.muted; emit(); };
  V.connected = () => [...V.links.values()].filter(L => L.state === 'connected').length;
  V.prime = getMic; // call from a user gesture (Host/Join tap) so the permission prompt is tied to it
  return V;
}
