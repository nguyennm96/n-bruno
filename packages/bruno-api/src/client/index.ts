import axios, { AxiosInstance, AxiosError } from 'axios';
import type { BrunoApiConfig } from '../types';

export class BrunoApiClient {
  private client: AxiosInstance;
  private config: BrunoApiConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor(config: BrunoApiConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401, auto-refresh, and retry transient errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // If 401 and not already retrying, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
          if (this.isRefreshing) {
            // Wait for token refresh to complete
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
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

            // Persist new tokens and update Redux state
            this.config.onTokenRefresh?.(newTokens);

            // Notify all waiting requests
            this.refreshSubscribers.forEach((callback) => callback(newTokens.accessToken));
            this.refreshSubscribers = [];

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed - logout user
            this.config.onAuthError?.();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Retry transient errors (429 Rate Limit, 500 Internal Error, 503 Service Unavailable)
        const retryableStatuses = [429, 500, 503];
        const status = error.response?.status;

        if (status && retryableStatuses.includes(status)) {
          // Initialize retry count
          originalRequest._retryCount = originalRequest._retryCount || 0;

          // Max 3 retries
          if (originalRequest._retryCount < 3) {
            originalRequest._retryCount += 1;

            // Exponential backoff: 1s, 2s, 4s (capped at 10s)
            const delay = Math.min(1000 * Math.pow(2, originalRequest._retryCount - 1), 10000);

            // Log retry attempt
            console.warn(
              `🔄 Retrying request (attempt ${originalRequest._retryCount}/3) after ${delay}ms due to ${status} error`,
              { url: originalRequest.url, method: originalRequest.method }
            );

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Retry the request
            return this.client(originalRequest);
          } else {
            console.error(
              `❌ Max retries (3) exceeded for request`,
              { url: originalRequest.url, method: originalRequest.method, status }
            );
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, refreshToken: string) {
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
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get axios instance for direct use
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Internal method to refresh access token
   */
  private async refreshAccessTokenInternal(): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(`${this.config.baseURL}/api/auth/refresh`, {
      refresh_token: this.refreshToken,
    });

    return {
      accessToken: response.data.data.access_token,
      refreshToken: response.data.data.refresh_token,
    };
  }
}
