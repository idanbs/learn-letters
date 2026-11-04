// Tiny SVG-path sampler. Supports the absolute commands we use for strokes: M L H V Q C.
// Turns a path into a dense polyline with cumulative arc length, so the tracing knob
// can be projected onto it and the traced part can be drawn as a polyline.

export function parsePath(d) {
  const tokens = d.match(/[MLHVQC]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const segs = [];
  let i = 0;
  let cmd = null;
  let x = 0;
  let y = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Z]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'M') {
      x = num(); y = num();
      cmd = 'L'; // implicit lineto after the first pair, per SVG spec
      segs.push({ type: 'M', x, y });
    } else if (cmd === 'L') {
      const nx = num(), ny = num();
      segs.push({ type: 'L', from: [x, y], to: [nx, ny] });
      x = nx; y = ny;
    } else if (cmd === 'H') {
      const nx = num();
      segs.push({ type: 'L', from: [x, y], to: [nx, y] });
      x = nx;
    } else if (cmd === 'V') {
      const ny = num();
      segs.push({ type: 'L', from: [x, y], to: [x, ny] });
      y = ny;
    } else if (cmd === 'Q') {
      const c = [num(), num()], to = [num(), num()];
      segs.push({ type: 'Q', from: [x, y], c, to });
      [x, y] = to;
    } else if (cmd === 'C') {
      const c1 = [num(), num()], c2 = [num(), num()], to = [num(), num()];
      segs.push({ type: 'C', from: [x, y], c1, c2, to });
      [x, y] = to;
    } else {
      throw new Error(`Unsupported path command "${cmd}" in "${d}"`);
    }
  }
  return segs;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pointAt(seg, t) {
  const u = 1 - t;
  if (seg.type === 'L') {
    return [seg.from[0] * u + seg.to[0] * t, seg.from[1] * u + seg.to[1] * t];
  }
  if (seg.type === 'Q') {
    const { from: p0, c: p1, to: p2 } = seg;
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ];
  }
  const { from: p0, c1: p1, c2: p2, to: p3 } = seg;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

function roughLength(seg) {
  if (seg.type === 'L') return dist(seg.from, seg.to);
  if (seg.type === 'Q') return dist(seg.from, seg.c) + dist(seg.c, seg.to);
  return dist(seg.from, seg.c1) + dist(seg.c1, seg.c2) + dist(seg.c2, seg.to);
}

// Returns { pts: [[x, y], ...], cum: [arcLengthAtPoint...], length }
export function samplePath(d, step = 0.75) {
  const pts = [];
  for (const seg of parsePath(d)) {
    if (seg.type === 'M') {
      if (pts.length === 0) pts.push([seg.x, seg.y]);
      continue;
    }
    const n = Math.max(2, Math.ceil(roughLength(seg) / step));
    for (let k = 1; k <= n; k++) pts.push(pointAt(seg, k / n));
  }
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k - 1], pts[k]));
  return { pts, cum, length: cum[cum.length - 1] };
}

export function bounds(polylines) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { pts } of polylines) {
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}
