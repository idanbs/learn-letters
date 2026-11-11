// Content: letters, numbers and every phrase the app can say.
// Texts carry niqqud so the fallback text-to-speech voice pronounces them correctly.

export const LETTERS = [
  { id: 'alef',   char: 'א', name: 'אָלֶף',  word: 'אַרְיֵה',        emoji: '🦁' },
  { id: 'bet',    char: 'ב', name: 'בֵּית',  word: 'בָּנָנָה',       emoji: '🍌' },
  { id: 'gimel',  char: 'ג', name: 'גִּימֶל', word: 'גְּלִידָה',      emoji: '🍦' },
  { id: 'dalet',  char: 'ד', name: 'דָּלֶת', word: 'דָּג',           emoji: '🐟' },
  { id: 'he',     char: 'ה', name: 'הֵא',   word: 'הִיפּוֹפּוֹטָם',  emoji: '🦛' },
  { id: 'vav',    char: 'ו', name: 'וָו',    word: 'וֶרֶד',          emoji: '🌹' },
  { id: 'zayin',  char: 'ז', name: 'זַיִן',  word: 'זֶבְּרָה',       emoji: '🦓' },
  { id: 'het',    char: 'ח', name: 'חֵית',  word: 'חָתוּל',         emoji: '🐱' },
  { id: 'tet',    char: 'ט', name: 'טֵית',  word: 'טְרַקְטוֹר',      emoji: '🚜' },
  { id: 'yod',    char: 'י', name: 'יוּד',   word: 'יָרֵחַ',         emoji: '🌙' },
  { id: 'kaf',    char: 'כ', name: 'כַּף',   word: 'כֶּלֶב',         emoji: '🐶' },
  { id: 'lamed',  char: 'ל', name: 'לָמֶד',  word: 'לִימוֹן',        emoji: '🍋' },
  { id: 'mem',    char: 'מ', name: 'מֵם',   word: 'מָטוֹס',         emoji: '✈️' },
  { id: 'nun',    char: 'נ', name: 'נוּן',   word: 'נָמֵר',          emoji: '🐯' },
  { id: 'samekh', char: 'ס', name: 'סָמֶךְ', word: 'סוּס',           emoji: '🐴' },
  { id: 'ayin',   char: 'ע', name: 'עַיִן',  word: 'עוּגָה',         emoji: '🎂' },
  { id: 'pe',     char: 'פ', name: 'פֵּא',   word: 'פִּיל',          emoji: '🐘' },
  { id: 'tsadi',  char: 'צ', name: 'צָדִי',  word: 'צָב',           emoji: '🐢' },
  { id: 'qof',    char: 'ק', name: 'קוֹף',   word: 'קִיפּוֹד',        emoji: '🦔' },
  { id: 'resh',   char: 'ר', name: 'רֵישׁ',  word: 'רַכֶּבֶת',        emoji: '🚂' },
  { id: 'shin',   char: 'ש', name: 'שִׁין',  word: 'שֶׁמֶשׁ',         emoji: '☀️' },
  { id: 'tav',    char: 'ת', name: 'תָּו',   word: 'תַּפּוּחַ',       emoji: '🍎' },
];

export const NUMBERS = [
  { n: 1,  name: 'אַחַת',   emoji: '🍎' },
  { n: 2,  name: 'שְׁתַּיִם', emoji: '🐟' },
  { n: 3,  name: 'שָׁלוֹשׁ',  emoji: '🎈' },
  { n: 4,  name: 'אַרְבַּע',  emoji: '🌸' },
  { n: 5,  name: 'חָמֵשׁ',   emoji: '⭐' },
  { n: 6,  name: 'שֵׁשׁ',    emoji: '🐞' },
  { n: 7,  name: 'שֶׁבַע',   emoji: '🍓' },
  { n: 8,  name: 'שְׁמוֹנֶה', emoji: '🚗' },
  { n: 9,  name: 'תֵּשַׁע',   emoji: '🦋' },
  { n: 10, name: 'עֶשֶׂר',   emoji: '🍪' },
];

export const PRAISE_COUNT = 6;

