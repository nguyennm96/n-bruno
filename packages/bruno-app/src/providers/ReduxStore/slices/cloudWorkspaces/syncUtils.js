/**
 * Sync utilities for cloud-local data synchronization
 * Implements conflict resolution based on timestamps
 */

/**
 * Compare timestamps and determine which version is newer
 * @param {string|Date} localTimestamp - Local update timestamp
 * @param {string|Date} cloudTimestamp - Cloud update timestamp
 * @returns {'local'|'cloud'|'conflict'} - Which version is newer
 */
export const compareTimestamps = (localTimestamp, cloudTimestamp) => {
  if (!localTimestamp && !cloudTimestamp) return 'conflict';
  if (!localTimestamp) return 'cloud';
  if (!cloudTimestamp) return 'local';

  const localTime = new Date(localTimestamp).getTime();
  const cloudTime = new Date(cloudTimestamp).getTime();

  if (localTime > cloudTime) return 'local';
  if (cloudTime > localTime) return 'cloud';
  return 'conflict'; // Same timestamp - needs manual resolution
};

/**
 * Merge workspace data prioritizing newer version
 * @param {Object} localWorkspace - Local workspace data
 * @param {Object} cloudWorkspace - Cloud workspace data
 * @returns {Object} - Merged workspace with conflict markers
 */
export const mergeWorkspaceData = (localWorkspace, cloudWorkspace) => {
  const result = compareTimestamps(localWorkspace.updatedAt, cloudWorkspace.updated_at);

  switch (result) {
    case 'local':
      return {
        ...cloudWorkspace,
        ...localWorkspace,
        _syncStatus: 'local-newer',
        _needsUpload: true
      };

    case 'cloud':
      return {
        ...localWorkspace,
        ...cloudWorkspace,
        _syncStatus: 'cloud-newer',
        _needsDownload: true
      };

    case 'conflict':
      return {
        ...cloudWorkspace,
        _syncStatus: 'conflict',
        _localVersion: localWorkspace,
        _cloudVersion: cloudWorkspace,
        _needsResolution: true
      };

    default:
      return cloudWorkspace;
  }
};

/**
 * Merge collection items prioritizing newer version
 * @param {Array} localItems - Local collection items
 * @param {Array} cloudItems - Cloud collection items
 * @returns {Object} - { merged: Array, conflicts: Array, needsUpload: Array }
 */
export const mergeCollectionItems = (localItems = [], cloudItems = []) => {
  const merged = [];
  const conflicts = [];
  const needsUpload = [];

  // Create maps for quick lookup
  const localMap = new Map(localItems.map((item) => [item.uid || item.id, item]));
  const cloudMap = new Map(cloudItems.map((item) => [item.id || item.uid, item]));

  // Process cloud items
  cloudItems.forEach((cloudItem) => {
    const itemId = cloudItem.id || cloudItem.uid;
    const localItem = localMap.get(itemId);

    if (!localItem) {
      // Cloud-only item - download
      merged.push({
        ...cloudItem,
        _syncStatus: 'cloud-only'
      });
    } else {
      // Item exists in both - compare timestamps
      const result = compareTimestamps(localItem.updatedAt, cloudItem.updated_at);

      switch (result) {
        case 'local':
          merged.push({
            ...cloudItem,
            ...localItem,
            _syncStatus: 'local-newer'
          });
          needsUpload.push(localItem);
          break;

        case 'cloud':
          merged.push({
            ...localItem,
            ...cloudItem,
            _syncStatus: 'cloud-newer'
          });
          break;

        case 'conflict':
          conflicts.push({
            id: itemId,
            local: localItem,
            cloud: cloudItem
          });
          merged.push({
            ...cloudItem,
            _syncStatus: 'conflict',
            _localVersion: localItem,
            _cloudVersion: cloudItem
          });
          break;
      }

      localMap.delete(itemId);
    }
  });

  // Process remaining local-only items
  localMap.forEach((localItem) => {
    merged.push({
      ...localItem,
      _syncStatus: 'local-only'
    });
    needsUpload.push(localItem);
  });

  return { merged, conflicts, needsUpload };
};

/**
 * Auto-resolve conflicts using last-write-wins strategy
 * @param {Object} conflict - Conflict object with local and cloud versions
 * @returns {Object} - Resolved item
 */
export const autoResolveConflict = (conflict) => {
  const result = compareTimestamps(conflict.local?.updatedAt, conflict.cloud?.updated_at);

  if (result === 'local') {
    return { ...conflict.local, _resolvedBy: 'auto-last-write-wins' };
  }

  return { ...conflict.cloud, _resolvedBy: 'auto-last-write-wins' };
};

/**
 * Check if sync is needed based on last sync timestamp
 * @param {string|Date} lastSyncTime - Last successful sync timestamp
 * @param {number} intervalMinutes - Minimum interval between syncs (default: 5 minutes)
 * @returns {boolean} - Whether sync is needed
 */
export const shouldSync = (lastSyncTime, intervalMinutes = 5) => {
  if (!lastSyncTime) return true;

  const lastSync = new Date(lastSyncTime).getTime();
  const now = Date.now();
  const intervalMs = intervalMinutes * 60 * 1000;

  return (now - lastSync) >= intervalMs;
};
