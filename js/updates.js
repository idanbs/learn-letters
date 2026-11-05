// New versions: the service worker downloads them in the background; we switch over at a calm
// moment (on the home screen), so an upload shows up on the very next launch instead of the one after.
import { currentScreen, onNavigate } from './nav.js';

let pending = false;
let reloadAsap = false;
let reload = () => location.reload();

export function watchForUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  const apply = () => {
    if (pending && (reloadAsap || currentScreen() === 'home')) {
      pending = false;
      reload();
    }
  };
  onNavigate(apply);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install: this already is the newest version
    pending = true;
    apply();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For the parents' "check for updates" button. Resolves 'updating' | 'latest' | 'offline' | 'unavailable'.
export async function checkForUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg) return 'unavailable';
  reloadAsap = true; // a parent asked: switch as soon as it's ready, even outside the home screen
  try {
    await reg.update();
  } catch {
    return 'offline';
  }
  return reg.installing || reg.waiting ? 'updating' : 'latest';
}

// The version the offline copy holds (the cache is named after VERSION in sw.js).
export async function installedVersion() {
  try {
    const key = (await caches.keys()).find((k) => k.startsWith('letters-'));
    return key ? key.slice('letters-'.length) : null;
  } catch {
    return null;
  }
}

export const _forTests = {
  setReload: (fn) => (reload = fn),
};
