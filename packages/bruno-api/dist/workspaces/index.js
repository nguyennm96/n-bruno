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
     * Update a workspace (rename, description)
     */
    async update(id, data) {
        const response = await this.client.getClient().patch(`/api/workspaces/${id}`, data);
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
    async addMember(workspaceId, data) {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceId}/members`, data);
        return response.data.data;
    }
    async removeMember(workspaceId, userId) {
        await this.client.getClient().delete(`/api/workspaces/${workspaceId}/members/${userId}`);
    }
    async updateMemberRole(workspaceId, userId, data) {
        const response = await this.client.getClient().patch(`/api/workspaces/${workspaceId}/members/${userId}`, data);
        return response.data.data;
    }
    async listPendingInvites(workspaceId) {
        const response = await this.client.getClient().get(`/api/workspaces/${workspaceId}/invites`);
        return response.data.data;
    }
    async cancelInvite(workspaceId, inviteId) {
        await this.client.getClient().delete(`/api/workspaces/${workspaceId}/invites/${inviteId}`);
    }
    async leaveWorkspace(workspaceId) {
        await this.client.getClient().post(`/api/workspaces/${workspaceId}/leave`);
    }
    async transferOwnership(workspaceId, newOwnerUserId) {
        await this.client.getClient().post(`/api/workspaces/${workspaceId}/transfer-ownership`, {
            new_owner_id: newOwnerUserId
        });
    }
}
exports.WorkspaceService = WorkspaceService;
