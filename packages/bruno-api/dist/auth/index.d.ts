import { BrunoApiClient } from '../client';
import type { RegisterRequest, LoginRequest, AuthResponse, UserResponse, TokenResponse, UpdateProfileRequest, UpdateProfileResponse, ResetPasswordRequest } from '../types';
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
    /**
     * Update the current user's name and/or avatar
     */
    updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse>;
    /**
     * Request a 6-digit OTP sent to the user's email for password reset
     */
    forgotPassword(email: string): Promise<void>;
    /**
     * Reset password using the OTP received by email
     */
    resetPassword(data: ResetPasswordRequest): Promise<void>;
}
