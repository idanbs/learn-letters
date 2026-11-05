import { initAudio, unlock } from './audio.js';
import { go } from './nav.js';
import { home } from './screens.js';
import { watchForUpdates } from './updates.js';

// iOS only allows sound after a user gesture; unlock on the very first touch.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click']) {
  document.addEventListener(type, unlock, { capture: true, passive: true });
}

// Toddler-proofing: a two-finger pinch would zoom the whole app and leave her stuck in a zoomed
// view she can't get out of. Zoom normally has to stay available, but this app's user is three;
// adults still have the system Zoom (Settings > Accessibility).
for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

initAudio();
go(home);

// Offline copy + automatic updates (service workers need https, or localhost while developing).
const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (secure) watchForUpdates();
