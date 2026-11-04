// Letter tracing: the letter is drawn as a thick "road" and a ball sits at the start of the
// current stroke. While the child drags, the ball is projected onto the stroke's centerline,
// so it can never leave the shape: the finger only has to move in the general direction.
// Progress is one-way (the ball never slides back) and can only advance a little at a time,
// so tapping the end of a stroke or scribbling elsewhere doesn't skip ahead.
import { samplePath, bounds } from './path.js';
import { STROKE_WIDTH } from './strokes.js';
import { sfx } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const W = STROKE_WIDTH;
const KNOB_R = 13;
const GRAB_RADIUS = 34; // how close to the ball a touch must start (letter units, ~1/3 of the letter)
const LOOKAHEAD = 26; // max arc length the ball may jump per move event
const TOLERANCE = 38; // finger may be this far from the road and still pull the ball
const FRAME_W = 124;
const FRAME_H = 150;

const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
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
  for (const s of strokes) {
    gOutline.append(el('path', { d: s.d }));
    gRoad.append(el('path', { d: s.d }));
    s.paint = el('polyline', { points: '' });
    gDone.append(s.paint);
  }
  const guide = el('polyline', { class: 'guide', points: '' });
  const arrow = el('g', { class: 'arrow' });
  arrow.append(el('path', { d: 'M -4 -6 L 4 0 L -4 6' }));
  const knob = el('g', { class: 'knob' });
  knob.append(el('circle', { class: 'knob-halo', r: KNOB_R + 5 }));
  knob.append(el('circle', { class: 'knob-ball', r: KNOB_R }));
  const star = el('text', { class: 'knob-star', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1 });
  star.textContent = '⭐';
  knob.append(star);
  svg.append(gOutline, gRoad, gDone, guide, arrow, knob);

  let cur = 0; // current stroke index
  let idx = 0; // index into current stroke's points
  let dragging = null; // pointerId
  let finished = false;
  let lastTickAt = 0;

  function knobPos() {
    return strokes[cur].pts[idx];
  }

  function render({ jump = false } = {}) {
    if (finished) return;
    const s = strokes[cur];
    s.paint.setAttribute('points', pointsAttr(s.pts, 0, idx + 1));
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
    idx = best;
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
    s.paint.setAttribute('points', pointsAttr(s.pts));
    sfx.pop();
    onStrokeDone?.(cur);
    if (cur === strokes.length - 1) {
      finished = true;
      dragging = null;
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
  }

  function onDown(e) {
    if (finished || dragging !== null) return;
    const p = toLocal(e);
    if (!p) return;
    const [kx, ky] = knobPos();
    if (Math.hypot(p[0] - kx, p[1] - ky) > GRAB_RADIUS) {
      // Touched somewhere else: wiggle the ball to show where to start.
      knob.classList.remove('hint');
      void knob.getBoundingClientRect();
      knob.classList.add('hint');
      return;
    }
    e.preventDefault();
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

  function onUp(e) {
    if (e.pointerId !== dragging) return;
    dragging = null;
    svg.classList.remove('dragging');
  }

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);

  function reset() {
    cur = 0;
    idx = 0;
    dragging = null;
    finished = false;
    svg.classList.remove('finished', 'dragging');
    for (const s of strokes) s.paint.setAttribute('points', '');
    render({ jump: true });
  }

  render();

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
