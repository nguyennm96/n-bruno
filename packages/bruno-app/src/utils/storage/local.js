/**
 * Local Storage Implementation — IndexedDB Edition
 *
 * All collection/request/folder/environment data is stored in IndexedDB.
 * No filesystem dependency for data operations.
 * Electron IPC is kept only for: network requests, OAuth2, cookies, preferences.
 */

import { nanoid } from 'nanoid';
import {
  STORES,
  idbGet,
  idbGetAll,
  idbPut,
  idbDelete,
  idbGetByIndex,
  idbPutBulk,
  idbDeleteByIndex,
  deleteCollectionCascade,
  getUiState,
  setUiState
} from 'utils/idb/localStore';

const _updateChildrenCollectionUid = async (parentFolderUid, newCollectionUid) => {
  const subFolders = await idbGetByIndex(STORES.FOLDERS, 'parentUid', parentFolderUid);
  for (const f of subFolders) {
    await idbPut(STORES.FOLDERS, { ...f, collectionUid: newCollectionUid, updatedAt: Date.now() });
    await _updateChildrenCollectionUid(f.uid, newCollectionUid);
  }
  const subRequests = await idbGetByIndex(STORES.REQUESTS, 'folderUid', parentFolderUid);
  for (const r of subRequests) {
    await idbPut(STORES.REQUESTS, { ...r, collectionUid: newCollectionUid, updatedAt: Date.now() });
  }
};
import { loadWorkspaceCollectionsFromIdb } from 'utils/idb/collectionTree';

const { ipcRenderer } = window;

// ─── Collections ──────────────────────────────────────────────────────────────

export const getCollections = async (getState) => {
  return getState().collections.collections;
};

export const createCollection = async (name, options = {}, getState) => {
  const state = getState();
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
  const workspaceUid = activeWorkspace?.uid || 'default';

  const uid = nanoid();
  const collectionName = name || `Collection ${Date.now()}`;
  const format = options.format || 'bru';
  const now = Date.now();

  const record = {
    uid,
    workspaceUid,
    name: collectionName,
    format,
    brunoConfig: { name: collectionName, version: '1', format },
    root: {},
    seq: now,
    createdAt: now,
    updatedAt: now
  };

  await idbPut(STORES.COLLECTIONS, record);

  // Dispatch _createCollection from Redux after write
  const { createCollection: _createCollection } = await import('providers/ReduxStore/slices/collections');
  const { addCollectionToWorkspace } = await import('providers/ReduxStore/slices/workspaces');
  const { default: store } = await import('providers/ReduxStore');

  const reduxCollection = {
    uid,
    name: collectionName,
    pathname: uid,
    format,
    brunoConfig: record.brunoConfig,
    root: {},
    version: '1',
    runtimeVariables: {},
    items: [],
    environments: []
  };

  store.dispatch(_createCollection(reduxCollection));
  store.dispatch(addCollectionToWorkspace({
    workspaceUid,
    collection: { uid, name: collectionName, path: uid }
  }));

  return reduxCollection;
};

export const updateCollection = async (collectionUid, data, getState) => {
  const record = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (!record) throw new Error('Collection not found');

  const updated = { ...record, ...data, updatedAt: Date.now() };
  await idbPut(STORES.COLLECTIONS, updated);
  return updated;
};

export const deleteCollection = async (collectionUid, getState) => {
  await deleteCollectionCascade(collectionUid);
};

export const removeCollection = async (pathname, collectionUid, workspaceId) => {
  // pathname = collectionUid in IDB mode
  const uid = collectionUid || pathname;
  await deleteCollectionCascade(uid);
};

export const cloneCollection = async (collectionName, collectionFolderName, collectionLocation, previousPath, collectionUid, getState) => {
  const original = await idbGet(STORES.COLLECTIONS, collectionUid || previousPath);
  if (!original) throw new Error('Collection not found');

  const state = getState();
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
  const workspaceUid = activeWorkspace?.uid || 'default';

  const newUid = nanoid();
  const now = Date.now();

  await idbPut(STORES.COLLECTIONS, {
    ...original,
    uid: newUid,
    name: collectionName || `${original.name} (Clone)`,
    workspaceUid,
    createdAt: now,
    updatedAt: now
  });

  // Deep clone all items
  const [folders, requests, environments] = await Promise.all([
    idbGetByIndex(STORES.FOLDERS, 'collectionUid', original.uid),
    idbGetByIndex(STORES.REQUESTS, 'collectionUid', original.uid),
    idbGetByIndex(STORES.ENVIRONMENTS, 'collectionUid', original.uid)
  ]);

  // Remap folder uids
  const folderUidMap = {};
  const newFolders = folders.map((f) => {
    const newFolderUid = nanoid();
    folderUidMap[f.uid] = newFolderUid;
    return { ...f, uid: newFolderUid, collectionUid: newUid, createdAt: now, updatedAt: now };
  });
  newFolders.forEach((f) => {
    if (f.parentUid && folderUidMap[f.parentUid]) {
      f.parentUid = folderUidMap[f.parentUid];
    }
  });

  const newRequests = requests.map((r) => ({
    ...r,
    uid: nanoid(),
    collectionUid: newUid,
    folderUid: r.folderUid ? (folderUidMap[r.folderUid] || null) : null,
    createdAt: now,
    updatedAt: now
  }));

  const newEnvironments = environments.map((e) => ({
    ...e,
    uid: nanoid(),
    collectionUid: newUid,
    createdAt: now,
    updatedAt: now
  }));

  await Promise.all([
    newFolders.length && idbPutBulk(STORES.FOLDERS, newFolders),
    newRequests.length && idbPutBulk(STORES.REQUESTS, newRequests),
    newEnvironments.length && idbPutBulk(STORES.ENVIRONMENTS, newEnvironments)
  ]);

  return { id: newUid, name: collectionName || `${original.name} (Clone)` };
};

/**
 * Import a pre-converted Bruno collection object into IDB.
 * The collection data has a nested items tree that we flatten.
 */
export const importCollection = async (collection, collectionLocation, options, getState) => {
  const isMultiple = Array.isArray(collection);
  const collections = isMultiple ? collection : [collection];

  const state = getState();
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
  const workspaceUid = activeWorkspace?.uid || 'default';
  const format = options?.format || 'bru';

  const results = [];

  for (const col of collections) {
    const uid = col.uid || nanoid();
    const now = Date.now();

    await idbPut(STORES.COLLECTIONS, {
      uid,
      workspaceUid,
      name: col.name,
      format,
      brunoConfig: col.brunoConfig || { name: col.name, version: '1', format },
      root: col.root || {},
      seq: now,
      createdAt: now,
      updatedAt: now
    });

    // Flatten nested items
    await flattenItemsToIdb(col.items || [], uid, null, now);

    // Import environments
    for (const env of col.environments || []) {
      await idbPut(STORES.ENVIRONMENTS, {
        uid: env.uid || nanoid(),
        collectionUid: uid,
        name: env.name,
        variables: env.variables || [],
        color: env.color || null
      });
    }

    results.push({ uid, name: col.name, path: uid });
  }

  return isMultiple ? results : results[0];
};

