"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentService = void 0;
class EnvironmentService {
    constructor(client) {
        this.client = client;
    }
    // ── Workspace-Level Environments ───────────────────────────────────────────
    /**
     * Create a new environment in a workspace
     */
    async createEnvironment(workspaceId, data) {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceId}/environments`, data);
        return response.data.data;
    }
    /**
     * List all environments in a workspace
     */
    async listEnvironments(workspaceId) {
        const response = await this.client.getClient().get(`/api/workspaces/${workspaceId}/environments`);
        return response.data.data;
    }
    /**
     * Update an existing environment
     */
    async updateEnvironment(environmentId, data) {
        const response = await this.client.getClient().patch(`/api/environments/${environmentId}`, data);
        return response.data.data;
    }
    /**
     * Delete an environment
     */
    async deleteEnvironment(environmentId) {
        await this.client.getClient().delete(`/api/environments/${environmentId}`);
    }
    // ── Collection-Level Environments ──────────────────────────────────────────
    /**
     * Create a new environment for a specific collection
     */
    async createCollectionEnvironment(collectionId, data) {
        const response = await this.client.getClient().post(`/api/collections/${collectionId}/environments`, data);
        return response.data.data;
    }
    /**
     * List all environments for a collection
     */
    async listCollectionEnvironments(collectionId) {
        const response = await this.client.getClient().get(`/api/collections/${collectionId}/environments`);
        return response.data.data;
    }
}
exports.EnvironmentService = EnvironmentService;
