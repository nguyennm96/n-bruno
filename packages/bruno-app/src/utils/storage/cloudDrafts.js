/**
 * Cloud mode draft request persistence via localStorage.
 * Drafts are saved locally so they survive app restarts,
 * but are cleared on logout.
 */

const STORAGE_KEY = 'bruno_cloud_drafts';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.warn('[CloudDrafts] Failed to persist drafts:', e?.message);
  }
}

export function saveDraft(item) {
  const drafts = readAll().filter((d) => d.uid !== item.uid);
  drafts.push(item);
  writeAll(drafts);
}

export function removeDraft(uid) {
  const drafts = readAll().filter((d) => d.uid !== uid);
  writeAll(drafts);
}

export function getDraftsForCollection(collectionUid) {
  return readAll().filter((d) => d.collectionUid === collectionUid);
}

export function getAllDrafts() {
  return readAll();
}

export function clearAllDrafts() {
  localStorage.removeItem(STORAGE_KEY);
}
