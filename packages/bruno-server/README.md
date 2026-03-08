# Bruno Cloud Server

> Rust + Axum + MongoDB + JWT + WebSocket backend for Bruno IDE cloud sync.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Axum 0.7 |
| Database | MongoDB 7 |
| Auth | JWT (jsonwebtoken) + Argon2 |
| Real-time | WebSocket (axum native) |
| Runtime | Tokio |
| Logging | tracing + tracing-subscriber (JSON) |

## Quick Start

### 1. Start MongoDB

```bash
docker-compose up -d
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env - especially set a strong JWT_SECRET in production!
```

### 3. Run Server

```bash
cargo run
# Server starts at http://0.0.0.0:8080
```

## Logging

Every request emits one structured log line with the following fields:

| Field | Description |
|-------|-------------|
| `request_id` | UUID v4 — unique per request, use for log correlation |
| `method` | HTTP verb (GET, POST, …) |
| `path` | URL path |
| `query` | Query string (empty string if none) |
| `ip` | Client IP — `X-Forwarded-For` first, then TCP peer address |
| `user_agent` | `User-Agent` header |
| `content_type` | `Content-Type` header |
| `content_length_bytes` | Request body size in bytes |
| `status` | HTTP response status code |
| `latency_ms` | End-to-end time in milliseconds |
| `user_id` | Authenticated user ID from JWT (empty on public routes) |

Log level mirrors the response status:

| Status | Level |
|--------|-------|
| 2xx / 3xx | `INFO` |
| 4xx | `WARN` |
| 5xx | `ERROR` |

### Log Format

Default output is **newline-delimited JSON** — suitable for Datadog, CloudWatch, Loki, etc.

```bash
# JSON (default)
cargo run

# Human-readable text (local dev)
LOG_FORMAT=text cargo run
```

**JSON sample:**
```json
{
  "timestamp": "2026-03-07T05:00:19.332350Z",
  "level": "INFO",
  "target": "bruno_server::middleware",
  "fields": { "message": "← response" },
  "span": {
    "request_id": "d424978d-9514-4ece-9e54-098e6132c77f",
    "method": "POST",
    "path": "/api/auth/refresh",
    "query": "",
    "ip": "127.0.0.1",
    "user_agent": "bruno/2.0.0 Electron/37.6.1",
    "content_type": "application/json",
    "content_length_bytes": 148,
    "status": 200,
    "latency_ms": 2668,
    "user_id": ""
  }
}
```

**Text sample (`LOG_FORMAT=text`):**
```
2026-03-07T05:00:19.332350Z  INFO http{request_id=d424978d method=POST path=/api/auth/refresh status=200 latency_ms=2668 user_id=""}: bruno_server::middleware: ← response
```

### Log Level

Controlled via `RUST_LOG` (defaults to `bruno_server=info,warn`):

```bash
RUST_LOG=debug cargo run        # verbose
RUST_LOG=bruno_server=trace     # trace everything in this crate
RUST_LOG=warn                   # warnings and errors only
```

## API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Get current user |

### Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | List my workspaces |
| GET | `/api/workspaces/:id` | Get workspace |
| PATCH | `/api/workspaces/:id` | Update (Owner only) |
| DELETE | `/api/workspaces/:id` | Delete (Owner only) |
| POST | `/api/workspaces/:id/members` | Add member |
| DELETE | `/api/workspaces/:id/members/:user_id` | Remove member |

### Collections
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces/:id/collections` | Create collection |
| GET | `/api/workspaces/:id/collections` | List collections |
| GET | `/api/collections/:id` | Get collection |
| PATCH | `/api/collections/:id` | Update |
| DELETE | `/api/collections/:id` | Delete |

### Items (Folders & Requests)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/collections/:id/folders` | Create folder |
| POST | `/api/collections/:id/requests` | Create request |
| GET | `/api/collections/:id/items` | List all items (flat) |
| GET | `/api/items/:id` | Get item |
| PATCH | `/api/items/:id` | Update |
| DELETE | `/api/items/:id` | Delete (cascade) |
| PATCH | `/api/items/:id/move` | Move to folder |

### Environments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces/:id/environments` | Create env |
| GET | `/api/workspaces/:id/environments` | List envs |
| PATCH | `/api/environments/:id` | Update vars |
| DELETE | `/api/environments/:id` | Delete |

### Examples
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/items/:item_id/examples` | Create example |
| GET | `/api/items/:item_id/examples` | List examples |
| PATCH | `/api/examples/:id` | Update |
| DELETE | `/api/examples/:id` | Delete |

### Import/Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces/:id/import/postman` | Import Postman Collection v2.1 |
| POST | `/api/workspaces/:id/import/insomnia` | Import Insomnia export |
| GET | `/api/collections/:id/export?format=postman` | Export collection to Postman |
| GET | `/api/collections/:id/export?format=openapi` | Export collection to OpenAPI 3.0 |
| GET | `/api/collections/:id/export?format=swagger` | Export collection to Swagger 2.0 |
| GET | `/api/workspaces/:id/export` | Export entire workspace |

**Import Postman Example:**
```bash
curl -X POST http://localhost:8080/api/workspaces/{workspace_id}/import/postman \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "json": "{...postman collection JSON...}",
    "conflict": "rename"
  }'
```

**Conflict Handling Options:**
- `error` (default): Returns 409 if collection name already exists
- `replace`: Deletes existing collection and imports new one
- `rename`: Creates new collection with name like "Collection Name (imported)"

