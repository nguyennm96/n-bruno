# Bruno – GitHub Copilot Instructions

## Project Overview

**Bruno** is an open-source desktop API client (IDE) for exploring and testing APIs — a modern alternative to Postman. It stores API collections as plain-text files (`.bru` or YAML) directly on the filesystem, enabling full Git-based collaboration.

Bruno has two modes:
- **Local mode** — fully offline, no account required; all data stays on the user's filesystem
- **Cloud mode** — optional Bruno Cloud account; enables cloud workspaces, collection sharing, cloud sync, and published documentation

The project is a **monorepo** managed via npm workspaces.

---

## Architecture

### Application Layer

| Package | Role |
|---|---|
| `packages/bruno-app` | React 19 (Rsbuild) frontend UI rendered inside Electron |
| `packages/bruno-electron` | Electron main process: IPC handlers, file system, network requests |
| `packages/bruno-cli` | CLI runner — execute collections/requests non-interactively |
| `packages/bruno-server` | Cloud backend — Rust/Axum REST API (auth, collections, public docs) |
| `packages/bruno-public-docs` | Standalone Vite/React viewer app for published API documentation |

### Library / Domain Packages

| Package | Role |
|---|---|
| `packages/bruno-lang` | Parser/serializer for `.bru` plain-text markup language |
| `packages/bruno-filestore` | Unified file I/O layer — reads/writes `.bru` and YAML format files |
| `packages/bruno-schema` | Runtime JSON schema definition for collections, requests, environments |
| `packages/bruno-schema-types` | TypeScript types generated from the schema |
| `packages/bruno-common` | Shared utilities (URL parsing, interpolation, env vars, etc.) |
| `packages/bruno-js` | Script/test/vars/assert runtimes executed per request (sandboxed) |
| `packages/bruno-requests` | HTTP networking layer: Axios instance, OAuth2, Digest, gRPC, WebSocket |
| `packages/bruno-converters` | Import/export converters (Postman → Bruno, OpenAPI, etc.) |
| `packages/bruno-query` | Query utilities for filtering/searching collection items |
| `packages/bruno-graphql-docs` | GraphQL introspection schema renderer |
| `packages/bruno-toml` | TOML config file parsing |
| `packages/bruno-api` | TypeScript API client methods and types for Bruno Cloud |
| `packages/bruno-docs` | Documentation package (placeholder) |
| `packages/bruno-tests` | Integration test collections and test utilities |

### Communication Pattern

```
bruno-app (React UI)
    ↕ IPC (Electron ipcRenderer / ipcMain)
bruno-electron (Main Process)
    ↕ fs, axios, node APIs
bruno-filestore / bruno-requests / bruno-js

bruno-app (React UI)
    ↕ HTTP (axios via bruno-api)
bruno-server (Rust/Axum Cloud API)
    ↕ MongoDB
```

All network requests to external APIs are executed in the **Electron main process** via IPC — never directly from the renderer. Bruno Cloud API calls (`bruno-api`) are made from the renderer directly to `bruno-server`.

---

## Key Features

### Local (no account required)
- **HTTP Requests** — REST (all methods), form data, multipart, binary
- **GraphQL** — query/mutation/subscription + introspection docs viewer
- **gRPC** — unary and streaming calls
- **WebSocket** — connect, send, receive events
- **Authentication** — Basic, Bearer, API Key, OAuth2 (all grant types), AWS v4, NTLM, Digest, WSSE
- **Environments & Variables** — per-collection environments, global environments, runtime vars, secrets
- **Scripting** — pre-request and post-response JavaScript scripts (`bruno-js` runtime)
- **Tests & Assertions** — JavaScript test blocks + declarative assert rules per request
- **Cookie Management** — per-domain cookie jar
- **Collections** — folder-based collections stored as files, importable from Postman/OpenAPI
- **CLI Runner** — run collections/folders headlessly (CI/CD)
- **Proxy Support** — per-collection or global proxy config with cert pinning
- **Workspaces** — multiple workspace root directories
- **Tabs** — open multiple requests in tabs with draft/saved state
- **Code Generation** — generate code snippets (curl, etc.)
- **API Spec Viewer** — render OpenAPI / Swagger specs inline
- **Terminal** — embedded xterm.js terminal
- **Themes** — light/dark theme via styled-components
- **Documentation (local)**:
  - Per-request Markdown editor with auto-rendered params/headers summary
  - Per-folder Markdown editor with child request listing
  - Collection-level overview Markdown editor (in Collection Settings)
  - **Generate Docs** — export collection as standalone interactive HTML file (OpenCollection viewer); no login needed