const flattenItemsToIdb = async (items, collectionUid, parentFolderUid, now) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const uid = item.uid || nanoid();

    if (item.type === 'folder') {
      await idbPut(STORES.FOLDERS, {
        uid,
        collectionUid,
        parentUid: parentFolderUid,
        name: item.name,
        seq: item.seq || i + 1,
        root: item.root || null,
        createdAt: now,
        updatedAt: now
      });
      // Recurse into sub-items
      if (item.items?.length) {
        await flattenItemsToIdb(item.items, collectionUid, uid, now);
      }
    } else {
      await idbPut(STORES.REQUESTS, {
        uid,
        collectionUid,
        folderUid: parentFolderUid,
        name: item.name,
        seq: item.seq || i + 1,
        type: item.type || 'http-request',
        filename: item.filename || item.name,
        request: item.request || {},
        settings: item.settings || { encodeUrl: true },
        createdAt: now,
        updatedAt: now
      });
    }
  }
};

export const renameCollection = async (collectionUid, newName, getState) => {
  const record = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (!record) throw new Error('Collection not found');
  const updated = { ...record, name: newName, updatedAt: Date.now() };
  await idbPut(STORES.COLLECTIONS, updated);
  return updated;
};

// ─── Folders ──────────────────────────────────────────────────────────────────

export const createFolder = async (collectionUid, folderName, parentFolderId = null, getState) => {
  const uid = nanoid();
  const now = Date.now();

  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);
  const parentItems = parentFolderId
    ? (collection?.items ? findItemInTree(collection.items, parentFolderId)?.items : null) || []
    : collection?.items || [];
  const seq = parentItems.filter((i) => i.type === 'folder' || i.type?.includes('request')).length + 1;

  await idbPut(STORES.FOLDERS, {
    uid,
    collectionUid,
    parentUid: parentFolderId || null,
    name: folderName,
    seq,
    root: null,
    createdAt: now,
    updatedAt: now
  });

  return { id: uid, client_id: uid, name: folderName, sort_order: seq };
};

// ─── Requests ────────────────────────────────────────────────────────────────

const findItemInTree = (items, uid) => {
  for (const item of items || []) {
    if (item.uid === uid) return item;
    if (item.items) {
      const found = findItemInTree(item.items, uid);
      if (found) return found;
    }
  }
  return null;
};

export const createRequest = async (collectionUid, requestData, getState) => {
  const { name, method = 'GET', url = '', parentFolderId = null, type = 'http-request' } = requestData;
  const uid = nanoid();
  const now = Date.now();

  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);
  const parentItem = parentFolderId ? findItemInTree(collection?.items || [], parentFolderId) : collection;
  const seq = ((parentItem?.items || []).filter((i) => i.type === 'folder' || i.type?.includes('request')).length + 1);

  await idbPut(STORES.REQUESTS, {
    uid,
    collectionUid,
    folderUid: parentFolderId || null,
    name,
    seq,
    type,
    filename: name,
    request: { method, url, auth: { mode: 'inherit' }, headers: [], params: [], body: { mode: 'none', json: null, text: null, xml: null, sparql: null, multipartForm: [], formUrlEncoded: [], file: [] }, script: { req: null, res: null }, vars: { req: [], res: [] }, assertions: [], tests: null },
    settings: { encodeUrl: true },
    createdAt: now,
    updatedAt: now
  });

  return { uid, name, type, collectionUid, seq };
};

export const updateRequest = async (itemUid, data, getState) => {
  const record = await idbGet(STORES.REQUESTS, itemUid);
  if (!record) throw new Error('Request not found');
  await idbPut(STORES.REQUESTS, { ...record, ...data, updatedAt: Date.now() });
};

/**
 * Save a request to IDB.
 * In IDB mode, pathname === uid (virtual path).
 */
export const saveRequest = async (pathname, itemData, format) => {
  const uid = pathname; // pathname is the item uid in IDB mode
  const existing = await idbGet(STORES.REQUESTS, uid);
  if (!existing) {
    // If not found, try to create (shouldn't happen normally)
    console.warn('[IDB saveRequest] Record not found for uid:', uid);
    return;
  }
  await idbPut(STORES.REQUESTS, {
    ...existing,
    request: itemData.request || itemData,
    name: itemData.name || existing.name,
    settings: itemData.settings || existing.settings,
    updatedAt: Date.now()
  });
};

export const updateItem = async (itemUid, collectionUid, data, getState) => {
  // Try folder first, then request
  const folder = await idbGet(STORES.FOLDERS, itemUid);
  if (folder) {
    await idbPut(STORES.FOLDERS, { ...folder, ...data, updatedAt: Date.now() });
    return;
  }
  const request = await idbGet(STORES.REQUESTS, itemUid);
  if (request) {
    await idbPut(STORES.REQUESTS, { ...request, ...data, updatedAt: Date.now() });
  }
};

export const deleteItem = async (itemUid, collectionUid, getState) => {
  // Try request first, then folder
  const request = await idbGet(STORES.REQUESTS, itemUid);
  if (request) {
    await idbDelete(STORES.REQUESTS, itemUid);
    return;
  }
  // Delete folder and all its children
  const { deleteFolderCascade } = await import('utils/idb/localStore');
  await deleteFolderCascade(itemUid);
};

export const moveItem = async (params, getState) => {
  const { targetDirname: targetUid, sourcePathname: sourceUid } = params;

  // Try request
  const request = await idbGet(STORES.REQUESTS, sourceUid);
  if (request) {
    // targetUid is either a folder uid or collection uid
    const targetFolder = await idbGet(STORES.FOLDERS, targetUid);
    const newFolderUid = targetFolder ? targetFolder.uid : null;
    const newCollectionUid = targetFolder ? targetFolder.collectionUid : targetUid;
    await idbPut(STORES.REQUESTS, { ...request, folderUid: newFolderUid, collectionUid: newCollectionUid, updatedAt: Date.now() });
    return;
  }
  // Try folder
  const folder = await idbGet(STORES.FOLDERS, sourceUid);
  if (folder) {
    const targetFolder = await idbGet(STORES.FOLDERS, targetUid);
    const newParentUid = targetFolder ? targetFolder.uid : null;
    const newCollectionUid = targetFolder ? targetFolder.collectionUid : targetUid;
    await idbPut(STORES.FOLDERS, { ...folder, parentUid: newParentUid, collectionUid: newCollectionUid, updatedAt: Date.now() });
    if (newCollectionUid !== folder.collectionUid) {
      await _updateChildrenCollectionUid(folder.uid, newCollectionUid);
    }
  }
};