**Export Example:**
```bash
# Export to Postman
curl http://localhost:8080/api/collections/{collection_id}/export?format=postman \
  -H "Authorization: Bearer {access_token}" \
  -o collection.postman.json

# Export to OpenAPI 3.0
curl http://localhost:8080/api/collections/{collection_id}/export?format=openapi \
  -H "Authorization: Bearer {access_token}" \
  -o openapi.json

# Export entire workspace (all collections as Postman format)
curl http://localhost:8080/api/workspaces/{workspace_id}/export \
  -H "Authorization: Bearer {access_token}" \
  -o workspace.json
```

### WebSocket
```
ws://localhost:8080/ws?token=<access_token>
```

**Client → Server Messages:**
```json
{ "type": "Subscribe", "workspace_id": "<id>" }
{ "type": "Unsubscribe", "workspace_id": "<id>" }
{ "type": "Ping" }
```

**Server → Client Events:**
```json
{ "type": "Event", "workspace_id": "<id>", "event": { "type": "CollectionChanged", "payload": {...} } }
{ "type": "Pong" }
```

## Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control (CRUD + manage members) |
| **Editor** | Create/edit collections, items, environments |
| **Viewer** | Read-only access |

## Project Structure

```
src/
├── main.rs           # Entry point, wires all together
├── router.rs         # All routes (43 REST + 1 WS)
├── state.rs          # Shared AppState
├── config/           # Config from env vars
├── db/               # MongoDB connection + indexes
├── errors/           # Centralized error handling
├── models/           # MongoDB document types
├── services/         # Business logic
├── handlers/         # HTTP request handlers
├── middleware/       # JWT auth + request logger
└── ws/               # WebSocket manager
```


### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Get current user |

### Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | List my workspaces |
| GET | `/api/workspaces/:id` | Get workspace |
| PATCH | `/api/workspaces/:id` | Update (Owner only) |
| DELETE | `/api/workspaces/:id` | Delete (Owner only) |
| POST | `/api/workspaces/:id/members` | Add member |
| DELETE | `/api/workspaces/:id/members/:user_id` | Remove member |

### Collections
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces/:id/collections` | Create collection |
| GET | `/api/workspaces/:id/collections` | List collections |
| GET | `/api/collections/:id` | Get collection |
| PATCH | `/api/collections/:id` | Update |
| DELETE | `/api/collections/:id` | Delete |

### Items (Folders & Requests)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/collections/:id/folders` | Create folder |
| POST | `/api/collections/:id/requests` | Create request |
| GET | `/api/collections/:id/items` | List all items (flat) |
| GET | `/api/items/:id` | Get item |
| PATCH | `/api/items/:id` | Update |
| DELETE | `/api/items/:id` | Delete (cascade) |
| PATCH | `/api/items/:id/move` | Move to folder |

### Environments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces/:id/environments` | Create env |
| GET | `/api/workspaces/:id/environments` | List envs |
| PATCH | `/api/environments/:id` | Update vars |
| DELETE | `/api/environments/:id` | Delete |

### Examples
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/items/:item_id/examples` | Create example |
| GET | `/api/items/:item_id/examples` | List examples |
| PATCH | `/api/examples/:id` | Update |
| DELETE | `/api/examples/:id` | Delete |

### Import/Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workspaces/:id/import/postman` | Import Postman Collection v2.1 |
| POST | `/api/workspaces/:id/import/insomnia` | Import Insomnia export |
| GET | `/api/collections/:id/export?format=postman` | Export collection to Postman |
| GET | `/api/collections/:id/export?format=openapi` | Export collection to OpenAPI 3.0 |
| GET | `/api/collections/:id/export?format=swagger` | Export collection to Swagger 2.0 |
| GET | `/api/workspaces/:id/export` | Export entire workspace |

**Import Postman Example:**
```bash
curl -X POST http://localhost:8080/api/workspaces/{workspace_id}/import/postman \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "json": "{...postman collection JSON...}",
    "conflict": "rename"
  }'
```

**Conflict Handling Options:**
- `error` (default): Returns 409 if collection name already exists
- `replace`: Deletes existing collection and imports new one
- `rename`: Creates new collection with name like "Collection Name (imported)"

**Export Example:**
```bash
# Export to Postman
curl http://localhost:8080/api/collections/{collection_id}/export?format=postman \
  -H "Authorization: Bearer {access_token}" \
  -o collection.postman.json

# Export to OpenAPI 3.0
curl http://localhost:8080/api/collections/{collection_id}/export?format=openapi \
  -H "Authorization: Bearer {access_token}" \
  -o openapi.json

# Export entire workspace (all collections as Postman format)
curl http://localhost:8080/api/workspaces/{workspace_id}/export \
  -H "Authorization: Bearer {access_token}" \
  -o workspace.json
```

### WebSocket
```
ws://localhost:8080/ws?token=<access_token>
```

**Client → Server Messages:**
```json
{ "type": "Subscribe", "workspace_id": "<id>" }
{ "type": "Unsubscribe", "workspace_id": "<id>" }
{ "type": "Ping" }
```

**Server → Client Events:**
```json
{ "type": "Event", "workspace_id": "<id>", "event": { "type": "CollectionChanged", "payload": {...} } }
{ "type": "Pong" }
```

## Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control (CRUD + manage members) |
| **Editor** | Create/edit collections, items, environments |
| **Viewer** | Read-only access |

## Project Structure

```
src/
├── main.rs           # Entry point, wires all together
├── router.rs         # All routes (43 REST + 1 WS)
├── state.rs          # Shared AppState
├── config/           # Config from env vars
├── db/               # MongoDB connection + indexes
├── errors/           # Centralized error handling
├── models/           # MongoDB document types
├── services/         # Business logic
├── handlers/         # HTTP request handlers
├── middleware/       # JWT auth + request logger
└── ws/               # WebSocket manager
```
