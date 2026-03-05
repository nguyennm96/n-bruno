/**
 * IndexedDB Cache Layer
 * Stores cloud data locally for offline access
 */

const DB_NAME = 'bruno-cloud-cache';
const DB_VERSION = 3; // v3: added cloud_collections full tree cache

// Store names
const STORES = {
  WORKSPACES: 'workspaces',
  COLLECTIONS: 'collections',
  METADATA: 'metadata',
  SYNC_QUEUE: 'sync_queue',
  CLOUD_COLLECTIONS: 'cloud_collections'
};

/**
 * Initialize IndexedDB
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create workspaces store
      if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
        const workspacesStore = db.createObjectStore(STORES.WORKSPACES, { keyPath: 'id' });
        workspacesStore.createIndex('userId', 'userId', { unique: false });
      }

      // Create collections store (items within workspaces)
      if (!db.objectStoreNames.contains(STORES.COLLECTIONS)) {
        const collectionsStore = db.createObjectStore(STORES.COLLECTIONS, { keyPath: 'id' });
        collectionsStore.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      // Create metadata store (cache timestamps, etc.)
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }

      // Create sync queue store (offline changes waiting to sync)
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncQueueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncQueueStore.createIndex('status', 'status', { unique: false });
      }

      // Create cloud_collections store — full collection trees for instant load
      if (!db.objectStoreNames.contains(STORES.CLOUD_COLLECTIONS)) {
        const cloudColStore = db.createObjectStore(STORES.CLOUD_COLLECTIONS, { keyPath: 'uid' });
        cloudColStore.createIndex('workspaceId', 'workspaceId', { unique: false });
      }
    };
  });
};

/**
 * Get object store for read/write
 */
const getStore = async (storeName, mode = 'readonly') => {
  const db = await initDB();
  const transaction = db.transaction([storeName], mode);
  return transaction.objectStore(storeName);
};

// ──────────────────────────────────────────────────────────────────────────────
// Workspaces Cache
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cache workspaces to IndexedDB
 */
export const cacheWorkspaces = async (workspaces, userId) => {
  try {
    const store = await getStore(STORES.WORKSPACES, 'readwrite');

    // Clear existing workspaces for this user (wait for completion)
    await new Promise((resolve, reject) => {
      const index = store.index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // No more entries, deletion complete
          resolve();
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to delete old workspaces'));
      };
    });

    // Add new workspaces (after deletion is complete)
    for (const workspace of workspaces) {
      store.put({
        ...workspace,
        userId,
        cachedAt: Date.now()
      });
    }

    // Update metadata
    const metaStore = await getStore(STORES.METADATA, 'readwrite');
    metaStore.put({
      key: 'workspaces_last_cached',
      value: Date.now(),
      userId
    });

    console.log(`✅ Cached ${workspaces.length} workspaces to IndexedDB`);
    return true;
  } catch (error) {
    console.error('Failed to cache workspaces:', error);
    return false;
  }
};

/**
 * Load workspaces from IndexedDB cache
 */
export const loadCachedWorkspaces = async (userId) => {
  try {
    const store = await getStore(STORES.WORKSPACES, 'readonly');
    const index = store.index('userId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const workspaces = request.result || [];
        console.log(`✅ Loaded ${workspaces.length} workspaces from cache`);
        resolve(workspaces);
      };

      request.onerror = () => {
        reject(new Error('Failed to load cached workspaces'));
      };
    });
  } catch (error) {
    console.error('Failed to load cached workspaces:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Collections (Items) Cache
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cache collection items to IndexedDB
 */
export const cacheCollectionItems = async (workspaceId, items) => {
  try {
    const store = await getStore(STORES.COLLECTIONS, 'readwrite');

    // Clear existing items for this workspace (wait for completion)
    await new Promise((resolve, reject) => {
      const index = store.index('workspaceId');
      const request = index.openCursor(IDBKeyRange.only(workspaceId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // No more entries, deletion complete
          resolve();
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to delete old items'));
      };
    });

    // Add new items (after deletion is complete)
    for (const item of items) {
      store.put({
        ...item,
        workspaceId,
        cachedAt: Date.now()
      });
    }

    console.log(`✅ Cached ${items.length} items for workspace ${workspaceId}`);
    return true;
  } catch (error) {
    console.error('Failed to cache collection items:', error);
    return false;
  }
};

/**
 * Load collection items from cache
 */
export const loadCachedCollectionItems = async (workspaceId) => {
  try {
    const store = await getStore(STORES.COLLECTIONS, 'readonly');
    const index = store.index('workspaceId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(workspaceId));

      request.onsuccess = () => {
        const items = request.result || [];
        console.log(`✅ Loaded ${items.length} items from cache for workspace ${workspaceId}`);
        resolve(items);
      };

      request.onerror = () => {
        reject(new Error('Failed to load cached items'));
      };
    });
  } catch (error) {
    console.error('Failed to load cached items:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Metadata
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get cache metadata
 */
export const getCacheMetadata = async (key) => {
  try {
    const store = await getStore(STORES.METADATA, 'readonly');

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get metadata'));
      };
    });
  } catch (error) {
    console.error('Failed to get cache metadata:', error);
    return null;
  }
};

/**
 * Clear all cache (on logout)
 */
export const clearAllCache = async () => {
  try {
    const db = await initDB();

    // Clear all stores
    for (const storeName of Object.values(STORES)) {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await store.clear();
    }

    console.log('✅ Cleared all cache');
    return true;
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return false;
  }
};

/**
 * Check if cache is available (IndexedDB supported)
 */
export const isCacheAvailable = () => {
  return typeof indexedDB !== 'undefined';
};

/**
 * Get cache size/stats
 */
export const getCacheStats = async (userId) => {
  try {
    const workspaces = await loadCachedWorkspaces(userId);
    const lastCached = await getCacheMetadata('workspaces_last_cached');

    return {
      workspacesCount: workspaces.length,
      lastCached,
      isAvailable: isCacheAvailable()
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      workspacesCount: 0,
      lastCached: null,
      isAvailable: false
    };
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Sync Queue
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Add item to sync queue
 * @param {Object} item - Queue item { action, type, data, workspaceId }
 */
export const addToSyncQueue = async (item) => {
  try {
    const store = await getStore(STORES.SYNC_QUEUE, 'readwrite');

    const queueItem = {
      ...item,
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
      error: null
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);

      request.onsuccess = () => {
        const id = request.result;
        console.log(`✅ Added to sync queue: ${item.action} ${item.type} (ID: ${id})`);
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error('Failed to add to sync queue'));
      };
    });
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
    throw error;
  }
};

/**
 * Get all pending items from sync queue
 */
export const getSyncQueue = async () => {
  try {
    const store = await getStore(STORES.SYNC_QUEUE, 'readonly');
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only('pending'));

      request.onsuccess = () => {
        const items = request.result || [];
        console.log(`📋 Loaded ${items.length} items from sync queue`);
        resolve(items);
      };

      request.onerror = () => {
        reject(new Error('Failed to load sync queue'));
      };
    });
  } catch (error) {
    console.error('Failed to load sync queue:', error);
    return [];
  }
};

