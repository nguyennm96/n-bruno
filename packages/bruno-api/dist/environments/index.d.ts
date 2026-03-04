import type { BrunoApiClient } from '../client';
import type { Environment, EnvironmentCreateRequest, EnvironmentUpdateRequest } from '../types';
export declare class EnvironmentService {
    private client;
    constructor(client: BrunoApiClient);
    /**
     * Create a new environment in a workspace
     */
    createEnvironment(workspaceId: string, data: EnvironmentCreateRequest): Promise<Environment>;
    /**
     * List all environments in a workspace
     */
    listEnvironments(workspaceId: string): Promise<Environment[]>;
    /**
     * Update an existing environment
     */
    updateEnvironment(environmentId: string, data: EnvironmentUpdateRequest): Promise<Environment>;
    /**
     * Delete an environment
     */
    deleteEnvironment(environmentId: string): Promise<void>;
    /**
     * Create a new environment for a specific collection
     */
    createCollectionEnvironment(collectionId: string, data: EnvironmentCreateRequest): Promise<Environment>;
    /**
     * List all environments for a collection
     */
    listCollectionEnvironments(collectionId: string): Promise<Environment[]>;
}
