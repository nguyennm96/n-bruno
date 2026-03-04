import type { BrunoApiClient } from '../client';
import type {
  Collection,
  CollectionItem,
  CollectionItemCreateRequest,
  CollectionItemUpdateRequest,
  CollectionCreateRequest,
  CollectionUpdateRequest,
  CloneCollectionRequest,
  ResequenceItemsRequest,
  ApiResponse
} from '../types';

export class CollectionService {
  constructor(private client: BrunoApiClient) {}

  // ── Collection CRUD ────────────────────────────────────────────────────────

  /**
   * Create a new collection in a workspace
   */
  async createCollection(
    workspaceId: string,
    data: CollectionCreateRequest
  ): Promise<Collection> {
    const response = await this.client.getClient().post<ApiResponse<Collection>>(
      `/api/workspaces/${workspaceId}/collections`,
      data
    );
    return response.data.data;
  }

  /**
   * Get all collections in a workspace
   */
  async listCollections(workspaceId: string): Promise<Collection[]> {
    const response = await this.client.getClient().get<ApiResponse<Collection[]>>(
      `/api/workspaces/${workspaceId}/collections`
    );
    return response.data.data;
  }

  /**
   * Get a single collection by ID
   */
  async getCollection(collectionId: string): Promise<Collection> {
    const response = await this.client.getClient().get<ApiResponse<Collection>>(
      `/api/collections/${collectionId}`
    );
    return response.data.data;
  }

  /**
   * Update a collection
   */
  async updateCollection(
    collectionId: string,
    data: CollectionUpdateRequest
  ): Promise<Collection> {
    const response = await this.client.getClient().patch<ApiResponse<Collection>>(
      `/api/collections/${collectionId}`,
      data
    );
    return response.data.data;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionId: string): Promise<void> {
    await this.client.getClient().delete(`/api/collections/${collectionId}`);
  }

  /**
   * Clone a collection (deep copy with all items)
   */
  async cloneCollection(
    collectionId: string,
    data: CloneCollectionRequest
  ): Promise<Collection> {
    const response = await this.client.getClient().post<ApiResponse<Collection>>(
      `/api/collections/${collectionId}/clone`,
      data
    );
    return response.data.data;
  }

  /**
   * Resequence items in a collection (bulk sort_order update)
   */
  async resequenceItems(
    collectionId: string,
    data: ResequenceItemsRequest
  ): Promise<{ updated: number }> {
    const response = await this.client.getClient().patch<ApiResponse<{ updated: number }>>(
      `/api/collections/${collectionId}/resequence`,
      data
    );
    return response.data.data;
  }

  // ── Collection Items ───────────────────────────────────────────────────────

  /**
   * Get all items (folders + requests) in a collection as tree structure
   */
  async getItems(collectionId: string): Promise<CollectionItem[]> {
    const response = await this.client.getClient().get<ApiResponse<CollectionItem[]>>(
      `/api/collections/${collectionId}/items`
    );
    return response.data.data;
  }

  /**
   * Get collections with their items (tree structure) for a workspace
   * This is a helper method that combines listCollections + getItems calls
   */
  async getCollectionsTreeByWorkspace(workspaceId: string): Promise<any[]> {
    // First, get all collections
    const collections = await this.listCollections(workspaceId);

    // Then, fetch items for each collection
    const collectionsWithItems = await Promise.all(
      collections.map(async (collection) => {
        const items = await this.getItems(collection.id);
        return {
          ...collection,
          items
        };
      })
    );

    return collectionsWithItems;
  }

  /**
   * Create a new folder in a collection
   */
  async createFolder(
    collectionId: string,
    data: {
      name: string;
      parent_item_id?: string;
      sort_order?: number;
    }
  ): Promise<CollectionItem> {
    const response = await this.client.getClient().post<ApiResponse<CollectionItem>>(
      `/api/collections/${collectionId}/folders`,
      data
    );
    return response.data.data;
  }

  /**
   * Create a new request in a collection
   */
  async createRequest(
    collectionId: string,
    data: {
      name: string;
      parent_item_id?: string;
      sort_order?: number;
      request?: any;
      settings?: any;
      method?: string;
      url?: string;
    }
  ): Promise<CollectionItem> {
    const response = await this.client.getClient().post<ApiResponse<CollectionItem>>(
      `/api/collections/${collectionId}/requests`,
      data
    );
    return response.data.data;
  }

  /**
   * Update an existing item
   */
  async updateItem(
    itemId: string,
    data: CollectionItemUpdateRequest
  ): Promise<CollectionItem> {
    const response = await this.client.getClient().patch<ApiResponse<CollectionItem>>(
      `/api/items/${itemId}`,
      data
    );
    return response.data.data;
  }

  /**
   * Delete an item
   */
  async deleteItem(itemId: string): Promise<void> {
    await this.client.getClient().delete(`/api/items/${itemId}`);
  }

  /**
   * Clone an item (shallow for requests, deep for folders)
   */
  async cloneItem(
    itemId: string,
    data: {
      new_name: string;
      target_parent_id?: string;
    }
  ): Promise<CollectionItem> {
    const response = await this.client.getClient().post<ApiResponse<CollectionItem>>(
      `/api/items/${itemId}/clone`,
      data
    );
    return response.data.data;
  }

  /**
   * Move an item to a different parent or position
   */
  async moveItem(
    itemId: string,
    data: {
      new_parent_id?: string;
      new_sort_order?: number;
    }
  ): Promise<CollectionItem> {
    const response = await this.client.getClient().patch<ApiResponse<CollectionItem>>(
      `/api/items/${itemId}/move`,
      data
    );
    return response.data.data;
  }

  /**
   * Get item by path (for sync lookups)
   */
  async getItemByPath(workspaceId: string, path: string): Promise<CollectionItem | null> {
    try {
      const response = await this.client.getClient().get<ApiResponse<CollectionItem>>(
        `/api/workspaces/${workspaceId}/items/by-path`,
        {
          params: { path }
        }
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Bulk sync items (upload multiple changes at once)
   */
  async syncItems(
    workspaceId: string,
    items: Array<{
      path: string;
      action: 'create' | 'update' | 'delete';
      data?: CollectionItemCreateRequest | CollectionItemUpdateRequest;
    }>
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const response = await this.client.getClient().post<
      ApiResponse<{ success: number; failed: number; errors: any[] }>
    >(
      `/api/workspaces/${workspaceId}/sync`,
      { items }
    );
    return response.data.data;
  }

  // ── Stub Methods (Not Yet Implemented in Backend) ─────────────────────────

  /**
   * Export a collection as Postman JSON format
   */
  async exportCollection(collectionId: string, format: string = 'postman'): Promise<Blob> {
    const response = await this.client.getClient().get(
      `/api/collections/${collectionId}/export?format=${format}`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  /**
   * Update collection security config
   * TODO: Implement backend endpoint (Priority 3)
   * For now, returns success without persisting
   */
  async updateSecurityConfig(collectionId: string, securityConfig: any): Promise<any> {
    console.warn('⚠️  Security config not implemented in backend yet - returning stub');
    return { success: true, securityConfig };
  }

  /**
   * Get collection security config
   * TODO: Implement backend endpoint (Priority 3)
   */
  async getSecurityConfig(collectionId: string): Promise<any> {
    console.warn('⚠️  Security config not implemented in backend yet - returning stub');
    return { securityConfig: {} };
  }
}