export const renameItemName = async (itemPath, newName, collectionPathname) => {
  // itemPath = itemUid in IDB mode
  const request = await idbGet(STORES.REQUESTS, itemPath);
  if (request) {
    await idbPut(STORES.REQUESTS, { ...request, name: newName, filename: newName, updatedAt: Date.now() });
    return;
  }
  const folder = await idbGet(STORES.FOLDERS, itemPath);
  if (folder) {
    await idbPut(STORES.FOLDERS, { ...folder, name: newName, updatedAt: Date.now() });
  }
};

export const renameItemFilename = async (oldPath, newPath, newName, newFilename, collectionPathname) => {
  // In IDB mode, rename same as renameItemName
  await renameItemName(oldPath, newName, collectionPathname);
};

/**
 * Create a new request in IDB.
 * containerPathname is either a collection uid (root) or folder uid (nested).
 * Returns the created item with uid so Redux updates immediately (like cloud mode).
 */
export const newRequest = async (containerPathname, item) => {
  const uid = item.uid || nanoid();
  const now = Date.now();

  // Resolve container: folder or collection
  const folder = await idbGet(STORES.FOLDERS, containerPathname);
  const collectionUid = folder ? folder.collectionUid : containerPathname;
  const folderUid = folder ? folder.uid : null;

  await idbPut(STORES.REQUESTS, {
    uid,
    collectionUid,
    folderUid,
    name: item.name,
    seq: item.seq || 1,
    type: item.type || 'http-request',
    filename: item.filename || item.name,
    request: item.request || {},
    settings: item.settings || { encodeUrl: true },
    createdAt: now,
    updatedAt: now
  });

  return { ...item, uid, collectionUid, folderUid };
};

/**
 * Recursively clone a folder and all its descendants into a new parent.
 */
const _cloneFolderTree = async (sourceFolderUid, newParentUid, collectionUid, now) => {
  const original = await idbGet(STORES.FOLDERS, sourceFolderUid);
  if (!original) return;

  const newUid = nanoid();
  await idbPut(STORES.FOLDERS, {
    ...original,
    uid: newUid,
    parentUid: newParentUid,
    collectionUid,
    createdAt: now,
    updatedAt: now
  });

  // Clone direct requests
  const requests = await idbGetByIndex(STORES.REQUESTS, 'folderUid', sourceFolderUid);
  if (requests.length) {
    await idbPutBulk(STORES.REQUESTS, requests.map((r) => ({ ...r, uid: nanoid(), folderUid: newUid, collectionUid, createdAt: now, updatedAt: now })));
  }

  // Recurse into sub-folders
  const subFolders = await idbGetByIndex(STORES.FOLDERS, 'parentUid', sourceFolderUid);
  for (const sub of subFolders) {
    await _cloneFolderTree(sub.uid, newUid, collectionUid, now);
  }

  return newUid;
};

export const cloneFolder = async (item, collectionPath, collectionPathname) => {
  const now = Date.now();
  const originalFolder = await idbGet(STORES.FOLDERS, item.uid);
  if (!originalFolder) throw new Error('Folder not found for clone');

  const newUid = await _cloneFolderTree(
    item.uid,
    originalFolder.parentUid,
    originalFolder.collectionUid,
    now
  );

  // Update name on the new top-level clone
  const cloned = await idbGet(STORES.FOLDERS, newUid);
  if (cloned) {
    await idbPut(STORES.FOLDERS, { ...cloned, name: item.name || `${originalFolder.name} (Clone)` });
  }

  return { id: newUid, uid: newUid, client_id: newUid, name: item.name || originalFolder.name, type: 'folder' };
};

export const resequenceItems = async (itemsToResequence, collectionPathname) => {
  for (const it of itemsToResequence) {
    const request = await idbGet(STORES.REQUESTS, it.uid);
    if (request) {
      await idbPut(STORES.REQUESTS, { ...request, seq: it.seq, updatedAt: Date.now() });
      continue;
    }
    const folder = await idbGet(STORES.FOLDERS, it.uid);
    if (folder) {
      await idbPut(STORES.FOLDERS, { ...folder, seq: it.seq, updatedAt: Date.now() });
    }
  }
};

export const cloneItem = async (itemUid, collectionUid, newName, getState) => {
  const now = Date.now();

  const request = await idbGet(STORES.REQUESTS, itemUid);
  if (request) {
    const newUid = nanoid();
    await idbPut(STORES.REQUESTS, { ...request, uid: newUid, name: newName || request.name, filename: newName || request.filename, createdAt: now, updatedAt: now });
    return { id: newUid, uid: newUid, name: newName || request.name };
  }

  const folder = await idbGet(STORES.FOLDERS, itemUid);
  if (folder) {
    const now2 = Date.now();
    const newFolderUid = await _cloneFolderTree(itemUid, folder.parentUid, folder.collectionUid, now2);
    // Update name on cloned root folder
    const clonedFolder = await idbGet(STORES.FOLDERS, newFolderUid);
    if (clonedFolder && newName) {
      await idbPut(STORES.FOLDERS, { ...clonedFolder, name: newName });
    }
    return { id: newFolderUid, uid: newFolderUid, name: newName || folder.name };
  }

  throw new Error('Item not found for clone');
};

// ─── Environments ─────────────────────────────────────────────────────────────

export const renameEnvironment = async (collectionPathname, oldName, newName, environmentUid) => {
  // collectionPathname = collectionUid in IDB mode
  let env = null;
  if (environmentUid) {
    env = await idbGet(STORES.ENVIRONMENTS, environmentUid);
  }
  if (!env) {
    const envs = await idbGetByIndex(STORES.ENVIRONMENTS, 'collectionUid', collectionPathname);
    env = envs.find((e) => e.name === oldName);
  }
  if (env) {
    await idbPut(STORES.ENVIRONMENTS, { ...env, name: newName, updatedAt: Date.now() });
  }
};

