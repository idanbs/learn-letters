// All screens: home → menu (letters / numbers) → cards | find | trace, plus the sticker album.
import { go } from './nav.js';
import { KINDS } from './kinds.js';
import { PRAISE_COUNT, STICKERS, COUNT_THINGS } from './data.js';
import { say, sfx, wait, preload } from './audio.js';
import {
  h, onTap, onHold, button, icon, layout, celebrate, party, stickerPop, shake, bounce, colorFor, COLORS,
} from './ui.js';
import { parents } from './parents.js';
import { createTracer } from './tracer.js';
import { recordAnswer, recordTrace, practiceWeight, earnSticker, stickers, newStickerCount, markStickersSeen } from './progress.js';
import { weightedPick, pickChoices, closeCounts } from './practice.js';

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

function pager(kind, start, render, { swipe = false } = {}) {
  let i = start;
  const n = kind.items.length;
  const holder = h('div', { class: 'pager-main' });
  const show = (to, dir) => {
    i = (to + n) % n;
    const el = render(kind.items[i], i);
    holder.replaceChildren(el);
    if (dir) slideIn(el, dir);
  };
  if (swipe) {
    // Swiping like turning the page of a Hebrew book: finger to the right = next.
    holder.classList.add('swipeable');
    let id = null;
    let sx = 0;
    let sy = 0;
    holder.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
    });
    holder.addEventListener('pointerup', (e) => {
      if (e.pointerId !== id) return;
      id = null;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) show(i + (dx > 0 ? 1 : -1), dx > 0 ? 'next' : 'prev');
    });
    holder.addEventListener('pointercancel', (e) => {
      if (e.pointerId === id) id = null;
    });
  }
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
    homeDecor(),
    h('h1', { class: 'home-title' }, 'אוֹתִיּוֹת וּמִסְפָּרִים'),
    h('main', { class: 'tiles' }, tile('letters', 'אב'), tile('numbers', '12')),
    albumButton(),
    parentBtn,
  );
  return { el };
}

// The sticker book: shows her newest sticker, with a badge for ones she hasn't looked at yet.
function albumButton() {
  const owned = stickers();
  const fresh = newStickerCount();
  return button(
    `album-btn${fresh ? ' has-new' : ''}${owned.length ? '' : ' empty'}`,
    [h('span', { class: 'album-face' }, owned.at(-1) || '📒'), fresh ? h('span', { class: 'album-badge' }, String(fresh)) : null],
    () => go(album),
    'המדבקות שלי',
  );
}

// Faint letters and numbers scattered around the edges of the home screen.
function homeDecor() {
  const glyphs = ['א', '3', 'ב', 'ש', '7', 'ג', 'מ', '2', 'ל', 'ד', '5', 'ת', 'ר', '1', 'ה'];
  const spots = [
    [5, 20], [94, 14], [12, 84], [88, 86], [30, 6], [70, 5], [4, 52], [97, 50],
    [30, 95], [68, 96], [10, 36], [91, 32], [9, 68], [92, 70], [50, 97],
  ];
  return h(
    'div',
    { class: 'home-decor', 'aria-hidden': 'true' },
    spots.map(([x, y], i) =>
      h(
        'span',
        {
          style: {
            left: `${x}%`,
            top: `${y}%`,
            color: COLORS[i % COLORS.length],
            rotate: `${((i * 29) % 40) - 20}deg`,
            'font-size': `calc(${3 + ((i * 7) % 5)}dvmin + 22px)`,
          },
        },
        glyphs[i],
      ),
    ),
  );
}

// ---------- Sticker album ----------

