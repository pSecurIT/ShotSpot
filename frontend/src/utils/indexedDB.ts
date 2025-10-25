/**
 * IndexedDB Storage Utility for Offline Data
 * Provides persistent storage for match data, shots, events, etc.
 */

const DB_NAME = 'ShotSpotOfflineDB';
const DB_VERSION = 1;

// Store names
export const STORES = {
  GAMES: 'games',
  SHOTS: 'shots',
  EVENTS: 'events',
  SUBSTITUTIONS: 'substitutions',
  TEAMS: 'teams',
  PLAYERS: 'players',
  SYNC_QUEUE: 'syncQueue'
};

/**
 * Initialize the IndexedDB database
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.GAMES)) {
        const gamesStore = db.createObjectStore(STORES.GAMES, { keyPath: 'id' });
        gamesStore.createIndex('date', 'date', { unique: false });
        gamesStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SHOTS)) {
        const shotsStore = db.createObjectStore(STORES.SHOTS, { keyPath: 'id', autoIncrement: true });
        shotsStore.createIndex('gameId', 'game_id', { unique: false });
        shotsStore.createIndex('playerId', 'player_id', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id', autoIncrement: true });
        eventsStore.createIndex('gameId', 'game_id', { unique: false });
        eventsStore.createIndex('eventType', 'event_type', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SUBSTITUTIONS)) {
        const subsStore = db.createObjectStore(STORES.SUBSTITUTIONS, { keyPath: 'id', autoIncrement: true });
        subsStore.createIndex('gameId', 'game_id', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.TEAMS)) {
        db.createObjectStore(STORES.TEAMS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.PLAYERS)) {
        const playersStore = db.createObjectStore(STORES.PLAYERS, { keyPath: 'id' });
        playersStore.createIndex('teamId', 'team_id', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncQueueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncQueueStore.createIndex('synced', 'synced', { unique: false });
      }

      console.log('[IndexedDB] Database initialized');
    };
  });
};

/**
 * Save data to a store
 */
export const saveToStore = async <T>(storeName: string, data: T): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to save to ${storeName}`));
    };
  });
};

/**
 * Save multiple items to a store
 */
export const saveMultipleToStore = async <T>(storeName: string, items: T[]): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const promises = items.map(item => {
      return new Promise<void>((res, rej) => {
        const request = store.put(item);
        request.onsuccess = () => res();
        request.onerror = () => rej();
      });
    });

    Promise.all(promises)
      .then(() => resolve())
      .catch(() => reject(new Error(`Failed to save multiple items to ${storeName}`)));
  });
};

/**
 * Get data from a store by key
 */
export const getFromStore = async <T>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result as T);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get from ${storeName}`));
    };
  });
};

/**
 * Get all data from a store
 */
export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as T[]);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get all from ${storeName}`));
    };
  });
};

/**
 * Get data from a store by index
 */
export const getByIndex = async <T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => {
      resolve(request.result as T[]);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get by index from ${storeName}`));
    };
  });
};

/**
 * Delete data from a store
 */
export const deleteFromStore = async (storeName: string, key: IDBValidKey): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete from ${storeName}`));
    };
  });
};

/**
 * Clear all data from a store
 */
export const clearStore = async (storeName: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to clear ${storeName}`));
    };
  });
};

/**
 * Queue an action for later sync
 */
export const queueOfflineAction = async (action: {
  type: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data: unknown;
  timestamp: number;
}): Promise<void> => {
  const actionWithMeta = {
    ...action,
    synced: false,
    timestamp: action.timestamp || Date.now()
  };
  
  await saveToStore(STORES.SYNC_QUEUE, actionWithMeta);
  console.log('[IndexedDB] Action queued for sync:', action.type, action.endpoint);
};

/**
 * Get all unsynced actions from the queue
 */
export const getUnsyncedActions = async (): Promise<Array<{
  id: number;
  type: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data: unknown;
  timestamp: number;
  synced: boolean;
}>> => {
  const allActions = await getAllFromStore<{
    id: number;
    type: 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    data: unknown;
    timestamp: number;
    synced: boolean;
  }>(STORES.SYNC_QUEUE);
  
  return allActions.filter(action => !action.synced);
};

/**
 * Mark an action as synced
 */
export const markActionSynced = async (actionId: number): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(actionId);

    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (action) {
        action.synced = true;
        const putRequest = store.put(action);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to mark action as synced'));
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to get action for syncing'));
    };
  });
};

/**
 * Clear synced actions from the queue (older than 7 days)
 */
export const clearOldSyncedActions = async (): Promise<void> => {
  const db = await initDB();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const action = cursor.value;
        if (action.synced && action.timestamp < sevenDaysAgo) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to clear old synced actions'));
    };
  });
};

export default {
  initDB,
  saveToStore,
  saveMultipleToStore,
  getFromStore,
  getAllFromStore,
  getByIndex,
  deleteFromStore,
  clearStore,
  queueOfflineAction,
  getUnsyncedActions,
  markActionSynced,
  clearOldSyncedActions,
  STORES
};
