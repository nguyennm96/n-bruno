import type { BrunoApiClient } from '../client';

export type ImportConflict = 'skip' | 'overwrite' | 'error';

export interface ImportResult {
  collectionUid: string;
  collectionName: string;
  imported: {
    folders: number;
    requests: number;
    examples: number;
    environments: number;
  };
  warnings: string[];
}

export class ImportService {
  constructor(private client: BrunoApiClient) {}

  async importPostman(
    workspaceUid: string,
    json: object,
    conflict: ImportConflict = 'error'
  ): Promise<ImportResult> {
    const response = await this.client.getClient().post(
      `/api/workspaces/${workspaceUid}/import/postman`,
      { json, conflict }
    );
    const d = response.data?.data;
    return {
      collectionUid: d.collectionUid,
      collectionName: d.collection_name,
      imported: d.imported,
      warnings: d.warnings || []
    };
  }

  async importInsomnia(workspaceUid: string, json: object): Promise<ImportResult> {
    const response = await this.client.getClient().post(
      `/api/workspaces/${workspaceUid}/import/insomnia`,
      { json }
    );
    const d = response.data?.data;
    return {
      collectionUid: d.collectionUid,
      collectionName: d.collection_name,
      imported: d.imported,
      warnings: d.warnings || []
    };
  }
}
