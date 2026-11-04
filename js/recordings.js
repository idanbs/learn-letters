// Parents' recordings, kept on the device in IndexedDB.
// Stored as ArrayBuffers (more reliable than Blobs across Safari versions).
// Note: on iPhone/iPad the home-screen app and the Safari tab have separate storage.

const DB_NAME = 'letters';
const STORE = 'recordings';
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const saveRecording = (key, data, type = 'audio/wav') =>
  run('readwrite', (s) => s.put({ data, type, at: Date.now() }, key));
export const loadRecording = (key) => run('readonly', (s) => s.get(key));
export const removeRecording = (key) => run('readwrite', (s) => s.delete(key));
export const recordingKeys = () => run('readonly', (s) => s.getAllKeys());

// Ask the browser not to evict recordings when space runs low.
export function keepRecordings() {
  navigator.storage?.persist?.().catch(() => {});
}
