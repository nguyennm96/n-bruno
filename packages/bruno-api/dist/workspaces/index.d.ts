import { BrunoApiClient } from '../client';
import type { Workspace, WorkspaceCreateRequest, WorkspaceUpdateRequest, WorkspaceMember, AddMemberRequest, AddMemberResponse, UpdateMemberRoleRequest, WorkspaceInvite } from '../types';
export declare class WorkspaceService {
    private client;
    constructor(client: BrunoApiClient);
    /**
     * Get all workspaces for the authenticated user
     */
    getAll(): Promise<Workspace[]>;
    /**
     * Create a new workspace
     */
    create(data: WorkspaceCreateRequest): Promise<Workspace>;
    /**
     * Get workspace by ID
     */
    getById(id: string): Promise<Workspace>;
    /**
     * Update a workspace (rename, description)
     */
    update(id: string, data: WorkspaceUpdateRequest): Promise<Workspace>;
    /**
     * Get workspace members
     */
    getMembers(id: string): Promise<WorkspaceMember[]>;
    /**
     * Delete workspace (owner only)
     */
    delete(id: string): Promise<void>;
    addMember(workspaceId: string, data: AddMemberRequest): Promise<AddMemberResponse>;
    removeMember(workspaceId: string, userId: string): Promise<void>;
    updateMemberRole(workspaceId: string, userId: string, data: UpdateMemberRoleRequest): Promise<WorkspaceMember>;
    listPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]>;
    cancelInvite(workspaceId: string, inviteId: string): Promise<void>;
    leaveWorkspace(workspaceId: string): Promise<void>;
    transferOwnership(workspaceId: string, newOwnerUserId: string): Promise<void>;
}
