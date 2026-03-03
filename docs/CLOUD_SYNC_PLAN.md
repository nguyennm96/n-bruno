# Bruno Cloud Sync - Implementation Plan
**Architecture**: Cloud-First with Offline Fallback

---

## 🎯 Vision

Enable Bruno users to:
- ✅ **Cloud-first experience**: Collections stored in cloud, accessible anywhere
- ✅ **Automatic sync on login**: Fetch user's collections and workspaces from cloud
- ✅ **Offline fallback**: Work with cached local files when internet is unavailable
- ✅ **Auto-sync when online**: Local changes sync to cloud automatically when internet returns
- ✅ **Real-time collaboration**: Multiple users work on same workspace with live updates

---

## 🏗️ Architecture Overview (Cloud-First)

```
┌──────────────────────────────────────────────────────────────┐
│                     Bruno Electron App                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Redux Store (Primary State)            │   │
│  │  - cloudCollections (from bruno-server)             │   │
│  │  - localCache (for offline)                         │   │
│  │  - isOnline / isOffline                             │   │
│  │  - syncQueue (pending changes)                      │   │
│  └───────┬─────────────────────────────────────┬───────┘   │
│          │                                     │            │
│          │                                     │            │
│    ┌─────▼──────────┐              ┌──────────▼─────────┐  │
│    │ Local Cache    │              │   Bruno API        │  │
│    │ (IndexedDB)    │◄─────────────┤   Client Service   │  │
│    │ - Offline Only │   Download   │   + WebSocket      │  │
│    │ - Read Cache   │              │   + Sync Manager   │  │
│    └────────────────┘              └──────────┬─────────┘  │
│                                               │             │
└───────────────────────────────────────────────┼─────────────┘
                                                │
                                    HTTPS + WSS │
                                                │
                         ┌──────────────────────▼───────┐
                         │   bruno-server (Cloud)       │
                         │   (Rust Backend)             │
                         │   - JWT Auth                 │
                         │   - MongoDB (Primary DB)     │
                         │   - WebSocket Sync           │
                         │   - Import/Export            │
                         │   - User Collections         │
                         └──────────────────────────────┘

Data Flow:
  Online:  Cloud (primary) → Redux → UI
           User changes → Cloud → Update cache

  Offline: Cache → Redux → UI
           User changes → Queue → Sync when online
```

---

## 📦 Implementation Phases

### **PHASE 1: Authentication & Cloud Account** (1 week)
**Goal**: Users can create cloud accounts and sign in

#### 1.1 UI Components
- Login/Register modal (React)
- Account settings page
- Cloud sync toggle in preferences
- Authentication status indicator in UI

#### 1.2 API Client Service
- Create `packages/bruno-api` - HTTP client for bruno-server
- JWT token management (access + refresh)
- Auto token refresh when expired
- Store tokens securely (Electron safeStorage)

#### 1.3 Redux Integration
- New slice: `auth` (user info, login state, tokens)
- Actions: login, logout, register, refreshToken
- Persist auth state to encrypted storage

#### Deliverables:
- [ ] Users can register/login to cloud account
- [ ] JWT tokens stored securely in Electron
- [ ] Auto refresh when access token expires
- [ ] "Signed in as..." indicator in UI
- [ ] Can logout and clear credentials

---

### **PHASE 2: Cloud Workspaces** (1 week)
**Goal**: Map local collections to cloud workspaces

#### 2.1 Workspace Mapping
- Local collection folder → Cloud workspace
- Store mapping: `{ localPath: "/path/to/collection", cloudWorkspaceId: "abc123" }`
- UI to link existing collection to cloud workspace
- Create new cloud workspace from local collection

#### 2.2 Sync Metadata
- Store sync state per collection:
  - `lastSyncedAt`: timestamp
  - `syncEnabled`: boolean
  - `conflictStrategy`: "local-wins" | "cloud-wins" | "manual"
- Metadata stored in `.bruno/cloud-sync.json` (gitignored)

#### 2.3 UI Updates
- "Cloud Sync" button in collection toolbar
- Sync status indicator (synced, syncing, conflict, offline)
- Workspace members list (read-only for now)

#### Deliverables:
- [ ] Can link local collection to cloud workspace
- [ ] Metadata file tracks sync state
- [ ] UI shows which collections are cloud-synced
- [ ] Can create new cloud workspace from local collection
- [ ] Can view workspace members (read-only)

---

### **PHASE 3: One-Way Sync (Local → Cloud)** (1 week)
**Goal**: Push local changes to cloud (upload only)

#### 3.1 Change Detection
- Watch `.bru` files for changes (existing file watcher)
- Detect: file created, modified, deleted, moved
- Queue changes to sync (debounced)

