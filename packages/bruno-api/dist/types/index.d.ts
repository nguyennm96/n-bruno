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
        avatar?: string | null;
        access_token: string;
        refresh_token: string;
    };
}
export interface UserResponse {
    data: {
        id: string;
        email: string;
        name: string;
        avatar?: string | null;
        created_at?: string;
    };
}
export interface TokenResponse {
    data: {
        access_token: string;
        refresh_token: string;
    };
}
export interface UpdateProfileRequest {
    name?: string;
    avatar?: string | null;
}
export interface UpdateProfileResponse {
    data: {
        id: string;
        email: string;
        name: string;
        avatar?: string | null;
        created_at?: string;
    };
}
export interface ForgotPasswordRequest {
    email: string;
}
export interface ResetPasswordRequest {
    email: string;
    otp: string;
    new_password: string;
}
export interface ApiError {
    error: string;
    message?: string;
    details?: any;
}
export interface BrunoApiConfig {
    baseURL: string;
    timeout?: number;
    onTokenRefresh?: (tokens: {
        accessToken: string;
        refreshToken: string;
    }) => void;
    onAuthError?: () => void;
}
export interface Workspace {
    uid: string;
    name: string;
    description: string;
    ownerUid: string;
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
    userId: string;
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
export interface Collection {
    uid: string;
    workspaceUid: string;
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
        uid: string;
        sort_order: number;
    }>;
}
export interface CollectionItem {
    uid: string;
    collectionUid: string;
    parentUid?: string | null;
    type: 'request' | 'folder';
    name: string;
    filename?: string | null;
    seq?: number;
    request?: any;
    settings?: any;
    created_at: string;
    updated_at: string;
}
export interface CollectionItemCreateRequest {
    name: string;
    method?: string;
    url?: string;
    seq?: number;
    parentUid?: string | null;
}
export interface CollectionItemUpdateRequest {
    name?: string;
    method?: string;
    url?: string;
    seq?: number;
    request?: any;
    settings?: any;
    docs?: string;
    root?: any;
}
export interface EnvVariable {
    key: string;
    value: string;
    enabled: boolean;
    secret?: boolean;
}
export interface Environment {
    uid: string;
    name: string;
    workspaceUid?: string;
    collectionUid?: string;
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
export interface ApiResponse<T> {
    data: T;
    message?: string;
}
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';
export interface WorkspaceInvite {
    id: string;
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedBy: {
        id: string;
        name: string;
        email: string;
    };
    expiresAt: string;
    status: 'pending' | 'accepted' | 'revoked';
    createdAt: string;
}
export interface AddMemberRequest {
    email: string;
    role: WorkspaceRole;
}
export interface AddMemberResponse {
    action: 'added' | 'invited';
    member?: WorkspaceMember;
    invite?: WorkspaceInvite;
}
export interface UpdateMemberRoleRequest {
    role: WorkspaceRole;
}
export interface InviteValidationResponse {
    valid: boolean;
    workspace?: {
        name: string;
        uid: string;
    };
    invitedBy?: {
        name: string;
        email: string;
    };
    role?: WorkspaceRole;
    email?: string;
}
export interface UserSearchResult {
    id: string;
    name: string;
    email: string;
}
export interface DocKeyValue {
    name: string;
    value: string;
    enabled: boolean;
}
export interface DocBody {
    mode: string;
    content?: string | null;
}
export interface DocExampleRequest {
    method?: string | null;
    url?: string | null;
    headers?: DocKeyValue[] | null;
    body?: DocBody | null;
}
export interface DocExampleResponse {
    status?: number | null;
    status_text?: string | null;
    headers?: DocKeyValue[] | null;
    body?: string | null;
}
export interface DocExample {
    name: string;
    description?: string | null;
    request?: DocExampleRequest | null;
    response?: DocExampleResponse | null;
}
export interface GenerateDocsRequest {
    name: string;
    method: string;
    url: string;
    headers?: DocKeyValue[] | null;
    params?: DocKeyValue[] | null;
    body?: DocBody | null;
    auth_type?: string | null;
    examples?: DocExample[] | null;
}
export interface GenerateDocsResponse {
    docs: string;
}
