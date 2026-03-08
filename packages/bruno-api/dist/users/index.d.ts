import { BrunoApiClient } from '../client';
import type { UserSearchResult } from '../types';
export declare class UserService {
    private client;
    constructor(client: BrunoApiClient);
    searchByEmail(email: string): Promise<UserSearchResult | null>;
}
