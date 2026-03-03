import { BrunoApiClient } from '../client';
import type { Workspace, WorkspaceCreateRequest, WorkspaceMember } from '../types';
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
     * Get workspace members
     */
    getMembers(id: string): Promise<WorkspaceMember[]>;
    /**
     * Delete workspace (owner only)
     */
    delete(id: string): Promise<void>;
}