export const saveEnvironment = async (collectionPathname, environmentData) => {
  const { uid, name, variables, color } = environmentData;
  const existing = await idbGet(STORES.ENVIRONMENTS, uid);
  await idbPut(STORES.ENVIRONMENTS, {
    ...(existing || {}),
    uid: uid || nanoid(),
    collectionUid: collectionPathname,
    name: name ?? existing?.name,
    variables: variables ?? existing?.variables ?? [],
    color: color !== undefined ? color : (existing?.color ?? null),
    updatedAt: Date.now()
  });
};

export const updateEnvironmentColor = async (collectionPathname, environmentName, color, environmentUid) => {
  let env = null;
  if (environmentUid) {
    env = await idbGet(STORES.ENVIRONMENTS, environmentUid);
  }
  if (!env) {
    const envs = await idbGetByIndex(STORES.ENVIRONMENTS, 'collectionUid', collectionPathname);
    env = envs.find((e) => e.name === environmentName);
  }
  if (env) {
    await idbPut(STORES.ENVIRONMENTS, { ...env, color, updatedAt: Date.now() });
  }
};

// ─── Collection Root / Config ─────────────────────────────────────────────────

export const saveCollectionRoot = async (collectionPathname, collectionRootData, brunoConfig) => {
  const record = await idbGet(STORES.COLLECTIONS, collectionPathname);
  if (!record) return;
  await idbPut(STORES.COLLECTIONS, {
    ...record,
    root: collectionRootData || record.root,
    brunoConfig: brunoConfig || record.brunoConfig,
    updatedAt: Date.now()
  });
};

export const updateBrunoConfig = async (brunoConfig, collectionPathname, collectionRoot) => {
  return saveCollectionRoot(collectionPathname, collectionRoot, brunoConfig);
};

// ─── Workspace Collections ────────────────────────────────────────────────────

export const loadWorkspaceCollections = async (workspaceUid) => {
  return loadWorkspaceCollectionsFromIdb(workspaceUid);
};

export const openCollection = async (options = {}) => {
  // In IDB mode, "opening" a collection means loading from IDB.
  // This is a no-op since loadWorkspaceCollections handles everything.
  console.log('[IDB] openCollection: no-op in IDB mode');
  return null;
};

export const importCollectionZip = async (zipFilePath, collectionLocation) => {
  // TODO: Migrate to IDB — requires a new IPC handler that parses the zip and returns
  // collection data (instead of writing to filesystem) so we can import via importCollection().
  // For now, delegate to Electron to unzip + parse; the resulting collection-opened event
  // will be handled by the file watcher which is still in place for this code path.
  console.log('[LocalStorage] importCollectionZip: invoking IPC', { zipFilePath, collectionLocation });
  return ipcRenderer.invoke('renderer:import-collection-zip', zipFilePath, collectionLocation);
};

export const addCollectionToWorkspace = async (workspacePath, workspaceCollection) => {
  // In IDB mode, workspace associations are stored in IDB, not filesystem
  console.log('[IDB] addCollectionToWorkspace: no-op, associations tracked in IDB');
  return null;
};

export const getCollectionSecurityConfig = async (pathname) => {
  const record = await idbGet(STORES.COLLECTIONS, pathname);
  return record?.securityConfig || {};
};

export const getCollectionWorkspaces = async (collectionPathname) => {
  const record = await idbGet(STORES.COLLECTIONS, collectionPathname);
  return record ? [record.workspaceUid] : [];
};

export const setCollectionWorkspace = async (collectionUid, workspacePathname) => {
  const record = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (record) {
    await idbPut(STORES.COLLECTIONS, { ...record, workspaceUid: workspacePathname, updatedAt: Date.now() });
  }
};

export const openMultipleCollections = async (collectionPaths, options = {}) => {
  // In IDB mode, this is handled by loadWorkspaceCollections
  console.log('[IDB] openMultipleCollections: no-op in IDB mode');
  return null;
};

export const deleteTransientRequests = async (filePaths, tempDir) => {
  // Transient requests in IDB mode are removed by uid
  for (const uid of filePaths) {
    await idbDelete(STORES.REQUESTS, uid).catch(() => {});
  }
};

export const clearUserCollections = async (userId) => {
  // Not needed in IDB mode — clear handled by workspace deletion
  console.log('[IDB] clearUserCollections: not applicable in IDB mode');
};

export const updateUiStateSnapshot = async (data) => {
  // In IDB mode, active environment is tracked in Redux state — no separate snapshot needed
};

export const browseDirectory = async () => {
  console.log('[LocalStorage] browseDirectory');
  return ipcRenderer.invoke('renderer:browse-directory');
};

export const browseFiles = async (filters, properties) => {
  console.log('[LocalStorage] browseFiles:', { filters, properties });
  return ipcRenderer.invoke('renderer:browse-files', filters, properties);
};

export const showInFolder = async (collectionPath) => {
  console.log('[LocalStorage] showInFolder:', { collectionPath });
  return ipcRenderer.invoke('renderer:show-in-folder', collectionPath);
};

// Load request operations — in IDB mode, requests are already in Redux via loadWorkspaceCollectionsFromIdb.
// loadLargeRequest is called for lazy-loaded large requests; load from IDB by uid.
export const loadRequestViaWorker = async ({ collectionUid, pathname }) => {
  return idbGet(STORES.REQUESTS, pathname);
};

export const loadRequest = async ({ collectionUid, pathname }) => {
  return idbGet(STORES.REQUESTS, pathname);
};

export const loadLargeRequest = async ({ collectionUid, pathname }) => {
  return idbGet(STORES.REQUESTS, pathname);
};

// Save and folder operations
export const saveMultipleRequests = async (itemsToSave) => {
  for (const { item, pathname } of itemsToSave) {
    const uid = pathname; // pathname === uid in IDB mode
    const existing = await idbGet(STORES.REQUESTS, uid);
    if (existing) {
      await idbPut(STORES.REQUESTS, {
        ...existing,
        request: item.request || item,
        name: item.name || existing.name,
        settings: item.settings || existing.settings,
        updatedAt: Date.now()
      });
    }
  }
};

export const saveFolderRoot = async (folderData) => {
  const { folderPathname, root } = folderData;
  const uid = folderPathname; // uid in IDB mode
  const existing = await idbGet(STORES.FOLDERS, uid);
  if (existing) {
    await idbPut(STORES.FOLDERS, { ...existing, root: root || {}, updatedAt: Date.now() });
  }
};

export const runCollectionFolder = async (collectionUid, folderUid, itemsToRun, options) => {
  console.log('[LocalStorage] runCollectionFolder:', { collectionUid, folderUid });
  return ipcRenderer.invoke('renderer:run-collection-folder', collectionUid, folderUid, itemsToRun, options);
};

