import type { BrunoApiClient } from '../client';
export interface WorkspaceChanges {
    serverTime: string;
    collections: any[];
    items: any[];
    environments: any[];
    examples: any[];
    deletions: Array<{
        resource_type: string;
        uid: string;
        deleted_at: string;
    }>;
}
export declare class SyncService {
    private client;
    constructor(client: BrunoApiClient);
    getChanges(workspaceUid: string, since?: string): Promise<WorkspaceChanges>;
}
