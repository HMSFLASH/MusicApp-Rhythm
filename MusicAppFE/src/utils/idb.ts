// src/utils/idb.ts
const DB_NAME = 'SonicAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'covers';

let dbPromise: Promise<IDBDatabase> | null = null;

async function closeDB() {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

export async function saveCover(trackId: string, data: Uint8Array, mimeType: string): Promise<boolean> {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id: trackId, data, mimeType });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('Cover save transaction aborted'));
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to save cover to IndexedDB', e);
    return false;
  }
}

export async function getCover(trackId: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(trackId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to get cover from IndexedDB', e);
    return null;
  }
}

export async function removeCover(trackId: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(trackId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to remove cover from IndexedDB', e);
  }
}

export async function removeCovers(trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const trackId of trackIds) {
        store.delete(trackId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to remove covers batch from IndexedDB', e);
  }
}

export async function getCoversStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const cursorRequest = store.openCursor();
      let count = 0;
      let totalBytes = 0;

      cursorRequest.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          count++;
          const data = cursor.value?.data;
          if (data && (data.byteLength || data.length)) {
            totalBytes += data.byteLength || data.length || 0;
          }
          cursor.continue();
        } else {
          resolve({ count, totalBytes });
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  } catch (e) {
    console.error('Failed to get covers stats from IndexedDB', e);
    return { count: 0, totalBytes: 0 };
  }
}

export async function clearCovers(): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to clear covers from IndexedDB', e);
  }
}

export async function deleteCoverDatabase(): Promise<void> {
  try {
    await closeDB();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`Unable to delete IndexedDB database "${DB_NAME}" because it is still open.`));
    });
  } catch (e) {
    console.error('Failed to delete cover IndexedDB', e);
  }
}