// Environment operations
export const createEnvironment = async (collectionPathname, name, variables, color) => {
  const uid = nanoid();
  await idbPut(STORES.ENVIRONMENTS, {
    uid,
    collectionUid: collectionPathname,
    name,
    variables: variables || [],
    color: color || null
  });
  return { uid, name, variables: variables || [], color };
};

export const deleteEnvironment = async (collectionPathname, name, environmentUid) => {
  if (environmentUid) {
    await idbDelete(STORES.ENVIRONMENTS, environmentUid);
    return;
  }
  const envs = await idbGetByIndex(STORES.ENVIRONMENTS, 'collectionUid', collectionPathname);
  const env = envs.find((e) => e.name === name);
  if (env) await idbDelete(STORES.ENVIRONMENTS, env.uid);
};

// Variable operations — update variable value in collection/folder/request root
export const updateVariableInFile = async (pathname, variable, scopeType, collectionRoot, format) => {
  if (scopeType === 'collection') {
    const record = await idbGet(STORES.COLLECTIONS, pathname);
    if (record) {
      const root = record.root || {};
      const vars = (root.vars || []).map((v) => v.name === variable.name ? { ...v, value: variable.value } : v);
      await idbPut(STORES.COLLECTIONS, { ...record, root: { ...root, vars }, updatedAt: Date.now() });
    }
  } else if (scopeType === 'folder') {
    const record = await idbGet(STORES.FOLDERS, pathname);
    if (record) {
      const root = record.root || {};
      const vars = (root.vars || []).map((v) => v.name === variable.name ? { ...v, value: variable.value } : v);
      await idbPut(STORES.FOLDERS, { ...record, root: { ...root, vars }, updatedAt: Date.now() });
    }
  } else if (scopeType === 'request') {
    const record = await idbGet(STORES.REQUESTS, pathname);
    if (record) {
      const req = record.request || {};
      const vars = (req.vars?.req || []).map((v) => v.name === variable.name ? { ...v, value: variable.value } : v);
      await idbPut(STORES.REQUESTS, { ...record, request: { ...req, vars: { ...req.vars, req: vars } }, updatedAt: Date.now() });
    }
  }
};

// Bruno config operations
export const updateBrunoConfigStorage = async (brunoConfig, pathname, collectionRoot) => {
  const record = await idbGet(STORES.COLLECTIONS, pathname);
  if (record) {
    await idbPut(STORES.COLLECTIONS, { ...record, brunoConfig, updatedAt: Date.now() });
  }
};

// Workspace operations
export const reorderWorkspaceCollections = async (workspacePathname, collectionPaths) => {
  // collectionPaths are uids in IDB mode; update seq on each collection record
  for (let i = 0; i < collectionPaths.length; i++) {
    const uid = collectionPaths[i];
    const record = await idbGet(STORES.COLLECTIONS, uid);
    if (record) {
      await idbPut(STORES.COLLECTIONS, { ...record, seq: i, updatedAt: Date.now() });
    }
  }
};

export const saveCollectionSecurityConfig = async (pathname, securityConfig) => {
  const record = await idbGet(STORES.COLLECTIONS, pathname);
  if (record) {
    await idbPut(STORES.COLLECTIONS, { ...record, securityConfig });
  }
};

// OAuth2 operations
export const fetchOAuth2Credentials = async ({ itemUid, request, collection }) => {
  console.log('[LocalStorage] fetchOAuth2Credentials:', { itemUid });
  return ipcRenderer.invoke('renderer:fetch-oauth2-credentials', { itemUid, request, collection });
};

export const refreshOAuth2Credentials = async ({ itemUid, request, collection }) => {
  console.log('[LocalStorage] refreshOAuth2Credentials:', { itemUid });
  return ipcRenderer.invoke('renderer:refresh-oauth2-credentials', { itemUid, request, collection });
};

export const isOAuth2AuthorizationInProgress = async () => {
  console.log('[LocalStorage] isOAuth2AuthorizationInProgress');
  return ipcRenderer.invoke('renderer:is-oauth2-authorization-request-in-progress');
};

export const cancelOAuth2Authorization = async () => {
  console.log('[LocalStorage] cancelOAuth2Authorization');
  return ipcRenderer.invoke('renderer:cancel-oauth2-authorization-request');
};

// Dotenv operations — stored in IDB collection record
export const saveDotenvVariables = async (collectionUid, variables, filename) => {
  const collection = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (!collection) return null;
  const dotEnvFiles = collection.dotEnvFiles || [];
  const idx = dotEnvFiles.findIndex((f) => f.filename === filename);
  if (idx >= 0) {
    dotEnvFiles[idx] = { filename, variables, exists: true };
  } else {
    dotEnvFiles.push({ filename, variables, exists: true });
  }
  await idbPut(STORES.COLLECTIONS, { ...collection, dotEnvFiles, updatedAt: Date.now() });
  return { collectionUid, variables, filename, exists: true };
};

export const saveDotenvRaw = async (collectionUid, content, filename) => {
  // Parse raw dotenv content into variables key=value pairs
  const variables = content
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return null;
      return { name: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1).trim(), enabled: true, secret: false };
    })
    .filter(Boolean);
  return saveDotenvVariables(collectionUid, variables, filename);
};

export const createDotenvFile = async (collectionUid, filename) => {
  const collection = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (!collection) return null;
  const dotEnvFiles = collection.dotEnvFiles || [];
  if (!dotEnvFiles.find((f) => f.filename === filename)) {
    dotEnvFiles.push({ filename, variables: [], exists: true });
    await idbPut(STORES.COLLECTIONS, { ...collection, dotEnvFiles, updatedAt: Date.now() });
  }
  return { collectionUid, filename, exists: true };
};

export const deleteDotenvFile = async (collectionUid, filename) => {
  const collection = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (!collection) return null;
  const dotEnvFiles = (collection.dotEnvFiles || []).filter((f) => f.filename !== filename);
  await idbPut(STORES.COLLECTIONS, { ...collection, dotEnvFiles, updatedAt: Date.now() });
  return { collectionUid, filename, exists: false };
};

// Git operations
export const cloneGitRepository = async (data) => {
  console.log('[LocalStorage] cloneGitRepository');
  return ipcRenderer.invoke('renderer:clone-git-repository', data);
};

export const scanForBrunoFiles = async (dir) => {
  console.log('[LocalStorage] scanForBrunoFiles:', { dir });
  return ipcRenderer.invoke('renderer:scan-for-bruno-files', dir);
};

// Mount collection — no-op in IDB mode (no filesystem watcher needed)
export const mountCollection = async ({ collectionUid }) => {
  return collectionUid;
};

// New request file operations
export const newRequestFile = async () => {
  // No-op in IDB mode — new requests are written via newRequest() directly to IDB
  return null;
};

