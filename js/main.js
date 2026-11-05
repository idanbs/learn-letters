import { initAudio, unlock } from './audio.js';
import { go } from './nav.js';
import { home } from './screens.js';
import { watchForUpdates } from './updates.js';

// iOS only allows sound after a user gesture; unlock on the very first touch.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click']) {
  document.addEventListener(type, unlock, { capture: true, passive: true });
}

initAudio();
go(home);

// Offline copy + automatic updates (service workers need https, or localhost while developing).
const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (secure) watchForUpdates();