### Cloud (requires authentication)
- **Cloud Workspaces** — shared workspaces with role-based access control (Owner / Editor / Viewer)
- **Collection Sharing** — share collections with team members; clone and resequence items
- **Real-time Sync** — WebSocket-based live sync across devices; sync queue and status tracking
- **Environments (Cloud)** — workspace-level and collection-level environments synced to cloud
- **Examples** — per-request response examples (create/list/update/delete)
- **Import** — Postman v2.1, Insomnia collections; conflict strategies (error/replace/rename)
- **Export** — collections to Postman JSON, OpenAPI 3.0, Swagger 2.0; full workspace export
- **Publish Docs** — publish collection documentation to a public URL; supports custom slug, custom CSS, custom logo, password protection, workspace-member-only visibility, and view analytics

---

## Tech Stack

### Frontend (`bruno-app`)
- **React 19** + **Redux Toolkit** (state management)
- **styled-components** — component styling and theming (colors must use theme, NOT CSS variables)
- **Tailwind CSS** — layout-only utilities (NO colors via Tailwind)
- **CodeMirror** — code editor (requests, scripts, responses)
- **Rsbuild** (bundler, replaces Next.js/Webpack)
- **Formik** + **Yup** — form handling and validation
- **i18next** — internationalisation
- **Immer** — immutable state updates in Redux slices
- **react-hot-toast** — toast notifications
- **GraphiQL 3** — GraphQL IDE
- **xterm.js** — embedded terminal
- **swagger-ui-react** — OpenAPI spec viewer
- **Playwright** — E2E tests
- **Jest** + **@testing-library/react** — unit/component tests

### Cloud Backend (`bruno-server`)
- **Rust** + **Axum 0.7** — HTTP framework (43 REST endpoints + 1 WebSocket)
- **MongoDB** — database
- **Argon2** — password hashing
- **JWT** — authentication tokens (access + refresh)
- **Tokio** — async runtime
- **Role-based access** — Owner / Editor / Viewer per workspace
- **WebSocket** — real-time sync events (`CollectionChanged`, `Ping/Pong`)

### Public Docs Viewer (`bruno-public-docs`)
- **Vite** + **React** — standalone SPA served at `/p/:slug`
- Fetches collection data from `bruno-server` public API

### Desktop Shell (`bruno-electron`)
- **Electron** — desktop shell
- **Axios** — HTTP client
- **IPC** — renderer ↔ main process communication
- **Node.js** built-ins: `fs`, `path`, `https`, `stream`

### Shared
- **TypeScript** — new packages (`bruno-filestore`, `bruno-requests`, `bruno-common`, `bruno-schema-types`, `bruno-api`) are written in TypeScript; `bruno-app`, `bruno-electron`, `bruno-cli` are JavaScript
- **Lodash** — utility functions
- **ESLint** + **@stylistic/eslint-plugin** — linting

---

## Coding Conventions

> Source: `CODING_STANDARDS.md`

### Formatting
- **2 spaces** for indentation — no tabs
- **Single quotes** for strings in JS/TS; **double quotes** for JSX/TSX attributes
- **Semicolons** always — end every statement with `;`
- **No trailing commas**
- Arrow functions always have parentheses around parameters: `(x) => x`
- Opening braces on the same line (K&R style)
- No space between function name and `(`: `fn()` not `fn ()`

### React
- **styled-components** for all color/visual styling; theme values via `${({ theme }) => theme.colors.xxx}`
- **Tailwind classes** for layout only (`flex`, `grid`, `p-4`, `gap-2`, etc.)
- **Custom hooks** for business logic, data fetching, and side effects — keep components thin
- Avoid `useEffect` unless absolutely necessary; prefer derived state or event handlers
- Import React hooks **directly**: `import { useState, useCallback } from 'react'` — never `React.useState`
- `useMemo`/`useCallback` only when there's a clear performance need
- Add `data-testid` attributes to elements that need Playwright test targeting
- Co-locate component-specific utilities next to the component; shared utilities go in `utils/`

### State Management (Redux)
- State lives in `packages/bruno-app/src/providers/ReduxStore/slices/`
- Key slices: `collections`, `workspaces`, `tabs`, `app`, `auth`, `global-environments`, `apiSpec`, `cloudSync`, `syncStatus`, `notifications`, `logs`, `network`
- Custom middlewares: `autosave`, `syncQueue`, `draft`, `tasks`, `globalLoading`
- Use **Immer** (built into Redux Toolkit) for immutable updates inside `createSlice`

### Cloud vs Local Feature Gating
- Cloud-only features are gated by `isAuthenticated` from `selectIsAuthenticated` (auth slice)
- Use `isCloudCollection(collection)` / `isCloudItem(item)` from `utils/storage/transform.js` to distinguish collection types
- Never show cloud-only UI to unauthenticated users

