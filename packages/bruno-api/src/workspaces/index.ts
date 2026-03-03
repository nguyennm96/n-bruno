import { BrunoApiClient } from '../client';
import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceListResponse,
  WorkspaceResponse,
  WorkspaceMember,
  WorkspaceMembersResponse,
} from '../types';

export class WorkspaceService {
  constructor(private client: BrunoApiClient) {}

  /**
   * Get all workspaces for the authenticated user
   */
  async getAll(): Promise<Workspace[]> {
    const response = await this.client.getClient().get<WorkspaceListResponse>('/api/workspaces');
    return response.data.data;
  }

  /**
   * Create a new workspace
   */
  async create(data: WorkspaceCreateRequest): Promise<Workspace> {
    const response = await this.client.getClient().post<WorkspaceResponse>('/api/workspaces', data);
    return response.data.data;
  }

  /**
   * Get workspace by ID
   */
  async getById(id: string): Promise<Workspace> {
    const response = await this.client.getClient().get<WorkspaceResponse>(`/api/workspaces/${id}`);
    return response.data.data;
  }

  /**
   * Get workspace members
   */
  async getMembers(id: string): Promise<WorkspaceMember[]> {
    const response = await this.client
      .getClient()
      .get<WorkspaceMembersResponse>(`/api/workspaces/${id}/members`);
    return response.data.data;
  }

  /**
   * Delete workspace (owner only)
   */
  async delete(id: string): Promise<void> {
    await this.client.getClient().delete(`/api/workspaces/${id}`);
  }
}
