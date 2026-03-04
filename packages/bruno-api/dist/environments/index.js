"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentService = void 0;
class EnvironmentService {
    constructor(client) {
        this.client = client;
    }
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
}
exports.EnvironmentService = EnvironmentService;
