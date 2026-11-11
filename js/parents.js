// Parents' area: how she's doing, a checklist of every phrase the app says, and a one-by-one recorder.
import { go } from './nav.js';
import { home } from './screens.js';
import { KINDS } from './kinds.js';
import { CLIPS, CLIP_GROUPS } from './data.js';
import { statsFor, stickers, resetStats, exportProgress, importProgress } from './progress.js';
import { checkForUpdate, installedVersion } from './updates.js';
import {
  say, stopAll, sourceOf, markRecorded, refreshRecordings, audioContext, fileManifest,
  soundLog, onSoundLog, audioMode, setAudioMode, canSetAudioMode,
} from './audio.js';
import { saveRecording, loadRecording, removeRecording, recordingKeys, keepRecordings } from './recordings.js';
import { canRecord, startRecording, cleanUp } from './recorder.js';
import { makeZip, readZip } from './zip.js';
import { h, button, icon, layout, toast } from './ui.js';

const ITEMS = CLIP_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g })));

// Openings are heard joined with an example, so the parent hears how the join sounds.
const preview = (key) => ({ 'find-letter': 'find-alef', 'find-number': 'find-num-1' })[key] || key;
const MAX_SECONDS = 8;

const recordedCount = () => ITEMS.filter((i) => sourceOf(i.key) === 'recorded').length;
const firstMissing = () => Math.max(0, ITEMS.findIndex((i) => sourceOf(i.key) !== 'recorded'));

const insecureNote = () =>
  h(
    'p',
    { class: 'rec-warning' },
    'הקלטה עובדת רק כשהאפליקציה פתוחה מכתובת מאובטחת (https), למשל אחרי פרסום ב-GitHub Pages. בכתובת http מקומית הדפדפן חוסם את המיקרופון.',
  );

// Installed to the home screen? Otherwise iOS keeps recordings (and stickers) for the Safari tab only.
const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

const installNote = () =>
  h(
    'p',
    { class: 'rec-warning' },
    'האפליקציה פתוחה כרגע בדפדפן. כדאי להוסיף אותה למסך הבית (שיתוף ← הוספה למסך הבית) ולפתוח משם: לאפליקציה במסך הבית יש אחסון נפרד, וההקלטות, המדבקות וההתקדמות נשמרים שם.',
  );

// ---------- How she's doing ----------

// One tile per letter/number: green = knows it well, yellow = still mixing it up, grey = not practised yet.
function progressSection() {
  const section = h('section', { class: 'progress' });
  const tile = (kindId, item) => {
    const kind = KINDS[kindId];
    const s = statsFor(kindId, kind.key(item));
    const asked = s.asked + (kindId === 'numbers' ? statsFor('count', item.n).asked : 0);
    const right = s.firstTry + (kindId === 'numbers' ? statsFor('count', item.n).firstTry : 0);
    const rate = asked ? right / asked : 0;
    const level = asked >= 3 && rate >= 0.8 ? 'good' : asked >= 2 && rate < 0.6 ? 'learning' : asked || s.traced ? 'some' : 'none';
    return h(
      'div',
      { class: `progress-tile ${level}` },
      h('span', { class: 'progress-glyph' }, kind.glyph(item)),
      h(
        'span',
        { class: 'progress-numbers' },
        s.traced ? `✏️${s.traced}` : '',
        asked ? h('span', {}, ` ${Math.round(rate * 100)}%`) : '',
      ),
    );
  };
  const render = () => {
    section.replaceChildren(
      h('h3', {}, 'התקדמות', h('span', { class: 'rec-group-count' }, `${new Set(stickers()).size} מדבקות`)),
      h('div', { class: 'progress-grid' }, KINDS.letters.items.map((l) => tile('letters', l))),
      h('div', { class: 'progress-grid' }, KINDS.numbers.items.map((x) => tile('numbers', x))),
      h(
        'p',
        { class: 'rec-help' },
        '✏️ = כמה פעמים ציירה. האחוז = כמה פעמים זיהתה נכון בניסיון הראשון במשחק "איפה?". ירוק: יודעת טוב, צהוב: עוד מתבלבלת, אפור: עוד לא תרגלה. מה שמתבלבלים בו חוזר יותר במשחק.',
      ),
      button('pill-btn small', 'איפוס ההתקדמות', () => {
        if (confirm('לאפס את ההתקדמות? המדבקות נשארות.')) {
          resetStats();
          render();
        }
      }),
    );
  };
  render();
  section.refresh = render;
  return section;
}

// ---------- About this copy of the app ----------

