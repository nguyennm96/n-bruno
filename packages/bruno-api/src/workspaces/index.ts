import { BrunoApiClient } from '../client';
import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceUpdateRequest,
  WorkspaceListResponse,
  WorkspaceResponse,
  WorkspaceMember,
  WorkspaceMembersResponse,
  AddMemberRequest,
  AddMemberResponse,
  UpdateMemberRoleRequest,
  WorkspaceInvite,
  ApiResponse,
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
   * Update a workspace (rename, description)
   */
  async update(id: string, data: WorkspaceUpdateRequest): Promise<Workspace> {
    const response = await this.client.getClient().patch<WorkspaceResponse>(`/api/workspaces/${id}`, data);
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

  async addMember(workspaceId: string, data: AddMemberRequest): Promise<AddMemberResponse> {
    const response = await this.client.getClient().post<ApiResponse<AddMemberResponse>>(
      `/api/workspaces/${workspaceId}/members`,
      data
    );
    return response.data.data;
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.client.getClient().delete(`/api/workspaces/${workspaceId}/members/${userId}`);
  }

  async updateMemberRole(workspaceId: string, userId: string, data: UpdateMemberRoleRequest): Promise<WorkspaceMember> {
    const response = await this.client.getClient().patch<ApiResponse<WorkspaceMember>>(
      `/api/workspaces/${workspaceId}/members/${userId}`,
      data
    );
    return response.data.data;
  }

  async listPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
    const response = await this.client.getClient().get<ApiResponse<WorkspaceInvite[]>>(
      `/api/workspaces/${workspaceId}/invites`
    );
    return response.data.data;
  }

  async cancelInvite(workspaceId: string, inviteId: string): Promise<void> {
    await this.client.getClient().delete(`/api/workspaces/${workspaceId}/invites/${inviteId}`);
  }

  async leaveWorkspace(workspaceId: string): Promise<void> {
    await this.client.getClient().post(`/api/workspaces/${workspaceId}/leave`);
  }

  async transferOwnership(workspaceId: string, newOwnerUserId: string): Promise<void> {
    await this.client.getClient().post(`/api/workspaces/${workspaceId}/transfer-ownership`, {
      new_owner_id: newOwnerUserId
    });
  }
}
