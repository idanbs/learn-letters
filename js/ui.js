// Small DOM helpers, icons, and the celebrations.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [p, pv] of Object.entries(v)) el.style.setProperty(p, pv);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Toddler-proof tap: fires on release if the finger is still over the element,
// even if it wandered a bit (a plain click is cancelled by small movements on iOS).
// A finger that travels further than MAX_TAP_TRAVEL was swiping, not tapping.
const MAX_TAP_TRAVEL = 45;

export function onTap(el, fn) {
  let active = null;
  let startX = 0;
  let startY = 0;
  el.addEventListener('pointerdown', (e) => {
    if (active !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    active = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    el.classList.add('pressed');
    try { el.setPointerCapture(e.pointerId); } catch { /* element may be detached */ }
  });
  const end = (e, fire) => {
    if (e.pointerId !== active) return;
    active = null;
    el.classList.remove('pressed');
    if (!fire || Math.hypot(e.clientX - startX, e.clientY - startY) > MAX_TAP_TRAVEL) return;
    const r = el.getBoundingClientRect();
    const slack = 24;
    if (e.clientX >= r.left - slack && e.clientX <= r.right + slack && e.clientY >= r.top - slack && e.clientY <= r.bottom + slack) {
      fn(e);
    }
  };
  el.addEventListener('pointerup', (e) => end(e, true));
  el.addEventListener('pointercancel', (e) => end(e, false));
  // Keyboard / switch control still work through click (detail === 0 means not a pointer).
  el.addEventListener('click', (e) => {
    if (e.detail === 0) fn(e);
  });
  return el;
}

export function button(cls, content, fn, label) {
  const b = h('button', { class: cls, type: 'button', 'aria-label': label }, content);
  if (fn) onTap(b, fn);
  return b;
}

const svgIcon = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  home: svgIcon('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>'),
  menu: svgIcon('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  // In RTL "previous" points right and "next" points left.
  prev: svgIcon('<path d="M9 5l7 7-7 7"/>'),
  next: svgIcon('<path d="M15 5l-7 7 7 7"/>'),
  play: svgIcon('<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>'),
  trash: svgIcon('<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>'),
  gear: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  speaker: svgIcon('<path d="M4 9.5v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  again: svgIcon('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4v4h-4"/>'),
};

// Parent gate: only a long press (not a toddler's tap) triggers fn. A short tap shows the hint.
export function onHold(el, ms, fn) {
  let timer = 0;
  let active = null;
  el.style.setProperty('--hold', `${ms}ms`);
  el.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add('holding');
    timer = setTimeout(() => {
      active = null;
      el.classList.remove('holding');
      fn();
    }, ms);
  });
  const cancel = (e) => {
    if (e.pointerId !== active) return;
    active = null;
    clearTimeout(timer);
    el.classList.remove('holding');
    el.classList.add('show-hint');
    setTimeout(() => el.classList.remove('show-hint'), 2200);
  };
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    if (e.detail === 0) fn();
  });
  return el;
}

export function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export function layout({ onBack, backIcon = 'menu', middle = null, end = null, cls = '' }, ...body) {
  return h(
    'div',
    { class: `screen ${cls}` },
    h(
      'header',
      { class: 'bar' },
      onBack ? button('round-btn back', icon(backIcon), onBack, 'חזרה') : h('span', { class: 'bar-spacer' }),
      h('div', { class: 'bar-mid' }, middle),
      end || h('span', { class: 'bar-spacer' }),
    ),
    ...body,
  );
}

export function icon(name) {
  return h('span', { class: 'icon', html: icons[name] });
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function celebrate({ from = null, big = false } = {}) {
  const layer = h('div', { class: 'burst', 'aria-hidden': 'true' });
  document.body.append(layer);
  const r = from?.getBoundingClientRect();
  const cx = r ? r.left + r.width / 2 : innerWidth / 2;
  const cy = r ? r.top + r.height / 2 : innerHeight / 2;
  const items = ['⭐', '🌟', '✨', '🎉', '💖', '🎈'];
  const count = reduceMotion() ? 6 : big ? 34 : 16;
  const reach = Math.min(innerWidth, innerHeight) * (big ? 0.55 : 0.32);
  for (let i = 0; i < count; i++) {
    const s = h('span', { style: { left: `${cx}px`, top: `${cy}px` } }, items[i % items.length]);
    layer.append(s);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const d = reach * (0.55 + Math.random() * 0.45);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const spin = (Math.random() - 0.5) * 240;
    s.animate(
      reduceMotion()
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }]
        : [
            { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15) rotate(${spin}deg)`, opacity: 1, offset: 0.65 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 70}px)) scale(0.9) rotate(${spin}deg)`, opacity: 0 },
          ],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' },
    );
  }
  setTimeout(() => layer.remove(), 1800);
}