function appSection() {
  const version = h('span', { class: 'app-version' }, 'גרסה: …');
  installedVersion().then((v) => {
    version.textContent = v ? `גרסה מותקנת: ${v}` : 'גרסה: לא מותקנת (נפתחה בלי https)';
  });
  const check = button('pill-btn small', 'לבדוק אם יש עדכון', async () => {
    toast('בודק…');
    const result = await checkForUpdate();
    toast(
      {
        updating: 'נמצא עדכון. מוריד אותו, והאפליקציה תתרענן לבד כשיהיה מוכן',
        latest: 'זו הגרסה האחרונה',
        offline: 'אין חיבור לאינטרנט כרגע',
        unavailable: 'עדכונים עובדים רק מהכתובת המפורסמת (https)',
      }[result],
    );
  });
  return h('section', { class: 'app-info' }, version, check);
}

// ---------- Sound check ----------
// Shows how each phrase actually played on this device, to compare devices or iOS versions.

const ENGINE = {
  recording: 'הקלטה',
  file: 'קובץ',
  voice: 'הקול המובנה',
  'voice (recording failed)': 'הקול המובנה (ההקלטה נכשלה)',
};

function soundSection() {
  const list = h('div', { class: 'sound-log' });
  const modeRow = h('div', { class: 'rec-actions' });
  const renderLog = () => {
    const rows = soundLog();
    list.replaceChildren(
      ...(rows.length
        ? rows.map((r) =>
            h(
              'div',
              { class: 'sound-row' },
              h('span', { class: 'sound-text' }, r.text),
              h(
                'span',
                { class: 'sound-meta' },
                r.startMs === null
                  ? `${ENGINE[r.kind] || r.kind} · זמן ההתחלה לא דווח`
                  : `${ENGINE[r.kind] || r.kind} · התחיל אחרי ${r.startMs}ms (מהלחיצה ${r.sinceTapMs}ms)`,
              ),
            ),
          )
        : [h('p', { class: 'rec-help' }, 'עוד לא הושמע כלום. אפשר ללחוץ "לנסות", או לשחק קצת ולחזור לכאן.')]),
    );
  };
  const renderMode = () => {
    if (!canSetAudioMode()) {
      modeRow.replaceChildren();
      return;
    }
    const mode = audioMode();
    modeRow.replaceChildren(
      button(`pill-btn small${mode === 'playback' ? ' primary' : ''}`, 'מצב playback', () => {
        setAudioMode('playback');
        renderMode();
      }),
      button(`pill-btn small${mode === 'auto' ? ' primary' : ''}`, 'מצב auto', () => {
        setAudioMode('auto');
        renderMode();
      }),
    );
  };
  renderLog();
  renderMode();
  const section = h(
    'section',
    { class: 'progress' },
    h('h3', {}, 'בדיקת צליל'),
    h('div', { class: 'rec-actions' }, button('pill-btn', [icon('play'), 'לנסות'], () => say('find-alef', 'name-alef', 'word-alef'))),
    modeRow,
    canSetAudioMode()
      ? h('p', { class: 'rec-help' }, 'playback: מתנגן גם כשהמתג השקט דלוק (ברירת המחדל כאן). auto: ההתנהגות הרגילה של ספארי. אם הצליל קופצני או מתעכב, כדאי לנסות את השני ולהשוות את הזמנים.')
      : null,
    list,
  );
  section.unsubscribe = onSoundLog(renderLog);
  return section;
}

// ---------- Checklist ----------

