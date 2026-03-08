# workspace.yml Quick Reference Card

## 🎯 One-Page Summary

### What is workspace.yml?
- **Location**: `<workspace-root>/workspace.yml`
- **Format**: YAML
- **Purpose**: Stores workspace metadata (SOURCE OF TRUTH)
- **Size**: ~200-500 bytes typically
- **Updated**: Every collection/environment change

### What's Inside?
```yaml
opencollection: "1.0.0"                    # Version
info:
  name: "My Workspace"                     # Workspace name
  type: workspace                          # Always "workspace"
collections:                               # REFERENCES to collections
  - name: "API"
    path: "collections/api"                # Relative path
specs:                                     # API specs
  - name: "OpenAPI"
    path: "specs/openapi.json"
docs: "..."                                # Workspace docs
activeEnvironmentUid: "env-uid-123"        # Selected environment
```

### Key Files to Know
| File | Purpose | Key Functions |
|------|---------|----------------|
| `workspace-config.js` | Core API | readWorkspaceConfig, writeWorkspaceConfig, addCollectionToWorkspace |
| `workspace.js` | IPC Handlers | All commands from renderer (650-714: startup) |
| `workspace-watcher.js` | Monitors file | Detects external changes, notifies renderer |
| `default-workspace.js` | Init | Creates workspace.yml on startup |
| `workspace-environments.js` | Env Storage | Reads/writes activeEnvironmentUid |

### Startup Sequence (5 steps)
1. **App launches** → Main process initializes
2. **IPC handlers registered** → Ready to receive commands
3. **Renderer ready** → Sends `main:renderer-ready` event
4. **Main reads workspace.yml** → readWorkspaceConfig() × multiple times
5. **Renderer receives config** → Via `main:workspace-opened` IPC event

### User Actions (Pattern)
```
User clicks button in Renderer
  ↓
window.ipcRenderer.invoke('renderer:ACTION', args)
  ↓
Main process handler reads workspace.yml
  ↓
Modifies config in memory
  ↓
Writes workspace.yml back to disk
  ↓
Sends 'main:workspace-config-updated' to renderer
  ↓
Renderer updates UI
```

### All Operations That Touch workspace.yml
| Operation | Read | Write | File | Handler Line |
|-----------|:----:|:-----:|:----:|-------------:|
| Open workspace | ✓ | ✗ | workspace.js | 112 |
| Create workspace | ✗ | ✓ | workspace.js | 64 |
| Add collection | ✓ | ✓ | workspace-config.js | 333 |
| Remove collection | ✓ | ✓ | workspace-config.js | 368 |
| Reorder collections | ✓ | ✓ | workspace-config.js | 409 |
| Select environment | ✓ | ✓ | workspace-environments.js | 154 |
| Rename workspace | ✓ | ✓ | workspace-config.js | 310 |
| Change docs | ✓ | ✓ | workspace-config.js | 323 |
| Load last opened | ✓ | ✗ | workspace.js | 245 |
| Validate workspace | ✓ | ✗ | workspace-config.js | 165 |
| Export workspace | ✓ | ✗ | workspace.js | 294 |
| Import workspace | ✓ | ✓ | workspace.js | 354 |

### Critical Lines
```javascript
// Startup (main:renderer-ready)
workspace.js:650   ipcMain.on('main:renderer-ready', ...)
workspace.js:663   readWorkspaceConfig()  ← FIRST READ
workspace.js:673   FOR each lastOpenedWorkspaces
workspace.js:683   fs.existsSync(workspace.yml)  ← FILE CHECK!
workspace.js:685   readWorkspaceConfig()  ← SECOND READ

// Add collection
workspace.js:531   ipcMain.handle('renderer:add-collection-to-workspace')
workspace-config.js:333  addCollectionToWorkspace()
workspace-config.js:339  readWorkspaceConfig()
workspace-config.js:360  config.collections.push()
workspace-config.js:362  generateYamlContent()
workspace-config.js:363  writeWorkspaceFileAtomic()

// Select environment
workspace-environments.js:317  selectGlobalEnvironment()
workspace-environments.js:154  setActiveGlobalEnvironmentUid()
workspace-environments.js:166  readWorkspaceConfig()
workspace-environments.js:167  workspaceConfig.activeEnvironmentUid = ...
workspace-environments.js:169  writeWorkspaceFileAtomic()
```

