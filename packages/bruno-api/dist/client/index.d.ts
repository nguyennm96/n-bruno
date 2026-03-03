import { AxiosInstance } from 'axios';
import type { BrunoApiConfig } from '../types';
export declare class BrunoApiClient {
    private client;
    private config;
    private accessToken;
    private refreshToken;
    private isRefreshing;
    private refreshSubscribers;
    constructor(config: BrunoApiConfig);
    /**
     * Set authentication tokens
     */
    setTokens(accessToken: string, refreshToken: string): void;
    /**
     * Clear authentication tokens
     */
    clearTokens(): void;
    /**
     * Get current access token
     */
    getAccessToken(): string | null;
    /**
     * Get axios instance for direct use
     */
    getClient(): AxiosInstance;
    /**
     * Internal method to refresh access token
     */
    private refreshAccessTokenInternal;
}