// Big wins get a random show so it stays a surprise: balloons, confetti, or a big star burst.
export function party() {
  const pick = Math.floor(Math.random() * 3);
  if (reduceMotion() || pick === 0) celebrate({ big: true });
  else if (pick === 1) balloons();
  else confetti();
}

function balloons() {
  const layer = h('div', { class: 'burst', 'aria-hidden': 'true' });
  document.body.append(layer);
  const count = 12;
  for (let i = 0; i < count; i++) {
    const size = 0.8 + Math.random() * 0.7;
    const b = h('span', { style: { left: `${(i + 0.5) * (100 / count) + (Math.random() - 0.5) * 6}%`, top: '100%', 'font-size': `calc(clamp(34px, 8dvmin, 80px) * ${size})` } }, i % 4 === 3 ? '⭐' : '🎈');
    layer.append(b);
    const sway = (Math.random() - 0.5) * 80;
    b.animate(
      [
        { transform: 'translate(-50%, 0) rotate(-6deg)' },
        { transform: `translate(calc(-50% + ${sway}px), -55vh) rotate(6deg)`, offset: 0.5 },
        { transform: `translate(calc(-50% - ${sway / 2}px), calc(-100vh - 120%)) rotate(-4deg)` },
      ],
      { duration: 2400 + Math.random() * 900, delay: Math.random() * 400, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'both' },
    );
  }
  setTimeout(() => layer.remove(), 3800);
}

function confetti() {
  const layer = h('div', { class: 'burst', 'aria-hidden': 'true' });
  document.body.append(layer);
  const count = 60;
  for (let i = 0; i < count; i++) {
    const piece = h('i', {
      class: 'confetti',
      style: { left: `${Math.random() * 100}%`, background: COLORS[i % COLORS.length], 'border-radius': i % 3 ? '2px' : '50%' },
    });
    layer.append(piece);
    const drift = (Math.random() - 0.5) * 160;
    const spin = (Math.random() - 0.5) * 1080;
    piece.animate(
      [
        { transform: 'translate(0, -5vh) rotate(0deg)', opacity: 1 },
        { transform: `translate(${drift}px, 105vh) rotate(${spin}deg)`, opacity: 1 },
      ],
      { duration: 1600 + Math.random() * 1200, delay: Math.random() * 500, easing: 'cubic-bezier(.25,.4,.45,1)', fill: 'both' },
    );
  }
  setTimeout(() => layer.remove(), 3500);
}

// A new sticker: pops up in the middle, wobbles, then flies off into the album corner.
export function stickerPop(emoji) {
  const layer = h('div', { class: 'sticker-layer', 'aria-hidden': 'true' });
  const card = h('div', { class: 'sticker-pop' }, h('span', { class: 'sticker-rays' }), h('span', { class: 'sticker-face' }, emoji));
  layer.append(card);
  document.body.append(layer);
  // The album button lives in the top inline-start corner (top right in Hebrew).
  const dx = innerWidth / 2 - 60;
  const dy = -(innerHeight / 2 - 60);
  const anim = card.animate(
    reduceMotion()
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [
          { transform: 'translate(-50%, -50%) scale(0) rotate(-40deg)', opacity: 0 },
          { transform: 'translate(-50%, -50%) scale(1.2) rotate(10deg)', opacity: 1, offset: 0.16, easing: 'ease-out' },
          { transform: 'translate(-50%, -50%) scale(0.95) rotate(-5deg)', opacity: 1, offset: 0.26 },
          { transform: 'translate(-50%, -50%) scale(1) rotate(-3deg)', opacity: 1, offset: 0.68, easing: 'cubic-bezier(.5,0,.75,0)' },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.15) rotate(-3deg)`, opacity: 0.4 },
        ],
    { duration: 2300, fill: 'forwards' },
  );
  const done = () => layer.remove();
  anim.onfinish = done;
  setTimeout(done, 2700);
}

export function shake(el) {
  if (reduceMotion()) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-10px) rotate(-3deg)' },
      { transform: 'translateX(9px) rotate(3deg)' },
      { transform: 'translateX(-6px) rotate(-2deg)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 420, easing: 'ease-out' },
  );
}

export function bounce(el) {
  if (reduceMotion()) return;
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }],
    { duration: 450, easing: 'ease-out' },
  );
}

export const COLORS = ['#ff6b6b', '#ff922b', '#f59f00', '#40c057', '#228be6', '#7950f2', '#e64980', '#15aabf'];
export const colorFor = (i) => COLORS[i % COLORS.length];

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
