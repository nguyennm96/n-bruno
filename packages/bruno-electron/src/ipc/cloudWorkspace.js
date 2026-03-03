const { ipcMain } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

// Store for workspace-collection links
const workspaceLinksStore = new Store({
  name: 'workspace-links',
  encryptionKey: 'bruno-workspace-links-encryption-key' // Basic encryption for local data
});

/**
 * Register all cloud workspace IPC handlers
 */
const registerCloudWorkspaceIpc = () => {
  /**
   * Save collection-to-workspace link
   */
  ipcMain.handle('workspace:save-link', async (event, { workspaceId, collectionPath, collectionName, linkedAt }) => {
    try {
      // Get existing links
      const links = workspaceLinksStore.get('links', {});

      // Save link
      links[collectionPath] = {
        workspaceId,
        collectionName,
        linkedAt
      };

      workspaceLinksStore.set('links', links);

      console.log(`Linked collection "${collectionName}" to workspace ${workspaceId}`);

      return { success: true };
    } catch (error) {
      console.error('Failed to save workspace link:', error);
      throw new Error(`Failed to save workspace link: ${error.message}`);
    }
  });

  /**
   * Get all collection-to-workspace links
   */
  ipcMain.handle('workspace:get-links', async () => {
    try {
      const links = workspaceLinksStore.get('links', {});
      return links;
    } catch (error) {
      console.error('Failed to get workspace links:', error);
      return {};
    }
  });

  /**
   * Remove collection-to-workspace link
   */
  ipcMain.handle('workspace:remove-link', async (event, { collectionPath }) => {
    try {
      const links = workspaceLinksStore.get('links', {});

      if (links[collectionPath]) {
        delete links[collectionPath];
        workspaceLinksStore.set('links', links);
        console.log(`Unlinked collection at path: ${collectionPath}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to remove workspace link:', error);
      throw new Error(`Failed to remove workspace link: ${error.message}`);
    }
  });

  /**
   * Save sync metadata to .bruno/cloud-sync.json
   */
  ipcMain.handle('workspace:save-sync-metadata', async (event, { collectionPath, metadata }) => {
    try {
      const brunoDir = path.join(collectionPath, '.bruno');
      const metadataPath = path.join(brunoDir, 'cloud-sync.json');

      // Create .bruno directory if it doesn't exist
      if (!fs.existsSync(brunoDir)) {
        fs.mkdirSync(brunoDir, { recursive: true });
      }

      // Write metadata
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      console.log(`Saved sync metadata for collection at: ${collectionPath}`);

      return { success: true, path: metadataPath };
    } catch (error) {
      console.error('Failed to save sync metadata:', error);
      throw new Error(`Failed to save sync metadata: ${error.message}`);
    }
  });

  /**
   * Get sync metadata from .bruno/cloud-sync.json
   */
  ipcMain.handle('workspace:get-sync-metadata', async (event, { collectionPath }) => {
    try {
      const metadataPath = path.join(collectionPath, '.bruno', 'cloud-sync.json');

      if (!fs.existsSync(metadataPath)) {
        return null;
      }

      const content = fs.readFileSync(metadataPath, 'utf8');
      const metadata = JSON.parse(content);

      return metadata;
    } catch (error) {
      console.error('Failed to read sync metadata:', error);
      return null;
    }
  });

  /**
   * Check if collection is linked to a workspace
   */
  ipcMain.handle('workspace:is-linked', async (event, { collectionPath }) => {
    try {
      const links = workspaceLinksStore.get('links', {});
      return !!links[collectionPath];
    } catch (error) {
      console.error('Failed to check workspace link:', error);
      return false;
    }
  });

  /**
   * Get workspace ID for a linked collection
   */
  ipcMain.handle('workspace:get-workspace-id', async (event, { collectionPath }) => {
    try {
      const links = workspaceLinksStore.get('links', {});
      return links[collectionPath]?.workspaceId || null;
    } catch (error) {
      console.error('Failed to get workspace ID:', error);
      return null;
    }
  });

  console.log('Cloud workspace IPC handlers registered');
};

module.exports = registerCloudWorkspaceIpc;