export function parents() {
  const progressEl = progressSection();
  const soundEl = soundSection();
  const summary = h('div', { class: 'rec-summary' });
  const list = h('div', { class: 'rec-groups' });
  const importInput = h('input', { type: 'file', accept: '.zip,application/zip', hidden: true });
  importInput.addEventListener('change', () => importBackup(importInput.files[0]).finally(() => (importInput.value = '')));

  function render() {
    const done = recordedCount();
    const startBtn = button(
      'pill-btn primary',
      [icon('play'), done === 0 ? 'להתחיל להקליט' : done === ITEMS.length ? 'לעבור על ההקלטות' : 'להמשיך להקליט'],
      () => go(recorder, done === ITEMS.length ? 0 : firstMissing()),
    );
    summary.replaceChildren(
      h('h3', {}, 'הקלטות'),
      h('div', { class: 'rec-count-line' }, `${done} מתוך ${ITEMS.length} הוקלטו`),
      h('div', { class: 'rec-bar' }, h('span', { style: { width: `${(100 * done) / ITEMS.length}%` } })),
      canRecord() ? null : insecureNote(),
      h(
        'div',
        { class: 'rec-actions' },
        startBtn,
        button('pill-btn', 'גיבוי / העברה', exportBackup),
        button('pill-btn', 'שחזור מגיבוי', () => importInput.click()),
      ),
      h(
        'p',
        { class: 'rec-help' },
        'ההקלטות, המדבקות וההתקדמות נשמרים רק במכשיר הזה. מה שלא הוקלט נשמע בקול המובנה. "גיבוי" יוצר קובץ אחד עם הכול, לשמירה או להעברה למכשיר אחר.',
      ),
    );
    list.replaceChildren(
      ...CLIP_GROUPS.map((g) =>
        h(
          'section',
          { class: 'rec-group' },
          h('h3', {}, g.title, h('span', { class: 'rec-group-count' }, `${g.items.filter((i) => sourceOf(i.key) === 'recorded').length}/${g.items.length}`)),
          g.items.map((item) => row(item)),
        ),
      ),
    );
  }

  function row(item) {
    const index = ITEMS.findIndex((i) => i.key === item.key);
    const done = sourceOf(item.key) === 'recorded';
    return h(
      'div',
      { class: `rec-row${done ? ' done' : ''}` },
      button(
        'rec-row-main',
        [
          h('span', { class: 'rec-check', 'aria-hidden': 'true' }, done ? '✓' : ''),
          h('span', { class: 'rec-row-text' }, h('span', { class: 'rec-row-say' }, CLIPS[item.key]), h('span', { class: 'rec-row-hint' }, item.hint)),
        ],
        () => go(recorder, index),
        CLIPS[item.key],
      ),
      button('mini-btn', icon('play'), () => say(preview(item.key)), 'להשמיע'),
    );
  }

  let prepared = null;
  async function exportBackup() {
    if (prepared) return share(prepared);
    const keys = await recordingKeys();
    const progress = exportProgress();
    if (!keys.length && !progress.stickers.length && !Object.keys(progress.items).length) {
      toast('אין עדיין מה לגבות');
      return;
    }
    const manifest = fileManifest();
    // Stickers and progress travel along, so a reinstall or a second device can pick them up too.
    const files = [{ name: 'progress.json', data: new TextEncoder().encode(JSON.stringify(progress)) }];
    for (const key of keys) {
      const r = await loadRecording(key);
      if (!r) continue;
      files.push({ name: `${key}.wav`, data: new Uint8Array(r.data) });
      manifest[key] = `${key}.wav`;
    }
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(sorted, null, 2) + '\n') });
    prepared = new File([makeZip(files)], 'letters-recordings.zip', { type: 'application/zip' });
    return share(prepared);
  }

  async function share(file) {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'הקלטות – אותיות ומספרים' });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') {
          // Building the file took too long for Safari's "user tapped" window; one more tap shares it.
          toast('הקובץ מוכן, צריך ללחוץ שוב על "גיבוי / העברה"');
          return;
        }
      }
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: file.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      let n = 0;
      let progressBack = false;
      for (const { name, data } of await readZip(file)) {
        if (/(?:^|\/)progress\.json$/.test(name)) {
          try {
            progressBack = importProgress(JSON.parse(new TextDecoder().decode(data)));
          } catch {
            // not ours: ignore
          }
          continue;
        }
        const key = name.match(/(?:^|\/)([\w-]+)\.wav$/)?.[1];
        if (!key || !(key in CLIPS)) continue;
        await saveRecording(key, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        n++;
      }
      await refreshRecordings();
      keepRecordings();
      prepared = null;
      render();
      progressEl.refresh();
      toast(
        n || progressBack
          ? [n ? `שוחזרו ${n} הקלטות` : '', progressBack ? 'המדבקות וההתקדמות חזרו' : ''].filter(Boolean).join(', ')
          : 'לא נמצא בקובץ מה לשחזר',
      );
    } catch {
      toast('לא הצלחתי לקרוא את הקובץ');
    }
  }

  const el = layout(
    { onBack: () => go(home), backIcon: 'home', middle: h('h2', { class: 'bar-title' }, 'מצב הורים'), cls: 'parents' },
    h('main', { class: 'rec-page' }, installed() ? null : installNote(), appSection(), progressEl, summary, list, soundEl, importInput),
  );
  return { el, enter: render, leave: () => soundEl.unsubscribe() };
}

// ---------- One-by-one recorder ----------

