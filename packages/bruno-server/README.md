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
├── middleware/       # JWT auth middleware
└── ws/               # WebSocket manager
```
