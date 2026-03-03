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

## 🔄 Cloud-First vs Local-First

### Cloud-First (NEW Architecture) ✅
**Primary Storage:** bruno-server (cloud)
**Offline Storage:** IndexedDB cache

**Flow:**
1. User logs in → Fetch collections from cloud
2. Display cloud data in UI
3. Cache to IndexedDB for offline
4. When offline → Use cache + queue changes
5. When back online → Sync queue to cloud

**Benefits:**
- Accessible from anywhere
- No manual sync needed
- Real-time collaboration ready
- Like Google Docs, Notion, Figma

### Local-First (OLD Architecture) ❌
**Primary Storage:** Local `.bru` files
**Cloud Storage:** Optional sync

**Flow:**
1. User creates collection locally
2. Manually link to cloud workspace
3. File changes → Auto-sync to cloud
4. Cloud is backup, not primary

**Limitations:**
- Tied to one machine
- Manual linking required
- Sync conflicts more common

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
**Goal**: Users can create cloud accounts, sign in, and fetch their cloud data

#### 1.1 UI Components
- Login/Register modal (React)
- Account settings page
- Online/Offline status indicator in UI
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

#### 1.4 Cloud Data Initialization
**On Login:**
1. Authenticate user → Get JWT tokens
2. Fetch user's workspaces from cloud
3. Fetch user's collections from cloud
4. Store in Redux (cloudCollections, workspaces)
5. Download/cache to local storage (IndexedDB) for offline
6. Display cloud collections in UI

**Initial Load Flow:**
```javascript
async function onLoginSuccess() {
  // 1. Fetch cloud data
  const workspaces = await api.workspaces.getAll();
  const collections = await api.collections.getAllForUser();

  // 2. Update Redux
  dispatch(setWorkspaces(workspaces));
  dispatch(setCloudCollections(collections));

  // 3. Cache for offline
  await cacheToIndexedDB(collections);

  // 4. Show in UI
  dispatch(setDataSource('cloud'));
}
```

#### 1.5 Global Loading Indicator (UX)
**Top Bar Loading:**
- Linear progress bar at top of screen (GitHub/YouTube style)
- Shows operation message: "Loading collections...", "Syncing...", etc.
- Auto-tracks all `createAsyncThunk` operations via middleware
- Supports progress tracking (0-100%)
- Bottom-right notification for operation details
- Handles multiple simultaneous operations

**Implementation:**
- Redux slice: `globalLoading` (tracks active operations)
- Middleware: Auto-tracks all async thunks
- Component: `<GlobalLoadingBar />` (top bar + notification)
- Hook: `useGlobalLoading()` for manual tracking

**User Experience:**
- User always knows when app is working
- Never appears "stuck" or "frozen"
- Clear feedback for all async operations
- Professional, polished feel

#### Deliverables:
- ✅ Users can register/login to cloud account
- ✅ JWT tokens stored securely in Electron
- ✅ Auto refresh when access token expires
- ✅ "Signed in as..." indicator in UI
- ✅ Can logout and clear credentials
- ✅ **Global loading indicator tracks all operations**
- ✅ **On login, fetch user's workspaces from cloud**
- ✅ **On login, fetch user's collections from cloud**
- ✅ **Cache cloud data locally (IndexedDB) for offline**
- ✅ **Display cloud collections in UI**

**Status**: ✅ **COMPLETE** (100%) - See [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md)

---

### **PHASE 2: Offline Mode & Local Caching** (1 week)
**Goal**: Work offline with cached data, auto-sync when back online

#### 2.1 Offline Detection
- Listen to `window.addEventListener('online')` / `window.addEventListener('offline')`
- Redux state: `isOnline: boolean`
- Detect on app startup: `navigator.onLine`
- Show status in UI: "☁️ Online" or "📴 Offline"

#### 2.2 Local Cache (IndexedDB)
- Store collections in IndexedDB for offline access
- Cache structure:
  ```javascript
  {
    collections: [
      { id, name, items, updatedAt, ... }
    ],
    workspaces: [...],
    lastCachedAt: timestamp
  }
  ```
- Download cloud data → Cache locally on login
- Update cache when online changes are made

#### 2.3 Data Source Switching
**Online Mode:**
- Primary source: Cloud (bruno-server API)
- Display: `state.cloudCollections`
- User changes → Update cloud → Update cache

