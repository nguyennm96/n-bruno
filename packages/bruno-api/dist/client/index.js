"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrunoApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
class BrunoApiClient {
    constructor(config) {
        this.accessToken = null;
        this.refreshToken = null;
        this.isRefreshing = false;
        this.refreshSubscribers = [];
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.baseURL,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Request interceptor - add auth token
        this.client.interceptors.request.use((config) => {
            if (this.accessToken) {
                config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return config;
        }, (error) => Promise.reject(error));
        // Response interceptor - handle 401 and auto-refresh
        this.client.interceptors.response.use((response) => response, async (error) => {
            const originalRequest = error.config;
            // If 401 and not already retrying, try to refresh token
            if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
                if (this.isRefreshing) {
                    // Wait for token refresh to complete
                    return new Promise((resolve) => {
                        this.refreshSubscribers.push((token) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(this.client(originalRequest));
                        });
                    });
                }
                originalRequest._retry = true;
                this.isRefreshing = true;
                try {
                    const newTokens = await this.refreshAccessTokenInternal();
                    this.setTokens(newTokens.accessToken, newTokens.refreshToken);
                    // Notify all waiting requests
                    this.refreshSubscribers.forEach((callback) => callback(newTokens.accessToken));
                    this.refreshSubscribers = [];
                    // Retry original request
                    originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
                    return this.client(originalRequest);
                }
                catch (refreshError) {
                    // Refresh failed - logout user
                    this.config.onAuthError?.();
                    return Promise.reject(refreshError);
                }
                finally {
                    this.isRefreshing = false;
                }
            }
            return Promise.reject(error);
        });
    }
    /**
     * Set authentication tokens
     */
    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
    /**
     * Clear authentication tokens
     */
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
    }
    /**
     * Get current access token
     */
    getAccessToken() {
        return this.accessToken;
    }
    /**
     * Get axios instance for direct use
     */
    getClient() {
        return this.client;
    }
    /**
     * Internal method to refresh access token
     */
    async refreshAccessTokenInternal() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }
        const response = await axios_1.default.post(`${this.config.baseURL}/api/auth/refresh`, {
            refresh_token: this.refreshToken,
        });
        return {
            accessToken: response.data.data.access_token,
            refreshToken: response.data.data.refresh_token,
        };
    }
}
exports.BrunoApiClient = BrunoApiClient;
