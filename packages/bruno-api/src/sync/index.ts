import type { BrunoApiClient } from '../client';
import type { ApiResponse } from '../types';

export interface WorkspaceChanges {
  serverTime: string;
  collections: any[];
  items: any[];
  environments: any[];
  examples: any[];
  deletions: Array<{ resource_type: string; uid: string; deleted_at: string }>;
}

export class SyncService {
  constructor(private client: BrunoApiClient) {}

  async getChanges(workspaceUid: string, since?: string): Promise<WorkspaceChanges> {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await this.client.getClient().get<ApiResponse<WorkspaceChanges>>(
      `/api/workspaces/${workspaceUid}/changes${params}`
    );
    return response.data.data;
  }
}
