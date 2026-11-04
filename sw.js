// Offline support: cache the whole app on install, then serve from cache and
// refresh in the background (an update shows up on the next launch).
// Bump VERSION when files are added or removed.
const VERSION = 'v2';
const CACHE = `letters-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/nav.js',
  'js/screens.js',
  'js/kinds.js',
  'js/data.js',
  'js/audio.js',
  'js/ui.js',
  'js/tracer.js',
  'js/path.js',
  'js/strokes.js',
  'js/parents.js',
  'js/recordings.js',
  'js/recorder.js',
  'js/zip.js',
  'fonts/rubik-hebrew-500-normal.woff2',
  'fonts/rubik-hebrew-700-normal.woff2',
  'fonts/rubik-latin-500-normal.woff2',
  'fonts/rubik-latin-700-normal.woff2',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'audio/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      try {
        const clips = await (await fetch('audio/manifest.json', { cache: 'no-cache' })).json();
        await cache.addAll(Object.values(clips).map((f) => `audio/${f}`));
      } catch {
        // no recordings yet
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(fresh);
        return cached;
      }
      return (await fresh) || new Response('', { status: 504 });
    })(),
  );
});
