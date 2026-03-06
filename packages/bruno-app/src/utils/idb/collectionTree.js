/**
 * Collection Tree Builder
 *
 * Assembles the nested collection tree from flat IDB records,
 * producing a structure compatible with the Redux collections slice.
 */
import { STORES, idbGet, idbGetAll, idbGetByIndex } from './localStore';

// ─── Tree Building ────────────────────────────────────────────────────────────

/**
 * Build a nested items tree from flat folder + request records.
 *
 * @param {Array} folders - Flat array of folder records from IDB
 * @param {Array} requests - Flat array of request records from IDB
 * @returns {Array} Nested items array (folders contain sub-items)
 */
export const buildItemTree = (folders, requests) => {
  // Build folder map with empty items arrays
  const folderMap = {};
  folders.forEach((f) => {
    folderMap[f.uid] = {
      uid: f.uid,
      pathname: f.uid,
      name: f.name,
      type: 'folder',
      filename: f.name,
      seq: f.seq || 0,
      collapsed: true,
      items: [],
      root: f.root || null
    };
  });

  // Place folders into hierarchy
  const rootItems = [];
  folders.forEach((f) => {
    if (f.parentUid && folderMap[f.parentUid]) {
      folderMap[f.parentUid].items.push(folderMap[f.uid]);
    } else {
      rootItems.push(folderMap[f.uid]);
    }
  });

  // Place requests into correct parent
  requests.forEach((r) => {
    const item = buildRequestItem(r);
    if (r.folderUid && folderMap[r.folderUid]) {
      folderMap[r.folderUid].items.push(item);
    } else {
      rootItems.push(item);
    }
  });

  // Sort all levels by seq
  sortBySeq(rootItems);
  Object.values(folderMap).forEach((f) => sortBySeq(f.items));

  return rootItems;
};

const buildRequestItem = (r) => ({
  uid: r.uid,
  pathname: r.uid,
  name: r.name,
  type: r.type || 'http-request',
  filename: r.filename || r.name,
  seq: r.seq || 0,
  request: r.request || {},
  settings: r.settings || { encodeUrl: true },
  examples: r.examples || []
});

const sortBySeq = (arr) => arr.sort((a, b) => (a.seq || 0) - (b.seq || 0));

// ─── Collection Loader ────────────────────────────────────────────────────────

/**
 * Load a single collection from IDB and return a Redux-compatible object.
 */
export const loadCollectionFromIdb = async (collectionUid) => {
  const collection = await idbGet(STORES.COLLECTIONS, collectionUid);
  if (!collection) return null;

  const [folders, requests, environments] = await Promise.all([
    idbGetByIndex(STORES.FOLDERS, 'collectionUid', collectionUid),
    idbGetByIndex(STORES.REQUESTS, 'collectionUid', collectionUid),
    idbGetByIndex(STORES.ENVIRONMENTS, 'collectionUid', collectionUid)
  ]);

  const items = buildItemTree(folders, requests);

  return {
    uid: collection.uid,
    name: collection.name,
    pathname: collection.uid,
    format: collection.format || 'bru',
    brunoConfig: collection.brunoConfig || { name: collection.name, version: '1' },
    root: collection.root || {},
    version: '1',
    runtimeVariables: {},
    items,
    environments: environments.map((e) => ({
      uid: e.uid,
      name: e.name,
      variables: e.variables || [],
      color: e.color || null
    }))
  };
};

/**
 * Load all collections for a workspace from IDB.
 */
export const loadWorkspaceCollectionsFromIdb = async (workspaceUid) => {
  const collections = await idbGetByIndex(STORES.COLLECTIONS, 'workspaceUid', workspaceUid);
  const results = await Promise.all(collections.map((c) => loadCollectionFromIdb(c.uid)));
  return results.filter(Boolean).sort((a, b) => (a.seq || 0) - (b.seq || 0));
};

/**
 * Load all workspaces from IDB.
 */
export const loadWorkspacesFromIdb = async () => {
  return idbGetAll(STORES.WORKSPACES);
};
