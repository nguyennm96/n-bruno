import { useSelector } from 'react-redux';
import { useMemo } from 'react';

/**
 * Hook to get collections that works for both local and cloud modes
 * Returns the appropriate collections array based on authentication state
 */
export const useCollections = () => {
  const localCollections = useSelector((state) => state.collections.collections);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const cloudWorkspaceCollectionsTree = useSelector((state) => state.cloudWorkspaces.workspaceCollectionsTree);
  const selectedCloudWorkspaceId = useSelector((state) => state.cloudWorkspaces.selectedWorkspaceId);

  const collections = useMemo(() => {
    if (isAuthenticated && selectedCloudWorkspaceId) {
      // Cloud mode: return collections from cloud workspace tree
      return cloudWorkspaceCollectionsTree[selectedCloudWorkspaceId] || [];
    }
    // Local mode: return local filesystem collections
    return localCollections;
  }, [isAuthenticated, selectedCloudWorkspaceId, cloudWorkspaceCollectionsTree, localCollections]);

  return collections;
};

/**
 * Hook to find a specific collection by UID
 * Works for both local and cloud modes
 */
export const useCollection = (collectionUid) => {
  const collections = useCollections();

  return useMemo(() => {
    if (!collectionUid) return null;
    return collections.find((c) => c.uid === collectionUid) || null;
  }, [collections, collectionUid]);
};
