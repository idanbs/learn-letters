// Speech + sound effects.
// say('name-alef') plays, in order of preference: the parents' own recording (IndexedDB),
// a file listed in audio/manifest.json, or the device's Hebrew text-to-speech voice.
// Every new say() cancels the previous one, so fast tapping never stacks voices.
// Consecutive recordings are stitched into one clip, and consecutive device-voice phrases into
// one utterance: fewer starts means smoother sound (iPhones are touchy about rapid restarts).
import { CLIPS, PARTS, LEADS_IN } from './data.js';
import { recordingKeys, loadRecording } from './recordings.js';

let ctx = null; // Web Audio: only for the short sound effects
let manifest = {};
let recorded = new Set();
const urls = new Map(); // key (or "a+b" for stitched clips) -> playable URL
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

// iOS 17+ audio mode. 'playback' plays even with the silent switch on; 'auto' is Safari's default.
// Switchable from the parents' sound check, to compare how each behaves on a given device.
const MODE_KEY = 'letters.audioMode';
export const audioMode = () => localStorage.getItem(MODE_KEY) || 'playback';
export const canSetAudioMode = () => !!navigator.audioSession;
export function setAudioMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
  if (navigator.audioSession) navigator.audioSession.type = mode;
}

export async function initAudio() {
  if (navigator.audioSession) navigator.audioSession.type = audioMode();
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

// Drops the cached clip for `key` and every stitched clip that contains it.
function forget(key) {
  for (const [k, url] of [...urls]) {
    if (k === key || k.split('+').includes(key)) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      urls.delete(k);
    }
  }
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

// A burst of calls (cards flipped back and forth, frantic tapping) waits this long and only the
// last one speaks. Restarting the voice many times a second is what trips up iOS speech.
const BURST_GAP_MS = 350;
const BURST_WAIT_MS = 170;
let lastSayAt = -Infinity;

// Resolves true when everything was said, false if it was interrupted by another say()/stopAll().
// The first call after a quiet moment plays at once; only rapid repeats are held back a beat.
export function say(...keys) {
  const my = ++token;
  halt();
  const now = performance.now();
  const burst = now - lastSayAt < BURST_GAP_MS;
  lastSayAt = now;
  return (async () => {
    if (burst) {
      await wait(BURST_WAIT_MS);
      if (my !== token) return false;
    }
    for (const seg of plan(keys)) {
      if (my !== token) return false;
      await playSegment(seg, my, now);
    }
    return my === token;
  })();
}

const hasAudio = (key) => recorded.has(key) || !!manifest[key];

// "find-alef" → ["find-letter", "name-alef"] once the shared opening is recorded in the parent's
// voice. Until then an older full recording (or file) of the question is used, else the device voice.
function expand(key) {
  const parts = PARTS[key];
  if (parts && recorded.has(parts[0])) return parts;
  return [key];
}

// Groups the keys into runs that play as one: recordings, files (one each), or device voice.
function plan(keys) {
  const segs = [];
  for (const key of keys.flatMap(expand)) {
    const kind = recorded.has(key) ? 'recording' : manifest[key] ? 'file' : 'voice';
    const last = segs.at(-1);
    if (last && last.kind === kind && kind !== 'file') last.keys.push(key);
    else segs.push({ kind, keys: [key] });
  }
  return segs;
}

// The device voice reads a run as one sentence.
function joinTexts(keys) {
  return keys.reduce((text, key, i) => {
    const next = CLIPS[key] ?? key;
    if (i === 0) return next;
    const sep = LEADS_IN.has(keys[i - 1]) ? ' ' : /[.!?]$/.test(text) ? ' ' : '. ';
    return text + sep + next;
  }, '');
}

// Readies recordings one at a time in the background, so a clip that is actually tapped
// never waits behind a whole screen's worth of loading.
let preloadQueue = Promise.resolve();
const queued = new Set(); // flipping between screens shouldn't pile up the same work
export function preload(keys) {
  for (const key of keys) {
    if (!recorded.has(key) || urls.has(key) || queued.has(key)) continue;
    queued.add(key);
    preloadQueue = preloadQueue
      .then(() => clipUrl(key))
      .catch(() => {})
      .finally(() => queued.delete(key));
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

const START_TIMEOUT_MS = 2500;

function playUrl(url, onStart) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let startTimer = 0;
    let endTimer = 0;
    const settle = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimer);
      clearTimeout(endTimer);
      player.onended = null;
      player.onerror = null;
      player.onplaying = null;
      fn(arg);
    };
    player.onended = () => settle(resolve);
    player.onerror = () => settle(reject, new Error('audio playback failed'));
    // A clip that never starts (iOS sometimes swallows a load) is retried instead of blocking.
    startTimer = setTimeout(() => settle(reject, new Error('audio did not start')), START_TIMEOUT_MS);
    player.onplaying = () => {
      clearTimeout(startTimer);
      onStart?.(performance.now());
      const seconds = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 8;
      clearTimeout(endTimer);
      endTimer = setTimeout(() => settle(resolve), (seconds + 1.5) * 1000);
    };
    finishCurrent = () => settle(resolve);
    player.src = url;
    player.play()?.catch((err) => {
      // AbortError just means a newer clip replaced this one: not a failure.
      if (err?.name !== 'AbortError') settle(reject, err);
    });
  });
}

