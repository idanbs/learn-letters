// Speech + sound effects.
// say('name-alef') plays, in order of preference: the parents' own recording (IndexedDB),
// a file listed in audio/manifest.json, or the device's Hebrew text-to-speech voice.
// Every new say() cancels the previous one, so fast tapping never stacks voices.
import { CLIPS } from './data.js';
import { recordingKeys, loadRecording } from './recordings.js';

let ctx = null; // Web Audio: only for the short sound effects
let manifest = {};
let recorded = new Set();
const urls = new Map(); // key -> playable URL (blob: URLs for recordings)
let finishCurrent = null;
let token = 0;
let heVoice = null;
let speechPrimed = false;
let playerPrimed = false;
let cancelledAt = -Infinity;

// One shared <audio> element plays every voice clip. Unlike Web Audio it needs no decoding up front,
// it keeps working after iOS pauses audio (background, screen lock, microphone use), and once it has
// played from a tap, iOS lets it play from timers too (the next question in a game, etc.).
const player = new Audio();
player.preload = 'auto';
player.setAttribute('playsinline', '');
const SILENCE = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function initAudio() {
  // Let iPhone play sound even when the silent switch is on (Safari 17+).
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }
  try {
    const res = await fetch('audio/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch {
    manifest = {};
  }
  await refreshRecordings();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
}

export async function refreshRecordings() {
  try {
    recorded = new Set(await recordingKeys());
  } catch {
    recorded = new Set();
  }
  for (const key of [...urls.keys()]) forget(key);
}

// Call after a recording is saved or deleted so the next say() picks it up.
export function markRecorded(key, isRecorded) {
  if (isRecorded) recorded.add(key);
  else recorded.delete(key);
  forget(key);
}

function forget(key) {
  const url = urls.get(key);
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  urls.delete(key);
}

export const sourceOf = (key) => (recorded.has(key) ? 'recorded' : manifest[key] ? 'file' : 'tts');
export const fileManifest = () => ({ ...manifest });

export function audioContext() {
  if (!ctx) unlock();
  return ctx;
}

function pickVoice() {
  const he = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('he'));
  // Prefer the higher quality voices if the device has downloaded them.
  heVoice =
    he.find((v) => /premium/i.test(v.voiceURI + v.name)) ||
    he.find((v) => /enhanced/i.test(v.voiceURI + v.name)) ||
    he[0] ||
    null;
}

// Must run inside a user gesture once; iOS keeps audio locked until then.
export function unlock(e) {
  // Speech needs its own unlock, and only a touch-end style gesture counts on iOS.
  const gesture = e?.type !== 'pointerdown';
  if (gesture && !speechPrimed && 'speechSynthesis' in window) {
    speechPrimed = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
  // Play silence once from a tap so the shared player is allowed to play later on its own.
  if (gesture && !playerPrimed && player.paused) {
    playerPrimed = true;
    player.src = SILENCE;
    player.play()?.catch((err) => {
      if (err?.name === 'NotAllowedError') playerPrimed = false;
    });
  }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start(0);
  }
  if (ctx.state !== 'running') ctx.resume();
}

export function stopAll() {
  token++;
  halt();
}

function halt() {
  if (!player.paused) player.pause();
  if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
    cancelledAt = performance.now();
  }
  finishCurrent?.();
  finishCurrent = null;
}

// Resolves true when everything was said, false if it was interrupted by another say()/stopAll().
export function say(...keys) {
  const my = ++token;
  halt();
  return (async () => {
    for (const key of keys) {
      if (my !== token) return false;
      await playClip(key, my);
    }
    return my === token;
  })();
}

const hasAudio = (key) => recorded.has(key) || !!manifest[key];

// Readies recordings one at a time in the background, so a clip that is actually tapped
// never waits behind a whole screen's worth of loading.
let preloadQueue = Promise.resolve();
export function preload(keys) {
  for (const key of keys) {
    if (recorded.has(key) && !urls.has(key)) preloadQueue = preloadQueue.then(() => clipUrl(key)).catch(() => {});
  }
}

async function clipUrl(key) {
  if (urls.has(key)) return urls.get(key);
  let url;
  if (recorded.has(key)) {
    const r = await loadRecording(key);
    if (!r) throw new Error(`recording ${key} missing`);
    if (urls.has(key)) return urls.get(key);
    url = URL.createObjectURL(new Blob([r.data], { type: r.type || 'audio/wav' }));
  } else {
    url = `audio/${manifest[key]}`;
  }
  urls.set(key, url);
  return url;
}

function playUrl(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = 0;
    const settle = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      player.onended = null;
      player.onerror = null;
      fn(arg);
    };
    player.onended = () => settle(resolve);
    player.onerror = () => settle(reject, new Error('audio playback failed'));
    finishCurrent = () => settle(resolve);
    timer = setTimeout(() => settle(resolve), 20000); // never hang the app on a stuck clip
    player.src = url;
    player.play()?.catch((err) => settle(reject, err));
  });
}

async function playClip(key, my) {
  if (hasAudio(key)) {
    try {
      const url = await clipUrl(key);
      if (my !== token) return;
      await playUrl(url);
      return;
    } catch {
      // fall through to text-to-speech
    }
  }
  if (my !== token) return;
  await speakText(CLIPS[key] ?? key);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return wait(400);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    if (heVoice) u.voice = heVoice;
    u.rate = 0.85;
    u.pitch = 1.1;
    let finished = false;
    let timer = 0;
    let deferred = 0;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(deferred);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    // Some iOS versions occasionally never fire onend; don't let the app wait forever.
    timer = setTimeout(done, 2000 + text.length * 200);
    finishCurrent = done;
    // Safari can drop an utterance queued in the same instant as cancel(); give it a beat.
    if (performance.now() - cancelledAt < 80) {
      deferred = setTimeout(() => {
        if (!finished) speechSynthesis.speak(u);
      }, 60);
    } else {
      speechSynthesis.speak(u);
    }
  });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Sound effects (synthesized, no files) ----

function tone({ freq, to, dur = 0.15, type = 'sine', gain = 0.2, delay = 0 }) {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  tap: () => tone({ freq: 520, to: 760, dur: 0.08, gain: 0.1 }),
  pop: () => tone({ freq: 420, to: 980, dur: 0.14, type: 'triangle', gain: 0.25 }),
  tick: (p) => tone({ freq: 380 + 520 * p, dur: 0.05, type: 'triangle', gain: 0.07 }),
  success: () =>
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', gain: 0.18, delay: i * 0.09 })),
  oops: () => tone({ freq: 320, to: 190, dur: 0.28, gain: 0.16 }),
  // A bright little sparkle for a new sticker.
  sticker: () =>
    [784, 1175, 988, 1568].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'sine', gain: 0.16, delay: 0.05 + i * 0.07 })),
};
