import { useSelector } from 'react-redux';
import { useMemo } from 'react';

/**
 * Hook to get collections that works for both local and cloud modes
 * Returns the appropriate collections array based on authentication state
 * Note: cloudWorkspaces (workspace linking) removed - now only returns local collections
 */
export const useCollections = () => {
  const localCollections = useSelector((state) => state.collections.collections);

  const collections = useMemo(() => {
    // Return local filesystem collections
    // TODO: Cloud collections will be synced directly to collections state
    return localCollections;
  }, [localCollections]);

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