### Abstractions & Readability
- No new abstraction unless the same code appears in **3+ places**
- Function names must be concise and descriptive
- Add JSDoc to complex abstractions
- Meaningful comments only where logic is non-obvious — no obvious comments
- Functional style is fine; no need for ADTs, Monads, or deeply nested FP constructs

### File / Folder Structure (bruno-app)
```
src/
  components/      # Feature components (each in own folder)
  providers/       # Context providers (Theme, ReduxStore, Hotkeys, App, Toaster)
  hooks/           # Shared custom hooks
  utils/           # Shared utilities (collections, url, auth, importers, exporters, codemirror)
  pages/           # Routing pages
  store/           # Legacy store helpers
  ui/              # Generic reusable UI primitives (Button, Dropdown, etc.)
  themes/          # Theme definitions
  services/        # Service layer utilities
  selectors/       # Redux selectors
```

---

## UI Conventions

> Full reference: `packages/bruno-app/UI_CONVENTIONS.md`

### Color
- **MUST** use theme tokens: `${({ theme }) => theme.colors.xxx}` — never hardcode hex/hsl/rgb
- **MUST NOT** use Tailwind color utilities (`text-red-500`, `bg-gray-100`, etc.)
- CSS variables (`var(--color-brand)`) are legacy — do not use in new code
- Key semantic keys: `theme.brand`, `theme.text`, `theme.background.*`, `theme.status.*`, `theme.colors.border*`

### Typography
- Use `theme.font.size.*`: `xs`(11px) · `sm`(12px) · `base`(13px) · `md`(14px) · `lg`(16px) · `xl`(18px)
- Font weight: `400` normal, `500` medium, `600` semibold — no `bold`/`700` in UI
- Line height: `1.4` for dense UI, `1.6` for descriptions

### Border Radius
- **MUST** use `theme.border.radius.*`: `sm`(4px) · `base`(6px) · `md`(8px) · `lg`(10px) · `xl`(12px)
- Pills/badges: `999px`
- **MUST NOT** hardcode `border-radius: 4px`

### Transitions — Standard
| Name | Value | Use |
|---|---|---|
| fast | `0.1s ease` | Hover backgrounds, icon color |
| base | `0.15s ease` | Color, border, opacity ← **default** |
| slow | `0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Size changes, sliding panels |
| spring | `0.2s cubic-bezier(0.34, 1.56, 0.64, 1)` | Menu/modal open |

- Use `theme.transition.*` tokens: `theme.transition.fast`, `.base`, `.slow`, `.spring`
- **MUST NOT** use `transition: all` — be explicit: `transition: background-color ${theme.transition.fast}`
- **MUST NOT** transition `width`, `height`, `padding`, `margin` — use `transform` or `max-height` instead

### Interactive States (required on all interactive elements)
```css
/* Hover */
background-color: ...; transition: background-color ${theme.transition.fast};
/* Active */
transform: scale(0.97); transition: transform ${theme.transition.fast};
/* Focus */
outline: 2px solid rgba(brand, 0.5); outline-offset: 2px;
/* Disabled */
opacity: 0.5; cursor: not-allowed;
```

### Loading States
- Use `<Skeleton>` (`src/ui/Skeleton/`) for async content — never show empty containers while loading

### Styled-Components Rules
- One `StyledWrapper.js` per component — no inline `styled.div` in `index.js`
- Prefix style-only props with `$`: `$isActive`, `$variant`
- Use `css` helper for conditional style blocks

### Tailwind: Layout Only
Allowed: `flex`, `grid`, `gap-*`, `p-*`, `m-*`, `w-*`, `h-*`, `overflow-*`, `truncate`, positioning
Not allowed: any color, shadow, radius, border-color utility

---

## Collection File Formats

Collections are stored as files on disk in two formats:

- **`.bru`** — Bruno's proprietary plain-text markup language (parsed by `bruno-lang`)
- **`.yml` / `.yaml`** — YAML format (default for new collections: `DEFAULT_COLLECTION_FORMAT = 'yml'`)

The `bruno-filestore` package abstracts over both formats via `parseRequest`, `stringifyRequest`, `parseCollection`, etc.

---

## Testing

- **Unit tests**: Jest — run with `npm test` per package
- **E2E tests**: Playwright — run with `npm run test:e2e` from root
- Tests live alongside source or in `tests/` directories
- Follow behavior-driven testing — test observable behavior, not implementation details
- Minimize mocking; prefer real flows; only mock external I/O or non-deterministic behavior
- All tests must be **deterministic and fast**
- Add `data-testid` to new interactive UI elements

---

## Build & Dev Commands

```bash
# Install dependencies
npm run setup

# Start dev (Electron + App hot-reload)
npm run dev

