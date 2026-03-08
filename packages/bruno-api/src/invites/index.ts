import { BrunoApiClient } from '../client';
import type { InviteValidationResponse } from '../types';

export class InviteService {
  constructor(private client: BrunoApiClient) {}

  async validateToken(token: string): Promise<InviteValidationResponse> {
    const response = await this.client.getClient().get<{ data: InviteValidationResponse }>(
      '/api/invites/validate',
      { params: { token } }
    );
    return response.data.data;
  }

  async acceptInvite(token: string): Promise<{ workspaceUid: string }> {
    const response = await this.client.getClient().post<{ data: { workspace_uid: string } }>(
      '/api/invites/accept',
      { token }
    );
    return { workspaceUid: response.data.data.workspace_uid };
  }
}