### What Breaks If Removed
- ❌ Workspace startup (validation fails at line 174)
- ❌ Last-opened validation (file check fails at line 683)
- ❌ Collection loading (paths are stored here)
- ❌ Environment selection (activeEnvironmentUid lost)
- ❌ File watching (no file to watch)
- ❌ Import/Export (expected in archive)
- ❌ Entire workspace system

### Race Condition Prevention
All writes use:
```javascript
withLock(getWorkspaceLockKey(workspacePath), async () => {
  // Only one operation can modify per workspace
  readWorkspaceConfig()
  // ... modify ...
  writeWorkspaceFileAtomic()
})
```

### If Migrating to IDB
Priority order:
1. Move `collections` array → IDB
2. Move `activeEnvironmentUid` → IDB  
3. Move workspace metadata → IDB
4. Replace file validation with IDB queries
5. Replace reads from disk with IDB reads
6. Implement transaction-based writes
7. Update watchers/listeners

### Important Functions to Find
- `readWorkspaceConfig(workspacePath)` — Line 210 in workspace-config.js
- `writeWorkspaceConfig(workspacePath, config)` — Line 285
- `addCollectionToWorkspace(workspacePath, collection)` — Line 333
- `removeCollectionFromWorkspace(workspacePath, collectionPath)` — Line 368
- `validateWorkspacePath(workspacePath)` — Line 165
- `setActiveGlobalEnvironmentUid(workspacePath, uid)` — Line 154 in workspace-environments.js
- `main:renderer-ready` event handler — Line 650 in workspace.js

### Data Flow
```
Renderer (React) 
    ↓ IPC invoke
Main Process Handler (workspace.js)
    ↓ read disk
workspace.yml on disk
    ↓ parse YAML
Config object in memory
    ↓ modify
Updated config
    ↓ write disk
workspace.yml updated
    ↓ send IPC
Renderer gets update
    ↓ Redux
UI updates
```

### Lock Mechanism
```javascript
// Prevents concurrent writes
withLock(getWorkspaceLockKey(workspacePath), async () => {
  // Operation A executes
  // Operation B waits here...
  // Operation B executes after A completes
});
```

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| "workspace.yml not found" | validateWorkspacePath() | File must exist |
| Collection not showing | Path in workspace.yml missing | Add collection via IPC |
| Environment selection lost | activeEnvironmentUid not in file | Select via IPC |
| Import fails | workspace.yml missing in zip | Include in archive |
| Changes not persisting | Write failed (disk full?) | Check disk space |

### Testing Checklist
- [ ] Startup reads workspace.yml ✓
- [ ] Collections load from workspace.yml ✓
- [ ] Adding collection updates workspace.yml ✓
- [ ] Removing collection updates workspace.yml ✓
- [ ] Environment selection updates activeEnvironmentUid ✓
- [ ] External changes detected by watcher ✓
- [ ] Last-opened validation checks workspace.yml ✓
- [ ] Import validates workspace.yml exists ✓
- [ ] Export includes workspace.yml ✓
- [ ] Concurrent operations don't corrupt file ✓

### Related Components (Don't Read Yet)
- IDB Store Structure (to be designed)
- Collection file structure (.bru files)
- Environment files (workspace/environments/*.yml)
- Request storage format
- Secrets encryption

---

**For more details, see:**
- WORKSPACE_YML_SUMMARY.txt (10-point overview)
- WORKSPACE_YML_ANALYSIS.md (12-section deep dive)
- WORKSPACE_YML_DATAFLOW.md (6 flow diagrams)
- WORKSPACE_YML_CODE_REFERENCE.md (actual code examples)
- README_WORKSPACE_YML.md (complete navigation guide)
