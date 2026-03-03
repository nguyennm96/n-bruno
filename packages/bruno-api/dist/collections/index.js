"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionService = void 0;
class CollectionService {
    constructor(client) {
        this.client = client;
    }
    /**
     * Get all items in a workspace/collection
     */
    async getItems(workspaceId) {
        const response = await this.client.getClient().get(`/api/workspaces/${workspaceId}/items`);
        return response.data.data;
    }
    /**
     * Create a new item (request/folder) in a collection
     */
    async createItem(workspaceId, data) {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceId}/items`, data);
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
}
exports.CollectionService = CollectionService;
