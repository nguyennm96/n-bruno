import { BrunoApiClient } from '../client';
import type { UserSearchResult } from '../types';

export class UserService {
  constructor(private client: BrunoApiClient) {}

  async searchByEmail(email: string): Promise<UserSearchResult | null> {
    const response = await this.client.getClient().get<{ data: UserSearchResult | null }>(
      '/api/users/search',
      { params: { email } }
    );
    return response.data.data;
  }
}
