# @usebruno/app

The frontend UI package for Bruno — an open-source, offline-first desktop API client. This React application runs inside the Electron shell and communicates with the main process via IPC for all file system and network operations.

## Overview

This package contains the full UI layer of Bruno, built with React 19 and Redux Toolkit. It is bundled via [Rsbuild](https://rsbuild.dev/) and rendered inside `packages/bruno-electron`.

---

## Features

### Request Types
- **HTTP** — all standard methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- **GraphQL** — queries, mutations, subscriptions; introspection docs viewer
- **gRPC** — unary and streaming calls
- **WebSocket** — connect, send, and receive messages

### Authentication
- Basic, Bearer Token, API Key
- OAuth 2.0 — Authorization Code, Client Credentials, Password, Implicit grant types
- AWS Signature v4
- Digest, NTLM, WSSE

### Request Configuration
- Query params, path params, headers
- Body formats: JSON, form-url-encoded, multipart/form-data, binary, raw text
- Per-request proxy and certificate settings
- Request-level variables and environment interpolation

### Scripting & Testing
- Pre-request and post-response JavaScript scripts
- Declarative assertions
- JavaScript test blocks with `expect`-style assertions
- Test results panel with pass/fail visualization
- Script error panel

### Environments & Variables
- Per-collection environments with variable sets
- Global environments shared across collections
- Runtime variable injection
- Secrets support with masked display

### Collections
- Collections stored as plain-text `.bru` or `.yaml` files on disk
- Folder-based hierarchy with drag-and-drop reordering
- Collection runner — run all or selected requests sequentially
- Clone, rename, remove collections
- Import from Postman, OpenAPI/Swagger
- Share collections *(cloud feature)*

### Documentation
- **Request docs** — Markdown editor per request; auto-renders params and headers summary
- **Folder docs** — Markdown editor per folder; lists all child requests with method badges
- **Collection overview docs** — Markdown editor in Collection Settings
- **Generate Docs** — Export collection as a standalone interactive HTML file (via [OpenCollection](https://opencollection.com)); no login required, works fully offline
- **Publish Docs** *(cloud only)* — Publish collection docs to a public URL via Bruno Cloud; supports custom slug, custom CSS, custom logo, password protection, and view analytics

### Response Viewer
- Formatted response body: JSON tree, raw, HTML preview, XML, image
- Response headers panel
- Timeline with request/response timing breakdown
- Status code, response time, and response size metadata
- Export, copy, or download response body
- Response examples — save and browse example responses per request

### WebSocket & gRPC
- WebSocket message history with full send/receive log
- gRPC unary and streaming response viewer

### API Spec Viewer
- Render OpenAPI / Swagger specs inline (via swagger-ui-react)
- Browse spec endpoints alongside live requests

### Code Generation
- Generate code snippets (cURL and more) for any request

### Cookies
- Per-domain cookie jar management
- View, edit, and delete cookies

### Preferences & Settings
- Light / dark theme
- Proxy configuration (global and per-collection)
- SSL certificate management
- Font and layout preferences
- Keyboard shortcuts

### DevTools & Terminal
- Embedded DevTools panel (via Electron)
- Network request log
- Embedded xterm.js terminal with "Open in Terminal" from collection context menu

### Tabs
- Multi-tab request editing with draft/saved state
- Unsaved changes indicator

### Global Utilities
- Global search across all collections and requests
- Network status indicator
- Cloud sync status badge
- Internationalization (i18next)

### Cloud Features *(requires authentication)*
- Cloud workspaces
- Collection sharing
- Publish Docs with public URL, password protection, and analytics
- Cloud sync

---

## Tech Stack

| Concern | Library |
|---|---|
| UI framework | React 19 |
| State management | Redux Toolkit + Immer |
| Styling | styled-components (colors/theme) + Tailwind CSS (layout) |
| Code editor | CodeMirror 5 |
| GraphQL IDE | GraphiQL 3 |
| Terminal | xterm.js |
| Forms | Formik + Yup |
| Notifications | react-hot-toast |
| i18n | i18next |
| Bundler | Rsbuild |
| Testing | Jest + @testing-library/react |
| E2E tests | Playwright |

---

## Scripts

```bash
# Development — hot-reload UI (run inside Electron via bruno-electron)
npm run dev

# Production build
npm run build

# Unit tests
npm test

# Storybook component explorer
npm run storybook
npm run build-storybook
```

---

## Project Structure

```
src/
  components/       # Feature components, each in its own folder
  providers/        # Context providers: Theme, ReduxStore, Hotkeys, App, Toaster
  providers/ReduxStore/slices/  # Redux slices: collections, tabs, workspaces, auth, ...
  hooks/            # Shared custom hooks
  utils/            # Shared utilities: collections, URL, auth, importers, exporters
  pages/            # Routing pages
  ui/               # Generic reusable UI primitives (Button, Dropdown, etc.)
  themes/           # Theme definitions (light/dark)
  services/         # Service layer utilities
  selectors/        # Redux selectors
```

---

## Communication with Electron

All heavy operations (file I/O, HTTP requests, OAuth flows) run in the Electron main process (`packages/bruno-electron`) via IPC:

```js
// Renderer (this package)
ipcRenderer.invoke('send-http-request', payload);

// Main process (bruno-electron)
ipcMain.handle('send-http-request', async (event, payload) => { ... });
```

---

## Related Packages

| Package | Role |
|---|---|
| `packages/bruno-electron` | Electron main process, IPC handlers |
| `packages/bruno-lang` | `.bru` file parser/serializer |
| `packages/bruno-filestore` | File I/O layer |
| `packages/bruno-requests` | HTTP networking layer |
| `packages/bruno-js` | Script/test runtime |
| `packages/bruno-api` | API client types and methods |
| `packages/bruno-common` | Shared utilities |
| `packages/bruno-public-docs` | Public documentation viewer app |
