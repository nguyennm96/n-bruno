/**
 * User-scoped local cache for cloud mode.
 *
 * All data is stored under the namespace `bruno/workspace/{userId}/` in localStorage,
 * isolating each user's state (tabs, UI selections, drafts, sync metadata).
 *
 * This is the local-first layer — data is read immediately on startup and synced
 * with the cloud server in the background.
 */

const NS = (userId) => `bruno/workspace/${userId}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function read(userId, key) {
  try {
    const raw = localStorage.getItem(`${NS(userId)}/${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(userId, key, value) {
  try {
    localStorage.setItem(`${NS(userId)}/${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn(`[WorkspaceCache] Failed to write ${key}:`, e?.message);
  }
}

function remove(userId, key) {
  try {
    localStorage.removeItem(`${NS(userId)}/${key}`);
  } catch {}
}

// ─── App State (tabs + active workspace) ─────────────────────────────────────

/**
 * @returns {{ tabs: Array, activeTabUid: string|null, activeWorkspaceUid: string|null } | null}
 */
export function getAppState(userId) {
  return read(userId, 'app_state');
}

/**
 * @param {string} userId
 * @param {{ tabs: Array, activeTabUid: string|null, activeWorkspaceUid: string|null }} state
 */
export function saveAppState(userId, state) {
  write(userId, 'app_state', state);
}

// ─── Collection UI State (selected environment per collection) ────────────────

/**
 * @returns {{ [collectionUid: string]: { selectedEnvironment: string|null } }}
 */
export function getCollectionUiState(userId) {
  return read(userId, 'collection_ui') || {};
}

/**
 * @param {string} userId
 * @param {{ [collectionUid: string]: { selectedEnvironment: string|null } }} uiState
 */
export function saveCollectionUiState(userId, uiState) {
  write(userId, 'collection_ui', uiState);
}

/**
 * Update the selected environment for a single collection.
 * @param {string|null} activeEnvironmentUid  environment UID (null to deselect)
 */
export function updateCollectionEnvironment(userId, collectionUid, activeEnvironmentUid) {
  const current = getCollectionUiState(userId);
  saveCollectionUiState(userId, {
    ...current,
    [collectionUid]: { ...current[collectionUid], activeEnvironmentUid }
  });
}

// ─── Draft Requests ───────────────────────────────────────────────────────────

export function getAllDrafts(userId) {
  return read(userId, 'drafts') || [];
}

export function saveDraft(userId, item) {
  const drafts = getAllDrafts(userId).filter((d) => d.uid !== item.uid);
  drafts.push(item);
  write(userId, 'drafts', drafts);
}

export function removeDraft(userId, uid) {
  const drafts = getAllDrafts(userId).filter((d) => d.uid !== uid);
  write(userId, 'drafts', drafts);
}

export function getDraftsForCollection(userId, collectionUid) {
  return getAllDrafts(userId).filter((d) => d.collectionUid === collectionUid);
}

export function clearDrafts(userId) {
  remove(userId, 'drafts');
}

// ─── Sync Metadata (version tracking for team sync) ──────────────────────────

/**
 * @returns {{ [collectionUid: string]: { server_updated_at: string, last_synced_at: string } }}
 */
export function getSyncMeta(userId) {
  return read(userId, 'sync_meta') || {};
}

/**
 * Update sync metadata for a single collection after a successful server fetch.
 * @param {string} server_updated_at  ISO timestamp from server
 */
export function updateSyncMeta(userId, collectionUid, { server_updated_at }) {
  const meta = getSyncMeta(userId);
  write(userId, 'sync_meta', {
    ...meta,
    [collectionUid]: {
      server_updated_at,
      last_synced_at: new Date().toISOString()
    }
  });
}

export function getSyncMetaForCollection(userId, collectionUid) {
  return getSyncMeta(userId)[collectionUid] || null;
}

// ─── Clear all user data (on logout) ─────────────────────────────────────────

export function clearAll(userId) {
  ['app_state', 'collection_ui', 'drafts', 'sync_meta'].forEach((key) => {
    remove(userId, key);
  });
}