// key -> text. Recordings (parents' own voice, or files in audio/) override these;
// otherwise the device voice reads the text.
export const CLIPS = {
  letters: 'אוֹתִיּוֹת',
  numbers: 'מִסְפָּרִים',
  'praise-0': 'כָּל הַכָּבוֹד!',
  'praise-1': 'מְצֻיָּן!',
  'praise-2': 'יוֹפִי!',
  'praise-3': 'נֶהְדָּר!',
  'praise-4': 'יָפֶה מְאוֹד!',
  'praise-5': 'בְּדִיּוּק!',
  'stars-5': 'הִצְלַחְנוּ! חֲמִשָּׁה כּוֹכָבִים!',
  'how-many': 'כַּמָּה יֵשׁ?',
  // Shared openings: recorded once, then joined with the letter's (or number's) name.
  'find-letter': 'אֵיפֹה הָאוֹת',
  'find-number': 'אֵיפֹה הַמִּסְפָּר',
};
for (const l of LETTERS) {
  CLIPS[`name-${l.id}`] = l.name;
  CLIPS[`word-${l.id}`] = l.word;
  CLIPS[`find-${l.id}`] = `אֵיפֹה הָאוֹת ${l.name}?`;
}
for (const x of NUMBERS) {
  CLIPS[`num-${x.n}`] = x.name;
  CLIPS[`find-num-${x.n}`] = `אֵיפֹה הַמִּסְפָּר ${x.name}?`;
}

// Questions built from two recordings: "where is the letter" + "alef". The full sentence above
// is still what the device voice reads when nothing is recorded.
export const PARTS = {};
for (const l of LETTERS) PARTS[`find-${l.id}`] = ['find-letter', `name-${l.id}`];
for (const x of NUMBERS) PARTS[`find-num-${x.n}`] = ['find-number', `num-${x.n}`];
// Openings that flow straight into the next word, with no pause in between.
export const LEADS_IN = new Set(['find-letter', 'find-number']);

// The parents' recording checklist, in recording order.
export const CLIP_GROUPS = [
  {
    title: 'כללי',
    items: [
      { key: 'letters', hint: 'נשמע כשנכנסים ל"אותיות"' },
      { key: 'numbers', hint: 'נשמע כשנכנסים ל"מספרים"' },
    ],
  },
  {
    title: 'עידוד',
    note: 'אפשר להגיד במילים שלכם, למשל עם השם שלה',
    items: [
      ...Array.from({ length: PRAISE_COUNT }, (_, i) => ({ key: `praise-${i}`, hint: 'אחרי הצלחה (נבחר באקראי)' })),
      { key: 'stars-5', hint: 'אחרי 5 כוכבים במשחק "איפה?"' },
    ],
  },
  {
    title: 'אותיות',
    items: [
      { key: 'find-letter', hint: 'במשחק "איפה?" שם האות מתחבר לזה. להגיד כמו התחלה של שאלה' },
      ...LETTERS.flatMap((l) => [
        { key: `name-${l.id}`, hint: `שם האות ${l.char}` },
        { key: `word-${l.id}`, hint: `${l.emoji} המילה בכרטיסייה של ${l.char}` },
      ]),
    ],
  },
  {
    title: 'מספרים',
    items: [
      { key: 'find-number', hint: 'במשחק "איפה?" המספר מתחבר לזה. להגיד כמו התחלה של שאלה' },
      { key: 'how-many', hint: 'שאלה במשחק "איפה?" כשסופרים חפצים' },
      ...NUMBERS.map((x) => ({ key: `num-${x.n}`, hint: `המספר ${x.n} (גם בספירה)` })),
    ],
  },
];

// Letters (and digits) that are easy to mix up. At the easy level they never appear side by side.
export const LOOK_ALIKE = [
  ['bet', 'kaf', 'pe'],
  ['dalet', 'resh'],
  ['he', 'het', 'tav', 'qof'],
  ['vav', 'zayin', 'yod'],
  ['gimel', 'nun'],
  ['samekh', 'tet'],
  ['ayin', 'tsadi'],
];
export const DIGIT_LOOK_ALIKE = [[1, 7], [6, 9], [3, 8], [2, 5]];

// Things to count in the "how many?" rounds.
export const COUNT_THINGS = ['🐥', '🍎', '🍓', '🌸', '⭐', '🎈', '🐞', '🦋', '🍪', '🚗', '🐢', '🍌', '🐟', '🧸'];

// The sticker album, in album order. A new sticker is a random one she doesn't have yet.
export const STICKERS = [
  '🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐤',
  '🦉', '🦄', '🐝', '🦋', '🐞', '🐢', '🐙', '🦀',
  '🐠', '🐬', '🐳', '🦒', '🐘', '🦓', '🦔', '🦩',
  '🌈', '🚀', '🚂', '🚒', '⛵', '🎈', '🍓', '🍉',
  '🍦', '🧁', '🌻', '🌙', '☀️', '🍭', '🎂', '🌸',
];
