// Choosing what to ask in the "where is…?" game.
import { LOOK_ALIKE, DIGIT_LOOK_ALIKE } from './data.js';
import { shuffle } from './ui.js';

// Weighted random pick; `avoid` (the previous answer) is never picked twice in a row.
export function weightedPick(items, weightOf, avoid = null) {
  const pool = items.filter((x) => x !== avoid);
  const weights = pool.map(weightOf);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// The target plus `count - 1` other choices. With `isSimilar`, look-alikes are left out when possible.
export function pickChoices(items, target, count, isSimilar = null) {
  const others = shuffle(items.filter((x) => x !== target));
  const distinct = isSimilar ? others.filter((x) => !isSimilar(target, x)) : others;
  const pool = distinct.length >= count - 1 ? distinct : others;
  return shuffle([target, ...pool.slice(0, count - 1)]);
}

const groupOf = (groups) => {
  const map = new Map();
  groups.forEach((g, i) => g.forEach((member) => map.set(member, i)));
  return (a, b) => map.has(a) && map.get(a) === map.get(b);
};

export const similarLetters = (() => {
  const same = groupOf(LOOK_ALIKE);
  return (a, b) => same(a.id, b.id);
})();

export const similarDigits = (() => {
  const same = groupOf(DIGIT_LOOK_ALIKE);
  return (a, b) => same(a.n, b.n);
})();

// For "how many?": neighbours (3 vs 4) are hard to tell apart when you're three.
export const closeCounts = (a, b) => Math.abs(a.n - b.n) <= 1;
