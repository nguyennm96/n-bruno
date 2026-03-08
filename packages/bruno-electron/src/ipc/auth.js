const { ipcMain, safeStorage, shell } = require('electron');
const Store = require('electron-store');
const https = require('https');
const http = require('http');
const { safeParseJSON, safeStringifyJSON } = require('../utils/common');

// Encrypted store for sensitive data
// Note: electron-store will be installed as dependency
const authStore = new Store({
  name: 'bruno-auth',
  encryptionKey: 'bruno-cloud-auth-v1' // Additional encryption layer
});

/**
 * Save authentication tokens securely
 * Uses Electron's safeStorage API for encryption
 */
const saveTokens = async (event, { accessToken, refreshToken }) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('Encryption not available, falling back to electron-store encryption');

      // Fallback to electron-store's encryption
      authStore.set('tokens', {
        accessToken,
        refreshToken,
        savedAt: Date.now()
      });

      return { success: true };
    }

    // Encrypt tokens using OS keychain
    const encryptedAccessToken = safeStorage.encryptString(accessToken);
    const encryptedRefreshToken = safeStorage.encryptString(refreshToken);

    // Save encrypted buffers as base64 strings
    authStore.set('encryptedTokens', {
      accessToken: encryptedAccessToken.toString('base64'),
      refreshToken: encryptedRefreshToken.toString('base64'),
      savedAt: Date.now()
    });

    console.log('Tokens saved securely');
    return { success: true };
  } catch (error) {
    console.error('Failed to save tokens:', error);
    throw new Error(`Failed to save tokens: ${error.message}`);
  }
};

/**
 * Retrieve authentication tokens
 */
const getTokens = async () => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      // Get from fallback storage
      const tokens = authStore.get('tokens');

      if (!tokens) {
        return null;
      }

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    }

    // Get encrypted tokens
    const encryptedTokens = authStore.get('encryptedTokens');

    if (!encryptedTokens) {
      return null;
    }

    // Decrypt tokens
    const accessTokenBuffer = Buffer.from(encryptedTokens.accessToken, 'base64');
    const refreshTokenBuffer = Buffer.from(encryptedTokens.refreshToken, 'base64');

    const accessToken = safeStorage.decryptString(accessTokenBuffer);
    const refreshToken = safeStorage.decryptString(refreshTokenBuffer);

    return {
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('Failed to retrieve tokens:', error);

    // Clear corrupted data
    authStore.delete('encryptedTokens');
    authStore.delete('tokens');

    return null;
  }
};

/**
 * Save user profile to store for session restore
 */
const saveUser = async (event, user) => {
  try {
    authStore.set('cachedUser', {
      id: user.id,
      name: user.name,
      email: user.email,
      savedAt: Date.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to save user cache:', error);
    return { success: false };
  }
};

/**
 * Retrieve cached user profile
 */
const getUser = async () => {
  try {
    return authStore.get('cachedUser') || null;
  } catch (error) {
    console.error('Failed to retrieve user cache:', error);
    return null;
  }
};

/**
 * Clear cached user profile
 */
const clearUser = async () => {
  try {
    authStore.delete('cachedUser');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear user cache:', error);
    return { success: false };
  }
};

/**
 * Clear authentication tokens
 */
const clearTokens = async () => {
  try {
    authStore.delete('encryptedTokens');
    authStore.delete('tokens');
    console.log('Tokens cleared');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    throw new Error(`Failed to clear tokens: ${error.message}`);
  }
};

/**
 * Check if tokens exist
 */
const hasTokens = async () => {
  try {
    const encryptedTokens = authStore.get('encryptedTokens');
    const fallbackTokens = authStore.get('tokens');

    return {
      hasTokens: !!(encryptedTokens || fallbackTokens)
    };
  } catch (error) {
    return { hasTokens: false };
  }
};

/**
 * Start OAuth flow for a given provider (google | github).
 * Fetches the authorization URL from the server, then opens it in the system browser.
 * The result comes back via bruno:// protocol → deeplink.js → 'oauth:callback' IPC event.
 */
const startOAuthFlow = async (event, { provider, serverUrl }) => {
  const baseUrl = serverUrl || process.env.VITE_BRUNO_SERVER_URL || 'http://localhost:8080';
  const authorizeUrl = `${baseUrl}/api/auth/oauth/${provider}/authorize`;

  return new Promise((resolve, reject) => {
    const client = authorizeUrl.startsWith('https') ? https : http;
    const req = client.get(authorizeUrl, { headers: { Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const url = parsed?.data?.url;
          if (!url) {
            return reject(new Error('No OAuth URL returned from server'));
          }
          shell.openExternal(url);
          resolve({ success: true });
        } catch (e) {
          reject(new Error(`Failed to parse OAuth URL response: ${e.message}`));
        }
      });
    });
    req.on('error', (e) => reject(new Error(`Failed to fetch OAuth URL: ${e.message}`)));
    req.end();
  });
};

/**
 * Register auth IPC handlers
 */
const registerAuthIpc = () => {
  // Save tokens
  ipcMain.handle('auth:save-tokens', saveTokens);

  // Get tokens
  ipcMain.handle('auth:get-tokens', getTokens);

  // Clear tokens
  ipcMain.handle('auth:clear-tokens', clearTokens);

  // Check if tokens exist
  ipcMain.handle('auth:has-tokens', hasTokens);

  // User profile cache (for session restore without network)
  ipcMain.handle('auth:save-user', saveUser);
  ipcMain.handle('auth:get-user', getUser);
  ipcMain.handle('auth:clear-user', clearUser);

  // OAuth social login — opens system browser with provider's auth page
  ipcMain.handle('auth:start-oauth-flow', startOAuthFlow);

  console.log('Auth IPC handlers registered');
};

module.exports = registerAuthIpc;
