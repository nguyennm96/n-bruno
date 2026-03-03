/**
 * Auto-link collection to cloud workspace
 * Called when collection is opened/mounted
 */
export const autoLinkCollectionToCloud = async (dispatch, collection, getState) => {
  try {
    const state = getState();
    const { isAuthenticated } = state.auth;
    const { workspaces, linkedCollections } = state.cloudWorkspaces;

    // Skip if not authenticated
    if (!isAuthenticated) {
      return false;
    }

    // Skip if already linked
    const isLinked = !!linkedCollections[collection.pathname];
    if (isLinked) {
      return false;
    }

    let targetWorkspace;

    // Find or create default workspace
    const defaultWorkspace = workspaces.find((w) => w.name === 'My Collections');

    if (defaultWorkspace) {
      targetWorkspace = defaultWorkspace;
    } else {
      // Create default workspace
      const { createWorkspace } = await import('providers/ReduxStore/slices/cloudWorkspaces');
      const result = await dispatch(
        createWorkspace({
          name: 'My Collections',
          description: 'Default workspace for all collections'
        })
      ).unwrap();
      targetWorkspace = result;
    }

    // Link collection to workspace
    const { linkCollection } = await import('providers/ReduxStore/slices/cloudWorkspaces');
    await dispatch(
      linkCollection({
        workspaceId: targetWorkspace.id,
        collectionPath: collection.pathname,
        collectionName: collection.name
      })
    ).unwrap();

    console.log(`✅ Auto-linked "${collection.name}" to "${targetWorkspace.name}"`);
    return true;
  } catch (error) {
    console.error('Failed to auto-link collection:', error);
    return false;
  }
};
