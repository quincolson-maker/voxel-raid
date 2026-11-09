// Always-on squad voice chat. One audio-only RTCPeerConnection per teammate (full mesh, max 3 links),
// signaled over the existing co-op data channel (the host relays offers/answers/ICE between players).
// Mic denied or missing: you still hear everyone; the button shows "mic unavailable" and retries on tap.
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }] };
// send(msg) delivers {t:'vs', to, ...} toward player `to`; me() returns this player's id (P1..P4).
export function createVoice({ send, me, onChange }) {
  const V = { on: false, mic: null, state: 'off', muted: false, links: new Map(), level: 0, err: '' };
  let asking = null; const early = [];
  const emit = () => { V.state = !V.on ? 'off' : !V.mic ? (V.err ? 'unavailable' : 'starting') : V.muted ? 'muted' : 'live'; onChange && onChange(V); };
  const track = () => (V.mic && V.mic.getAudioTracks()[0]) || null;
  function getMic() {
    if (V.mic) return Promise.resolve(V.mic); if (asking) return asking;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { V.err = 'Voice needs HTTPS and a mic'; emit(); return Promise.resolve(null); }
    asking = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      .then(s => { V.mic = s; V.err = ''; const t = track(); if (t) { t.enabled = !V.muted; t.onended = () => { V.mic = null; V.err = 'Mic disconnected'; emit(); }; }
        for (const L of V.links.values()) attach(L); emit(); return s; })
      .catch(e => { V.err = (e && e.name === 'NotAllowedError') ? 'Mic blocked — allow it in browser settings' : 'No mic found'; emit(); return null; })
      .finally(() => { asking = null; });
    return asking;
  }
  function attach(L) { const t = track(); const tr = L.pc.getTransceivers()[0]; if (!tr) return; try { tr.direction = 'sendrecv'; } catch (_) {} if (tr.sender.track !== t) tr.sender.replaceTrack(t).catch(() => {}); }
  const unlock = () => { for (const L of V.links.values()) L.audio && L.audio.paused && L.audio.play().catch(() => {}); };
  addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
  function link(id) {
    let L = V.links.get(id); if (L) return L;
    const pc = new RTCPeerConnection(ICE); L = { id, pc, pend: [], audio: null, tries: 0, state: 'new' }; V.links.set(id, L);
    pc.onicecandidate = e => { if (e.candidate) send({ t: 'vs', to: id, k: 'ice', d: e.candidate.toJSON() }); };
    pc.ontrack = e => { if (!L.audio) { L.audio = document.createElement('audio'); L.audio.autoplay = true; L.audio.setAttribute('playsinline', ''); L.audio.hidden = true; L.audio.dataset.voice = id; document.body.appendChild(L.audio); }
      L.audio.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]); L.audio.play().catch(() => {}); };
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
  V.peer = id => { if (!V.on || !id || id === me() || V.links.has(id)) return; if (initiator(id)) offer(link(id)); };
  V.signal = m => {
    if (!m.f || m.f === me()) return; if (!V.on) { if (early.length < 60) early.push(m); return; } let L = V.links.get(m.f);
    if (m.k === 'offer') { if (L && L.pc.signalingState !== 'stable') return; if (L) drop(m.f); L = link(m.f); const pc = L.pc;
      pc.setRemoteDescription(m.d).then(() => { attach(L); return pc.createAnswer(); }).then(a => pc.setLocalDescription(a))
        .then(() => { send({ t: 'vs', to: m.f, k: 'answer', d: pc.localDescription.toJSON() }); flush(L); }).catch(() => {}); }
    else if (m.k === 'answer' && L && L.pc.signalingState === 'have-local-offer') L.pc.setRemoteDescription(m.d).then(() => flush(L)).catch(() => {});
    else if (m.k === 'ice' && L) { if (L.pc.remoteDescription) L.pc.addIceCandidate(m.d).catch(() => {}); else L.pend.push(m.d); }
  };
  function drop(id) { const L = V.links.get(id); if (!L) return; V.links.delete(id); try { L.pc.close(); } catch (_) {} if (L.audio) { L.audio.srcObject = null; L.audio.remove(); } emit(); }
  V.drop = drop;
  // Join/host: turn voice on (asks for the mic once) and link to everyone already known.
  V.start = ids => { V.on = true; emit(); getMic(); (ids || []).forEach(V.peer); early.splice(0).forEach(V.signal); };
  V.stop = () => { for (const id of [...V.links.keys()]) drop(id); V.on = false; emit(); };
  V.toggle = () => { if (!V.on) return; if (!V.mic) { V.err = ''; emit(); getMic(); return; } V.muted = !V.muted; const t = track(); if (t) t.enabled = !V.muted; emit(); };
  V.connected = () => [...V.links.values()].filter(L => L.state === 'connected').length;
  V.prime = getMic; // call from a user gesture (Host/Join tap) so the permission prompt is tied to it
  return V;
}
