const DB_NAME = 'SonicMediaCache';
const STORE_NAME = 'audio';
const MAX_CACHE_BYTES = 7 * 1024 * 1024 * 1024;
const MAX_ITEM_BYTES = 100 * 1024 * 1024;

type AudioCacheEntry = {
  id: string;
  blob: Blob;
  bytes: number;
  cachedAt: number;
  lastAccessed: number;
};

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

export async function cacheAudio(id: string, blob: Blob): Promise<void> {
  if (blob.size === 0 || blob.size > MAX_ITEM_BYTES) return;
  try {
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
          if (totalBytes + blob.size <= MAX_CACHE_BYTES) break;
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
