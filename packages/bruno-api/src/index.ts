export { BrunoApiClient } from './client';
export { AuthService } from './auth';
export { WorkspaceService } from './workspaces';
export { CollectionService } from './collections';
export { EnvironmentService } from './environments';
export * from './types';

// Re-export for convenience
import { BrunoApiClient } from './client';
import { AuthService } from './auth';
import { WorkspaceService } from './workspaces';
import { CollectionService } from './collections';
import { EnvironmentService } from './environments';
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

  return {
    client,
    auth,
    workspaces,
    collections,
    environments,
  };
}
