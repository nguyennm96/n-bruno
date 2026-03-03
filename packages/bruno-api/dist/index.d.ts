export { BrunoApiClient } from './client';
export { AuthService } from './auth';
export { WorkspaceService } from './workspaces';
export { CollectionService } from './collections';
export * from './types';
import { BrunoApiClient } from './client';
import { AuthService } from './auth';
import { WorkspaceService } from './workspaces';
import { CollectionService } from './collections';
import type { BrunoApiConfig } from './types';
/**
 * Create a configured Bruno API instance
 */
export declare function createBrunoApi(config: BrunoApiConfig): {
    client: BrunoApiClient;
    auth: AuthService;
    workspaces: WorkspaceService;
    collections: CollectionService;
};
