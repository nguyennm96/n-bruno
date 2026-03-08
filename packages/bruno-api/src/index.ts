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

// Re-export for convenience
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
export function createBrunoApi(config: BrunoApiConfig) {
  const client = new BrunoApiClient(config);
  const auth = new AuthService(client);
  const workspaces = new WorkspaceService(client);
  const collections = new CollectionService(client);
  const environments = new EnvironmentService(client);
  const ws = new WsService();
  const sync = new SyncService(client);
  const importService = new ImportService(client);
  const examples = new ExampleService(client);
  const invites = new InviteService(client);
  const users = new UserService(client);
  const ai = new AiService(client);

  return {
    client,
    auth,
    workspaces,
    collections,
    environments,
    ws,
    sync,
    import: importService,
    examples,
    invites,
    users,
    ai,
  };
}
