// Letters and numbers share the same activities; this adapts each to a common shape.
import { LETTERS, NUMBERS } from './data.js';
import { LETTER_STROKES, DIGIT_STROKES } from './strokes.js';
import { similarLetters, similarDigits } from './practice.js';

export const KINDS = {
  letters: {
    id: 'letters',
    title: 'אוֹתִיּוֹת',
    items: LETTERS,
    key: (l) => l.id,
    glyph: (l) => l.char,
    nameClip: (l) => `name-${l.id}`,
    cardClips: (l) => [`name-${l.id}`, `word-${l.id}`],
    findClip: (l) => `find-${l.id}`,
    strokes: (l) => LETTER_STROKES[l.id],
    similar: similarLetters,
  },
  numbers: {
    id: 'numbers',
    title: 'מִסְפָּרִים',
    items: NUMBERS,
    key: (x) => x.n,
    glyph: (x) => String(x.n),
    nameClip: (x) => `num-${x.n}`,
    cardClips: (x) => [`num-${x.n}`],
    findClip: (x) => `find-num-${x.n}`,
    strokes: (x) => DIGIT_STROKES[x.n],
    similar: similarDigits,
  },
};
