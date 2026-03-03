import { BrunoApiClient } from '../client';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  AuthResponse,
  UserResponse,
  TokenResponse,
} from '../types';

export class AuthService {
  constructor(private client: BrunoApiClient) {}

  /**
   * Register a new user account
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.getClient().post<AuthResponse>('/api/auth/register', data);
    return response.data;
  }

  /**
   * Login with email and password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.getClient().post<AuthResponse>('/api/auth/login', data);

    // Store tokens in client
    const { access_token, refresh_token } = response.data.data;
    this.client.setTokens(access_token, refresh_token);

    return response.data;
  }

  /**
   * Logout (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    await this.client.getClient().post('/api/auth/logout', {
      refresh_token: refreshToken,
    });

    // Clear tokens from client
    this.client.clearTokens();
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await this.client.getClient().post<TokenResponse>('/api/auth/refresh', {
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
  async getMe(): Promise<UserResponse> {
    const response = await this.client.getClient().get<UserResponse>('/api/auth/me');
    return response.data;
  }
}
