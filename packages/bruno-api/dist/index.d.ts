export { BrunoApiClient } from './client';
export { AuthService } from './auth';
export { WorkspaceService } from './workspaces';
export { CollectionService } from './collections';
export { EnvironmentService } from './environments';
export { WsService } from './ws';
export { SyncService } from './sync';
export { ImportService } from './import';
export { ExampleService } from './examples';
export { InviteService } from './invites';
export { UserService } from './users';
export { AiService } from './ai';
export * from './types';
import { BrunoApiClient } from './client';
import { AuthService } from './auth';
import { WorkspaceService } from './workspaces';
import { CollectionService } from './collections';
import { EnvironmentService } from './environments';
import { WsService } from './ws';
import { SyncService } from './sync';
import { ImportService } from './import';
import { ExampleService } from './examples';
import { InviteService } from './invites';
import { UserService } from './users';
import { AiService } from './ai';
import type { BrunoApiConfig } from './types';
/**
 * Create a configured Bruno API instance
 */
export declare function createBrunoApi(config: BrunoApiConfig): {
    client: BrunoApiClient;
    auth: AuthService;
    workspaces: WorkspaceService;
    collections: CollectionService;
    environments: EnvironmentService;
    ws: WsService;
    sync: SyncService;
    import: ImportService;
    examples: ExampleService;
    invites: InviteService;
    users: UserService;
    ai: AiService;
};