// gRPC operations
export const loadMethodsReflection = async ({ request, collection, environment, runtimeVariables }) => {
  console.log('[LocalStorage] loadMethodsReflection');
  return ipcRenderer.invoke('grpc:load-methods-reflection', { request, collection, environment, runtimeVariables });
};

export const generateGrpcurl = async ({ request, collection, environment, runtimeVariables }) => {
  console.log('[LocalStorage] generateGrpcurl');
  return ipcRenderer.invoke('grpc:generate-grpcurl', { request, collection, environment, runtimeVariables });
};

// OAuth2 cache
export const clearOAuth2Cache = async (collectionUid, url, credentialsId) => {
  console.log('[LocalStorage] clearOAuth2Cache:', { collectionUid });
  return ipcRenderer.invoke('clear-oauth2-cache', collectionUid, url, credentialsId);
};

// Preferences
export const savePreferences = async (preferences) => {
  return ipcRenderer.invoke('renderer:save-preferences', preferences);
};

// Collection import helper
export const parseCollectionImport = async (collection, format) => {
  console.log('[LocalStorage] parseCollectionImport:', { format });
  return ipcRenderer.invoke('renderer:parse-collection-import', collection, format);
};

// System operations (always local - cookies, proxy, quit flow)
export const deleteCookiesForDomain = async (domain) => {
  console.log('[LocalStorage] deleteCookiesForDomain:', { domain });
  return ipcRenderer.invoke('renderer:delete-cookies-for-domain', domain);
};

export const deleteCookie = async (domain, path, cookieKey) => {
  console.log('[LocalStorage] deleteCookie:', { domain, path, cookieKey });
  return ipcRenderer.invoke('renderer:delete-cookie', domain, path, cookieKey);
};

export const addCookie = async (domain, cookie) => {
  console.log('[LocalStorage] addCookie:', { domain });
  return ipcRenderer.invoke('renderer:add-cookie', domain, cookie);
};

export const modifyCookie = async (domain, oldCookie, cookie) => {
  console.log('[LocalStorage] modifyCookie:', { domain });
  return ipcRenderer.invoke('renderer:modify-cookie', domain, oldCookie, cookie);
};

export const getParsedCookie = async (cookieStr) => {
  console.log('[LocalStorage] getParsedCookie');
  return ipcRenderer.invoke('renderer:get-parsed-cookie', cookieStr);
};

export const createCookieString = async (cookieObj) => {
  console.log('[LocalStorage] createCookieString');
  return ipcRenderer.invoke('renderer:create-cookie-string', cookieObj);
};

export const completeQuitFlow = async () => {
  console.log('[LocalStorage] completeQuitFlow');
  return ipcRenderer.invoke('main:complete-quit-flow');
};

export const getSystemProxyVariables = async () => {
  console.log('[LocalStorage] getSystemProxyVariables');
  return ipcRenderer.invoke('renderer:get-system-proxy-variables');
};

export const refreshSystemProxy = async () => {
  console.log('[LocalStorage] refreshSystemProxy');
  return ipcRenderer.invoke('renderer:refresh-system-proxy');
};

// Auth token operations (always local - secure storage)
export const saveAuthTokens = async (tokens) => {
  console.log('[LocalStorage] saveAuthTokens');
  return ipcRenderer.invoke('auth:save-tokens', tokens);
};

export const getAuthTokens = async () => {
  console.log('[LocalStorage] getAuthTokens');
  return ipcRenderer.invoke('auth:get-tokens');
};

export const clearAuthTokens = async () => {
  console.log('[LocalStorage] clearAuthTokens');
  return ipcRenderer.invoke('auth:clear-tokens');
};

// Workspace link operations (IDB — keyed by collectionUid)
export const saveWorkspaceLink = async ({ collectionUid, workspaceId, collectionName, linkedAt }) => {
  await idbPut(STORES.WORKSPACE_LINKS, { collectionUid, workspaceId, collectionName, linkedAt: linkedAt || Date.now() });
};

export const removeWorkspaceLink = async ({ collectionUid }) => {
  await idbDelete(STORES.WORKSPACE_LINKS, collectionUid);
};

export const getWorkspaceLinks = async () => {
  const links = await idbGetAll(STORES.WORKSPACE_LINKS);
  // Return as object keyed by collectionUid for backward compatibility
  return links.reduce((acc, l) => {
    acc[l.collectionUid] = l; return acc;
  }, {});
};

// Workspace operations (local filesystem - not applicable to cloud mode)
export const createWorkspace = async (workspaceName) => {
  const uid = nanoid();
  const now = Date.now();
  await idbPut(STORES.WORKSPACES, { uid, name: workspaceName, createdAt: now, updatedAt: now });
  return { workspaceUid: uid, workspacePath: null, workspaceConfig: { name: workspaceName } };
};

export const openWorkspace = async (workspacePath) => {
  console.log('[LocalStorage] openWorkspace:', { workspacePath });
  return ipcRenderer.invoke('renderer:open-workspace', workspacePath);
};

export const openWorkspaceDialog = async () => {
  console.log('[LocalStorage] openWorkspaceDialog');
  return ipcRenderer.invoke('renderer:open-workspace-dialog');
};

export const removeCollectionFromWorkspace = async (workspaceUid, workspacePath, collectionPath, options = {}) => {
  // collectionPath = collection uid in IDB mode
  const uid = collectionPath;
  if (options?.deleteFiles !== false) {
    await deleteCollectionCascade(uid);
  }
};

// API Specs — IDB-native (workspaceUid-scoped)
export const loadWorkspaceApiSpecs = async (workspaceUid) => {
  return idbGetByIndex(STORES.API_SPECS, 'workspaceUid', workspaceUid);
};

// Open a file dialog, read the selected spec, persist to IDB, return the record.
export const openApiSpec = async (workspaceUid) => {
  const filePaths = await ipcRenderer.invoke('renderer:browse-files', [
    { name: 'API Spec', extensions: ['yaml', 'yml', 'json'] }
  ]);
  if (!filePaths?.length) return null;
  const filePath = filePaths[0];
  const raw = await ipcRenderer.invoke('renderer:read-file', filePath);
  const filename = filePath.split('/').pop().split('\\').pop();
  const name = filename.replace(/\.[^.]+$/, '');
  const uid = nanoid();
  let json = null;
  try { json = JSON.parse(raw); } catch { /* yaml or invalid */ }
  const now = Date.now();
  const spec = { uid, workspaceUid, name, filename, pathname: uid, raw, json, createdAt: now, updatedAt: now };
  await idbPut(STORES.API_SPECS, spec);
  return spec;
};

