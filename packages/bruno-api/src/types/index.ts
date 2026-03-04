// Auth types
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface AuthResponse {
  data: {
    id: string;
    email: string;
    name: string;
    access_token: string;
    refresh_token: string;
  };
}

export interface UserResponse {
  data: {
    id: string;
    email: string;
    name: string;
  };
}

export interface TokenResponse {
  data: {
    access_token: string;
    refresh_token: string;
  };
}

// API Error
export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// API Client Config
export interface BrunoApiConfig {
  baseURL: string;
  timeout?: number;
  onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string }) => void;
  onAuthError?: () => void;
}

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface WorkspaceCreateRequest {
  name: string;
  description?: string;
}

export interface WorkspaceUpdateRequest {
  name?: string;
  description?: string;
}

export interface WorkspaceListResponse {
  data: Workspace[];
}

export interface WorkspaceResponse {
  data: Workspace;
}

export interface WorkspaceMember {
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface WorkspaceMembersResponse {
  data: WorkspaceMember[];
}

// Collection types
export interface Collection {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionCreateRequest {
  name: string;
  description?: string | null;
}

export interface CollectionUpdateRequest {
  name?: string;
  description?: string | null;
  bruno_config?: any;
  root?: any;
}

export interface CloneCollectionRequest {
  name: string;
  target_workspace_id?: string;
}

export interface ResequenceItemsRequest {
  items: Array<{
    id: string;
    sort_order: number;
  }>;
}

export interface CollectionItem {
  id: string;
  workspace_id: string;
  type: 'request' | 'folder';
  name: string;
  path: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  parent_id?: string;
  seq?: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionItemCreateRequest {
  type: 'request' | 'folder';
  name: string;
  path: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  parent_id?: string;
  seq?: number;
}

export interface CollectionItemUpdateRequest {
  name?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  seq?: number;
}

// Environment types
export interface EnvVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  workspace_id?: string;
  collection_id?: string;
  variables: EnvVariable[];
  created_at: string;
  updated_at: string;
}

export interface EnvironmentCreateRequest {
  name: string;
  variables: EnvVariable[];
  color?: string | null;
}

export interface EnvironmentUpdateRequest {
  name?: string;
  variables?: EnvVariable[];
  color?: string | null;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}
