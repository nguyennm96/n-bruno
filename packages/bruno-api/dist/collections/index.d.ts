import type { BrunoApiClient } from '../client';
import type { CollectionItem, CollectionItemCreateRequest, CollectionItemUpdateRequest } from '../types';
export declare class CollectionService {
    private client;
    constructor(client: BrunoApiClient);
    /**
     * Get all items in a workspace/collection
     */
    getItems(workspaceId: string): Promise<CollectionItem[]>;
    /**
     * Create a new item (request/folder) in a collection
     */
    createItem(workspaceId: string, data: CollectionItemCreateRequest): Promise<CollectionItem>;
    /**
     * Update an existing item
     */
    updateItem(itemId: string, data: CollectionItemUpdateRequest): Promise<CollectionItem>;
    /**
     * Delete an item
     */
    deleteItem(itemId: string): Promise<void>;
    /**
     * Get item by path (for sync lookups)
     */
    getItemByPath(workspaceId: string, path: string): Promise<CollectionItem | null>;
    /**
     * Bulk sync items (upload multiple changes at once)
     */
    syncItems(workspaceId: string, items: Array<{
        path: string;
        action: 'create' | 'update' | 'delete';
        data?: CollectionItemCreateRequest | CollectionItemUpdateRequest;
    }>): Promise<{
        success: number;
        failed: number;
        errors: any[];
    }>;
}
