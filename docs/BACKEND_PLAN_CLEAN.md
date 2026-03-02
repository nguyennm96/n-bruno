# Backend Implementation Plan - Clean Version
## Postman-like API Server with Real-Time Sync

**Tech Stack**: Rust + Axum + MongoDB + JWT + WebSocket
**Timeline**: 7-8 weeks
**Architecture**: REST API + WebSocket for real-time collaboration

---

## Core Features

1. **Authentication** - Register, login, JWT tokens, refresh tokens
2. **Workspaces** - Team collaboration with roles (Owner/Editor/Viewer)
3. **Collections** - Container for API requests
4. **Folders & Requests** - Hierarchical organization
5. **Environments** - Variable management
6. **Examples** - Saved response examples
7. **Real-Time Sync** - WebSocket for instant updates across clients

---

# Implementation Phases

## PHASE 1: Authentication & Foundation
**Duration**: 1 week
**Goal**: Working server with secure authentication

### What to Build:

1. **Project Setup**
   - Initialize Rust project with Axum framework
   - Setup MongoDB with Docker
   - Configure environment variables
   - Create project folder structure

2. **Database - Users Collection**
   - MongoDB collection: `users`
   - Document structure: `{email, password_hash, name, created_at, updated_at}`
   - Unique index on email field
   - Store user credentials

3. **Password Security**
   - Use Argon2 for password hashing (industry standard)
   - Never store plaintext passwords

4. **JWT Authentication**
   - Access tokens: 15 minutes (short-lived for security)
   - Refresh tokens: 30 days (long-lived for convenience)
   - Store refresh tokens in MongoDB collection (as hashes, not plaintext)
   - Collection: `refresh_tokens` with TTL index for auto-expiration

5. **API Endpoints**
   - `POST /api/auth/register` - Create new user account
   - `POST /api/auth/login` - Authenticate and get tokens
   - `POST /api/auth/refresh` - Get new access token when expired
   - `POST /api/auth/logout` - Revoke refresh token
   - `GET /api/auth/me` - Get current user info

6. **Auth Middleware**
   - Validate JWT on protected routes
   - Extract user info from token
   - Return 401 for invalid/expired tokens

7. **Auto-Cleanup with TTL Index**
   - MongoDB TTL index on refresh_tokens collection
   - Automatically deletes expired documents (no background job needed!)
   - Set TTL on `expires_at` field

### Why These Decisions:

- **Short access tokens (15 min)**: If stolen, attacker only has 15 minutes access
- **Refresh tokens in DB**: Can revoke remotely (logout works properly)
- **Token rotation**: New refresh token on each use (prevents replay attacks)
- **Argon2**: Winner of password hashing competition, resistant to GPU attacks

### Deliverables:
- [ ] Server runs successfully
- [ ] Users can register and login
- [ ] Access tokens expire after 15 minutes
- [ ] Can refresh tokens without re-login
- [ ] Logout revokes tokens properly
- [ ] Protected routes require valid JWT

---

## PHASE 2: Workspaces
**Duration**: 3-4 days
**Goal**: Multi-tenant workspace system with team collaboration

### What to Build:

1. **Database Collections**
   - `workspaces`: `{name, description, owner_id, created_at, updated_at}`
   - `workspace_members`: `{workspace_id, user_id, role, joined_at}`
   - Indexes on workspace_id and user_id for fast lookups

2. **Role-Based Access Control (RBAC)**
   - **OWNER**: Full control (create, update, delete, manage members)
   - **EDITOR**: Create/edit content (collections, requests)
   - **VIEWER**: Read-only access

3. **API Endpoints**
   - `POST /api/workspaces` - Create workspace (auto-assigns creator as OWNER)
   - `GET /api/workspaces` - List user's workspaces
   - `GET /api/workspaces/:id` - Get workspace details
   - `PATCH /api/workspaces/:id` - Update workspace (OWNER only)
   - `DELETE /api/workspaces/:id` - Delete workspace (OWNER only)
   - `GET /api/workspaces/:id/members` - List members
   - `POST /api/workspaces/:id/members` - Add member (OWNER/EDITOR)
   - `DELETE /api/workspaces/:id/members/:user_id` - Remove member (OWNER)