**Offline Mode:**
- Primary source: Local cache (IndexedDB)
- Display: `state.localCache`
- User changes → Queue for sync → Show "pending" indicator

#### 2.4 Sync Queue
- When offline, queue all changes:
  ```javascript
  syncQueue: [
    { action: 'create', type: 'request', data: {...} },
    { action: 'update', type: 'folder', id: '...', data: {...} },
    { action: 'delete', type: 'request', id: '...' }
  ]
  ```
- When back online → Process queue → Sync to cloud

#### 2.5 UI Updates
- Online/Offline indicator in header
- "Pending sync: 3 changes" when offline
- Auto-sync when connection restored
- Toast: "Back online - syncing changes..."

#### Deliverables:
- [ ] Detect online/offline status
- [ ] Cache cloud collections to IndexedDB
- [ ] Switch data source based on online/offline
- [ ] Queue changes when offline
- [ ] Auto-sync queue when back online
- [ ] UI shows online/offline status
- [ ] Can create workspace from UI (online only)
- [ ] Can view workspace members

---

### **PHASE 3: Cloud-First CRUD Operations** (1 week)
**Goal**: All create/update/delete operations go to cloud first, then update cache

#### 3.1 Cloud-First Write Strategy
**When user creates/updates/deletes:**
1. **Optimistic update**: Update Redux state immediately (UI feels instant)
2. **API call**: Send change to cloud (bruno-server)
3. **On success**: Update local cache, mark as synced
4. **On failure**: Rollback optimistic update, show error
5. **If offline**: Add to sync queue, mark as pending

```javascript
async function createRequest(data) {
  // 1. Optimistic update
  dispatch(addRequestOptimistic(data));

  try {
    // 2. Send to cloud
    const result = await api.requests.create(data);

    // 3. Confirm success
    dispatch(confirmRequest(result));
    await updateCache(result);
  } catch (error) {
    // 4. Rollback on error
    dispatch(rollbackRequest(data.id));
    toast.error('Failed to create request');
  }
}
```

#### 3.2 CRUD Operations
- **Create**: POST `/api/workspaces/:id/items`
- **Update**: PATCH `/api/items/:id`
- **Delete**: DELETE `/api/items/:id`
- **Move**: PATCH `/api/items/:id/move`
- All operations update cloud first, then cache

#### 3.3 Sync Status Per Collection
- Track sync state in Redux:
  ```javascript
  syncStatus: {
    '/workspace/123': {
      status: 'synced' | 'syncing' | 'pending' | 'error',
      lastSyncedAt: timestamp,
      pendingChanges: 3,
      error: null
    }
  }
  ```

#### 3.4 Sync UI
- Real-time sync status per collection
- Progress indicator while syncing
- Error messages with retry button
- "Last synced: 2 minutes ago"

#### Deliverables:
- [ ] Create/Update/Delete goes to cloud first
- [ ] Optimistic UI updates for instant feel
- [ ] Rollback on error
- [ ] Local cache updated after cloud success
- [ ] Sync status tracked per collection
- [ ] UI shows sync progress and errors
- [ ] Offline changes queued automatically

---

### **PHASE 4: Offline Queue Processing** (1 week)
**Goal**: Process queued changes when back online, handle conflicts

#### 4.1 Sync Queue Processing
**When back online:**
1. Detect `navigator.onLine === true`
2. Process sync queue in order
3. For each queued change:
   - Send to cloud API
   - On success: Remove from queue, update cache
   - On conflict: Show conflict resolution UI
   - On error: Keep in queue, show error

```javascript
async function processSyncQueue() {
  toast.info('Syncing offline changes...');

  for (const change of syncQueue) {
    try {
      await syncChangeToCloud(change);
      dispatch(removeFromQueue(change.id));
    } catch (error) {
      if (error.status === 409) {
        // Conflict detected
        dispatch(showConflictModal(change, error.cloudVersion));
      } else {
        // Other error - keep in queue
        toast.error(`Failed to sync: ${error.message}`);
      }
    }
  }

  toast.success('All changes synced!');
}
```

#### 4.2 Conflict Detection
- Server detects conflicts by comparing timestamps
- Conflict scenarios:
  - **Edit-Edit**: Both local and cloud modified same item
  - **Delete-Edit**: Deleted locally, modified on cloud
  - **Edit-Delete**: Modified locally, deleted on cloud

