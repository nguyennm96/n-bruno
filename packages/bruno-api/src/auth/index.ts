import { BrunoApiClient } from '../client';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  AuthResponse,
  UserResponse,
  TokenResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
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

  /**
   * Update the current user's name and/or avatar
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const response = await this.client.getClient().patch<UpdateProfileResponse>('/api/auth/me', data);
    return response.data;
  }

  /**
   * Request a 6-digit OTP sent to the user's email for password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await this.client.getClient().post('/api/auth/forgot-password', { email } satisfies ForgotPasswordRequest);
  }

  /**
   * Reset password using the OTP received by email
   */
  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await this.client.getClient().post('/api/auth/reset-password', data);
  }

  /**
   * Get the OAuth authorization URL for a given provider ('google' | 'github').
   * The Electron process will open this URL in the system browser.
   */
  async oauthAuthorize(provider: string): Promise<{ url: string }> {
    const response = await this.client.getClient().get<{ data: { url: string } }>(
      `/api/auth/oauth/${provider}/authorize`
    );
    return response.data.data;
  }

  /**
   * Exchange a one-time OAuth code (from bruno:// callback) for JWT tokens.
   */
  async oauthExchange(code: string): Promise<AuthResponse> {
    const response = await this.client.getClient().post<AuthResponse>('/api/auth/oauth/exchange', { code });
    const { access_token, refresh_token } = (response.data as any).data;
    this.client.setTokens(access_token, refresh_token);
    return response.data;
  }
}
