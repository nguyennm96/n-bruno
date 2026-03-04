# 🔄 Cloud-Local Sync Mechanism

## 📋 Overview

Bruno's cloud sync system implements a **smart bidirectional synchronization** between cloud server and local cache, với conflict resolution dựa trên timestamps.

---

## 🎯 Core Principles

### 1. **Anonymous Mode** (Chưa đăng nhập)
- ✅ Chỉ đọc data từ local filesystem (anonymous directory)
- ✅ KHÔNG có cloud operations
- ✅ Tất cả changes lưu local only
- ✅ **KHÔNG BAO GIỜ** share data với authenticated session

### 2. **Authenticated Mode** (Đã đăng nhập)

**⚠️ CRITICAL**: Authenticated session **TUYỆT ĐỐI KHÔNG** dùng data từ anonymous local directory.

#### **First Login Flow**:
```
1. Login success → Save tokens
2. dispatch(initializeCloudData(userId))
3. Fetch workspaces từ cloud API
4. If workspaces.length === 0:
   ├─► Auto-create "My Workspace" on server
   ├─► Fetch items for new workspace
   ├─► Cache to IndexedDB
   └─► Done! UI shows workspace
5. If auto-create fails:
   └─► Show CloudOnboardingModal (manual creation)
```

#### **Online** (Có internet):
```
1. Fetch data từ cloud API
2. Load cached data từ IndexedDB
3. Compare timestamps giữa cloud vs local
4. Merge với strategy:
   - Nếu cloud mới hơn → Download cloud version
   - Nếu local mới hơn → Flag for upload (TODO: implement upload)
   - Nếu bằng nhau → Conflict → Last-write-wins
5. Cache merged result vào IndexedDB
6. Display merged data trong UI
```

#### **Offline** (Không có internet):
```
1. Load data từ IndexedDB cache
2. Display cached data
3. Flag các changes để sync sau khi online
4. Show offline indicator trong UI
```

---

## 🔧 Implementation

### Sync Utilities (`syncUtils.js`)

#### **`compareTimestamps(localTime, cloudTime)`**
```javascript
// Returns: 'local' | 'cloud' | 'conflict'
const result = compareTimestamps(
  localItem.updatedAt,    // ISO timestamp
  cloudItem.updated_at    // ISO timestamp
);
```

#### **`mergeCollectionItems(localItems, cloudItems)`**
```javascript
const { merged, conflicts, needsUpload } = mergeCollectionItems(
  cachedItems,  // Local cache
  cloudItems    // From API
);

// Returns:
// - merged: Array of merged items with _syncStatus
// - conflicts: Array of conflicts needing resolution
// - needsUpload: Array of local-only items
```

#### **Sync Status Markers**
Mỗi item có `_syncStatus` field:
- `'cloud-only'` - Item chỉ có trên cloud
- `'local-only'` - Item chỉ có ở local (cần upload)
- `'cloud-newer'` - Cloud version mới hơn (đã download)
- `'local-newer'` - Local version mới hơn (cần upload)
- `'conflict'` - Timestamps bằng nhau (resolved by last-write-wins)

---

## 📊 Data Flow

### Startup Flow (Authenticated)

```
App Start (With Valid Tokens)
  │
  ├─► loadSavedAuth()
  │   ├─► Verify tokens with API
  │   ├─► Get user info
  │   └─► dispatch(initializeCloudData(userId)) [Non-blocking]
  │
  └─► UI renders với loading state

initializeCloudData:
  │
  ├─► dispatch(fetchWorkspaces())
  │   ├─► Online: Fetch từ API
  │   ├─► Offline: Load từ cache
  │   └─► Update Redux state
  │
  ├─► If workspaces.length === 0:
  │   ├─► Auto-create default workspace on server
  │   │   ├─► dispatch(createWorkspace({ name, description }))
  │   │   ├─► dispatch(fetchWorkspaceItems(workspaceId))
  │   │   ├─► Cache workspace to IndexedDB
  │   │   └─► Return success
  │   │
  │   └─► If creation fails:
  │       └─► dispatch(setNeedsCloudOnboarding(true))
  │           └─► Show CloudOnboardingModal
  │
  └─► Else (has workspaces):
      ├─► Cache workspaces to IndexedDB
      └─► for each workspace:
          └─► dispatch(fetchWorkspaceItems(workspaceId))
              ├─► Load cached items
              ├─► Online: Fetch cloud items
              ├─► Merge với sync logic
              │   ├─► Compare timestamps
              │   ├─► Resolve conflicts
              │   └─► Flag items needing upload
              ├─► Cache merged result
              └─► Return merged items
```

### Login Flow

```
User Login
  │
  ├─► dispatch(login({ email, password }))
  │   ├─► Call API: POST /auth/login
  │   ├─► Save tokens to secure storage
  │   ├─► toast.success("Welcome back!")
  │   └─► dispatch(initializeCloudData(userId)) [Background]
  │
  └─► Authenticated session starts
      ├─► Fetch cloud workspaces
      ├─► If empty → Auto-create default
      └─► Display cloud data in UI

⚠️  NO local anonymous data is loaded!
```

### Logout Flow

