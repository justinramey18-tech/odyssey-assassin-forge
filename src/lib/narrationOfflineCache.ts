/**
 * Offline narration cache.
 *
 * Saved narration clips normally stream from the party audio bucket, which
 * means a weak signal at the table kills playback. This module keeps a copy of
 * each clip's bytes in IndexedDB on the device, so playback falls back to the
 * local copy whenever it exists (and works with no connection at all).
 */

const DB_NAME = 'odyssey-narration-cache';
const STORE = 'clips';
const DB_VERSION = 1;

/** Object URLs handed out this session, so we don't leak a new one per play. */
const objectUrls = new Map<string, string>();
/** Cached list of stored keys, kept in sync as we write/delete. */
let keyCache: Set<string> | null = null;

/** Storage key ignores the cache-busting `?v=` suffix on the public URL. */
export const clipKey = (url: string) => (url || '').split('?')[0];

const openDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

const tx = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
      t.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
};

/** Every clip URL currently stored on this device. */
export async function listCachedClips(): Promise<Set<string>> {
  if (keyCache) return keyCache;
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  keyCache = new Set((keys || []).map(String));
  return keyCache;
}

export async function isClipCached(url: string): Promise<boolean> {
  const keys = await listCachedClips();
  return keys.has(clipKey(url));
}

/** Downloads a clip and stores its bytes. Returns true when it's available offline. */
export async function cacheClip(url: string): Promise<boolean> {
  if (!url) return false;
  const key = clipKey(url);
  if ((await listCachedClips()).has(key)) return true;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const stored = await tx('readwrite', (s) => s.put(blob, key) as IDBRequest<any>);
    if (stored === null && !(await openDb())) return false;
    keyCache?.add(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a local object URL for a clip when it's stored on the device,
 * otherwise null (caller falls back to the network URL).
 */
export async function getOfflineUrl(url: string): Promise<string | null> {
  const key = clipKey(url);
  const existing = objectUrls.get(key);
  if (existing) return existing;
  if (!(await listCachedClips()).has(key)) return null;
  const blob = await tx<Blob>('readonly', (s) => s.get(key) as IDBRequest<Blob>);
  if (!blob) return null;
  const objUrl = URL.createObjectURL(blob);
  objectUrls.set(key, objUrl);
  return objUrl;
}

/** Local copy if there is one, else the original network URL. */
export async function resolvePlaybackUrl(url: string): Promise<string> {
  return (await getOfflineUrl(url)) || url;
}

export async function removeCachedClip(url: string): Promise<void> {
  const key = clipKey(url);
  await tx('readwrite', (s) => s.delete(key) as IDBRequest<any>);
  keyCache?.delete(key);
  const obj = objectUrls.get(key);
  if (obj) { URL.revokeObjectURL(obj); objectUrls.delete(key); }
}

/** Wipes every downloaded clip from this device. */
export async function clearOfflineClips(): Promise<void> {
  await tx('readwrite', (s) => s.clear() as IDBRequest<any>);
  keyCache?.clear();
  keyCache = new Set();
  for (const obj of objectUrls.values()) URL.revokeObjectURL(obj);
  objectUrls.clear();
}

/** Rough total size of the downloaded clips, in bytes. */
export async function offlineCacheSize(): Promise<number> {
  const blobs = await tx<Blob[]>('readonly', (s) => s.getAll() as IDBRequest<Blob[]>);
  return (blobs || []).reduce((sum, b) => sum + (b?.size || 0), 0);
}
