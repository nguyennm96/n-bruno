"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionService = void 0;
class CollectionService {
    constructor(client) {
        this.client = client;
    }
    // ── Collection CRUD ────────────────────────────────────────────────────────
    /**
     * Create a new collection in a workspace
     */
    async createCollection(workspaceId, data) {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceId}/collections`, data);
        return response.data.data;
    }
    /**
     * Get all collections in a workspace
     */
    async listCollections(workspaceId) {
        const response = await this.client.getClient().get(`/api/workspaces/${workspaceId}/collections`);
        return response.data.data;
    }
    /**
     * Get a single collection by ID
     */
    async getCollection(collectionId) {
        const response = await this.client.getClient().get(`/api/collections/${collectionId}`);
        return response.data.data;
    }
    /**
     * Update a collection
     */
    async updateCollection(collectionId, data) {
        const response = await this.client.getClient().patch(`/api/collections/${collectionId}`, data);
        return response.data.data;
    }
    /**
     * Delete a collection
     */
    async deleteCollection(collectionId) {
        await this.client.getClient().delete(`/api/collections/${collectionId}`);
    }
    /**
     * Clone a collection (deep copy with all items)
     */
    async cloneCollection(collectionId, data) {
        const response = await this.client.getClient().post(`/api/collections/${collectionId}/clone`, data);
        return response.data.data;
    }
    /**
     * Resequence items in a collection (bulk sort_order update)
     */
    async resequenceItems(collectionId, data) {
        const response = await this.client.getClient().patch(`/api/collections/${collectionId}/resequence`, data);
        return response.data.data;
    }
    // ── Collection Items ───────────────────────────────────────────────────────
    /**
     * Get all items (folders + requests) in a collection as tree structure
     */
    async getItems(collectionId) {
        const response = await this.client.getClient().get(`/api/collections/${collectionId}/items`);
        return response.data.data;
    }
    /**
     * Get collections with their items (tree structure) for a workspace
     * This is a helper method that combines listCollections + getItems calls
     */
    async getCollectionsTreeByWorkspace(workspaceId) {
        // First, get all collections
        const collections = await this.listCollections(workspaceId);
        // Then, fetch items for each collection
        const collectionsWithItems = await Promise.all(collections.map(async (collection) => {
            const items = await this.getItems(collection.id);
            return {
                ...collection,
                items
            };
        }));
        return collectionsWithItems;
    }
    /**
     * Create a new folder in a collection
     */
    async createFolder(collectionId, data) {
        const response = await this.client.getClient().post(`/api/collections/${collectionId}/folders`, data);
        return response.data.data;
    }
    /**
     * Create a new request in a collection
     */
    async createRequest(collectionId, data) {
        const response = await this.client.getClient().post(`/api/collections/${collectionId}/requests`, data);
        return response.data.data;
    }
    /**
     * Update an existing item
     */
    async updateItem(itemId, data) {
        const response = await this.client.getClient().patch(`/api/items/${itemId}`, data);
        return response.data.data;
    }
    /**
     * Delete an item
     */
    async deleteItem(itemId) {
        await this.client.getClient().delete(`/api/items/${itemId}`);
    }
    /**
     * Clone an item (shallow for requests, deep for folders)
     */
    async cloneItem(itemId, data) {
        const response = await this.client.getClient().post(`/api/items/${itemId}/clone`, data);
        return response.data.data;
    }
    /**
     * Move an item to a different parent or position
     */
    async moveItem(itemId, data) {
        const response = await this.client.getClient().patch(`/api/items/${itemId}/move`, data);
        return response.data.data;
    }
    /**
     * Get item by path (for sync lookups)
     */
    async getItemByPath(workspaceId, path) {
        try {
            const response = await this.client.getClient().get(`/api/workspaces/${workspaceId}/items/by-path`, {
                params: { path }
            });
            return response.data.data;
        }
        catch (error) {
            if (error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Bulk sync items (upload multiple changes at once)
     */
    async syncItems(workspaceId, items) {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceId}/sync`, { items });
        return response.data.data;
    }
    // ── Stub Methods (Not Yet Implemented in Backend) ─────────────────────────
    /**
     * Export a collection as Postman JSON format
     */
    async exportCollection(collectionId, format = 'postman') {
        const response = await this.client.getClient().get(`/api/collections/${collectionId}/export?format=${format}`, { responseType: 'blob' });
        return response.data;
    }
    /**
     * Update collection security config
     * TODO: Implement backend endpoint (Priority 3)
     * For now, returns success without persisting
     */
    async updateSecurityConfig(collectionId, securityConfig) {
        console.warn('⚠️  Security config not implemented in backend yet - returning stub');
        return { success: true, securityConfig };
    }
    /**
     * Get collection security config
     * TODO: Implement backend endpoint (Priority 3)
     */
    async getSecurityConfig(collectionId) {
        console.warn('⚠️  Security config not implemented in backend yet - returning stub');
        return { securityConfig: {} };
    }
}
exports.CollectionService = CollectionService;