# Build specific packages
npm run build:bruno-common
npm run build:bruno-requests
npm run build:bruno-filestore
npm run build:bruno-converters

# Build Electron app
npm run build:electron

# Lint
npm run lint
npm run lint:fix

# Run E2E tests
npm run test:e2e

# Storybook
npm run storybook
```

---

## IPC Communication Pattern

All heavy operations (file I/O, HTTP requests, auth flows) happen in `bruno-electron` main process:

```js
// Renderer (bruno-app)
ipcRenderer.invoke('send-http-request', payload)

// Main (bruno-electron/src/ipc/network/index.js)
ipcMain.handle('send-http-request', async (event, payload) => { ... })
```

IPC handler files in `bruno-electron/src/ipc/`:
- `collection.js` — collection CRUD, file operations
- `network/index.js` — HTTP request execution
- `network/grpc-event-handlers.js` — gRPC
- `network/ws-event-handlers.js` — WebSocket
- `filesystem.js` — file system utilities
- `git.js` — Git operations
- `preferences.js` — app preferences
- `auth.js` — OAuth2 flows

---

## Important Notes

- **Privacy-first**: Local collections stay entirely on the user's filesystem; cloud features are opt-in.
- **Git collaboration**: Collections as files → standard Git workflows apply.
- The project name in `package.json` is `ahaman` (internal codename) but the product is **Bruno**.
- `@usebruno/*` is the npm package scope used across all packages.
- New TypeScript code should go into packages that already use TypeScript (`bruno-common`, `bruno-requests`, `bruno-filestore`, `bruno-schema-types`, `bruno-api`). `bruno-app`, `bruno-electron`, and `bruno-cli` are still JavaScript.
- `bruno-server` is written in **Rust** — do not add Node.js/TypeScript code there.

---

## Bruno Cloud Server — MongoDB Schema

> Full reference: `packages/bruno-server/MONGODB_SCHEMA.md`

### Collections Overview

| Collection | Mô tả | Soft Delete |
|---|---|---|
| `users` | Tài khoản người dùng | ❌ |
| `refresh_tokens` | JWT refresh token (TTL tự xóa) | ❌ |
| `workspaces` | Workspace nhóm làm việc | ❌ |
| `workspace_members` | Quan hệ user ↔ workspace + role | ❌ |
| `collections` | API collection | ✅ `deletedAt` |
| `items` | Folder và Request trong collection | ✅ `deletedAt` |
| `environments` | Biến môi trường (workspace hoặc collection level) | ✅ `deletedAt` |
| `examples` | Response example của request | ✅ `deletedAt` |

### ID Conventions

- **`_id`**: MongoDB `ObjectId` — internal only, never exposed in API responses
- **`uid`**: 21-character nanoid (UUID v4 truncated) — used in all API routes and cross-collection references
- Owner/member joins use `ObjectId` (`owner_id`, `workspace_id`, `user_id`); all other cross-collection refs use nanoid `uid`

### Key Design Decisions

- **`items` collection** stores both Folders and Requests discriminated by `type: "folder" | "request"`. `request`, `settings`, and `filename` fields are only present on requests.
- **`items.seq`** is `f64` (fractional index) — allows reordering without updating every sibling.
- **`environments`** is a single collection for both workspace-level and collection-level envs. Exactly one of `workspaceUid` or `collectionUid` is set; never both.
- **`collections.public_docs`** is an embedded sub-document (not a separate collection). Contains `visibility` (public / password / workspaceMembers / customList), `settings`, and `analytics`.
- **Soft delete**: `deletedAt` field on `collections`, `items`, `environments`, `examples`. All queries must filter `{ deletedAt: null }`. Deleting a folder cascades soft-delete to all child items.
- **`refresh_tokens`** uses a MongoDB TTL index on `expires_at` (expireAfterSeconds: 0) — expired tokens are auto-deleted by MongoDB. Only the bcrypt hash of the token is stored, never the raw value.

### Workspace Roles

| Role | `can_write()` | `is_owner()` | Permissions |
|---|---|---|---|
| `owner` | ✅ | ✅ | Full CRUD + manage members + delete workspace |
| `editor` | ✅ | ❌ | Create/edit collections, items, environments |
| `viewer` | ❌ | ❌ | Read-only |

### Server Logging

Every HTTP request emits one structured JSON log line (default) with:
`request_id`, `method`, `path`, `query`, `ip`, `user_agent`, `content_type`, `content_length_bytes`, `status`, `latency_ms`, `user_id`

- Log level: `5xx → ERROR`, `4xx → WARN`, `2xx/3xx → INFO`
- `LOG_FORMAT=text` for human-readable output; JSON is the default
- `RUST_LOG` controls verbosity (default: `bruno_server=info,warn`)