4. **Access Control Middleware**
   - Verify user is workspace member before allowing access
   - Check role permissions for write operations
   - Return 404 (not 403) for non-members (security: don't leak workspace existence)

### Why These Decisions:

- **Auto-owner assignment**: User who creates workspace is automatically owner
- **Role hierarchy**: OWNER > EDITOR > VIEWER (simple, easy to understand)
- **Cascade delete**: Deleting workspace deletes all contained data
- **404 for non-members**: Security best practice (don't reveal if workspace exists)

### Deliverables:
- [ ] Can create workspaces
- [ ] Can invite team members
- [ ] Roles enforce proper permissions
- [ ] Non-members cannot access workspace data
- [ ] Workspace owner can manage members

---

## PHASE 3: Collections
**Duration**: 2-3 days
**Goal**: Collections as containers for API requests

### What to Build:

1. **Database Collection**
   - MongoDB collection: `collections`
   - Document: `{name, description, workspace_id, created_at, updated_at}`
   - Index on workspace_id for fast queries
   - Application-level cascade delete when workspace deleted

2. **API Endpoints**
   - `POST /api/workspaces/:workspace_id/collections` - Create collection
   - `GET /api/workspaces/:workspace_id/collections` - List collections
   - `GET /api/collections/:id` - Get collection details
   - `PATCH /api/collections/:id` - Update collection
   - `DELETE /api/collections/:id` - Delete collection

3. **Permission Checks**
   - Verify user has EDITOR role for create/update/delete
   - VIEWER can only read

### Why These Decisions:

- **Workspace-scoped**: Collections belong to workspaces
- **Simple CRUD**: Standard REST operations
- **Inherit permissions**: Use workspace roles (no separate collection permissions)

### Deliverables:
- [ ] Can create collections in workspace
- [ ] Can list workspace's collections
- [ ] Can update/delete collections
- [ ] Permissions enforced properly

---

## PHASE 4: Items (Folders & Requests)
**Duration**: 5-6 days
**Goal**: Hierarchical folder structure with API requests

### What to Build:

1. **Database Collection**
   - MongoDB collection: `items`
   - Document structure: `{type, name, collection_id, parent_item_id, sort_order, method, url, headers, body, created_at, updated_at}`
   - Type field: "folder" or "request"
   - Headers and body stored as native subdocuments (MongoDB advantage!)
   - Parent-child relationship via `parent_item_id` (tree structure)

2. **Hierarchy Design**
   - Folders can contain folders and requests (unlimited nesting)
   - Requests cannot contain children
   - Root items have `parent_item_id = null`
   - Sort order for drag-and-drop positioning
   - **Option**: Can also use embedded documents for simpler collections (embed items inside collection)

3. **API Endpoints**
   - `POST /api/collections/:id/folders` - Create folder
   - `POST /api/collections/:id/requests` - Create request
   - `GET /api/collections/:id/items` - Get all items (tree structure)
   - `GET /api/items/:id` - Get single item
   - `PATCH /api/items/:id` - Update item
   - `DELETE /api/items/:id` - Delete item (cascade children)
   - `POST /api/collections/:id/items/reorder` - Change order
   - `PATCH /api/items/:id/move` - Move to different folder

4. **Query Optimization**
   - Create indexes on `collection_id`, `parent_item_id`, `workspace_id`
   - Use MongoDB aggregation pipeline for tree retrieval
   - Or return flat list and let client build tree (simpler, faster)
   - MongoDB's native document structure makes hierarchy natural

### Why These Decisions:

- **Single collection for both**: Simpler schema, easier hierarchy management
- **parent_item_id**: Classic adjacency list pattern for trees
- **sort_order**: Float/numeric allows inserting between items without reordering all
- **Native subdocuments**: MongoDB stores headers/body as nested objects (no serialization needed)
- **Application cascade delete**: Delete folder = query and delete all children
- **Alternative**: Could embed entire tree in collection document for small collections (trade-off: simplicity vs size limits)

### Deliverables:
- [ ] Can create nested folders
- [ ] Can create requests in folders or at root
- [ ] Can get full collection tree
- [ ] Can reorder items via drag-and-drop
- [ ] Can move items between folders
- [ ] Deleting folder deletes contents

---

## PHASE 5: Environments
**Duration**: 2-3 days
**Goal**: Variable management like Postman environments

### What to Build:

1. **Database Collection**
   - MongoDB collection: `environments`
   - Document: `{name, workspace_id, variables: [...], created_at, updated_at}`
   - Variables stored as array of subdocuments (MongoDB native arrays)
   - Unique index on `{workspace_id, name}`

2. **API Endpoints**
   - `POST /api/workspaces/:id/environments` - Create environment
   - `GET /api/workspaces/:id/environments` - List environments
   - `PATCH /api/environments/:id` - Update variables
   - `DELETE /api/environments/:id` - Delete environment

3. **Variable Structure**
   - Each variable: `{key: "API_URL", value: "https://...", enabled: true}`
   - Store as array of objects (MongoDB handles natively, no JSON parsing needed)

### Why These Decisions:

- **Workspace-level**: Environments shared across collections in workspace
- **Array storage**: MongoDB arrays are native, no JSON serialization overhead
- **Simple key-value pairs**: Enough for most use cases
- **Unique names**: Prevent duplicate environment names via unique index

### Deliverables:
- [ ] Can create environments
- [ ] Can store multiple variables
- [ ] Can update variables
- [ ] Can enable/disable variables

---

## PHASE 6: Examples (Saved Responses)
**Duration**: 2 days
**Goal**: Save response examples for requests

### What to Build:

1. **Database Collection**
   - MongoDB collection: `examples`
   - Document: `{name, item_id, status_code, headers: {...}, body: "...", created_at}`
   - Index on item_id for fast retrieval
   - Link to specific request (not folders)

2. **API Endpoints**
   - `POST /api/items/:item_id/examples` - Create example
   - `GET /api/items/:item_id/examples` - List examples
   - `PATCH /api/examples/:id` - Update example
   - `DELETE /api/examples/:id` - Delete example

3. **Validation**
   - Ensure examples only attached to REQUEST type items (not folders)
   - Store HTTP status code, headers (subdocument), body (text)
   - Application-level validation (MongoDB has no foreign key constraints)

### Why These Decisions:

- **Request-scoped**: Examples belong to specific requests
- **Simple storage**: Status code + headers + body
- **Multiple examples**: One request can have many examples (success, error, etc.)

### Deliverables:
- [ ] Can save response examples
- [ ] Can list request's examples
- [ ] Can update/delete examples
- [ ] Examples only for requests (not folders)

---

## PHASE 7: Real-Time Sync (WebSocket)
**Duration**: 1 week
**Goal**: Instant updates when workspace data changes

### What to Build:

1. **WebSocket Server**
   - Endpoint: `ws://server/ws?token=<jwt>`
   - Authenticate via JWT query parameter
   - Keep connections open for subscribed clients

2. **Connection Management**
   - Track active connections per workspace
   - Map: `workspace_id -> list of connected users`
   - Handle connect/disconnect lifecycle

3. **Subscription System**
   - Client connects and subscribes to workspace(s)
   - Server verifies user has workspace access
   - Only workspace members receive updates

4. **Event Broadcasting**
   - When user creates/updates/deletes via REST API:
     1. Save to database (via REST endpoint)
     2. Broadcast event to all workspace subscribers (via WebSocket)
   - Exclude the user who made the change (they already know)

5. **Event Types**
   - `CollectionChanged`: {action: created/updated/deleted, data}
   - `ItemChanged`: {action, item_id, data}
   - `EnvironmentChanged`: {action, environment_id, data}
   - `ExampleChanged`: {action, example_id, data}

6. **Reconnection Handling**
   - Client auto-reconnects on disconnect
   - Exponential backoff (1s, 2s, 4s, 8s...)
   - Maximum retry attempts to prevent infinite loops

7. **Scalability Considerations**
   - Limit connections per user (e.g., max 5 devices)
   - Heartbeat/ping-pong to detect dead connections
   - Connection timeout after idle period

### Why These Decisions:

- **WebSocket over long-polling**: True real-time, more efficient
- **Workspace isolation**: Only relevant team members get updates
- **Exclude sender**: User doesn't need echo of their own changes
- **Separate from REST**: WebSocket for push, REST for pull (clean separation)
- **JWT auth**: Reuse existing authentication system

### Architecture Flow:
```
User A: Updates Collection
    ↓
REST API: PATCH /api/collections/:id (save to DB)
    ↓
WebSocket: Broadcast to workspace subscribers
    ↓
User B, C: Receive update instantly
    ↓
Client UI: Refresh collection list
```

### Deliverables:
- [ ] WebSocket endpoint accepts connections
- [ ] Clients can subscribe to workspaces
- [ ] Changes broadcast to subscribed clients
- [ ] Sender excluded from broadcast
- [ ] Reconnection works automatically
- [ ] Connection limits enforced
- [ ] Works with 100+ concurrent connections

---

## PHASE 8: Testing & Documentation
**Duration**: 3-4 days
**Goal**: Production-ready quality

### What to Build:

1. **Integration Tests**
   - Test complete user flows (register → create workspace → add collection → etc.)
   - Test permissions (ensure VIEWER can't edit, etc.)
   - Test WebSocket scenarios (multiple clients, disconnect/reconnect)
   - Test edge cases (delete workspace with 1000 items, deep folder nesting)

2. **API Documentation**
   - Document all endpoints (OpenAPI/Swagger)
   - Include request/response examples
   - Document authentication flow
   - Document WebSocket protocol
   - Host interactive API docs (Swagger UI)

3. **Error Handling**
   - Standardize error response format
   - Consistent HTTP status codes
   - Helpful error messages
   - Validation error details

4. **Performance Testing**
   - Test with realistic data (1000+ items per collection)
   - Test WebSocket with 100+ concurrent connections
   - Identify slow queries and optimize
   - Add database indexes where needed

### Deliverables:
- [ ] All integration tests pass
- [ ] API documentation complete
- [ ] Error responses consistent
- [ ] Performance acceptable under load
- [ ] No critical bugs

---

## PHASE 9: Deployment
**Duration**: 2-3 days
**Goal**: Production deployment

### What to Build:

1. **Docker Setup**
   - Dockerfile for Rust application
   - docker-compose for local development
   - Multi-stage build for smaller images
   - Health check endpoint

2. **Production Configuration**
   - Environment-based config (dev/staging/prod)
   - Secure secret management (never commit secrets)
   - Database connection pooling
   - CORS configuration for production domains

3. **Database Management**
   - Index creation strategy (create on first deploy)
   - Backup strategy (automated daily backups via MongoDB Atlas or mongodump)
   - No migrations needed (schema-less advantage)

4. **Reverse Proxy**
   - Nginx/Caddy in front of Rust server
   - HTTPS/SSL certificates (Let's Encrypt)
   - WebSocket proxy configuration
   - Rate limiting at proxy level

5. **Monitoring**
   - Application logs (structured logging)
   - Error tracking (what errors occur?)
   - Performance metrics (response times, database query times)
   - Health check monitoring (uptime)

6. **Deployment Strategy**
   - Deploy to VPS/Cloud (DigitalOcean, AWS, etc.)
   - MongoDB hosting: MongoDB Atlas (managed) or self-hosted
   - Zero-downtime deployment (blue-green or rolling)
   - Automated deployment via CI/CD

7. **MongoDB-Specific Setup**
   - Create database and collections
   - Create indexes on deployment
   - Setup replica set for production (high availability)
   - Configure connection string with authentication

### Deliverables:
- [ ] Docker image builds successfully
- [ ] Can deploy to production server
- [ ] HTTPS configured properly
- [ ] WebSocket works in production
- [ ] Logs and monitoring active
- [ ] Backup strategy in place

---

## PHASE 10: Import/Export
**Duration**: 1-2 weeks
**Goal**: Import from Postman and export to standard formats

### What to Build:

1. **Import from Postman**
   - Accept Postman Collection v2.1 JSON format
   - Parse and convert to Bruno structure
   - Handle: collections, folders, requests, environments, examples
   - Map Postman auth types to Bruno format
   - Preserve request/response examples

2. **Export to Postman Format**
   - Convert Bruno collections to Postman v2.1 JSON
   - Include all metadata, folders, requests
   - Export environments separately
   - Allow users to migrate away if needed

3. **Export to OpenAPI 3.0**
   - Generate OpenAPI spec from collection
   - Extract endpoints, methods, parameters
   - Generate request/response schemas from examples
   - Include authentication schemes
   - Output valid OpenAPI 3.0 YAML/JSON

4. **Export to Swagger 2.0**
   - Similar to OpenAPI but Swagger format
   - For legacy systems compatibility

5. **Import from Insomnia** (Optional)
   - Support Insomnia export format
   - Broader compatibility

### API Endpoints:

**Import:**
- `POST /api/workspaces/:id/import/postman` - Upload Postman JSON
- `POST /api/workspaces/:id/import/insomnia` - Upload Insomnia JSON

**Export:**
- `GET /api/collections/:id/export?format=postman` - Download Postman JSON
- `GET /api/collections/:id/export?format=openapi` - Download OpenAPI 3.0
- `GET /api/collections/:id/export?format=swagger` - Download Swagger 2.0
- `GET /api/workspaces/:id/export` - Export entire workspace

### Format Mapping:

**Postman → Bruno:**
```
Postman Collection → Bruno Collection
Postman Folder → Bruno Folder (item type: folder)
Postman Request → Bruno Request (item type: request)
Postman Example → Bruno Example
Postman Environment → Bruno Environment
Postman Variables → Bruno Variables
```

**Bruno → OpenAPI:**
```
Collection → API spec
Folders → Tags
Requests → Paths & Operations
Method + URL → Path + HTTP Method
Headers → Parameters (header)
Query Params → Parameters (query)
Body → Request Body Schema
Examples → Response Examples
Environments → Servers (optional)
```

### Why These Features:

- **Import from Postman**: Users can switch from Postman easily (migration path)
- **Export to Postman**: No vendor lock-in, users can leave if they want
- **OpenAPI/Swagger**: Standard format for API documentation
- **Documentation**: Auto-generated docs from collections
- **Interoperability**: Work with other tools in ecosystem

### Technical Considerations:

1. **Large Files**
   - Handle large Postman collections (1000+ requests)
   - Stream processing for big files
   - Progress indication for imports

2. **Validation**
   - Validate JSON structure before importing
   - Handle malformed data gracefully
   - Report errors clearly

3. **Conflicts**
   - Check for duplicate collection names on import
   - Allow user to choose: merge, replace, or create new

4. **Data Loss Prevention**
   - Warn about features that can't be mapped
   - Postman-specific features that Bruno doesn't support
   - Log what couldn't be imported

5. **Authentication Mapping**
   - Map Postman auth types (Basic, Bearer, OAuth, etc.)
   - Convert to Bruno format
   - Preserve credentials securely

### Implementation Steps:

1. **Create Format Parsers**
   - Postman v2.1 parser
   - Insomnia parser
   - Validate structure

2. **Create Format Generators**
   - Postman v2.1 generator
   - OpenAPI 3.0 generator
   - Swagger 2.0 generator

3. **Build Converters**
   - Postman → Bruno converter
   - Bruno → Postman converter
   - Bruno → OpenAPI converter
   - Bruno → Swagger converter

4. **Handle Special Cases**
   - Pre-request scripts (store as-is, may not execute)
   - Test scripts (store, client handles)
   - Postman-specific variables
   - Dynamic variables

5. **Testing**
   - Test with real Postman collections
   - Validate generated OpenAPI specs
   - Round-trip testing (import → export → import)
   - Edge cases (empty collections, deeply nested, etc.)

### Deliverables:

- [ ] Can import Postman Collection v2.1 JSON
- [ ] Can import Postman Environments
- [ ] Import creates proper Bruno structure (collections, folders, requests)
- [ ] Can export collection to Postman format
- [ ] Can export collection to OpenAPI 3.0 (valid spec)
- [ ] Can export collection to Swagger 2.0
- [ ] Can export entire workspace
- [ ] Large collections handled efficiently
- [ ] Import errors reported clearly
- [ ] No data loss in round-trip (import Postman → export Postman)
- [ ] Generated OpenAPI specs are valid
- [ ] Documentation for supported/unsupported features

---

## Summary

**Total Timeline**: 8-10 weeks

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1 | 1 week | Authentication working |
| 2 | 3-4 days | Workspaces & teams |
| 3 | 2-3 days | Collections |
| 4 | 5-6 days | Folders & Requests |
| 5 | 2-3 days | Environments |
| 6 | 2 days | Examples |
| 7 | 1 week | Real-time WebSocket sync |
| 8 | 3-4 days | Testing & docs |
| 9 | 2-3 days | Production deployment |
| **10** | **1-2 weeks** | **Import/Export (Postman, OpenAPI)** |

**Total Endpoints**: ~43 REST + 1 WebSocket
- Import: 2 endpoints (Postman, Insomnia)
- Export: 4 endpoints (Postman, OpenAPI, Swagger, Workspace)

---

## Key Architecture Decisions

### Why Rust + Axum?
- **Performance**: Handles high concurrency efficiently
- **Type Safety**: Compile-time guarantees prevent bugs
- **Memory Safety**: No garbage collection, no memory leaks
- **Modern**: Great ecosystem for web development

### Why MongoDB?
- **Native Document Storage**: Requests, collections, environments are naturally documents
- **Flexible Schema**: Easy to add fields without migrations
- **Nested Data**: Headers, body, variables stored as subdocuments (no JSON parsing)
- **Horizontal Scaling**: Sharding built-in for future growth
- **Fast Development**: No schema migrations, faster iteration
- **Good Fit**: API client data is document-oriented, not heavily relational
- **TTL Indexes**: Auto-expire refresh tokens without background jobs

### Why JWT?
- **Stateless**: No session storage needed
- **Scalable**: Works across multiple servers
- **Standard**: Widely supported
- **Secure**: With proper expiration and rotation

### Why WebSocket for Sync?
- **Real-time**: Instant updates (not 5-10 second polling delay)
- **Efficient**: One connection vs many polling requests
- **Industry Standard**: Proven solution (Figma, Google Docs use it)
- **Simple Protocol**: Text-based JSON messages

### Why Single Collection for Folders/Requests?
- **Simpler**: One schema, easier queries
- **Flexible**: Easy to add new item types later
- **Hierarchy**: Parent-child relationship straightforward

### MongoDB Considerations

**Advantages for This Project:**
- API collections, requests, environments are natural documents
- No need for complex joins (most queries are within workspace/collection)
- Schema flexibility allows fast iteration
- Embedded documents perfect for headers, body, variables
- Horizontal scaling easier when you grow

**Trade-offs:**
- No foreign key constraints (enforce in application code)
- Must handle cascade deletes manually
- Need application-level validation for references
- Transactions available but should be used sparingly
- 16MB document size limit (shouldn't be an issue for API requests)

---

## What This Plan Does NOT Include

**Out of Scope** (can add later):
- Request execution from server (Bruno client handles this)
- Pre-request/post-response scripts (client-side)
- Collection runner (automated testing)
- Public collection sharing (view-only links)
- OAuth/Social login
- Email verification
- Password reset
- Request history tracking
- Mock servers
- Comments & mentions
- Activity feed
- Global search
- Tags/Labels

**Focus**: Core storage, sync, and interoperability. Client handles request execution.

---

## Next Steps

1. ✅ Review this plan
2. ✅ Confirm tech stack choices
3. ✅ Start Phase 1: Authentication
4. ✅ Complete each phase before moving to next
5. ✅ Test thoroughly at each step

**Ready to start implementation?**