// Load a spec by uid — in IDB mode pathname === uid
export const openApiSpecFile = async (specUid) => {
  return idbGet(STORES.API_SPECS, specUid);
};

export const createApiSpec = async (name, _location, content = '', workspaceUid) => {
  const uid = nanoid();
  const now = Date.now();
  let json = null;
  try { json = JSON.parse(content); } catch { /* yaml */ }
  const spec = { uid, workspaceUid, name, filename: name, pathname: uid, raw: content, json, createdAt: now, updatedAt: now };
  await idbPut(STORES.API_SPECS, spec);
  return spec;
};

export const saveApiSpec = async (uid, content) => {
  const existing = await idbGet(STORES.API_SPECS, uid);
  if (!existing) throw new Error('API spec not found');
  let json = null;
  try { json = JSON.parse(content); } catch { /* yaml */ }
  const updated = { ...existing, raw: content, json, updatedAt: Date.now() };
  await idbPut(STORES.API_SPECS, updated);
  return updated;
};

export const removeApiSpec = async (uid) => {
  await idbDelete(STORES.API_SPECS, uid);
};

export const ensureApispecFolder = async () => {
  // No-op in IDB mode — no filesystem folders needed
};

export const getGlobalEnvironments = async ({ workspaceUid } = {}) => {
  const globalEnvironments = await idbGetByIndex(STORES.GLOBAL_ENVIRONMENTS, 'workspaceUid', workspaceUid) || [];
  const activeGlobalEnvironmentUid = await getUiState(`global_env_active_${workspaceUid}`);
  return { globalEnvironments, activeGlobalEnvironmentUid };
};

// loadWorkspaceCollections already exported above (IDB version at line ~572)

export const getLastOpenedWorkspaces = async () => {
  // In IDB mode, all workspaces are always available in IDB
  const { loadWorkspacesFromIdb } = await import('utils/idb/collectionTree');
  const workspaces = await loadWorkspacesFromIdb();
  return workspaces.map((w) => ({ uid: w.uid, name: w.name, pathname: w.uid }));
};

export const startWorkspaceWatcher = async (workspacePath) => {
  console.log('[LocalStorage] startWorkspaceWatcher:', { workspacePath });
  return ipcRenderer.invoke('renderer:start-workspace-watcher', workspacePath);
};

export const saveWorkspaceDocs = async (workspaceUid, docs) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (workspace) {
    await idbPut(STORES.WORKSPACES, { ...workspace, docs, updatedAt: Date.now() });
  }
  return docs;
};

export const renameWorkspace = async (workspaceUid, newName) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (workspace) {
    await idbPut(STORES.WORKSPACES, { ...workspace, name: newName, updatedAt: Date.now() });
  }
  return { uid: workspaceUid, name: newName };
};

export const closeWorkspace = async (workspaceUid) => {
  // In IDB mode, remove the workspace record so it doesn't reappear on restart
  if (workspaceUid) {
    await idbDelete(STORES.WORKSPACES, workspaceUid);
  }
  return true;
};

export const loadWorkspaceEnvironments = async (workspaceUid) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  return workspace?.environments || [];
};

export const createWorkspaceEnvironment = async (workspaceUid, environmentName) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  const newEnv = { uid: nanoid(), name: environmentName, variables: [] };
  const environments = [...(workspace.environments || []), newEnv];
  await idbPut(STORES.WORKSPACES, { ...workspace, environments });
  return newEnv;
};

export const deleteWorkspaceEnvironment = async (workspaceUid, environmentUid) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  const environments = (workspace.environments || []).filter((e) => e.uid !== environmentUid);
  const activeEnvironmentUid = workspace.activeEnvironmentUid === environmentUid ? null : workspace.activeEnvironmentUid;
  await idbPut(STORES.WORKSPACES, { ...workspace, environments, activeEnvironmentUid });
  return true;
};

export const selectWorkspaceEnvironment = async (workspaceUid, environmentUid) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  await idbPut(STORES.WORKSPACES, { ...workspace, activeEnvironmentUid: environmentUid });
  return true;
};

export const importWorkspaceEnvironment = async (workspaceUid, environmentData) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  const importedEnv = { uid: nanoid(), name: environmentData.name, variables: environmentData.variables || [] };
  const environments = [...(workspace.environments || []), importedEnv];
  await idbPut(STORES.WORKSPACES, { ...workspace, environments });
  return importedEnv;
};

export const updateWorkspaceEnvironment = async (workspaceUid, environmentUid, environmentData) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  const environments = (workspace.environments || []).map((e) =>
    e.uid === environmentUid ? { ...e, ...environmentData, uid: environmentUid } : e
  );
  await idbPut(STORES.WORKSPACES, { ...workspace, environments });
  return true;
};

export const renameWorkspaceEnvironment = async (workspaceUid, environmentUid, newName) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  const environments = (workspace.environments || []).map((e) =>
    e.uid === environmentUid ? { ...e, name: newName } : e
  );
  await idbPut(STORES.WORKSPACES, { ...workspace, environments });
  return true;
};

export const copyWorkspaceEnvironment = async (workspaceUid, environmentUid, newName) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error('Workspace not found');
  const baseEnv = (workspace.environments || []).find((e) => e.uid === environmentUid);
  if (!baseEnv) throw new Error('Environment not found');
  const copiedEnv = { uid: nanoid(), name: newName, variables: baseEnv.variables || [] };
  const environments = [...(workspace.environments || []), copiedEnv];
  await idbPut(STORES.WORKSPACES, { ...workspace, environments });
  return copiedEnv;
};

export const exportWorkspace = async (workspacePath, workspaceName) => {
  console.log('[LocalStorage] exportWorkspace:', { workspacePath, workspaceName });
  return ipcRenderer.invoke('renderer:export-workspace', workspacePath, workspaceName);
};

export const importWorkspace = async (zipFilePath, extractLocation) => {
  console.log('[LocalStorage] importWorkspace:', { zipFilePath, extractLocation });
  return ipcRenderer.invoke('renderer:import-workspace', zipFilePath, extractLocation);
};

