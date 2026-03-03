import type { BrunoApiClient } from '../client';
import type {
  Collection,
  CollectionItem,
  CollectionItemCreateRequest,
  CollectionItemUpdateRequest,
  ApiResponse
} from '../types';

export class CollectionService {
  constructor(private client: BrunoApiClient) {}

  /**
   * Get all items in a workspace/collection
   */
  async getItems(workspaceId: string): Promise<CollectionItem[]> {
    const response = await this.client.getClient().get<ApiResponse<CollectionItem[]>>(
      `/api/workspaces/${workspaceId}/items`
    );
    return response.data.data;
  }

  /**
   * Create a new item (request/folder) in a collection
   */
  async createItem(
    workspaceId: string,
    data: CollectionItemCreateRequest
  ): Promise<CollectionItem> {
    const response = await this.client.getClient().post<ApiResponse<CollectionItem>>(
      `/api/workspaces/${workspaceId}/items`,
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
}
