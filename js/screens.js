// All screens: home → menu (letters / numbers) → cards | find | trace.
import { go } from './nav.js';
import { KINDS } from './kinds.js';
import { PRAISE_COUNT } from './data.js';
import { say, sfx, wait, preload } from './audio.js';
import { h, onTap, onHold, button, icon, layout, celebrate, shake, bounce, colorFor, shuffle } from './ui.js';
import { parents } from './parents.js';
import { createTracer } from './tracer.js';

const praise = () => `praise-${Math.floor(Math.random() * PRAISE_COUNT)}`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// In RTL the next item arrives from the left.
function slideIn(el, dir) {
  if (reduceMotion()) return;
  const dx = dir === 'next' ? -70 : 70;
  el.animate([{ transform: `translateX(${dx}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], {
    duration: 280,
    easing: 'cubic-bezier(.2,.8,.2,1)',
  });
}

function pager(kind, start, render) {
  let i = start;
  const n = kind.items.length;
  const holder = h('div', { class: 'pager-main' });
  const show = (to, dir) => {
    i = (to + n) % n;
    const el = render(kind.items[i], i);
    holder.replaceChildren(el);
    if (dir) slideIn(el, dir);
  };
  const prevBtn = button('nav-btn prev', icon('prev'), () => show(i - 1, 'prev'), 'הקודם');
  const nextBtn = button('nav-btn next', icon('next'), () => show(i + 1, 'next'), 'הבא');
  const stage = h('main', { class: 'stage pager' }, prevBtn, holder, nextBtn);
  return { stage, show, nextBtn, get index() { return i; } };
}

// ---------- Home ----------

export function home() {
  const tile = (kindId, glyphs) =>
    button(
      `tile tile-big ${kindId}`,
      [h('span', { class: 'tile-art' }, glyphs), h('span', { class: 'tile-label' }, KINDS[kindId].title)],
      () => go(menu, kindId),
      KINDS[kindId].title,
    );
  // Parents' area: hold for 1.5s, so a toddler's tap doesn't open it.
  const parentBtn = h(
    'button',
    { class: 'parent-btn', type: 'button', 'aria-label': 'מצב הורים (להחזיק לחוץ)' },
    h('span', { class: 'hold-ring', html: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" pathLength="100"/></svg>' }),
    icon('gear'),
    h('span', { class: 'parent-hint' }, 'מצב הורים: להחזיק לחוץ'),
  );
  onHold(parentBtn, 1500, () => go(parents));
  const el = h(
    'div',
    { class: 'screen home' },
    h('h1', { class: 'home-title' }, 'אוֹתִיּוֹת וּמִסְפָּרִים'),
    h('main', { class: 'tiles' }, tile('letters', 'אב'), tile('numbers', '12')),
    parentBtn,
  );
  return { el };
}

// ---------- Activity menu ----------

export function menu(kindId) {
  const kind = KINDS[kindId];
  const items = [
    { cls: 'cards', art: kindId === 'letters' ? '🦁' : '🍎', label: 'כַּרְטִיסִיּוֹת', to: () => go(cards, kindId, 0) },
    { cls: 'find', art: '🔍', label: 'אֵיפֹה?', to: () => go(find, kindId) },
    { cls: 'trace', art: '✏️', label: 'מְצַיְּרִים', to: () => go(trace, kindId, 0) },
  ];
  const el = layout(
    { onBack: () => go(home), backIcon: 'home', middle: h('h2', { class: 'bar-title' }, kind.title), cls: `menu ${kindId}` },
    h(
      'main',
      { class: 'tiles three' },
      items.map((t) =>
        button(`tile ${t.cls}`, [h('span', { class: 'tile-art' }, t.art), h('span', { class: 'tile-label' }, t.label)], t.to, t.label),
      ),
    ),
  );
  return { el, enter: () => say(kindId) };
}

// ---------- Flash cards ----------

export function cards(kindId, start = 0) {
  const kind = KINDS[kindId];
  const p = pager(kind, start, (item, i) => {
    const card = kindId === 'letters' ? letterCard(item, i) : numberCard(item, i);
    say(...kind.cardClips(item));
    return card;
  });
  const el = layout({ onBack: () => go(menu, kindId), cls: 'cards-screen' }, p.stage);
  return {
    el,
    enter: () => {
      p.show(start);
      preload(kind.items.flatMap(kind.cardClips));
    },
  };
}

function letterCard(item, i) {
  const glyph = h('span', { class: 'card-glyph' }, item.char);
  const emoji = h('span', { class: 'card-emoji' }, item.emoji);
  const card = h(
    'div',
    { class: 'card', style: { '--accent': colorFor(i) }, role: 'button', 'aria-label': item.char },
    h('div', { class: 'card-inner' }, glyph, h('span', { class: 'card-pic' }, emoji, h('span', { class: 'card-word' }, item.word))),
  );
  onTap(card, () => {
    bounce(glyph);
    bounce(emoji);
    say(`name-${item.id}`, `word-${item.id}`);
  });
  return card;
}

function numberCard(item, i) {
  let counted = 0;
  const glyph = button('card-glyph', String(item.n), () => {
    bounce(glyph);
    say(`num-${item.n}`);
  }, String(item.n));
  const things = Array.from({ length: item.n }, () => {
    const badge = h('span', { class: 'count-badge' });
    const b = button('count-item', [h('span', { class: 'count-emoji' }, item.emoji), badge], () => {
      bounce(b);
      if (b.dataset.n) {
        say(`num-${b.dataset.n}`);
        return;
      }
      counted++;
      b.dataset.n = counted;
      badge.textContent = counted;
      b.classList.add('counted');
      sfx.pop();
      if (counted === item.n) {
        sfx.success();
        celebrate({ from: glyph });
        bounce(glyph);
        say(`num-${counted}`, praise());
      } else {
        say(`num-${counted}`);
      }
    });
    return b;
  });
  const cols = Math.min(item.n, 5);
  const rows = Math.ceil(item.n / 5);
  return h(
    'div',
    { class: 'card number-card', style: { '--accent': colorFor(i) } },
    h('div', { class: 'card-inner' }, glyph, h('div', { class: 'count-grid', style: { '--cols': cols, '--rows': rows } }, things)),
  );
}

// ---------- "Where is ...?" ----------

export function find(kindId) {
  const kind = KINDS[kindId];
  const GOAL = 5;
  let options = 2;
  let streak = 0;
  let roughRounds = 0;
  let stars = 0;
  let target = null;
  let last = null;
  let busy = false;
  let mistakes = 0;
  let alive = true;

  const starEls = Array.from({ length: GOAL }, () => h('span', { class: 'star' }, '⭐'));
  const starRow = h('div', { class: 'stars', 'aria-label': 'כוכבים' }, starEls);
  const ask = () => say(kind.findClip(target));
  const speakBtn = button('round-btn speak', icon('speaker'), ask, 'שוב');
  const grid = h('div', { class: 'options' });

  function updateStars() {
    starEls.forEach((s, k) => s.classList.toggle('on', k < stars));
  }

  function round() {
    busy = false;
    mistakes = 0;
    const pool = kind.items.filter((x) => x !== last);
    target = pool[Math.floor(Math.random() * pool.length)];
    last = target;
    const others = shuffle(kind.items.filter((x) => x !== target)).slice(0, options - 1);
    const choices = shuffle([target, ...others]);
    grid.style.setProperty('--n', choices.length);
    grid.replaceChildren(
      ...choices.map((item) => {
        const b = button('option', h('span', { class: 'option-glyph' }, kind.glyph(item)), () => pick(b, item), kind.glyph(item));
        b.style.setProperty('--accent', colorFor(kind.items.indexOf(item)));
        return b;
      }),
    );
    if (!reduceMotion()) {
      [...grid.children].forEach((b, k) =>
        b.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], {
          duration: 320,
          delay: k * 70,
          easing: 'cubic-bezier(.3,1.4,.5,1)',
          fill: 'backwards',
        }),
      );
    }
    ask();
  }

  async function pick(b, item) {
    if (busy || b.classList.contains('wrong')) return;
    if (item !== target) {
      mistakes++;
      b.classList.add('wrong');
      shake(b);
      sfx.oops();
      ask();
      return;
    }
    busy = true;
    b.classList.add('right');
    bounce(b);
    sfx.success();
    celebrate({ from: b });
    stars++;
    updateStars();
    // Adapt: 3 choices after a few clean answers, back to 2 if it gets hard.
    if (mistakes === 0) {
      streak++;
      roughRounds = 0;
      if (streak >= 3) options = 3;
    } else {
      streak = 0;
      roughRounds++;
      if (roughRounds >= 2) options = 2;
    }
    await Promise.all([say(praise(), kind.nameClip(item)), wait(1300)]);
    if (!alive) return;
    if (stars >= GOAL) {
      celebrate({ big: true });
      sfx.success();
      await Promise.all([say('stars-5'), wait(1700)]);
      if (!alive) return;
      stars = 0;
      updateStars();
    }
    round();
  }

  const el = layout(
    { onBack: () => go(menu, kindId), middle: starRow, end: speakBtn, cls: 'find-screen' },
    h('main', { class: 'stage' }, grid),
  );
  return {
    el,
    enter: () => {
      preload(kind.items.map(kind.findClip));
      round();
    },
    leave: () => {
      alive = false;
    },
  };
}

// ---------- Tracing ----------

export function trace(kindId, start = 0) {
  const kind = KINDS[kindId];
  let tracer = null;
  let alive = true;
  const again = button('round-btn', icon('again'), () => {
    tracer?.reset();
    p.nextBtn.classList.remove('nudge');
  }, 'שוב');

  const p = pager(kind, start, (item, i) => {
    const box = h('div', { class: 'trace-box' });
    tracer = createTracer(kind.strokes(item), {
      color: colorFor(i),
      onDone: async () => {
        sfx.success();
        celebrate({ from: box, big: true });
        p.nextBtn.classList.add('nudge');
        await wait(300);
        if (alive) say(praise(), kind.nameClip(item));
      },
    });
    // Once finished, a fresh tap on the letter says its name again
    // (the finger lifting from the last stroke must not cut off the praise).
    const t = tracer;
    let armed = false;
    box.addEventListener('pointerdown', () => {
      armed = t.finished;
    });
    box.addEventListener('pointerup', () => {
      if (armed && t.finished) say(kind.nameClip(item));
      armed = false;
    });
    box.append(tracer.el);
    p.nextBtn.classList.remove('nudge');
    say(kind.nameClip(item));
    return box;
  });

  const el = layout({ onBack: () => go(menu, kindId), end: again, cls: 'trace-screen' }, p.stage);
  return {
    el,
    enter: () => {
      p.show(start);
      preload(kind.items.map(kind.nameClip));
    },
    leave: () => {
      alive = false;
    },
    get tracer() {
      return tracer;
    },
  };
}
