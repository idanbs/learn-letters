// Letter tracing: the letter is drawn as a thick "road" and a ball sits at the start of the
// current stroke. While the child drags, the ball is projected onto the stroke's centerline,
// so it can never leave the shape: the finger only has to move in the general direction.
// Progress is one-way (the ball never slides back) and can only advance a little at a time,
// so tapping the end of a stroke or scribbling elsewhere doesn't skip ahead.
// A faint "ghost" ball shows the way along each stroke before she starts, and again if she's stuck.
import { samplePath, bounds } from './path.js';
import { STROKE_WIDTH } from './strokes.js';
import { sfx } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const W = STROKE_WIDTH;
const KNOB_R = 13;
const GRAB_RADIUS = 34; // how close to the ball a touch must start (letter units, ~1/3 of the letter)
const LOOKAHEAD = 26; // max arc length the ball may jump per move event
const TOLERANCE = 38; // finger may be this far from the road and still pull the ball
const END_SNAP = 9; // lifting the finger this close to a stroke's end still counts as finishing it
const IDLE_DEMO_MS = 7000; // show the way again after this long without touching
const FRAME_W = 124;
const FRAME_H = 150;

const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The point at arc length `len` along a sampled stroke.
function pointAtLength(s, len) {
  let lo = 0;
  let hi = s.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.cum[mid] < len) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return s.pts[0];
  const span = s.cum[lo] - s.cum[lo - 1] || 1;
  const t = (len - s.cum[lo - 1]) / span;
  const [ax, ay] = s.pts[lo - 1];
  const [bx, by] = s.pts[lo];
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

const pointsAttr = (pts, from = 0, to = pts.length) => {
  let s = '';
  for (let i = from; i < to; i++) s += `${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} `;
  return s;
};

