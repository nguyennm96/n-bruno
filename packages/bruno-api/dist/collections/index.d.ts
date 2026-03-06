import type { BrunoApiClient } from '../client';
import type { Collection, CollectionItem, CollectionItemCreateRequest, CollectionItemUpdateRequest, CollectionCreateRequest, CollectionUpdateRequest, CloneCollectionRequest, ResequenceItemsRequest } from '../types';
export declare class CollectionService {
    private client;
    constructor(client: BrunoApiClient);
    /**
     * Create a new collection in a workspace
     */
    createCollection(workspaceId: string, data: CollectionCreateRequest): Promise<Collection>;
    /**
     * Get all collections in a workspace
     */
    listCollections(workspaceId: string): Promise<Collection[]>;
    /**
     * Get a single collection by ID
     */
    getCollection(collectionId: string): Promise<Collection>;
    /**
     * Update a collection
     */
    updateCollection(collectionId: string, data: CollectionUpdateRequest): Promise<Collection>;
    /**
     * Delete a collection
     */
    deleteCollection(collectionId: string): Promise<void>;
    /**
     * Clone a collection (deep copy with all items)
     */
    cloneCollection(collectionId: string, data: CloneCollectionRequest): Promise<Collection>;
    /**
     * Resequence items in a collection (bulk sort_order update)
     */
    resequenceItems(collectionId: string, data: ResequenceItemsRequest): Promise<{
        updated: number;
    }>;
    /**
     * Get all items (folders + requests) in a collection as tree structure
     */
    getItems(collectionId: string): Promise<CollectionItem[]>;
    /**
     * Get collections with their items (tree structure) for a workspace
     * This is a helper method that combines listCollections + getItems calls
     */
    getCollectionsTreeByWorkspace(workspaceId: string): Promise<any[]>;
    /**
     * Create a new folder in a collection
     */
    createFolder(collectionId: string, data: {
        name: string;
        parentUid?: string;
        seq?: number;
    }): Promise<CollectionItem>;
    /**
     * Create a new request in a collection
     */
    createRequest(collectionId: string, data: {
        name: string;
        parentUid?: string;
        seq?: number;
        request?: any;
        settings?: any;
        method?: string;
        url?: string;
    }): Promise<CollectionItem>;
    /**
     * Update an existing item
     */
    updateItem(itemId: string, data: CollectionItemUpdateRequest): Promise<CollectionItem>;
    /**
     * Delete an item
     */
    deleteItem(itemId: string): Promise<void>;
    /**
     * Clone an item (shallow for requests, deep for folders)
     */
    cloneItem(itemId: string, data: {
        new_name: string;
        target_parent_id?: string;
    }): Promise<CollectionItem>;
    /**
     * Move an item to a different parent or position
     */
    moveItem(itemId: string, data: {
        new_parent_id?: string;
        seq?: number;
    }): Promise<CollectionItem>;
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
    /**
     * Export a collection as Postman JSON format
     */
    exportCollection(collectionId: string, format?: string): Promise<Blob>;
    /**
     * Update collection security config
     * TODO: Implement backend endpoint (Priority 3)
     * For now, returns success without persisting
     */
    updateSecurityConfig(collectionId: string, securityConfig: any): Promise<any>;
    /**
     * Get collection security config
     * TODO: Implement backend endpoint (Priority 3)
     */
    getSecurityConfig(collectionId: string): Promise<any>;
}