// IDB mode: create/reuse a stable scratch collection in IDB — no temp directory needed
export const mountWorkspaceScratch = async ({ workspaceUid }) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) throw new Error(`Workspace ${workspaceUid} not found`);

  // Reuse existing scratch collection uid if already stored
  if (workspace.scratchCollectionUid) {
    const existing = await idbGet(STORES.COLLECTIONS, workspace.scratchCollectionUid);
    if (existing) return { uid: workspace.scratchCollectionUid, idbMode: true };
  }

  const uid = nanoid();
  const now = Date.now();
  await idbPut(STORES.COLLECTIONS, {
    uid,
    workspaceUid,
    name: 'Scratch',
    pathname: uid,
    brunoConfig: { opencollection: '1.0.0', name: 'Scratch', type: 'collection', ignore: ['node_modules', '.git'] },
    items: [],
    createdAt: now,
    updatedAt: now
  });

  // Persist the scratch uid onto the workspace record so it survives restarts
  await idbPut(STORES.WORKSPACES, { ...workspace, scratchCollectionUid: uid, updatedAt: now });

  return { uid, idbMode: true };
};

// No-op in IDB mode — no filesystem watchers needed
export const addCollectionWatcher = async () => {};

export const saveWorkspaceDotEnvVariables = async ({ workspaceUid, variables, filename = '.env' }) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) return null;
  const dotEnvFiles = workspace.dotEnvFiles || [];
  const idx = dotEnvFiles.findIndex((f) => f.filename === filename);
  if (idx >= 0) {
    dotEnvFiles[idx] = { filename, variables, exists: true };
  } else {
    dotEnvFiles.push({ filename, variables, exists: true });
  }
  await idbPut(STORES.WORKSPACES, { ...workspace, dotEnvFiles, updatedAt: Date.now() });
  return { workspaceUid, variables, filename, exists: true };
};

export const saveWorkspaceDotEnvRaw = async ({ workspaceUid, content, filename = '.env' }) => {
  const variables = content
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return null;
      return { name: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1).trim(), enabled: true, secret: false };
    })
    .filter(Boolean);
  return saveWorkspaceDotEnvVariables({ workspaceUid, variables, filename });
};

export const createWorkspaceDotEnvFile = async ({ workspaceUid, filename = '.env' }) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) return null;
  const dotEnvFiles = workspace.dotEnvFiles || [];
  if (!dotEnvFiles.find((f) => f.filename === filename)) {
    dotEnvFiles.push({ filename, variables: [], exists: true });
    await idbPut(STORES.WORKSPACES, { ...workspace, dotEnvFiles, updatedAt: Date.now() });
  }
  return { workspaceUid, filename, exists: true };
};

export const deleteWorkspaceDotEnvFile = async ({ workspaceUid, filename = '.env' }) => {
  const workspace = await idbGet(STORES.WORKSPACES, workspaceUid);
  if (!workspace) return null;
  const dotEnvFiles = (workspace.dotEnvFiles || []).filter((f) => f.filename !== filename);
  await idbPut(STORES.WORKSPACES, { ...workspace, dotEnvFiles, updatedAt: Date.now() });
  return { workspaceUid, filename, exists: false };
};

export const fetchNotifications = async () => {
  console.log('[LocalStorage] fetchNotifications');
  return ipcRenderer.invoke('renderer:fetch-notifications');
};

export const createGlobalEnvironment = async ({ name, uid, variables = [], color, workspaceUid }) => {
  const record = { uid, name, variables, color: color || null, workspaceUid };
  await idbPut(STORES.GLOBAL_ENVIRONMENTS, record);
  return record;
};

export const renameGlobalEnvironment = async ({ name, environmentUid, workspaceUid }) => {
  const existing = await idbGet(STORES.GLOBAL_ENVIRONMENTS, environmentUid);
  if (!existing) throw new Error('Global environment not found');
  const updated = { ...existing, name };
  await idbPut(STORES.GLOBAL_ENVIRONMENTS, updated);
  return updated;
};

export const saveGlobalEnvironment = async ({ environmentUid, variables }) => {
  const existing = await idbGet(STORES.GLOBAL_ENVIRONMENTS, environmentUid);
  if (!existing) throw new Error('Global environment not found');
  const updated = { ...existing, variables };
  await idbPut(STORES.GLOBAL_ENVIRONMENTS, updated);
  return updated;
};

export const updateGlobalEnvironmentColor = async ({ environmentUid, color }) => {
  const existing = await idbGet(STORES.GLOBAL_ENVIRONMENTS, environmentUid);
  if (!existing) throw new Error('Global environment not found');
  const updated = { ...existing, color };
  await idbPut(STORES.GLOBAL_ENVIRONMENTS, updated);
  return updated;
};

export const selectGlobalEnvironment = async ({ environmentUid, workspaceUid }) => {
  await setUiState(`global_env_active_${workspaceUid}`, environmentUid || null);
  return { environmentUid };
};

export const deleteGlobalEnvironment = async ({ environmentUid, workspaceUid }) => {
  await idbDelete(STORES.GLOBAL_ENVIRONMENTS, environmentUid);
  const activeUid = await getUiState(`global_env_active_${workspaceUid}`);
  if (activeUid === environmentUid) {
    await setUiState(`global_env_active_${workspaceUid}`, null);
  }
  return { environmentUid };
};

export const getCollectionJson = async (collectionLocation) => {
  console.log('[LocalStorage] getCollectionJson:', { collectionLocation });
  return ipcRenderer.invoke('renderer:get-collection-json', collectionLocation);
};

export const saveTransientRequest = async ({ sourceItemUid, sourceCollectionUid, targetCollectionUid, targetFolderUid, request }) => {
  const { idbGet, idbPut, idbDelete, STORES } = await import('utils/idb/localStore');
  const source = await idbGet(STORES.REQUESTS, sourceItemUid);
  const newUid = nanoid();
  const now = Date.now();
  const newRecord = {
    ...(source || {}),
    ...request,
    uid: newUid,
    collectionUid: targetCollectionUid,
    folderUid: targetFolderUid || null,
    createdAt: now,
    updatedAt: now
  };
  await idbPut(STORES.REQUESTS, newRecord);
  await idbDelete(STORES.REQUESTS, sourceItemUid);
  return newRecord;
};

export const ensureCollectionsFolder = async (workspacePath) => {
  console.log('[LocalStorage] ensureCollectionsFolder:', { workspacePath });
  return ipcRenderer.invoke('renderer:ensure-collections-folder', workspacePath);
};

export const exportCollectionZip = async (collectionPath, collectionName) => {
  console.log('[LocalStorage] exportCollectionZip:', { collectionPath, collectionName });
  return ipcRenderer.invoke('renderer:export-collection-zip', collectionPath, collectionName);
};

export const isBrunoCollectionZip = async (filePath) => {
  console.log('[LocalStorage] isBrunoCollectionZip:', { filePath });
  return ipcRenderer.invoke('renderer:is-bruno-collection-zip', filePath);
};

export const appReady = async () => {
  console.log('[LocalStorage] appReady');
  return ipcRenderer.invoke('renderer:ready');
};