/**
 * Update sync queue item status
 */
export const updateSyncQueueItem = async (id, updates) => {
  try {
    const store = await getStore(STORES.SYNC_QUEUE, 'readwrite');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error(`Sync queue item ${id} not found`));
          return;
        }

        const updatedItem = { ...item, ...updates };
        const putRequest = store.put(updatedItem);

        putRequest.onsuccess = () => {
          resolve(updatedItem);
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to update sync queue item'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to get sync queue item'));
      };
    });
  } catch (error) {
    console.error('Failed to update sync queue item:', error);
    throw error;
  }
};

/**
 * Remove item from sync queue
 */
export const removeFromSyncQueue = async (id) => {
  try {
    const store = await getStore(STORES.SYNC_QUEUE, 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`✅ Removed from sync queue: ${id}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to remove from sync queue'));
      };
    });
  } catch (error) {
    console.error('Failed to remove from sync queue:', error);
    throw error;
  }
};

/**
 * Clear all items from sync queue
 */
export const clearSyncQueue = async () => {
  try {
    const store = await getStore(STORES.SYNC_QUEUE, 'readwrite');

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ Cleared sync queue');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear sync queue'));
      };
    });
  } catch (error) {
    console.error('Failed to clear sync queue:', error);
    throw error;
  }
};

/**
 * Get sync queue count
 */
export const getSyncQueueCount = async () => {
  try {
    const store = await getStore(STORES.SYNC_QUEUE, 'readonly');
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only('pending'));

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to count sync queue'));
      };
    });
  } catch (error) {
    console.error('Failed to count sync queue:', error);
    return 0;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Cloud Collections — Full Tree Cache
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cache a full collection tree (items + environments) keyed by uid.
 * @param {Object} collection — Redux-compatible collection object (uid, workspaceId, items, environments, ...)
 */
export const cacheCloudCollection = async (collection) => {
  try {
    const store = await getStore(STORES.CLOUD_COLLECTIONS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ ...collection, cachedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to cache cloud collection'));
    });
  } catch (error) {
    console.error('[CloudCache] Failed to cache collection:', error);
  }
};

/**
 * Load all cached collections for a workspace.
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export const loadCachedCloudCollections = async (workspaceId) => {
  try {
    const store = await getStore(STORES.CLOUD_COLLECTIONS, 'readonly');
    const index = store.index('workspaceId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(workspaceId));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to load cached cloud collections'));
    });
  } catch (error) {
    console.error('[CloudCache] Failed to load collections:', error);
    return [];
  }
};

/**
 * Get a single cached collection by uid.
 * @param {string} collectionUid
 * @returns {Promise<Object|null>}
 */
export const getCachedCloudCollection = async (collectionUid) => {
  try {
    const store = await getStore(STORES.CLOUD_COLLECTIONS, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(collectionUid);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get cached cloud collection'));
    });
  } catch (error) {
    console.error('[CloudCache] Failed to get collection:', error);
    return null;
  }
};

/**
 * Remove a single collection from the cache.
 * @param {string} collectionUid
 */
export const removeCachedCloudCollection = async (collectionUid) => {
  try {
    const store = await getStore(STORES.CLOUD_COLLECTIONS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(collectionUid);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove cached cloud collection'));
    });
  } catch (error) {
    console.error('[CloudCache] Failed to remove collection:', error);
  }
};

/**
 * Clear all cached collections for a workspace.
 * @param {string} workspaceId
 */
export const clearCloudCollectionCache = async (workspaceId) => {
  try {
    const store = await getStore(STORES.CLOUD_COLLECTIONS, 'readwrite');
    const index = store.index('workspaceId');
    await new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(workspaceId));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete(); cursor.continue();
        } else resolve();
      };
      request.onerror = () => reject(new Error('Failed to clear cloud collection cache'));
    });
  } catch (error) {
    console.error('[CloudCache] Failed to clear cache:', error);
  }
};