export function recorder(start = 0) {
  let i = start;
  let state = 'idle'; // idle | preparing | recording | processing
  let session = null;
  let alive = true;
  let startedAt = 0;
  let ticker = 0;
  let autoStop = 0;

  const count = h('div', { class: 'rec-step-count' });
  const del = button('round-btn', icon('trash'), removeCurrent, 'למחוק הקלטה');
  const group = h('div', { class: 'rec-step-group' });
  const sayText = h('div', { class: 'rec-step-say' });
  const hint = h('div', { class: 'rec-step-hint' });
  const note = h('div', { class: 'rec-step-note' });
  const status = h('div', { class: 'rec-step-status' });
  const msg = h('p', { class: 'rec-msg', role: 'status' });
  const recLabel = h('div', { class: 'rec-label' });
  const recBtn = button('rec-btn', h('span', { class: 'rec-btn-mark' }), toggle, 'הקלטה');
  const playBtn = button('pill-btn', [icon('play'), 'להשמיע'], () => say(preview(item().key)));
  const prevBtn = button('nav-btn prev', icon('prev'), () => show(i - 1), 'הקודם');
  const nextBtn = button('nav-btn next', icon('next'), () => show(i + 1), 'הבא');

  const item = () => ITEMS[i];

  function show(n) {
    if (state === 'recording' || state === 'preparing') cancelRecording();
    if (state === 'processing') return;
    i = Math.max(0, Math.min(ITEMS.length - 1, n));
    msg.textContent = '';
    stopAll();
    render();
  }

  function render() {
    const it = item();
    const src = sourceOf(it.key);
    count.textContent = `${i + 1} מתוך ${ITEMS.length}`;
    group.textContent = it.group.title;
    sayText.textContent = CLIPS[it.key];
    hint.textContent = it.hint;
    note.textContent = it.group.note || '';
    status.textContent = src === 'recorded' ? '✓ מוקלט' : src === 'file' ? 'כרגע: קול מוכן' : 'כרגע: הקול המובנה';
    status.classList.toggle('done', src === 'recorded');
    del.style.visibility = src === 'recorded' ? 'visible' : 'hidden';
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === ITEMS.length - 1;
    nextBtn.classList.toggle('nudge', src === 'recorded' && state === 'idle' && i < ITEMS.length - 1);
    recBtn.dataset.state = state;
    recBtn.disabled = state === 'preparing' || state === 'processing';
    recLabel.textContent =
      state === 'recording'
        ? `מקליט… ${Math.floor((performance.now() - startedAt) / 1000)} · ללחוץ לסיום`
        : state === 'preparing'
          ? 'רגע…'
          : state === 'processing'
            ? 'שומר…'
            : src === 'recorded'
              ? 'להקליט שוב'
              : 'ללחוץ ולהקליט';
  }

  function setState(s) {
    state = s;
    render();
  }

  async function toggle() {
    if (state === 'recording') return finish();
    if (state !== 'idle') return;
    msg.textContent = '';
    if (!canRecord()) {
      msg.replaceChildren(insecureNote());
      return;
    }
    stopAll();
    audioContext(); // created inside this tap so playback works afterwards
    setState('preparing');
    try {
      session = await startRecording();
    } catch (e) {
      setState('idle');
      msg.textContent =
        e?.name === 'NotAllowedError'
          ? 'אין גישה למיקרופון. צריך לאשר אותה (בהגדרות ← Safari ← מיקרופון) ולנסות שוב.'
          : 'לא הצלחתי להפעיל את המיקרופון.';
      return;
    }
    if (!alive || state !== 'preparing') {
      session.cancel();
      session = null;
      return;
    }
    startedAt = performance.now();
    setState('recording');
    ticker = setInterval(render, 250);
    autoStop = setTimeout(finish, MAX_SECONDS * 1000);
  }

  async function finish() {
    if (state !== 'recording') return;
    clearInterval(ticker);
    clearTimeout(autoStop);
    setState('processing');
    const key = item().key;
    try {
      const blob = await session.stop();
      session = null;
      const clean = await cleanUp(audioContext(), blob);
      if (!clean) {
        msg.textContent = 'לא נשמע כלום. אפשר לנסות שוב, קצת יותר קרוב למיקרופון.';
      } else {
        await saveRecording(key, clean.wav);
        markRecorded(key, true);
        keepRecordings();
      }
    } catch {
      msg.textContent = 'משהו השתבש בשמירה. אפשר לנסות שוב.';
    }
    if (!alive) return;
    setState('idle');
    // Give iOS a moment to switch the speaker back after the microphone closes.
    if (sourceOf(key) === 'recorded') setTimeout(() => alive && item().key === key && state === 'idle' && say(preview(key)), 250);
  }

  function cancelRecording() {
    clearInterval(ticker);
    clearTimeout(autoStop);
    session?.cancel();
    session = null;
    state = 'idle';
  }

  async function removeCurrent() {
    if (!confirm('למחוק את ההקלטה הזאת? במקומה יישמע הקול המובנה.')) return;
    const key = item().key;
    await removeRecording(key);
    markRecorded(key, false);
    render();
    toast('ההקלטה נמחקה');
  }

  const el = layout(
    { onBack: () => go(parents), middle: count, end: del, cls: 'recorder' },
    h(
      'main',
      { class: 'rec-step' },
      h('div', { class: 'rec-card' }, group, sayText, hint, note, status),
      h('div', { class: 'rec-controls' }, prevBtn, h('div', { class: 'rec-center' }, recBtn, recLabel), nextBtn),
      h('div', { class: 'rec-under' }, playBtn),
      msg,
    ),
  );
  return {
    el,
    enter: render,
    leave: () => {
      alive = false;
      cancelRecording();
    },
  };
}
