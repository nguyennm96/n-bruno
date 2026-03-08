# Complete Analysis: workspace.yml Usage in Bruno

## EXECUTIVE SUMMARY: DATA FLOW & SOURCE OF TRUTH

**workspace.yml is the PRIMARY source of truth** for workspace metadata. The data flow is:

1. **At Startup**: Main process reads `workspace.yml` → sends config to renderer via IPC
2. **User Actions**: Renderer requests changes via IPC → Main process updates `workspace.yml` on disk
3. **Watching**: chokidar watches `workspace.yml` → if external change detected, sends update to renderer
4. **No IDB sync**: `workspace.yml` is NOT cached/synced to IDB—it's the persistent reference

The key insight: **The renderer never directly writes `workspace.yml`.** All changes go through:
- IPC handlers in main process
- Which read/modify/write to `workspace.yml`
- Then notify renderer of changes

---

## 1. workspace-config.js EXPORTS (Core API)

**File**: `/packages/bruno-electron/src/utils/workspace-config.js`

### READ OPERATIONS
- `readWorkspaceConfig(workspacePath)` - Reads workspace.yml, parses YAML, normalizes to config object
- `getWorkspaceCollections(workspacePath)` - Reads workspace.yml, returns collections with resolved absolute paths
- `getWorkspaceApiSpecs(workspacePath)` - Reads workspace.yml, returns api specs array

### WRITE OPERATIONS
- `writeWorkspaceConfig(workspacePath, config)` - Writes complete config back to workspace.yml (atomic)
- `addCollectionToWorkspace(workspacePath, collection)` - Adds/updates collection entry in workspace.yml
- `removeCollectionFromWorkspace(workspacePath, collectionPath)` - Removes collection from workspace.yml
- `reorderWorkspaceCollections(workspacePath, collectionPaths)` - Reorders collections array in workspace.yml
- `updateWorkspaceName(workspacePath, newName)` - Updates workspace name in workspace.yml
- `updateWorkspaceDocs(workspacePath, docs)` - Updates docs in workspace.yml
- `addApiSpecToWorkspace(workspacePath, apiSpec)` - Adds API spec to workspace.yml
- `removeApiSpecFromWorkspace(workspacePath, apiSpecPath)` - Removes API spec from workspace.yml

### VALIDATION
- `validateWorkspacePath(workspacePath)` - **Requires workspace.yml to exist** ✓
- `validateWorkspaceConfig(config)` - Validates structure
- `isValidCollectionEntry(collection)` - Validates collection objects

### UTILITY
- `generateYamlContent(config)` - Generates YAML string from config object
- `writeWorkspaceFileAtomic(workspacePath, content)` - Low-level write (uses workspace lock)

### KEY PROPERTIES TRACKED
```javascript
workspaceConfig = {
  opencollection: "1.0.0",
  info: {
    name: "Workspace Name",      // ← Workspace name
    type: "workspace"
  },
  collections: [
    { name: "...", path: "...", remote?: "..." }
  ],
  specs: [
    { name: "...", path: "..." }
  ],
  docs: "...",
  activeEnvironmentUid: "..."    // ← Active environment UID
}
```

---

## 2. workspace.js IPC HANDLERS (Main Process Integration)

**File**: `/packages/bruno-electron/src/ipc/workspace.js` (714 lines)

### HANDLERS THAT READ workspace.yml

| Handler | Line | Operation |
|---------|------|-----------|
| `renderer:open-workspace` | 112 | `readWorkspaceConfig()` to load and validate |
| `renderer:open-workspace-dialog` | 141 | `readWorkspaceConfig()` to load and validate |
| `renderer:load-workspace-collections` | 181 | `getWorkspaceCollections()` reads workspace.yml |
| `renderer:load-workspace-apispecs` | 206 | Direct YAML parse of workspace.yml for specs |
| `renderer:get-last-opened-workspaces` | 245 | Checks `workspace.yml` exists for validity |
| `renderer:import-workspace` | 354 | Validates `workspace.yml` exists in zip |
| `renderer:get-collection-workspaces` | 591 | Reads `workspace.yml` to find which workspace has collection |
| `renderer:get-default-workspace` | 625 | `ensureDefaultWorkspaceExists()` → `readWorkspaceConfig()` |

### HANDLERS THAT WRITE workspace.yml

| Handler | Line | Operation |
|---------|------|-----------|
| `renderer:create-workspace` | 64 | `writeWorkspaceConfig()` creates new workspace.yml |
| `renderer:rename-workspace` | 271 | `updateWorkspaceName()` → writes workspace.yml |
| `renderer:reorder-workspace-collections` | 194 | `reorderWorkspaceCollections()` → writes workspace.yml |
| `renderer:add-collection-to-workspace` | 531 | `addCollectionToWorkspace()` → writes workspace.yml |
| `renderer:remove-collection-from-workspace` | 571 | `removeCollectionFromWorkspace()` → writes workspace.yml |
| `renderer:save-workspace-docs` | 435 | `updateWorkspaceDocs()` → writes workspace.yml |

