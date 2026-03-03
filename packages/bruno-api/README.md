# @usebruno/api

API client for Bruno Cloud Server with authentication, auto token refresh, and type safety.

## Installation

```bash
npm install @usebruno/api
```

## Usage

```typescript
import { createBrunoApi } from '@usebruno/api';

// Create API instance
const api = createBrunoApi({
  baseURL: 'http://localhost:8080',
  onTokenRefresh: (tokens) => {
    // Save new tokens to storage
    console.log('Tokens refreshed:', tokens);
  },
  onAuthError: () => {
    // Handle auth error (e.g., redirect to login)
    console.log('Auth error - please login again');
  },
});

// Register
const registerResult = await api.auth.register({
  email: 'user@example.com',
  password: 'securepassword',
  name: 'John Doe',
});

// Login
const loginResult = await api.auth.login({
  email: 'user@example.com',
  password: 'securepassword',
});

// Access tokens are automatically stored and used
console.log('Logged in:', loginResult.data.email);

// Get current user
const user = await api.auth.getMe();
console.log('Current user:', user.data);

// Logout
await api.auth.logout(refreshToken);
```

## Features

- ✅ TypeScript types
- ✅ Automatic token refresh on 401
- ✅ Request/response interceptors
- ✅ Error handling
- ✅ Configurable base URL and timeout
- ✅ Auth state management hooks

## API

### `createBrunoApi(config)`

Creates a new API client instance.

**Config options:**
- `baseURL` (string): Bruno server URL
- `timeout` (number, optional): Request timeout in ms (default: 30000)
- `onTokenRefresh` (function, optional): Callback when tokens are refreshed
- `onAuthError` (function, optional): Callback when auth fails (logout required)

### `auth.register(data)`

Register a new user account.

### `auth.login(data)`

Login with email and password. Tokens are automatically stored.

### `auth.logout(refreshToken)`

Logout and revoke refresh token.

### `auth.refreshToken(refreshToken)`

Manually refresh access token.

### `auth.getMe()`

Get current authenticated user info.

## License

MIT
