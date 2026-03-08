/**
 * Local Mode IndexedDB Store
 *
 * Single source of truth for all local-mode data (workspaces, collections,
 * folders, requests, environments, preferences, UI state).
 *
 * No filesystem dependency — all CRUD operations happen in-browser.
 */

const DB_NAME = 'bruno-local';
const DB_VERSION = 3;

export const STORES = {
  WORKSPACES: 'workspaces',
  COLLECTIONS: 'collections',
  FOLDERS: 'folders',
  REQUESTS: 'requests',
  ENVIRONMENTS: 'environments',
  GLOBAL_ENVIRONMENTS: 'global_environments',
  PREFERENCES: 'preferences',
  UI_STATE: 'ui_state',
  API_SPECS: 'api_specs',
  WORKSPACE_LINKS: 'workspace_links'
};

// ─── DB Init ──────────────────────────────────────────────────────────────────

let _db = null;

export const initLocalDB = () => {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open bruno-local IndexedDB'));

    request.onsuccess = () => {
      _db = request.result;
      resolve(_db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Drop all existing stores and recreate from scratch
      Array.from(db.objectStoreNames).forEach((name) => db.deleteObjectStore(name));

      // workspaces: { uid, name, createdAt, updatedAt }
      if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
        db.createObjectStore(STORES.WORKSPACES, { keyPath: 'uid' });
      }

      // collections: { uid, workspaceUid, name, brunoConfig, root, format, seq, createdAt, updatedAt }
      if (!db.objectStoreNames.contains(STORES.COLLECTIONS)) {
        const s = db.createObjectStore(STORES.COLLECTIONS, { keyPath: 'uid' });
        s.createIndex('workspaceUid', 'workspaceUid', { unique: false });
      }

      // folders: { uid, collectionUid, parentUid (null = root), name, seq, root, createdAt, updatedAt }
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        const s = db.createObjectStore(STORES.FOLDERS, { keyPath: 'uid' });
        s.createIndex('collectionUid', 'collectionUid', { unique: false });
        s.createIndex('parentUid', 'parentUid', { unique: false });
      }

      // requests: { uid, collectionUid, folderUid (null = root), name, seq, type, request, createdAt, updatedAt }
      if (!db.objectStoreNames.contains(STORES.REQUESTS)) {
        const s = db.createObjectStore(STORES.REQUESTS, { keyPath: 'uid' });
        s.createIndex('collectionUid', 'collectionUid', { unique: false });
        s.createIndex('folderUid', 'folderUid', { unique: false });
      }

      // environments: { uid, collectionUid, name, variables, color }
      if (!db.objectStoreNames.contains(STORES.ENVIRONMENTS)) {
        const s = db.createObjectStore(STORES.ENVIRONMENTS, { keyPath: 'uid' });
        s.createIndex('collectionUid', 'collectionUid', { unique: false });
      }

      // global_environments: { uid, workspaceUid, name, variables, color }
      if (!db.objectStoreNames.contains(STORES.GLOBAL_ENVIRONMENTS)) {
        const s = db.createObjectStore(STORES.GLOBAL_ENVIRONMENTS, { keyPath: 'uid' });
        s.createIndex('workspaceUid', 'workspaceUid', { unique: false });
      }

      // preferences: { key, value } — singleton key: 'user'
      if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
        db.createObjectStore(STORES.PREFERENCES, { keyPath: 'key' });
      }

      // ui_state: { key, value } — tabs, active_workspace, collection_env, etc.
      if (!db.objectStoreNames.contains(STORES.UI_STATE)) {
        db.createObjectStore(STORES.UI_STATE, { keyPath: 'key' });
      }

      // api_specs: { uid, workspaceUid, name, filename, raw, json, createdAt, updatedAt }
      if (!db.objectStoreNames.contains(STORES.API_SPECS)) {
        const s = db.createObjectStore(STORES.API_SPECS, { keyPath: 'uid' });
        s.createIndex('workspaceUid', 'workspaceUid', { unique: false });
      }

      // workspace_links: { collectionUid, workspaceId, collectionName, linkedAt }
      if (!db.objectStoreNames.contains(STORES.WORKSPACE_LINKS)) {
        db.createObjectStore(STORES.WORKSPACE_LINKS, { keyPath: 'collectionUid' });
      }
    };
  });
};

