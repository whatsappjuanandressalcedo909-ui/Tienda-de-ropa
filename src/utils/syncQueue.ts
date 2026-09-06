import { SyncAction, SyncActionType } from '../types';
import { generateId } from '../utils';

const DB_NAME = 'maisoft_sync_store';
const DB_VERSION = 1;
const QUEUE_STORE = 'sync_queue';
const CACHE_STORE = 'offline_cache';

let dbInstance: IDBDatabase | null = null;

/**
 * Initializes and returns the IndexedDB database instance.
 */
export function openSyncDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Sync Queue Object Store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      // 2. Offline Data Cache Object Store
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Adds an action to the Sync Queue in IndexedDB.
 */
export async function enqueueSyncAction(
  actionData: Omit<SyncAction, 'id' | 'createdAt' | 'status' | 'attempts'>
): Promise<SyncAction> {
  const db = await openSyncDB();

  const newAction: SyncAction = {
    ...actionData,
    id: `sync_${generateId()}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.add(newAction);

    request.onsuccess = () => {
      notifyQueueChange();
      resolve(newAction);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to enqueue sync action.'));
    };
  });
}

/**
 * Retrieves all pending or failed actions from IndexedDB sorted chronologically.
 */
export async function getPendingSyncActions(): Promise<SyncAction[]> {
  const db = await openSyncDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const all: SyncAction[] = request.result || [];
      // Filter pending or failed and sort by createdAt ascending (FIFO)
      const pending = all
        .filter((item) => item.status === 'pending' || item.status === 'failed')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(pending);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to get pending sync actions.'));
    };
  });
}

/**
 * Retrieves all actions in the sync queue.
 */
export async function getAllSyncActions(): Promise<SyncAction[]> {
  const db = await openSyncDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const all: SyncAction[] = request.result || [];
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(all);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to get sync actions.'));
    };
  });
}

/**
 * Updates a sync action in IndexedDB.
 */
export async function updateSyncAction(action: SyncAction): Promise<void> {
  const db = await openSyncDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.put(action);

    request.onsuccess = () => {
      notifyQueueChange();
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to update sync action.'));
    };
  });
}

/**
 * Removes a sync action once successfully committed to Firebase.
 */
export async function removeSyncAction(id: string): Promise<void> {
  const db = await openSyncDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyQueueChange();
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to remove sync action.'));
    };
  });
}

/**
 * Clears all actions from the sync queue.
 */
export async function clearAllSyncActions(): Promise<void> {
  const db = await openSyncDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.clear();

    request.onsuccess = () => {
      notifyQueueChange();
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to clear sync queue.'));
    };
  });
}

/**
 * Counts how many pending or failed actions are currently in the queue.
 */
export async function countPendingSyncActions(): Promise<number> {
  try {
    const pending = await getPendingSyncActions();
    return pending.length;
  } catch (err) {
    console.error('Error counting pending sync actions:', err);
    return 0;
  }
}

// ----------------------------------------------------
// Offline Cache Storage (for durable offline-first data)
// ----------------------------------------------------

export async function setCachedData(key: string, data: any): Promise<void> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.put({
        key,
        data,
        updatedAt: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`Failed to cache data for key "${key}":`, err);
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result && request.result.data !== undefined) {
          resolve(request.result.data as T);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`Failed to read cached data for key "${key}":`, err);
    return null;
  }
}

// ----------------------------------------------------
// Event Helper to notify React components
// ----------------------------------------------------

function notifyQueueChange() {
  if (typeof window !== 'undefined') {
    countPendingSyncActions().then((count) => {
      window.dispatchEvent(
        new CustomEvent('maisoft:sync-queue-changed', {
          detail: { count },
        })
      );
    });
  }
}