#### 3.2 Upload Strategy
- Parse `.bru` file → convert to bruno-server format
- Create/Update/Delete via REST API:
  - POST `/api/collections/:id/requests`
  - PATCH `/api/items/:id`
  - DELETE `/api/items/:id`
- Handle conflicts (for now: local always wins)

#### 3.3 Sync UI
- Manual "Push to Cloud" button
- Auto-sync toggle in settings
- Show last synced time
- Sync progress indicator

#### Deliverables:
- [ ] Local file changes detected automatically
- [ ] Can manually push to cloud
- [ ] Can enable auto-push on file save
- [ ] UI shows sync progress and last synced time
- [ ] Errors shown clearly (network issues, auth expired, etc.)

---

### **PHASE 4: Two-Way Sync (Cloud → Local)** (1 week)
**Goal**: Pull cloud changes to local files

#### 4.1 Download Strategy
- Fetch collection from cloud API
- Convert bruno-server format → `.bru` files
- Write to filesystem (update existing files)

#### 4.2 Conflict Detection
- Compare timestamps: `local.modifiedAt` vs `cloud.updatedAt`
- Detect conflicts:
  - Both changed since last sync
  - Deleted locally but updated on cloud
  - Updated locally but deleted on cloud

#### 4.3 Conflict Resolution
- **Phase 4a**: Manual resolution (show diff, let user choose)
- **Phase 4b**: Auto strategies (configurable: local-wins, cloud-wins, newer-wins)

#### 4.4 Sync UI
- Manual "Pull from Cloud" button
- Conflict resolution modal
- Show what changed (diff viewer)

#### Deliverables:
- [ ] Can manually pull from cloud
- [ ] Conflicts detected and shown to user
- [ ] User can choose which version to keep
- [ ] Changes written to local `.bru` files
- [ ] Redux state updated after pull

---

### **PHASE 5: Real-Time Sync (WebSocket)** (1 week)
**Goal**: Instant updates when team members make changes

#### 5.1 WebSocket Client
- Connect to `ws://bruno-server/ws?token={jwt}`
- Subscribe to workspace events
- Handle reconnection (exponential backoff)

#### 5.2 Event Handling
- Receive events:
  - `CollectionChanged`: collection created/updated/deleted
  - `ItemChanged`: request/folder created/updated/deleted/moved
  - `EnvironmentChanged`: env vars updated
- Update Redux state in real-time
- Optionally update local files (if auto-sync enabled)

#### 5.3 Optimistic Updates
- When user makes change:
  1. Update local state immediately (optimistic)
  2. Push to cloud via API
  3. If fails → rollback local state
  4. WebSocket broadcast to others (sender excluded)

#### 5.4 Sync UI
- Live indicator: "John is editing this request..."
- Real-time status: "Syncing..." → "Synced ✓"
- Offline indicator when disconnected

#### Deliverables:
- [ ] WebSocket connection established on login
- [ ] Real-time updates from other users appear in UI
- [ ] Local files updated automatically (optional)
- [ ] Optimistic UI updates
- [ ] Reconnection works after network loss
- [ ] Offline mode gracefully degrades

---

### **PHASE 6: Import/Export Integration** (3 days)
**Goal**: Leverage bruno-server import/export features

#### 6.1 Import from Cloud
- UI: "Import from Postman" button
- Upload Postman JSON to bruno-server
- Pull imported collection to local files
- Create `.bru` files from imported data

#### 6.2 Export to OpenAPI
- UI: "Export to OpenAPI" button
- Call bruno-server export API
- Download OpenAPI 3.0 spec
- (Bonus: Swagger 2.0 export)

#### Deliverables:
- [ ] Can import Postman collection via cloud
- [ ] Imported collection synced to local files
- [ ] Can export collection to OpenAPI/Swagger
- [ ] Export UI integrated in collection context menu

---

### **PHASE 7: Team Collaboration** (1 week)
**Goal**: Multi-user workspace features

#### 7.1 Workspace Members
- Invite team members via email
- Assign roles: Owner, Editor, Viewer
- Remove members (Owner only)

#### 7.2 Permissions
- Viewer: Read-only, cannot push changes
- Editor: Can create/edit/delete items
- Owner: Full control + member management

#### 7.3 UI
- Members tab in workspace settings
- Invite modal
- Role badges in UI
- Permission errors shown clearly

#### Deliverables:
- [ ] Can invite team members to workspace
- [ ] Roles enforced by bruno-server
- [ ] UI shows permission errors (e.g., "Read-only workspace")
- [ ] Can view member list with roles

---

### **PHASE 8: Advanced Features** (Optional)
**Goal**: Polish and enterprise features