export function createTracer(strokeDefs, { color, onStrokeDone, onDone } = {}) {
  const strokes = strokeDefs.map((d) => ({ d, ...samplePath(d) }));
  const b = bounds(strokes);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  const svg = el('svg', {
    class: 'tracer',
    viewBox: `${cx - FRAME_W / 2} ${cy - FRAME_H / 2} ${FRAME_W} ${FRAME_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  });
  svg.style.setProperty('--trace-color', color);

  const gOutline = el('g', { class: 'road-outline', 'stroke-width': W + 7 });
  const gRoad = el('g', { class: 'road', 'stroke-width': W });
  const gDone = el('g', { class: 'painted', 'stroke-width': W });
  const gShine = el('g', { class: 'shine', 'stroke-width': W * 0.26 });
  for (const s of strokes) {
    gOutline.append(el('path', { d: s.d }));
    gRoad.append(el('path', { d: s.d }));
    s.paint = el('polyline', { points: '' });
    gDone.append(s.paint);
    s.shine = el('polyline', { points: '' });
    gShine.append(s.shine);
  }
  const gSparkles = el('g', { class: 'sparkles' });
  const guide = el('polyline', { class: 'guide', points: '' });
  const ghost = el('circle', { class: 'ghost', r: KNOB_R * 0.6 });
  const arrow = el('g', { class: 'arrow' });
  arrow.append(el('path', { d: 'M -4 -6 L 4 0 L -4 6' }));
  const knob = el('g', { class: 'knob' });
  knob.append(el('circle', { class: 'knob-halo', r: KNOB_R + 5 }));
  knob.append(el('circle', { class: 'knob-ball', r: KNOB_R }));
  const star = el('text', { class: 'knob-star', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1 });
  star.textContent = '⭐';
  knob.append(star);
  svg.append(gOutline, gRoad, gDone, gShine, gSparkles, guide, ghost, arrow, knob);

  let cur = 0; // current stroke index
  let idx = 0; // index into current stroke's points
  let dragging = null; // pointerId
  let finished = false;
  let lastTickAt = 0;
  let sparkleTravel = 0;

  function knobPos() {
    return strokes[cur].pts[idx];
  }

  function render({ jump = false } = {}) {
    if (finished) return;
    const s = strokes[cur];
    const painted = pointsAttr(s.pts, 0, idx + 1);
    s.paint.setAttribute('points', painted);
    s.shine.setAttribute('points', painted);
    guide.setAttribute('points', pointsAttr(s.pts, idx));
    const [x, y] = knobPos();
    knob.classList.toggle('jump', jump);
    knob.style.transform = `translate(${x}px, ${y}px)`;
    // Direction hint just ahead of the ball.
    const ahead = Math.min(s.pts.length - 1, findAhead(s, idx, KNOB_R + 9));
    const back = Math.max(0, ahead - 4);
    const [ax, ay] = s.pts[ahead];
    const [bx, by] = s.pts[back];
    const angle = (Math.atan2(ay - by, ax - bx) * 180) / Math.PI;
    arrow.style.transform = `translate(${ax}px, ${ay}px) rotate(${angle}deg)`;
    arrow.classList.toggle('jump', jump);
  }

  function findAhead(s, from, distance) {
    let j = from;
    while (j < s.pts.length - 1 && s.cum[j] - s.cum[from] < distance) j++;
    return j;
  }

  function toLocal(e) {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  function advanceTowards([px, py]) {
    const s = strokes[cur];
    let best = idx;
    let bestD = Infinity;
    for (let j = idx; j < s.pts.length && s.cum[j] - s.cum[idx] <= LOOKAHEAD; j++) {
      const d = Math.hypot(s.pts[j][0] - px, s.pts[j][1] - py);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (bestD > TOLERANCE || best === idx) return;
    sparkleTravel += s.cum[best] - s.cum[idx];
    idx = best;
    if (sparkleTravel >= 5) {
      sparkleTravel = 0;
      sparkle(s.pts[idx]);
    }
    const now = performance.now();
    if (now - lastTickAt > 90) {
      lastTickAt = now;
      sfx.tick(s.cum[idx] / s.length);
    }
    if (s.length - s.cum[idx] < 1.5) {
      completeStroke();
    } else {
      render();
    }
  }

  function completeStroke() {
    const s = strokes[cur];
    idx = s.pts.length - 1;
    const all = pointsAttr(s.pts);
    s.paint.setAttribute('points', all);
    s.shine.setAttribute('points', all);
    sfx.pop();
    onStrokeDone?.(cur);
    if (cur === strokes.length - 1) {
      finished = true;
      dragging = null;
      stopDemo();
      clearTimeout(idleTimer);
      guide.setAttribute('points', '');
      svg.classList.add('finished');
      onDone?.();
      return;
    }
    const end = s.pts[s.pts.length - 1];
    cur++;
    idx = 0;
    const start = strokes[cur].pts[0];
    // Keep dragging only when the next stroke continues right where this one ended.
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) > 6) dragging = null;
    svg.classList.toggle('dragging', dragging !== null);
    render({ jump: true });
    if (dragging === null) demo(550);
  }

  // ---- Little sparkles behind the ball ----
  function sparkle([x, y]) {
    if (reduceMotion() || gSparkles.childElementCount > 24) return;
    const c = el('circle', {
      class: `sparkle sp${Math.floor(Math.random() * 3)}`,
      cx: (x + (Math.random() - 0.5) * W * 0.9).toFixed(1),
      cy: (y + (Math.random() - 0.5) * W * 0.9).toFixed(1),
      r: (1.4 + Math.random() * 1.8).toFixed(1),
    });
    gSparkles.append(c);
    setTimeout(() => c.remove(), 700);
  }

  // ---- "Show me": a ghost ball runs ahead along the rest of the current stroke ----
  let demoRaf = 0;
  let demoTimer = 0;
  let idleTimer = 0;

  function stopDemo() {
    cancelAnimationFrame(demoRaf);
    clearTimeout(demoTimer);
    demoRaf = 0;
    ghost.classList.remove('on');
  }

  function demo(delay = 0) {
    stopDemo();
    if (finished || reduceMotion()) return;
    demoTimer = setTimeout(() => {
      if (!svg.isConnected || finished || dragging !== null) return;
      const s = strokes[cur];
      const from = s.cum[idx];
      const span = s.length - from;
      const duration = Math.min(1700, Math.max(650, span * 11));
      const t0 = performance.now();
      const step = (now) => {
        if (!svg.isConnected || finished || dragging !== null) return stopDemo();
        const t = Math.min(1, (now - t0) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const [x, y] = pointAtLength(s, from + eased * span);
        ghost.style.transform = `translate(${x}px, ${y}px)`;
        ghost.classList.add('on');
        if (t < 1) demoRaf = requestAnimationFrame(step);
        else {
          demoRaf = 0;
          setTimeout(() => ghost.classList.remove('on'), 120);
        }
      };
      demoRaf = requestAnimationFrame(step);
    }, delay);
  }

  // If nothing happens for a while, show the way again.
  function armIdle() {
    clearTimeout(idleTimer);
    if (finished) return;
    idleTimer = setTimeout(() => {
      if (!svg.isConnected) return;
      if (dragging === null) demo();
      armIdle();
    }, IDLE_DEMO_MS);
  }

  function onDown(e) {
    if (finished || dragging !== null) return;
    const p = toLocal(e);
    if (!p) return;
    armIdle();
    const [kx, ky] = knobPos();
    if (Math.hypot(p[0] - kx, p[1] - ky) > GRAB_RADIUS) {
      // Touched somewhere else: wiggle the ball and show the way from it.
      knob.classList.remove('hint');
      void knob.getBoundingClientRect();
      knob.classList.add('hint');
      demo(250);
      return;
    }
    e.preventDefault();
    stopDemo();
    sparkleTravel = 0;
    dragging = e.pointerId;
    try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    svg.classList.add('dragging');
    knob.classList.remove('hint');
    render();
  }

  function onMove(e) {
    if (e.pointerId !== dragging) return;
    e.preventDefault();
    const events = e.getCoalescedEvents?.() || [e];
    for (const ev of events.length ? events : [e]) {
      if (dragging === null || finished) break;
      const p = toLocal(ev);
      if (p) advanceTowards(p);
    }
  }

  function onUp(e, released = true) {
    if (e.pointerId !== dragging) return;
    dragging = null;
    svg.classList.remove('dragging');
    armIdle();
    // Little fingers often stop just short of the end: that still counts.
    const s = strokes[cur];
    if (released && !finished && s.length - s.cum[idx] <= Math.min(END_SNAP, s.length * 0.3)) completeStroke();
  }

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', (e) => onUp(e, true));
  svg.addEventListener('pointercancel', (e) => onUp(e, false));

  function reset() {
    cur = 0;
    idx = 0;
    dragging = null;
    finished = false;
    svg.classList.remove('finished', 'dragging');
    for (const s of strokes) {
      s.paint.setAttribute('points', '');
      s.shine.setAttribute('points', '');
    }
    render({ jump: true });
    demo(500);
    armIdle();
  }

  render();
  demo(900);
  armIdle();

  return {
    el: svg,
    reset,
    get finished() {
      return finished;
    },
    // Used by automated checks: progress as [strokeIndex, fraction].
    get progress() {
      return [cur, strokes[cur].cum[idx] / strokes[cur].length];
    },
    strokes,
  };
}
