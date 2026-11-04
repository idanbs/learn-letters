// Microphone capture and clean-up for the parents' recordings:
// trims the silence before/after the words, evens out the volume, and stores a small mono WAV.

const OUT_RATE = 24000;

export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

// Resolves once the microphone is actually recording. The mic is released after every take,
// so iPhone playback goes back to the loud speaker right away.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(
    (t) => MediaRecorder.isTypeSupported?.(t),
  );
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const started = new Promise((resolve) => (rec.onstart = resolve));
  const stopped = new Promise((resolve) => (rec.onstop = resolve));
  const release = () => stream.getTracks().forEach((t) => t.stop());
  rec.start();
  await started;
  return {
    async stop() {
      if (rec.state !== 'inactive') rec.stop();
      await stopped;
      release();
      return new Blob(chunks, { type: rec.mimeType || type || 'audio/mp4' });
    },
    cancel() {
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
  };
}

const decode = (ctx, data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));

// Returns { wav: ArrayBuffer, seconds } or null when nothing audible was recorded.
export async function cleanUp(ctx, blob) {
  const buffer = await decode(ctx, await blob.arrayBuffer());
  const rate = buffer.sampleRate;
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buffer.numberOfChannels;
  }

  // Loudness per 10ms frame; speech is whatever rises clearly above the quiet parts.
  const frame = Math.max(1, Math.round(rate * 0.01));
  const frames = Math.floor(mono.length / frame);
  const rms = new Float32Array(frames);
  let loudest = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) sum += mono[i] * mono[i];
    rms[f] = Math.sqrt(sum / frame);
    if (rms[f] > loudest) loudest = rms[f];
  }
  if (loudest < 0.004) return null;
  const threshold = Math.max(0.006, loudest * 0.1);
  const first = rms.findIndex((v) => v > threshold);
  if (first < 0) return null;
  let last = frames - 1;
  while (last > first && rms[last] <= threshold) last--;
  // Keep a little air before and a bit more after (word endings fade out slowly).
  const start = Math.max(0, first * frame - Math.round(rate * 0.08));
  const end = Math.min(mono.length, (last + 1) * frame + Math.round(rate * 0.2));
  if (end - start < rate * 0.12) return null;
  const clip = mono.subarray(start, end);

  // Even out the volume: bring the peak to about -1 dB, but don't blow up a far-away mic.
  let peak = 0;
  for (const v of clip) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(0.89 / peak, 8);

  const out = resample(clip, rate, OUT_RATE);
  const fade = Math.min(Math.round(OUT_RATE * 0.012), out.length >> 2);
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    else if (i > out.length - 1 - fade) g *= (out.length - 1 - i) / fade;
    out[i] *= g;
  }
  return { wav: encodeWav(out, OUT_RATE), seconds: out.length / OUT_RATE };
}

// Box-filter resampling: averages the source samples that fall into each output sample.
function resample(input, from, to) {
  if (from === to) return Float32Array.from(input);
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = i * ratio;
    const b = Math.min(input.length, a + Math.max(1, ratio));
    let sum = 0;
    let n = 0;
    for (let j = Math.floor(a); j < b; j++) {
      sum += input[j];
      n++;
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

export function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}
