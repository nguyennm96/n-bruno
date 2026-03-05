/**
 * Cloud mode draft request persistence.
 *
 * Thin shim over workspaceCache — all drafts are stored under
 * `bruno/workspace/{userId}/drafts` so each user's drafts are isolated.
 *
 * Callers do not need to pass userId; it is resolved from the Redux store.
 */

import {
  saveDraft as wcSaveDraft,
  removeDraft as wcRemoveDraft,
  getDraftsForCollection as wcGetDraftsForCollection,
  getAllDrafts as wcGetAllDrafts,
  clearDrafts as wcClearDrafts
} from 'utils/workspaceCache';

function getCurrentUserId() {
  return window.__REDUX_STORE__?.getState()?.auth?.user?.id || null;
}

export function saveDraft(item) {
  const userId = getCurrentUserId();
  if (!userId) return;
  wcSaveDraft(userId, item);
}

export function removeDraft(uid) {
  const userId = getCurrentUserId();
  if (!userId) return;
  wcRemoveDraft(userId, uid);
}

export function getDraftsForCollection(collectionUid) {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return wcGetDraftsForCollection(userId, collectionUid);
}

export function getAllDrafts() {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return wcGetAllDrafts(userId);
}

export function clearAllDrafts() {
  const userId = getCurrentUserId();
  if (!userId) return;
  wcClearDrafts(userId);
}
