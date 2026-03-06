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
export declare class ImportService {
    private client;
    constructor(client: BrunoApiClient);
    importPostman(workspaceUid: string, json: object, conflict?: ImportConflict): Promise<ImportResult>;
    importInsomnia(workspaceUid: string, json: object): Promise<ImportResult>;
}