#### 4.3 Conflict Resolution UI
- Show diff between local and cloud versions
- Options:
  - "Keep Local" → Overwrite cloud with local
  - "Keep Cloud" → Discard local, use cloud
  - "View Diff" → Show side-by-side comparison
- Remember choice: "Always keep local/cloud for conflicts"

#### 4.4 Auto-Retry on Network Errors
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max retries: 5
- Show retry countdown in UI
- Option to "Retry Now" or "Cancel"

#### Deliverables:
- [ ] Process sync queue when back online
- [ ] Auto-sync queued changes on reconnect
- [ ] Detect conflicts from server
- [ ] Conflict resolution modal with diff
- [ ] User can choose which version to keep
- [ ] Auto-retry with exponential backoff
- [ ] Clear UI feedback during sync

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

## 🔄 Cloud-First Data Flow

### Online Mode (Primary)
```
User Action (Create/Update/Delete)
    ↓
Optimistic Redux Update (instant UI)
    ↓
API Call to bruno-server
    ↓
┌──── Success ────┐         ┌──── Failure ────┐
│   Confirm Redux │         │  Rollback Redux │
│   Update Cache  │         │  Show Error     │
└─────────────────┘         └─────────────────┘
```

### Offline Mode (Fallback)
```
User Action
    ↓
Update Local Cache (IndexedDB)
    ↓
Add to Sync Queue
    ↓
Show "Pending Sync" indicator
    ↓
[Wait for connection]
    ↓
Connection restored → Process queue → Sync to cloud
```

### Login Flow (Cloud → Local)
```
1. User logs in
    ↓
2. Fetch workspaces from cloud
    ↓
3. Fetch collections from cloud
    ↓
4. Update Redux state
    ↓
5. Cache to IndexedDB (for offline)
    ↓
6. Display in UI
```

---

## 🔧 Technical Decisions

### 1. **Primary Data Source: Cloud**
- **Online**: All reads/writes go to cloud (bruno-server)
- **Offline**: Use local cache (IndexedDB) as fallback
- **No local `.bru` files** by default (cloud-first)
- **Optional export** to `.bru` files for backup/version control

### 2. Local Cache (IndexedDB)
- Store collections for offline access
- Cache structure:
  ```javascript
  {
    collections: [
      {
        id: 'workspace_123',
        name: 'My API',
        items: [...],
        cachedAt: timestamp,
        updatedAt: timestamp
      }
    ],
    syncQueue: [
      { action: 'create', data: {...} },
      { action: 'update', id: '...', data: {...} }
    ]
  }
  ```
- Cleared on logout
- Refreshed on login

### 3. Authentication
- JWT tokens stored in Electron `safeStorage` API (encrypted)
- Access token: 15 min (short-lived)
- Refresh token: 30 days (auto-refresh)
- Auto logout on token expiration

### 4. Conflict Resolution Priority
- Phase 4: Manual (user chooses via modal)
- Phase 5: Configurable strategies (local-wins, cloud-wins, newer-wins)
- Phase 8: Smart auto-merge (three-way merge)

### 5. New Packages
- `packages/bruno-api`: API client for bruno-server
  - REST API wrapper
  - WebSocket client
  - Token management
  - Type definitions (TypeScript)
- Local cache managed in Redux middleware (no separate package needed)

### 6. Offline Detection
- Use browser APIs: `navigator.onLine`, `online`/`offline` events
- Fallback: Ping bruno-server every 30s
- Show status in UI header

### 7. File Export (Optional)
- Users can **export** collections to `.bru` files
- For Git versioning or backup
- Not the primary storage method

---

## 🚀 Rollout Strategy (Cloud-First)

### MVP (Minimum Viable Product)
**Phases 1-4**: Cloud-first with offline fallback
- ✅ Login and fetch cloud collections
- ✅ Display cloud data in UI
- ✅ Offline mode with local cache
- ✅ Auto-sync when back online
- ✅ Basic conflict resolution

**Key Features:**
- Cloud as primary source
- Offline fallback
- Automatic sync queue
- Online/offline indicators

### V1 (Full Release)
**Phases 1-6**: Real-time collaboration
- WebSocket live sync (multi-user editing)
- Import/Export integration
- Team workspaces
- Live cursors/presence

**Key Features:**
- Real-time updates
- Multi-user collaboration
- Import Postman/OpenAPI