async function playSegment(seg, my, saidAt) {
  if (seg.kind !== 'voice') {
    // One retry before giving up on a recording: a hiccup shouldn't swap in the robot voice.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = seg.keys.length > 1 ? await stitchedUrl(seg.keys) : await clipUrl(seg.keys[0]);
        if (my !== token) return;
        const askedAt = performance.now();
        await playUrl(url, (startedAt) => note(seg, startedAt, askedAt, saidAt));
        return;
      } catch {
        if (my !== token) return;
        if (attempt === 0) {
          await wait(120);
          if (my !== token) return;
        }
      }
    }
    seg = { kind: 'voice', keys: seg.keys, fallback: true };
  }
  if (my !== token) return;
  const askedAt = performance.now();
  await speakText(joinTexts(seg.keys), (startedAt) => note(seg, startedAt, askedAt, saidAt));
}

// ---- Stitching recordings into one clip ----
// Recordings made in the app are 16-bit mono WAV with ~80 ms of air before and ~200 ms after.
// Between words that air makes a natural pause; after an opening like "where is the letter"
// most of it is cut so the letter's name follows right on.

const LEAD_IN_TAIL_CUT_MS = 150;
const FOLLOW_HEAD_CUT_MS = 50;

function pcm(buffer) {
  const v = new DataView(buffer);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (buffer.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let o = 12;
  let fmt = null;
  while (o + 8 <= buffer.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { format: v.getUint16(o + 8, true), channels: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    if (id === 'data' && fmt) return { ...fmt, samples: new Int16Array(buffer.slice(o + 8, o + 8 + size)) };
    o += 8 + size + (size % 2);
  }
  return null;
}

async function stitchedUrl(keys) {
  const id = keys.join('+');
  if (urls.has(id)) return urls.get(id);
  const parts = [];
  for (const key of keys) {
    const r = await loadRecording(key);
    const p = r && pcm(r.data);
    if (!p || p.format !== 1 || p.channels !== 1 || p.bits !== 16 || (parts[0] && p.rate !== parts[0].rate)) {
      throw new Error(`can't stitch ${key}`);
    }
    parts.push(p);
  }
  const rate = parts[0].rate;
  const pieces = parts.map((p, i) => {
    const head = i > 0 && LEADS_IN.has(keys[i - 1]) ? Math.round((rate * FOLLOW_HEAD_CUT_MS) / 1000) : 0;
    const tail = LEADS_IN.has(keys[i]) && i < keys.length - 1 ? Math.round((rate * LEAD_IN_TAIL_CUT_MS) / 1000) : 0;
    return p.samples.subarray(Math.min(head, p.samples.length), Math.max(head, p.samples.length - tail));
  });
  const total = pieces.reduce((n, a) => n + a.length, 0);
  const out = new ArrayBuffer(44 + total * 2);
  const v = new DataView(out);
  const str = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + total * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, total * 2, true);
  let at = 44;
  for (const a of pieces) {
    new Int16Array(out, at, a.length).set(a);
    at += a.length * 2;
  }
  if (urls.has(id)) return urls.get(id);
  const url = URL.createObjectURL(new Blob([out], { type: 'audio/wav' }));
  urls.set(id, url);
  return url;
}

// ---- Sound check: what played, with which engine, and how long it took to start ----
const log = [];
// startedAt is null when the device didn't report when the sound began.
function note(seg, startedAt, askedAt, saidAt) {
  const known = typeof startedAt === 'number';
  log.unshift({
    text: joinTexts(seg.keys),
    kind: seg.fallback ? 'voice (recording failed)' : seg.kind,
    startMs: known ? Math.round(startedAt - askedAt) : null,
    sinceTapMs: known ? Math.round(startedAt - saidAt) : null,
  });
  log.length = Math.min(log.length, 12);
  for (const fn of logListeners) fn();
}
const logListeners = new Set();
export const soundLog = () => log.slice();
export const onSoundLog = (fn) => (logListeners.add(fn), () => logListeners.delete(fn));

function speakText(text, onStart) {
  if (!('speechSynthesis' in window)) return wait(400);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    let started = false;
    u.onstart = () => {
      started = true;
      onStart?.(performance.now());
    };
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
    // Some iOS versions never report the start; still list it in the sound check.
    u.onend = () => {
      if (!started) onStart?.(null);
      done();
    };
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
