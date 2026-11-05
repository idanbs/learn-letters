// Stroke paths for tracing. Coordinates: x 0..100, letter body y 0..100 (top..baseline).
// Stroke centerlines sit at y≈9 (top) and y≈91 (baseline) so that with STROKE_WIDTH the
// painted letter fills 0..100. ל rises above 0, ק drops below 100.
// Each stroke is drawn in order and in the direction the path is written.

export const STROKE_WIDTH = 18;

export const LETTER_STROKES = {
  // The main diagonal, then a stem from the top right that bends into the diagonal's lower half
  // (about 3/4 of the way down), then a stem that bends out of its upper half (about 1/4) down to
  // the bottom left. The two stems mirror each other, so the three parts never blur into an X.
  alef: [
    'M 22 9 L 80 91',
    'M 80 9 L 80 32 Q 80 60 69 63',
    'M 33 37 Q 22 40 22 68 L 22 91',
  ],
  bet: [
    'M 18 9 L 62 9 Q 76 9 76 23 L 76 91',
    'M 86 91 L 14 91',
  ],
  gimel: [
    'M 34 9 L 52 9 Q 62 9 64 20 L 74 91',
    'M 68 58 Q 40 62 34 91',
  ],
  dalet: [
    'M 14 9 L 86 9',
    'M 70 9 L 70 91',
  ],
  he: [
    'M 18 9 L 66 9 Q 80 9 80 23 L 80 91',
    'M 24 44 L 24 91',
  ],
  vav: [
    'M 36 9 L 46 9 Q 58 9 58 21 L 58 91',
  ],
  zayin: [
    'M 30 9 L 74 9',
    'M 54 9 L 54 91',
  ],
  het: [
    'M 18 9 L 66 9 Q 80 9 80 23 L 80 91',
    'M 22 9 L 22 91',
  ],
  // The curl is on the right (straight side on the left): start inside the curl, go over it,
  // down the right side, around the bottom and up the left.
  tet: [
    'M 50 44 C 50 22 58 9 68 9 C 76 9 80 15 80 25 L 80 60 C 80 80 67 91 50 91 C 33 91 20 80 20 60 L 20 9',
  ],
  yod: [
    'M 38 9 L 48 9 Q 60 9 60 21 L 60 46',
  ],
  kaf: [
    'M 18 9 L 54 9 C 70 9 80 20 80 36 L 80 64 C 80 80 70 91 54 91 L 18 91',
  ],
  lamed: [
    'M 24 -24 L 24 12 L 64 12 C 78 12 84 22 84 36 L 84 50 C 84 76 66 91 34 92',
  ],
  mem: [
    'M 26 9 L 16 91',
    'M 26 9 L 66 9 Q 84 9 84 27 L 84 91 L 46 91',
  ],
  nun: [
    'M 34 9 L 46 9 Q 58 9 58 21 L 58 91 L 28 91',
  ],
  samekh: [
    'M 16 9 L 62 9 C 76 9 82 20 82 34 L 82 60 C 82 80 68 91 50 91 C 32 91 18 80 18 60 L 18 18',
  ],
  ayin: [
    'M 78 9 L 78 50 C 78 76 58 91 12 94',
    'M 22 9 L 46 70',
  ],
  pe: [
    'M 24 42 L 24 21 Q 24 9 36 9 L 56 9 C 72 9 80 20 80 36 L 80 64 C 80 80 72 91 56 91 L 16 91',
  ],
  tsadi: [
    'M 80 9 L 80 30 Q 80 46 56 52',
    'M 20 9 L 74 80 Q 82 91 68 91 L 14 91',
  ],
  qof: [
    'M 16 9 L 64 9 C 80 9 86 18 86 32 L 86 52 C 86 72 76 84 58 90',
    'M 22 40 L 22 122',
  ],
  resh: [
    'M 18 9 L 60 9 C 74 9 80 17 80 31 L 80 91',
  ],
  shin: [
    'M 84 9 L 84 64 C 84 82 74 91 56 91 L 44 91 C 26 91 16 82 16 64 L 16 9',
    'M 50 9 L 50 62',
  ],
  tav: [
    'M 16 9 L 66 9 Q 80 9 80 23 L 80 91',
    'M 30 9 L 30 82 Q 30 91 18 91',
  ],
};

export const DIGIT_STROKES = {
  0: ['M 50 9 C 33 9 22 27 22 50 C 22 73 33 91 50 91 C 67 91 78 73 78 50 C 78 27 67 9 50 9'],
  1: ['M 36 26 L 56 9 L 56 91'],
  2: ['M 26 28 C 26 16 36 9 50 9 C 64 9 74 18 74 31 C 74 46 62 58 26 91 L 76 91'],
  3: ['M 28 18 C 34 12 42 9 50 9 C 64 9 73 17 73 29 C 73 41 63 49 48 49 C 66 49 76 58 76 71 C 76 84 64 91 50 91 C 40 91 30 87 25 80'],
  4: ['M 60 9 L 22 66 L 80 66', 'M 62 9 L 62 91'],
  5: [
    'M 30 9 L 27 46 C 34 41 42 39 50 39 C 66 39 76 50 76 65 C 76 81 64 91 50 91 C 40 91 30 87 25 80',
    'M 30 9 L 74 9',
  ],
  6: ['M 70 14 C 64 10 58 9 52 9 C 34 9 24 26 24 52 C 24 77 35 91 51 91 C 66 91 76 81 76 67 C 76 53 66 44 52 44 C 38 44 27 52 24 62'],
  7: ['M 24 9 L 76 9 L 42 91'],
  8: ['M 70 24 C 70 15 61 9 50 9 C 39 9 30 15 30 25 C 30 36 40 43 50 48 C 62 53 74 60 74 72 C 74 84 63 91 50 91 C 37 91 26 84 26 72 C 26 60 38 53 50 48 C 60 43 70 36 70 24'],
  9: ['M 74 32 C 74 18 63 9 50 9 C 36 9 26 19 26 32 C 26 46 36 55 50 55 C 63 55 74 46 74 32 L 74 56 C 74 76 64 88 44 91'],
  10: [
    'M 14 26 L 30 9 L 30 91',
    'M 66 9 C 52 9 44 27 44 50 C 44 73 52 91 66 91 C 80 91 88 73 88 50 C 88 27 80 9 66 9',
  ],
};
