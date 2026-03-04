import type { BrunoApiClient } from '../client';
import type {
  Environment,
  EnvironmentCreateRequest,
  EnvironmentUpdateRequest,
  ApiResponse
} from '../types';

export class EnvironmentService {
  constructor(private client: BrunoApiClient) {}

  // ── Workspace-Level Environments ───────────────────────────────────────────

  /**
   * Create a new environment in a workspace
   */
  async createEnvironment(
    workspaceId: string,
    data: EnvironmentCreateRequest
  ): Promise<Environment> {
    const response = await this.client.getClient().post<ApiResponse<Environment>>(
      `/api/workspaces/${workspaceId}/environments`,
      data
    );
    return response.data.data;
  }

  /**
   * List all environments in a workspace
   */
  async listEnvironments(workspaceId: string): Promise<Environment[]> {
    const response = await this.client.getClient().get<ApiResponse<Environment[]>>(
      `/api/workspaces/${workspaceId}/environments`
    );
    return response.data.data;
  }

  /**
   * Update an existing environment
   */
  async updateEnvironment(
    environmentId: string,
    data: EnvironmentUpdateRequest
  ): Promise<Environment> {
    const response = await this.client.getClient().patch<ApiResponse<Environment>>(
      `/api/environments/${environmentId}`,
      data
    );
    return response.data.data;
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(environmentId: string): Promise<void> {
    await this.client.getClient().delete(`/api/environments/${environmentId}`);
  }

  // ── Collection-Level Environments ──────────────────────────────────────────

  /**
   * Create a new environment for a specific collection
   */
  async createCollectionEnvironment(
    collectionId: string,
    data: EnvironmentCreateRequest
  ): Promise<Environment> {
    const response = await this.client.getClient().post<ApiResponse<Environment>>(
      `/api/collections/${collectionId}/environments`,
      data
    );
    return response.data.data;
  }

  /**
   * List all environments for a collection
   */
  async listCollectionEnvironments(collectionId: string): Promise<Environment[]> {
    const response = await this.client.getClient().get<ApiResponse<Environment[]>>(
      `/api/collections/${collectionId}/environments`
    );
    return response.data.data;
  }
}
