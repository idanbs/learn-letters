// What she has done, kept on this device: earned stickers and how each letter/number is going.
// Feeds the "where is…?" game (letters she misses come back more often) and the parents' progress view.
import { STICKERS } from './data.js';

const KEY = 'letters.progress.v1';
const empty = () => ({ stickers: [], seen: 0, items: {} });

function load() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return empty();
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: progress just won't persist
  }
}

const statKey = (area, id) => `${area}:${id}`;
const blank = () => ({ asked: 0, firstTry: 0, traced: 0 });

function entry(area, id) {
  const k = statKey(area, id);
  if (!state.items[k]) state.items[k] = blank();
  return state.items[k];
}

// area: 'letters' | 'numbers' (which one is it?) | 'count' (how many are there?)
export function recordAnswer(area, id, firstTry) {
  const e = entry(area, id);
  e.asked++;
  if (firstTry) e.firstTry++;
  save();
}

export function recordTrace(area, id) {
  entry(area, id).traced++;
  save();
}

export const statsFor = (area, id) => ({ ...blank(), ...state.items[statKey(area, id)] });

// How often to ask about an item: new ones a bit more, and the ones she still misses a lot more.
export function practiceWeight(area, id) {
  const s = statsFor(area, id);
  if (s.asked === 0) return 1.5;
  const missRate = (s.asked - s.firstTry) / (s.asked + 2); // smoothed, so one slip doesn't dominate
  return 1 + 3 * missRate;
}

// ---- Stickers ----

export function earnSticker() {
  const owned = new Set(state.stickers);
  const fresh = STICKERS.filter((s) => !owned.has(s));
  const pool = fresh.length ? fresh : STICKERS;
  const sticker = pool[Math.floor(Math.random() * pool.length)];
  state.stickers.push(sticker);
  save();
  navigator.storage?.persist?.().catch(() => {});
  return sticker;
}

export const stickers = () => [...state.stickers];
export const newStickerCount = () => Math.max(0, state.stickers.length - state.seen);

export function markStickersSeen() {
  state.seen = state.stickers.length;
  save();
}

// ---- Backup ----

export const exportProgress = () => JSON.parse(JSON.stringify(state));

// Brings a backup back without losing anything earned since: for stickers and for each
// letter, whichever side has more wins. Returns false if `saved` isn't a progress backup.
export function importProgress(saved) {
  if (!saved || !Array.isArray(saved.stickers) || typeof saved.items !== 'object') return false;
  if (saved.stickers.length > state.stickers.length) {
    state.stickers = [...saved.stickers];
    state.seen = Math.min(Number(saved.seen) || 0, state.stickers.length);
  }
  const size = (e) => (e ? (e.asked || 0) + (e.traced || 0) : -1);
  for (const [k, v] of Object.entries(saved.items)) {
    if (size(v) > size(state.items[k])) state.items[k] = { ...blank(), ...v };
  }
  save();
  return true;
}

// Clears what she has practised (the game starts adapting from scratch). Stickers stay.
export function resetStats() {
  state.items = {};
  save();
}