// Close cached connection (e.g. before version upgrade)
export const closeLocalDB = () => {
  if (_db) {
    _db.close();
    _db = null;
  }
};

// ─── Generic CRUD Helpers ─────────────────────────────────────────────────────

const withStore = async (storeName, mode, fn) => {
  const db = await initLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], mode);
    const store = tx.objectStore(storeName);
    tx.onerror = () => reject(tx.error);
    fn(store, resolve, reject);
  });
};

/** Insert or replace a record */
export const idbPut = (storeName, item) =>
  withStore(storeName, 'readwrite', (store, resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });

/** Get a record by primary key */
export const idbGet = (storeName, key) =>
  withStore(storeName, 'readonly', (store, resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

/** Get all records in a store */
export const idbGetAll = (storeName) =>
  withStore(storeName, 'readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

/** Get all records matching an index value */
export const idbGetByIndex = (storeName, indexName, value) =>
  withStore(storeName, 'readonly', (store, resolve, reject) => {
    const index = store.index(indexName);
    const req = index.getAll(IDBKeyRange.only(value));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

/** Delete a record by primary key */
export const idbDelete = (storeName, key) =>
  withStore(storeName, 'readwrite', (store, resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

/** Delete all records matching an index value */
export const idbDeleteByIndex = async (storeName, indexName, value) => {
  const db = await initLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    tx.onerror = () => reject(tx.error);

    const req = index.openCursor(IDBKeyRange.only(value));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
};

/** Bulk put (transaction-safe) */
export const idbPutBulk = async (storeName, items) => {
  const db = await initLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    tx.oncomplete = () => resolve(items);
    tx.onerror = () => reject(tx.error);
    items.forEach((item) => store.put(item));
  });
};

/** Clear all records in a store */
export const idbClear = (storeName) =>
  withStore(storeName, 'readwrite', (store, resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

// ─── Key-Value UI State helpers ───────────────────────────────────────────────

export const getUiState = (key) => idbGet(STORES.UI_STATE, key).then((r) => r?.value ?? null);

export const setUiState = (key, value) => idbPut(STORES.UI_STATE, { key, value });

// ─── Preferences helpers ──────────────────────────────────────────────────────

export const getPreferences = () => idbGet(STORES.PREFERENCES, 'user').then((r) => r?.value ?? null);

export const savePreferences = (prefs) => idbPut(STORES.PREFERENCES, { key: 'user', value: prefs });

// ─── Cascade delete helpers ───────────────────────────────────────────────────

/**
 * Delete a collection and all its children (folders, requests, environments).
 */
export const deleteCollectionCascade = async (collectionUid) => {
  await idbDeleteByIndex(STORES.ENVIRONMENTS, 'collectionUid', collectionUid);
  await idbDeleteByIndex(STORES.REQUESTS, 'collectionUid', collectionUid);
  await idbDeleteByIndex(STORES.FOLDERS, 'collectionUid', collectionUid);
  await idbDelete(STORES.COLLECTIONS, collectionUid);
};

/**
 * Delete a folder and ALL its descendant folders + requests recursively.
 */
export const deleteFolderCascade = async (folderUid) => {
  const subFolders = await idbGetByIndex(STORES.FOLDERS, 'parentUid', folderUid);
  for (const sub of subFolders) {
    await deleteFolderCascade(sub.uid);
  }
  await idbDeleteByIndex(STORES.REQUESTS, 'folderUid', folderUid);
  await idbDelete(STORES.FOLDERS, folderUid);
};