### CRITICAL STARTUP SEQUENCE: main:renderer-ready (lines 647-711)

**Triggered by**: `ipcMain.emit('main:renderer-ready', mainWindow)` in preferences.js:38

**Execution flow** (runs ONLY ONCE):

```javascript
ipcMain.on('main:renderer-ready', async (win) => {
  // 1. Ensure default workspace exists
  const defaultResult = await defaultWorkspaceManager.ensureDefaultWorkspaceExists();
  if (defaultResult) {
    const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml
    const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, workspacePath, true);
    win.webContents.send('main:workspace-opened', workspacePath, workspaceUid, configForClient);
    workspaceWatcher.addWatcher(win, workspacePath);  // ← WATCHES workspace.yml
  }

  // 2. Load last opened workspaces
  const workspacePaths = lastOpenedWorkspaces.getAll();
  for (const workspacePath of workspacePaths) {
    const workspaceYmlPath = path.join(workspacePath, 'workspace.yml');
    if (fs.existsSync(workspaceYmlPath)) {
      const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml
      validateWorkspaceConfig(workspaceConfig);
      win.webContents.send('main:workspace-opened', ...);
      workspaceWatcher.addWatcher(win, workspacePath);
    }
  }
});
```

**KEY INSIGHT**: At app startup:
- ✓ Main process reads `workspace.yml` FIRST (before renderer fully initializes)
- ✓ Default workspace is created if missing
- ✓ Watchers are attached to monitor `workspace.yml` changes
- ✓ Renderer receives workspace config via IPC, NOT from IDB

---

## 3. workspace-watcher.js (File Watching)

**File**: `/packages/bruno-electron/src/app/workspace-watcher.js` (230 lines)

### Purpose
Monitors `workspace.yml` for external changes using chokidar and broadcasts changes to renderer.

### How It Works

```javascript
const handleWorkspaceFileChange = (win, workspacePath) => {
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  const yamlContent = fs.readFileSync(workspaceFilePath, 'utf8');
  const rawConfig = yaml.load(yamlContent);
  const workspaceConfig = normalizeWorkspaceConfig(rawConfig);
  
  // Send update to renderer
  win.webContents.send('main:workspace-config-updated', workspacePath, workspaceUid, workspaceConfig);
};
```

### Key Methods
- `addWatcher(win, workspacePath)` - Attaches chokidar to workspace.yml
  - Debounces writes with `stabilityThreshold: 80ms`
  - Calls `handleWorkspaceFileChange()` on any change
- `removeWatcher(workspacePath)` - Closes watcher

