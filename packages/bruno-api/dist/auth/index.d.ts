import { BrunoApiClient } from '../client';
import type { RegisterRequest, LoginRequest, AuthResponse, UserResponse, TokenResponse } from '../types';
export declare class AuthService {
    private client;
    constructor(client: BrunoApiClient);
    /**
     * Register a new user account
     */
    register(data: RegisterRequest): Promise<AuthResponse>;
    /**
     * Login with email and password
     */
    login(data: LoginRequest): Promise<AuthResponse>;
    /**
     * Logout (revoke refresh token)
     */
    logout(refreshToken: string): Promise<void>;
    /**
     * Refresh access token
     */
    refreshToken(refreshToken: string): Promise<TokenResponse>;
    /**
     * Get current user info
     */
    getMe(): Promise<UserResponse>;
}
