import { initAudio, unlock } from './audio.js';
import { go } from './nav.js';
import { home } from './screens.js';

// iOS only allows sound after a user gesture; unlock on the very first touch.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click']) {
  document.addEventListener(type, unlock, { capture: true, passive: true });
}

initAudio();
go(home);

const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && secure) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
