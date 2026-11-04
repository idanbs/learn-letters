// Letters and numbers share the same activities; this adapts each to a common shape.
import { LETTERS, NUMBERS } from './data.js';
import { LETTER_STROKES, DIGIT_STROKES } from './strokes.js';

export const KINDS = {
  letters: {
    id: 'letters',
    title: 'אוֹתִיּוֹת',
    items: LETTERS,
    glyph: (l) => l.char,
    nameClip: (l) => `name-${l.id}`,
    cardClips: (l) => [`name-${l.id}`, `word-${l.id}`],
    findClip: (l) => `find-${l.id}`,
    strokes: (l) => LETTER_STROKES[l.id],
  },
  numbers: {
    id: 'numbers',
    title: 'מִסְפָּרִים',
    items: NUMBERS,
    glyph: (x) => String(x.n),
    nameClip: (x) => `num-${x.n}`,
    cardClips: (x) => [`num-${x.n}`],
    findClip: (x) => `find-num-${x.n}`,
    strokes: (x) => DIGIT_STROKES[x.n],
  },
};
