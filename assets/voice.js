/* Hisab ko Sathi — voice: speech in/out, command parser, conversation flows */
'use strict';

// ======================= speech output =======================
let speakSeq = 0;
const speakCbs = {};
window.onSpeakDone = id => { const cb = speakCbs[id]; delete speakCbs[id]; if (cb) setTimeout(cb, 150); };
function speak(text, cb) {
  cb = cb || (() => {});
  if (!text || !db.meta.speakOn) { setTimeout(cb, 60); return; }
  if (HAS_ANDROID) {
    const id = 's' + (++speakSeq);
    speakCbs[id] = cb;
    let ok = false;
    try { ok = Android.speak(text, id); } catch (e) { ok = false; }
    if (!ok) { delete speakCbs[id]; setTimeout(cb, 60); }
    else setTimeout(() => { if (speakCbs[id]) { delete speakCbs[id]; cb(); } }, 4000 + text.length * 90); // safety net
  } else if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; let done = false;
    const fin = () => { if (!done) { done = true; cb(); } };
    u.onend = fin; u.onerror = fin;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    setTimeout(fin, 3000 + text.length * 90);
  } else setTimeout(cb, 60);
}
function stopSpeaking() {
  Object.keys(speakCbs).forEach(k => delete speakCbs[k]);
  try { if (HAS_ANDROID) Android.stopSpeaking(); else if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
}

// ======================= speech input =======================
let listening = false, webRec = null;
const HINTS = ['“sold 2 kg meat”', '“sold 3 live chickens 6 kg Ashar lot 1”', '“2 dead in lot 1”', '“how many left?”', '“lot 1 has 220 left”', '“cut 5 giriraj chickens”', '“feed B2 2 bags 3400 rupees”', '“today’s summary”', '“set broiler meat price 450”'];
function listen() {
  if (listening) return;
  stopSpeaking();
  listening = true;
  $('#voice').classList.remove('hidden');
  $('#micBtn').classList.add('on');
  $('#voiceState').textContent = 'Starting…';
  $('#voiceText').textContent = '';
  $('#voiceHint').textContent = pendingAsk ? pendingAsk.hint : 'Say: ' + HINTS[Math.floor(Math.random() * HINTS.length)];
  const lang = db.meta.voiceLang || 'en-IN';
  if (HAS_ANDROID) { Android.listen(lang); setTimeout(() => { if (listening && $('#voiceState').textContent === 'Starting…') { stopVoiceUi(); toast('Voice did not start. Tap 🎤 again.'); } }, 8000); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onVoiceState('error', 'unavailable'); return; }
  webRec = new SR();
  webRec.lang = lang; webRec.interimResults = true; webRec.maxAlternatives = 5;
  let finalList = null;
  webRec.onstart = () => onVoiceState('ready');
  webRec.onresult = e => {
    const r = e.results[e.results.length - 1];
    if (r.isFinal) { finalList = Array.from(r).map(a => a.transcript); }
    else onVoiceState('partial', r[0].transcript);
  };
  webRec.onerror = e => { finalList = null; onVoiceState('error', e.error === 'no-speech' ? 'timeout' : e.error); };
  webRec.onend = () => { if (finalList) onVoiceResult(finalList); else if (listening) onVoiceState('error', 'nomatch'); };
  webRec.start();
}
function stopVoiceUi() {
  listening = false;
  $('#voice').classList.add('hidden');
  $('#micBtn').classList.remove('on');
}
function cancelListening() {
  stopVoiceUi();
  try { if (HAS_ANDROID) Android.cancelListening(); else if (webRec) webRec.abort(); } catch (e) {}
}
window.onVoiceState = function (state, data) {
  if (state === 'ready' || state === 'speaking') $('#voiceState').textContent = 'Listening…';
  else if (state === 'processing') $('#voiceState').textContent = 'Got it…';
  else if (state === 'partial') $('#voiceText').textContent = data || '';
  else if (state === 'fallback') { $('#voice').classList.add('hidden'); }
  else if (state === 'error') {
    const was = listening;
    stopVoiceUi();
    if (!was && data !== 'cancelled') return;
    const msg = {
      nomatch: "Didn't catch that. Tap 🎤 and try again.",
      timeout: "I didn't hear anything. Tap 🎤 and speak.",
      network: 'Voice needs internet, or download the offline voice pack (Settings → Voice).',
      unavailable: 'Voice typing is not available. Install or enable “Google” voice typing.',
      audio: 'Microphone problem. Please try again.',
      permission: 'Allow the microphone: Settings → Apps → Hisab ko Sathi → Permissions → Microphone.',
      error11: 'Voice is busy. Tap 🎤 again.', error8: 'Voice is busy. Tap 🎤 again.', error5: 'Voice was interrupted. Tap 🎤 again.',
      error12: 'This voice language is not available offline — check Settings → Voice.', error13: 'This voice language is not downloaded — check Settings → Voice.'
    }[data];
    if (msg) toast(msg);
  }
};
window.onVoiceResult = function (list) {
  stopVoiceUi();
  list = (list || []).filter(Boolean);
  try { const log = db.meta.voiceLog || (db.meta.voiceLog = []); log.unshift({ t: Date.now(), lang: db.meta.voiceLang, heard: list.slice(0, 3) }); log.length = Math.min(log.length, 40); persist(); } catch (e) {}
  if (!list.length) { toast("Didn't catch that. Try again."); return; }
  handleInput(list, 'voice');
};

