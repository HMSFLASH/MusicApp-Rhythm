const DB_NAME = 'SonicMediaCache';
const STORE_NAME = 'audio';
export const DEFAULT_MAX_CACHE_BYTES = 12 * 1024 * 1024 * 1024; // 12 GB
const MAX_ITEM_BYTES = 300 * 1024 * 1024; // 300 MB for Hi-Res audio
const STORAGE_LIMIT_KEY = 'SONIC_MAX_CACHE_BYTES';

export type AudioCacheEntry = {
  id: string;
  blob: Blob;
  bytes: number;
  cachedAt: number;
  lastAccessed: number;
};

export type AudioCacheEntryMeta = {
  id: string;
  bytes: number;
  cachedAt: number;
  lastAccessed: number;
};

export function getMaxCacheBytes(): number {
  try {
    const saved = localStorage.getItem(STORAGE_LIMIT_KEY);
    if (saved) {
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_MAX_CACHE_BYTES;
}

export function setMaxCacheBytes(bytes: number): void {
  try {
    localStorage.setItem(STORAGE_LIMIT_KEY, String(bytes));
  } catch {
    // Ignore localStorage errors
  }
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

export async function getCachedAudio(id: string): Promise<Blob | null> {
  try {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const entry = request.result as AudioCacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        entry.lastAccessed = Date.now();
        store.put(entry);
        resolve(entry.blob);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function hasCachedAudio(id: string): Promise<boolean> {
  try {
    const database = await openDatabase();
    return await new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count(id);
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getAllCachedIds(): Promise<string[]> {
  try {
    const database = await openDatabase();
    return await new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        resolve(request.result.map(String));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Returns metadata of all cached audio entries without keeping full Blobs in memory.
 */
export async function getAudioCacheEntriesMetadata(): Promise<AudioCacheEntryMeta[]> {
  try {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const cursorRequest = store.openCursor();
      const results: AudioCacheEntryMeta[] = [];

      cursorRequest.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value;
          results.push({
            id: String(val.id),
            bytes: typeof val.bytes === 'number' ? val.bytes : (val.blob?.size || 0),
            cachedAt: typeof val.cachedAt === 'number' ? val.cachedAt : 0,
            lastAccessed: typeof val.lastAccessed === 'number' ? val.lastAccessed : 0,
          });
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  } catch {
    return [];
  }
}

/**
 * Returns summary statistics of the audio cache.
 */
export async function getAudioCacheSummary(): Promise<{
  totalBytes: number;
  count: number;
  maxBytes: number;
  entries: AudioCacheEntryMeta[];
}> {
  const entries = await getAudioCacheEntriesMetadata();
  const totalBytes = entries.reduce((sum, item) => sum + item.bytes, 0);
  const maxBytes = getMaxCacheBytes();
  return {
    totalBytes,
    count: entries.length,
    maxBytes,
    entries,
  };
}

export async function removeCachedAudio(id: string): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}

/**
 * Batch delete cached audio tracks inside a single readwrite transaction.
 */
export async function removeCachedAudios(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      for (const id of ids) {
        store.delete(id);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}

export async function cacheAudio(id: string, blob: Blob): Promise<void> {
  if (blob.size === 0 || blob.size > MAX_ITEM_BYTES) return;
  try {
    const maxCacheBytes = getMaxCacheBytes();
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const entriesRequest = store.getAll();
      entriesRequest.onsuccess = () => {
        const entries = entriesRequest.result as AudioCacheEntry[];
        const previousSize = entries.find((entry) => entry.id === id)?.bytes || 0;
        let totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0) - previousSize;
        const staleEntries = entries
          .filter((entry) => entry.id !== id)
          .sort((left, right) => left.lastAccessed - right.lastAccessed);

        for (const entry of staleEntries) {
          if (totalBytes + blob.size <= maxCacheBytes) break;
          store.delete(entry.id);
          totalBytes -= entry.bytes;
        }

        store.put({ id, blob, bytes: blob.size, cachedAt: Date.now(), lastAccessed: Date.now() } satisfies AudioCacheEntry);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // Storage quota can vary by browser; playback must continue without a persistent cache.
  }
}

export async function clearCachedAudio(): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}