### Watch Targets
1. **workspace.yml** - Main config file
2. **environments/*.yml** - Global environment files
   - `handleGlobalEnvironmentFileAdd()` - Notifies renderer
   - `handleGlobalEnvironmentFileChange()` - Updates renderer
   - `handleGlobalEnvironmentFileUnlink()` - Removes from renderer

---

## 4. default-workspace.js (Initialization)

**File**: `/packages/bruno-electron/src/store/default-workspace.js` (414 lines)

### Role
Creates and manages the default workspace, with recovery/migration logic.

### What It Does During Startup

```javascript
async ensureDefaultWorkspaceExists() {
  // 1. Check if stored path is valid
  const existingPath = this.getDefaultWorkspacePath();
  if (this.isValidDefaultWorkspace(existingPath)) {
    return { workspacePath: existingPath, workspaceUid: 'default' };
  }

  // 2. If no stored path, find latest existing default workspace
  const latestValid = this.findLatestValidWorkspace();
  if (latestValid) {
    await this.setDefaultWorkspacePath(latestValid);
    return { workspacePath: latestValid, workspaceUid: 'default' };
  }

  // 3. Create NEW default workspace
  const newPath = await this.initializeDefaultWorkspace({
    migrateFromPreferences: true,
    recoveredData: null
  });
  return { workspacePath: newPath, workspaceUid: 'default' };
}

async initializeDefaultWorkspace(options) {
  // Creates workspace.yml with initial config
  const workspaceConfig = {
    opencollection: '1.0.0',
    info: { name: 'My Workspace', type: 'workspace' },
    collections: [],
    specs: [],
    docs: ''
  };

  // Migrate from preferences if needed
  if (options.migrateFromPreferences) {
    await this.migrateFromPreferences(workspacePath, workspaceConfig);
  }

  // WRITE workspace.yml
  const yamlContent = generateYamlContent(workspaceConfig);
  await writeFile(path.join(workspacePath, 'workspace.yml'), yamlContent);
  
  return workspacePath;
}
```

### Validation Check
```javascript
isValidDefaultWorkspace(workspacePath) {
  if (!fs.existsSync(workspacePath)) return false;
  const workspaceYmlPath = path.join(workspacePath, 'workspace.yml');
  if (!fs.existsSync(workspaceYmlPath)) return false;  // ← REQUIRES workspace.yml
  
  try {
    const config = readWorkspaceConfig(workspacePath);
    validateWorkspaceConfig(config);
    return true;
  } catch (error) {
    return false;
  }
}
```

---

## 5. Data Model: What's in workspace.yml vs What's Elsewhere

### In workspace.yml ✓
```yaml
opencollection: 1.0.0
info:
  name: "My Workspace"
  type: workspace

collections:
  - name: "API Collection"
    path: "collections/api"          # RELATIVE to workspace root
    remote: "https://..."             # Optional, for sync

specs:
  - name: "OpenAPI Spec"
    path: "specs/openapi.json"

docs: "Workspace documentation..."

activeEnvironmentUid: "env-uid-xyz"  # ← Selected environment for workspace
```

### NOT in workspace.yml (Stored separately) ✗
- **Individual collection files** (collection.bru, requests, etc.) - stored in subdirectories
- **Environment files** - stored in `workspace/environments/*.yml` (not in workspace.yml)
- **Request/API data** - stored in collection subdirectories
- **Secrets** - stored in encrypted env-secrets store

### Data Synchronization
- **workspace.yml ↔ Renderer**: One-way → Main reads `.yml`, broadcasts to renderer via IPC
- **Environment UIDs ↔ workspace.yml**: `activeEnvironmentUid` is stored in `workspace.yml`, NOT separately
- **Collection paths ↔ workspace.yml**: Collection paths (on disk) are stored in `workspace.yml`

---

## 6. Collection Add/Remove Flow (When User Adds Collection)

### When User Clicks "Add Collection":

```
Renderer (React)
    ↓
  IPC: renderer:add-collection-to-workspace
    ↓
Main Process (collection.js NOT involved for this)
    ↓
  IPC Handler: renderer:add-collection-to-workspace (workspace.js:531)
    ↓
  normalizeCollectionEntry(workspacePath, collection)
    ↓
  addCollectionToWorkspace(workspacePath, normalizedCollection)
    ├─ readWorkspaceConfig(workspacePath)        [READ workspace.yml]
    ├─ config.collections.push(newCollection)
    ├─ generateYamlContent(config)
    └─ writeWorkspaceFileAtomic(workspacePath, yamlContent)  [WRITE workspace.yml]
    ↓
  mainWindow.webContents.send('main:workspace-config-updated', ...)
    ↓
Renderer receives update and re-renders
```

### When User Removes Collection:

```
Renderer
    ↓
  IPC: renderer:remove-collection-from-workspace (workspace.js:571)
    ↓
  removeCollectionFromWorkspace(workspacePath, collectionPath)
    ├─ readWorkspaceConfig(workspacePath)        [READ workspace.yml]
    ├─ config.collections.filter(...)             [REMOVE matching]
    ├─ generateYamlContent(config)
    └─ writeWorkspaceFileAtomic(workspacePath, yamlContent)  [WRITE workspace.yml]
    ↓
  mainWindow.webContents.send('main:workspace-config-updated', ...)
    ↓
Renderer receives update
```

---

## 7. Active Environment Selection Flow

### When User Selects Environment:

```
Renderer
    ↓
  IPC: renderer:select-workspace-environment
    ↓
Main Process (workspace-environments.js)
    ↓
  selectGlobalEnvironment(workspacePath, { environmentUid })
    ↓
  setActiveGlobalEnvironmentUid(workspacePath, environmentUid)
    ├─ readWorkspaceConfig(workspacePath)        [READ workspace.yml]
    ├─ workspaceConfig.activeEnvironmentUid = environmentUid
    ├─ generateYamlContent(workspaceConfig)
    └─ writeWorkspaceFileAtomic(workspacePath, yamlContent)  [WRITE workspace.yml]
    ↓
  Returns true
    ↓
Renderer receives result
```

**Key Insight**: `activeEnvironmentUid` is ALWAYS stored in `workspace.yml`, not in the environment file itself.

---

## 8. Complete Startup Sequence (Step by Step)

```
App Launch
  ↓
1. Electron main process initializes
  ↓
2. IPC handlers registered (workspace.js:61+)
  ↓
3. Renderer process launches, creates window
  ↓
4. Renderer sends: ipcMain.emit('main:renderer-ready', mainWindow)
       [from preferences.js:38]
  ↓
5. BOTH handlers triggered (in workspace.js:650 AND onboarding.js:12):
  ├─ main:renderer-ready in workspace.js:
  │  ├─ defaultWorkspaceManager.ensureDefaultWorkspaceExists()
  │  │  ├─ readWorkspaceConfig() if exists ← [READ workspace.yml]
  │  │  └─ OR initializeDefaultWorkspace() → generateYamlContent() → WRITE workspace.yml
  │  │
  │  ├─ FOR each in lastOpenedWorkspaces:
  │  │  ├─ Check workspace.yml exists
  │  │  ├─ readWorkspaceConfig() ← [READ workspace.yml]
  │  │  └─ win.webContents.send('main:workspace-opened', ...)
  │  │
  │  └─ workspaceWatcher.addWatcher() ← MONITORS workspace.yml
  │
  └─ main:renderer-ready in onboarding.js:
     ├─ globalEnvironmentsStore.getGlobalEnvironments()
     │  └─ Reads activeEnvironmentUid FROM workspace.yml
     └─ win.webContents.send('main:load-global-environments', ...)
  ↓
6. Renderer receives 'main:workspace-opened' + workspace config
  ↓
7. Renderer can now display workspaces and collections
```

---

## 9. What Would Break If We Removed workspace.yml

If we moved to IndexedDB and removed `workspace.yml`:

### IMMEDIATE BREAKAGE
1. ❌ **Startup validation** - `validateWorkspacePath()` requires workspace.yml to exist
2. ❌ **Workspace detection** - `renderer:get-last-opened-workspaces` checks `fs.existsSync(workspaceYmlPath)`
3. ❌ **Collection loading** - All collection paths are stored in workspace.yml
4. ❌ **Environment selection** - activeEnvironmentUid saved only in workspace.yml
5. ❌ **Workspace watching** - chokidar watches workspace.yml specifically
6. ❌ **Import/Export** - Import validates workspace.yml, export includes it

### ARCHITECTURE CHANGES NEEDED

To move to IDB, you'd need to:

1. **Move collection list to IDB**
   - Currently: stored in `workspace.yml`
   - Change: `collections` array moved to IDB
   - Also: update all paths to absolute (no relative-to-workspace logic)

2. **Move activeEnvironmentUid to IDB**
   - Currently: stored in `workspace.yml`
   - Change: stored in IDB under workspace metadata

3. **Store workspace metadata in IDB**
   - Currently: `info.name`, `info.type`, `docs`, `opencollection` in `workspace.yml`
   - Change: all moved to IDB, workspace.yml deleted

4. **Disable file watching**
   - Currently: chokidar watches `workspace.yml`
   - Change: no longer needed (IDB is source of truth)

5. **Update all validation**
   - Currently: `validateWorkspacePath()` requires workspace.yml
   - Change: validate IDB record instead

6. **Update startup sequence**
   - Currently: main reads workspace.yml on startup
   - Change: main queries IDB instead

7. **Handle multi-process scenarios**
   - Currently: workspace.yml provides external sync point
   - Change: IDB must handle concurrent access (needs redesign)

---

## 10. Lock Mechanism (Concurrency Control)

All writes use `withLock(getWorkspaceLockKey(workspacePath), async () => {...})` in workspace-config.js:

```javascript
const writeWorkspaceConfig = async (workspacePath, config) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);
  });
};
```

This prevents race conditions when multiple processes try to write `workspace.yml` simultaneously.

---

## CONCLUSION: THE DEPENDENCY CHAIN

```
workspace.yml
├─ Stores: collections paths, workspace name, type, docs, activeEnvironmentUid
├─ Read by:
│  ├─ workspace-config.js (readWorkspaceConfig, getWorkspaceCollections, etc.)
│  ├─ workspace.js IPC handlers (on every workspace operation)
│  ├─ workspace-watcher.js (monitors for changes)
│  ├─ default-workspace.js (creates/initializes)
│  └─ Every workspace startup
├─ Written by:
│  ├─ Any collection add/remove/reorder
│  ├─ Workspace name change
│  ├─ Environment selection
│  ├─ Docs update
│  └─ API spec changes
└─ CRITICAL: There is NO fallback. Without workspace.yml:
   ├─ Collections cannot be located
   ├─ Active environment cannot be determined
   ├─ Workspace metadata is lost
   └─ Entire workspace system breaks
```

**Priority to migrate**: 
1. Collections array → IDB
2. activeEnvironmentUid → IDB
3. Workspace metadata (name, type, docs) → IDB
4. Remove workspace.yml validation everywhere
5. Update startup to query IDB instead of filesystem
