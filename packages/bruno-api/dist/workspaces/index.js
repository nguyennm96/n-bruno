"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
class WorkspaceService {
    constructor(client) {
        this.client = client;
    }
    /**
     * Get all workspaces for the authenticated user
     */
    async getAll() {
        const response = await this.client.getClient().get('/api/workspaces');
        return response.data.data;
    }
    /**
     * Create a new workspace
     */
    async create(data) {
        const response = await this.client.getClient().post('/api/workspaces', data);
        return response.data.data;
    }
    /**
     * Get workspace by ID
     */
    async getById(id) {
        const response = await this.client.getClient().get(`/api/workspaces/${id}`);
        return response.data.data;
    }
    /**
     * Get workspace members
     */
    async getMembers(id) {
        const response = await this.client
            .getClient()
            .get(`/api/workspaces/${id}/members`);
        return response.data.data;
    }
    /**
     * Delete workspace (owner only)
     */
    async delete(id) {
        await this.client.getClient().delete(`/api/workspaces/${id}`);
    }
}
exports.WorkspaceService = WorkspaceService;
