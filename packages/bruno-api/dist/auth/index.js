"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
class AuthService {
    constructor(client) {
        this.client = client;
    }
    /**
     * Register a new user account
     */
    async register(data) {
        const response = await this.client.getClient().post('/api/auth/register', data);
        return response.data;
    }
    /**
     * Login with email and password
     */
    async login(data) {
        const response = await this.client.getClient().post('/api/auth/login', data);
        // Store tokens in client
        const { access_token, refresh_token } = response.data.data;
        this.client.setTokens(access_token, refresh_token);
        return response.data;
    }
    /**
     * Logout (revoke refresh token)
     */
    async logout(refreshToken) {
        await this.client.getClient().post('/api/auth/logout', {
            refresh_token: refreshToken,
        });
        // Clear tokens from client
        this.client.clearTokens();
    }
    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        const response = await this.client.getClient().post('/api/auth/refresh', {
            refresh_token: refreshToken,
        });
        // Update tokens in client
        const { access_token, refresh_token } = response.data.data;
        this.client.setTokens(access_token, refresh_token);
        return response.data;
    }
    /**
     * Get current user info
     */
    async getMe() {
        const response = await this.client.getClient().get('/api/auth/me');
        return response.data;
    }
    /**
     * Update the current user's name and/or avatar
     */
    async updateProfile(data) {
        const response = await this.client.getClient().patch('/api/auth/me', data);
        return response.data;
    }
    /**
     * Request a 6-digit OTP sent to the user's email for password reset
     */
    async forgotPassword(email) {
        await this.client.getClient().post('/api/auth/forgot-password', { email });
    }
    /**
     * Reset password using the OTP received by email
     */
    async resetPassword(data) {
        await this.client.getClient().post('/api/auth/reset-password', data);
    }
}
exports.AuthService = AuthService;