```
User Logout
  │
  ├─► dispatch(logout())
  │   ├─► Revoke refresh token on server
  │   ├─► Clear tokens from secure storage
  │   ├─► Clear IndexedDB cache (cloud data)
  │   ├─► dispatch(resetWorkspaces()) - Clear cloud workspaces
  │   ├─► Clear collections state
  │   ├─► dispatch(loadAnonymousWorkspaces()) - Load local data
  │   └─► toast.success("Logged out")
  │
  └─► Anonymous session starts
      └─► Display local data from anonymous directory
```

### Sync Comparison Example

**Scenario**: User has local changes + cloud has updates

```javascript
// Cached (Local)
[
  { id: 1, name: "Request A", updatedAt: "2026-03-03T10:00:00Z" },
  { id: 2, name: "Request B", updatedAt: "2026-03-03T09:00:00Z" },
  { id: 3, name: "Request C", updatedAt: "2026-03-03T08:00:00Z" }  // Local-only
]

// Cloud (Server)
[
  { id: 1, name: "Request A", updated_at: "2026-03-03T09:30:00Z" },
  { id: 2, name: "Request B Updated", updated_at: "2026-03-03T10:30:00Z" },
  { id: 4, name: "Request D", updated_at: "2026-03-03T11:00:00Z" }  // Cloud-only
]

// Merged Result
[
  { 
    id: 1, 
    name: "Request A",              // Local version (newer)
    updatedAt: "2026-03-03T10:00:00Z",
    _syncStatus: 'local-newer'      // → Need upload
  },
  { 
    id: 2, 
    name: "Request B Updated",      // Cloud version (newer)
    updated_at: "2026-03-03T10:30:00Z",
    _syncStatus: 'cloud-newer'      // ✅ Downloaded
  },
  { 
    id: 3, 
    name: "Request C", 
    updatedAt: "2026-03-03T08:00:00Z",
    _syncStatus: 'local-only'       // → Need upload
  },
  { 
    id: 4, 
    name: "Request D", 
    updated_at: "2026-03-03T11:00:00Z",
    _syncStatus: 'cloud-only'       // ✅ Downloaded
  }
]

// needsUpload array (for future implementation)
[
  { id: 1, name: "Request A", updatedAt: "2026-03-03T10:00:00Z" },
  { id: 3, name: "Request C", updatedAt: "2026-03-03T08:00:00Z" }
]
```

---

## 🎨 UI States

### Loading States
```javascript
// Sidebar/Collections checks:
if (isAuthenticated && isLoadingCloudData) {
  return <div>Loading workspaces...</div>;
}
```

### Offline State
```javascript
// Network detection
const isOnline = useSelector(state => state.network.isOnline);

// Show offline banner
{!isOnline && <OfflineBanner />}
```

### Sync Conflicts
```javascript
// Items with conflicts show indicator
{item._syncStatus === 'conflict' && (
  <ConflictIcon tooltip="Version conflict - showing latest" />
)}
```

---

## 🔮 Future Enhancements

### Phase 2: Upload Local Changes
```javascript
// TODO: Implement in cloudWorkspaces.js
export const uploadLocalChanges = createAsyncThunk(
  'workspaces/uploadChanges',
  async ({ workspaceId, items }, { rejectWithValue }) => {
    try {
      // Batch upload items to cloud
      await brunoApi.collections.batchUpdate(workspaceId, items);
      return { workspaceId, uploadedCount: items.length };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

### Phase 3: Real-time Sync
- WebSocket connection cho live updates
- Optimistic UI updates
- Automatic background sync every N minutes

### Phase 4: Conflict Resolution UI
- Manual conflict resolution modal
- Side-by-side diff view
- Cherry-pick changes

---

## 🧪 Testing Scenarios

### Test 1: Online → Offline → Online
```
1. Login với internet → Cloud data loads
2. Make changes offline → Saved to cache
3. Go back online → Auto-sync with merge
4. Verify changes uploaded to cloud
```

### Test 2: Concurrent Edits
```
1. Edit request on Device A
2. Edit same request on Device B
3. Device A syncs first
4. Device B syncs → Conflict detected
5. Last-write-wins applies
6. Verify final state consistent
```

### Test 3: Fresh Install
```
1. Login on new device
2. No cached data
3. Download all from cloud
4. Verify complete sync
```

---

## 📝 Configuration

### Sync Intervals
```javascript
// syncUtils.js
const SYNC_INTERVAL_MINUTES = 5;  // Auto-sync every 5 minutes
const MAX_CONFLICTS_AUTO_RESOLVE = 10;  // Auto-resolve up to 10 conflicts
```

### Cache Strategy
```javascript
// IndexedDB structure
{
  workspaces: [],           // Workspace metadata
  items: {                  // Collection items by workspace
    [workspaceId]: []
  },
  lastSync: {               // Last sync timestamps
    [workspaceId]: "2026-03-03T12:00:00Z"
  }
}
```

---

## ⚠️ Known Limitations

1. **Upload not implemented**: Local changes flagged but not uploaded yet
2. **No real-time sync**: Changes require manual refresh or app restart
3. **Binary data**: Large files (images, attachments) not synced
4. **Conflict resolution**: Always uses last-write-wins, no manual resolution yet

---

## 🔗 Related Files

- `cloudWorkspaces.js` - Main sync logic
- `cloudWorkspaces/syncUtils.js` - Sync utilities
- `utils/cache/indexedDB.js` - Cache storage
- `components/Sidebar/Collections/index.js` - UI rendering
- `auth.js` - Authentication + sync initialization
