import { BrunoApiClient } from '../client';
import type { InviteValidationResponse } from '../types';
export declare class InviteService {
    private client;
    constructor(client: BrunoApiClient);
    validateToken(token: string): Promise<InviteValidationResponse>;
    acceptInvite(token: string): Promise<{
        workspaceUid: string;
    }>;
}