#### 8.1 Offline Queue
- Queue changes when offline
- Auto-sync when back online
- Show queued changes count

#### 8.2 Conflict Resolution Strategies
- Auto-merge simple changes (different fields)
- Three-way merge for smart conflict resolution
- Version history (view past versions)

#### 8.3 Selective Sync
- Choose which collections to sync
- Exclude sensitive collections from cloud
- Sync specific folders only

#### 8.4 Performance
- Batch API calls (upload multiple items at once)
- Compression for large collections
- Incremental sync (only changed items)

---

## 🔧 Technical Decisions

### 1. File Format Compatibility
- **Keep `.bru` format unchanged** on disk
- Convert `.bru` ↔ bruno-server JSON format in sync layer
- Use existing `bruno-filestore` package for parsing

### 2. Sync Metadata Storage
- Create `.bruno/` folder in collection root (gitignored)
- Store in `.bruno/cloud-sync.json`:
  ```json
  {
    "workspaceId": "abc123",
    "lastSyncedAt": "2024-03-02T12:00:00Z",
    "syncEnabled": true,
    "conflictStrategy": "manual",
    "items": {
      "request-123.bru": {
        "cloudId": "item_xyz",
        "lastSyncedHash": "sha256..."
      }
    }
  }
  ```

### 3. Authentication
- JWT tokens stored in Electron `safeStorage` API (encrypted)
- Access token: 15 min (short-lived)
- Refresh token: 30 days (auto-refresh)
- Auto logout on token expiration

### 4. Conflict Resolution Priority
- Phase 4: Manual (user chooses)
- Phase 5: Configurable strategies
- Phase 8: Smart auto-merge

### 5. New Packages
- `packages/bruno-api`: API client for bruno-server
  - REST API wrapper
  - WebSocket client
  - Token management
  - Type definitions (TypeScript)
- `packages/bruno-sync`: Sync logic
  - Conflict detection
  - File ↔ API conversion
  - Change queue
  - Sync strategies

---

## 🚀 Rollout Strategy

### MVP (Minimum Viable Product)
**Phases 1-4**: Basic cloud sync
- Users can backup collections to cloud
- Manual push/pull
- Basic conflict resolution

### V1 (Full Release)
**Phases 1-6**: Real-time collaboration
- WebSocket live sync
- Import/Export integration
- Team workspaces

### V2 (Enterprise)
**Phases 1-8**: Advanced features
- Offline queue
- Smart conflict resolution
- Selective sync
- Version history

---

## 🔐 Security Considerations

1. **Never store credentials in localStorage** → Use Electron safeStorage
2. **HTTPS only** for API calls
3. **WSS (WebSocket Secure)** for real-time
4. **JWT expiration** enforced
5. **API keys/secrets** never synced to cloud (use `.env` locally)
6. **Workspace permissions** enforced server-side
7. **Audit log** for enterprise (future)

---

## 📊 Success Metrics

1. **Sync Success Rate**: >99% of syncs succeed without conflicts
2. **Sync Latency**: <2 seconds from file save to cloud update
3. **Real-time Latency**: <500ms from user A change to user B update
4. **Conflict Rate**: <1% of syncs result in conflicts
5. **User Adoption**: X% of users enable cloud sync

---

## 🎨 UI/UX Mockups Needed

1. Login/Register modal
2. Cloud sync status indicator
3. Workspace settings page
4. Conflict resolution modal
5. Sync preferences panel
6. Team members list
7. Import/Export dialogs

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during sync | HIGH | Backup before sync, rollback on error |
| Sync conflicts too frequent | MEDIUM | Smart merge strategies, user education |
| Performance with large collections | MEDIUM | Incremental sync, compression, batching |
| Network unreliable | MEDIUM | Offline queue, auto-retry with backoff |
| Users confused by hybrid model | LOW | Clear UI, good defaults, documentation |

---

## 📝 Next Steps

**Before starting Phase 1:**
1. ✅ Review this plan
2. [ ] Get user feedback/approval
3. [ ] Create UI mockups
4. [ ] Setup `packages/bruno-api` scaffold
5. [ ] Write detailed Phase 1 tasks

**Estimated Total Timeline**: 6-8 weeks (MVP), 10-12 weeks (V1)

---

## 🤔 Open Questions

1. Should we support **multiple cloud accounts** per user?
2. Should `.bruno/` folder be **gitignored by default**?
3. Should we add **collection sharing** via public links?
4. Should we support **nested workspaces** (workspace hierarchy)?
5. How to handle **environment variables** (local vs cloud)?
   - Proposal: Keep `.env` files local-only for security
6. Should we add **activity feed** (who changed what when)?

---

**Status**: 📋 Planning Phase - Awaiting Approval
**Last Updated**: 2024-03-02