export function album() {
  const owned = stickers();
  const counts = new Map();
  for (const s of owned) counts.set(s, (counts.get(s) || 0) + 1);
  const fresh = new Set(owned.slice(owned.length - newStickerCount()));
  const slots = STICKERS.map((s, i) => {
    const n = counts.get(s) || 0;
    if (!n) return h('span', { class: 'slot empty', 'aria-hidden': 'true' });
    const b = button(
      `slot sticker${fresh.has(s) ? ' fresh' : ''}`,
      [h('span', { class: 'sticker-face' }, s), n > 1 ? h('span', { class: 'sticker-count' }, `×${n}`) : null],
      () => {
        bounce(b);
        sfx.pop();
      },
      s,
    );
    b.style.setProperty('--tilt', `${((i * 37) % 13) - 6}deg`);
    return b;
  });
  const count = h('div', { class: 'album-count' }, h('span', { class: 'album-count-star' }, '⭐'), String(counts.size));
  const el = layout(
    { onBack: () => go(home), backIcon: 'home', middle: count, cls: 'album' },
    h('main', { class: 'album-page' }, h('div', { class: 'album-grid' }, slots)),
  );
  return {
    el,
    enter: () => {
      // New stickers land one after another.
      [...el.querySelectorAll('.slot.fresh')].slice(0, 8).forEach((s, k) => {
        const delay = 300 + k * 260;
        if (!reduceMotion()) {
          s.animate(
            [
              { transform: 'scale(2.2) rotate(-25deg)', opacity: 0 },
              { transform: 'scale(0.9)', opacity: 1, offset: 0.7 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            { duration: 420, delay, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' },
          );
        }
        setTimeout(() => sfx.pop(), delay + 250);
      });
      markStickersSeen();
    },
  };
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
  const p = pager(
    kind,
    start,
    (item, i) => {
      const card = kindId === 'letters' ? letterCard(item, i) : numberCard(item, i);
      say(...kind.cardClips(item));
      return card;
    },
    { swipe: true },
  );
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

// Things to tap and count: each one gets its number and says it out loud.
function countingThings(n, thing, { onAll } = {}) {
  let counted = 0;
  return Array.from({ length: n }, () => {
    const badge = h('span', { class: 'count-badge' });
    const b = button('count-item', [h('span', { class: 'count-emoji' }, thing), badge], () => {
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
      if (counted === n && onAll) onAll();
      else say(`num-${counted}`);
    });
    return b;
  });
}

function numberCard(item, i) {
  const glyph = button('card-glyph', String(item.n), () => {
    bounce(glyph);
    say(`num-${item.n}`);
  }, String(item.n));
  const things = countingThings(item.n, item.emoji, {
    onAll: () => {
      sfx.success();
      celebrate({ from: glyph });
      bounce(glyph);
      say(`num-${item.n}`, praise());
    },
  });
  return h(
    'div',
    { class: 'card number-card', style: { '--accent': colorFor(i) } },
    h(
      'div',
      { class: 'card-inner' },
      glyph,
      h('div', { class: 'count-grid', style: { '--cols': Math.min(item.n, 5), '--rows': Math.ceil(item.n / 5) } }, things),
    ),
  );
}

// ---------- "Where is ...?" ----------
// Letters: "Where is the letter Bet?". Numbers: half the rounds are "Where is the number 3?",
// the other half show some things to count and ask "How many are there?".

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
  let counting = false;
  let question = null;

  const starEls = Array.from({ length: GOAL }, () => h('span', { class: 'star' }, '⭐'));
  const starRow = h('div', { class: 'stars', 'aria-label': 'כוכבים' }, starEls);
  const ask = () => question && say(question);
  const speakBtn = button('round-btn speak', icon('speaker'), ask, 'שוב');
  const prompt = h('div', { class: 'find-prompt' });
  const grid = h('div', { class: 'options' });
  const stage = h('main', { class: 'stage find-stage' }, prompt, grid);
  const area = () => (counting ? 'count' : kindId);

  function updateStars() {
    starEls.forEach((s, k) => s.classList.toggle('on', k < stars));
  }

  function round() {
    busy = false;
    mistakes = 0;
    counting = kindId === 'numbers' && Math.random() < 0.5;
    // Letters she still mixes up come back more often.
    target = weightedPick(kind.items, (x) => practiceWeight(area(), kind.key(x)), last);
    last = target;
    // At the easy level, no look-alikes (ב next to כ, or 3 things next to 4).
    const similar = options <= 2 ? (counting ? closeCounts : kind.similar) : null;
    const choices = pickChoices(kind.items, target, options, similar);
    grid.style.setProperty('--n', choices.length);
    grid.replaceChildren(
      ...choices.map((item) => {
        const b = button('option', h('span', { class: 'option-glyph' }, kind.glyph(item)), () => pick(b, item), kind.glyph(item));
        b.style.setProperty('--accent', colorFor(kind.items.indexOf(item)));
        return b;
      }),
    );
    if (counting) {
      const thing = COUNT_THINGS[Math.floor(Math.random() * COUNT_THINGS.length)];
      prompt.style.setProperty('--accent', colorFor(Math.floor(Math.random() * 8)));
      prompt.replaceChildren(
        h('div', { class: 'howmany-grid', style: { '--cols': Math.min(target.n, 5), '--rows': Math.ceil(target.n / 5) } }, countingThings(target.n, thing)),
      );
      question = 'how-many';
    } else {
      prompt.replaceChildren();
      question = kind.findClip(target);
    }
    stage.classList.toggle('has-prompt', counting);
    if (!reduceMotion()) {
      [...grid.children, ...prompt.querySelectorAll('.count-item')].forEach((b, k) =>
        b.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], {
          duration: 320,
          delay: k * 60,
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
      // Say what she tapped, then ask again: every mistake is a little lesson too.
      say(kind.nameClip(item), question);
      return;
    }
    busy = true;
    recordAnswer(area(), kind.key(item), mistakes === 0);
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
      party();
      sfx.success();
      await Promise.all([say('stars-5'), wait(1800)]);
      if (!alive) return;
      const sticker = earnSticker();
      sfx.sticker();
      stickerPop(sticker);
      await wait(2300);
      if (!alive) return;
      stars = 0;
      updateStars();
    }
    round();
  }

  const el = layout({ onBack: () => go(menu, kindId), middle: starRow, end: speakBtn, cls: 'find-screen' }, stage);
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

// What appears when a letter is done: its picture and word (letters) or that many things (numbers).
function rewardFor(kindId, item) {
  if (kindId === 'letters') {
    return h('div', { class: 'trace-reward' }, h('span', { class: 'reward-emoji' }, item.emoji), h('span', { class: 'reward-word' }, item.word));
  }
  return h(
    'div',
    { class: 'trace-reward' },
    // Compact rows so the things fit under the digit (5 → 3+2, 10 → 5+5), or narrower beside it (10 → 4+4+2).
    h(
      'span',
      {
        class: 'reward-things',
        style: { '--cols': item.n <= 3 ? item.n : Math.ceil(item.n / 2), '--cols-wide': item.n <= 3 ? item.n : item.n === 9 ? 3 : Math.min(4, Math.ceil(item.n / 2)) },
      },
      Array.from({ length: item.n }, () => h('span', {}, item.emoji)),
    ),
  );
}

export function trace(kindId, start = 0) {
  const kind = KINDS[kindId];
  let tracer = null;
  let box = null;
  let alive = true;
  const again = button('round-btn', icon('again'), () => {
    tracer?.reset();
    box?.querySelector('.trace-reward')?.remove();
    p.nextBtn.classList.remove('nudge');
  }, 'שוב');

  const p = pager(kind, start, (item, i) => {
    const thisBox = h('div', { class: 'trace-box' });
    const t = createTracer(kind.strokes(item), {
      color: colorFor(i),
      onDone: async () => {
        recordTrace(kindId, kind.key(item));
        const sticker = earnSticker();
        sfx.success();
        celebrate({ from: thisBox, big: true });
        thisBox.querySelector('.trace-reward')?.remove();
        thisBox.append(rewardFor(kindId, item));
        p.nextBtn.classList.add('nudge');
        await wait(350);
        if (!alive || tracer !== t) return;
        await say(praise(), ...kind.cardClips(item));
        if (!alive || tracer !== t) return;
        await wait(250);
        // If she already moved on, the sticker is still hers: it waits in the album.
        if (!alive || tracer !== t) return;
        sfx.sticker();
        stickerPop(sticker);
      },
    });
    tracer = t;
    box = thisBox;
    // Once finished, a fresh tap on the letter says it again
    // (the finger lifting from the last stroke must not cut off the praise).
    let armed = false;
    thisBox.addEventListener('pointerdown', () => {
      armed = t.finished;
    });
    thisBox.addEventListener('pointerup', () => {
      if (armed && t.finished) say(...kind.cardClips(item));
      armed = false;
    });
    thisBox.append(t.el);
    p.nextBtn.classList.remove('nudge');
    say(kind.nameClip(item));
    return thisBox;
  });

  const el = layout({ onBack: () => go(menu, kindId), end: again, cls: 'trace-screen' }, p.stage);
  return {
    el,
    enter: () => {
      p.show(start);
      preload(kind.items.flatMap(kind.cardClips));
    },
    leave: () => {
      alive = false;
    },
    get tracer() {
      return tracer;
    },
  };
}