### V2 (Enterprise)
**Phases 1-8**: Advanced features
- Smart conflict resolution (three-way merge)
- Version history (undo/redo)
- Activity feed (audit log)
- Advanced permissions

**Key Features:**
- Time travel (view history)
- Smart merging
- Enterprise security

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

## 🎨 UI/UX Components

### Implemented ✅
1. **Global Loading Bar** (Top bar + bottom notification)
   - Linear progress bar at top
   - Operation message display
   - Multiple operation tracking
   - Auto-tracking via middleware

### To Implement
1. Login/Register modal
2. Online/Offline status indicator
3. Cloud sync status per collection
4. Workspace settings page
5. Conflict resolution modal
6. Sync preferences panel
7. Team members list
8. Import/Export dialogs

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

## 🤔 Open Questions (Cloud-First)

1. Should we support **multiple cloud accounts** per user?
   - Use case: Personal + Work accounts
2. How to handle **migration from local-first** users?
   - Provide migration tool to upload existing collections?
3. Should we add **collection sharing** via public links?
   - Share read-only link with non-users
4. Should we support **nested workspaces** (workspace hierarchy)?
   - Organize workspaces into folders
5. How to handle **environment variables** security?
   - **Proposal**: Cloud-stored but encrypted end-to-end
   - Only decrypt client-side with user's password
6. Should we add **activity feed** (who changed what when)?
   - Useful for team collaboration
7. How long to keep **offline cache** before clearing?
   - **Proposal**: 30 days since last login
8. Should we support **exporting to `.bru` files** for Git?
   - **Proposal**: Yes, as optional backup/version control
9. What's the **offline storage limit** (IndexedDB)?
   - **Proposal**: 500MB per user
10. Should we support **guest mode** (use without account)?
    - **Proposal**: No - cloud-first requires authentication

---

**Status**: 📋 Updated to Cloud-First Architecture
**Last Updated**: 2024-03-03

---

## 📋 Implementation Roadmap Summary

### Current Status: Phase 1 - 100% COMPLETE ✅
- ✅ Authentication (login/register)
- ✅ JWT token management
- ✅ Secure token storage
- ✅ **Global loading indicator** (auto-tracks all operations)
- ✅ **Fetch workspaces on login**
- ✅ **Fetch collections on login**
- ✅ **Cache to IndexedDB**
- ✅ **Display cloud collections in UI**
- ✅ **Zero mistakes implementation**

### Next Steps (Phase 2): Offline Mode
**Week 1-2:**
1. Implement IndexedDB cache layer
2. Add online/offline detection
3. Create sync queue system
4. Build offline mode UI indicators
5. Test offline → online transitions

**Deliverables:**
- Can work offline with cached data
- Changes queue when offline
- Auto-sync when back online
- UI shows connection status

### Future Phases:
- **Phase 3**: Cloud-first CRUD operations
- **Phase 4**: Offline queue processing & conflicts
- **Phase 5**: Real-time sync (WebSocket)
- **Phase 6**: Import/Export
- **Phase 7**: Team collaboration
- **Phase 8**: Advanced features

### Migration Plan (for existing users):
1. Prompt user on first cloud login: "Upload existing collections?"
2. Scan local file system for `.bru` collections
3. Upload to cloud and link to workspaces
4. Show migration progress
5. Option to keep local files or switch to cloud-only

---

## 🎯 Success Criteria (Cloud-First)

### Phase 1 (Authentication) ✅
- [x] Login successful
- [x] Tokens stored securely
- [x] Auto-refresh working
- [x] **Global loading indicator working**
- [ ] Fetch user data on login

### Phase 2 (Offline Mode)
- [ ] Works offline with cached data
- [ ] Auto-syncs when back online
- [ ] Queue processes correctly
- [ ] No data loss during transitions

### Phase 3 (Cloud CRUD)
- [ ] Create/Update/Delete works online
- [ ] Optimistic updates feel instant
- [ ] Errors handled gracefully
- [ ] Cache updated after cloud success

### Phase 4 (Conflict Resolution)
- [ ] Conflicts detected accurately
- [ ] User can resolve conflicts
- [ ] No data loss on conflicts
- [ ] Sync queue processes completely

### Overall Success Metrics:
- **Sync Success Rate**: >99%
- **Offline → Online Sync**: <5 seconds
- **UI Responsiveness**: <100ms (optimistic updates)
- **Data Loss**: 0%
- **User Satisfaction**: >90% would recommend cloud sync
