# workspace.yml Analysis - Complete Documentation

This directory contains comprehensive analysis of how `workspace.yml` is used throughout the Bruno codebase and what would need to change to migrate to IndexedDB.

## 📚 Documents Included

### 1. **WORKSPACE_YML_SUMMARY.txt** (6 KB) ⭐ START HERE
Quick reference with 10 key points:
- What is workspace.yml?
- Key exports and APIs
- Startup sequence
- Collection add/remove flow
- What data is stored
- Files that depend on it
- What breaks if removed
- Migration roadmap

**Read this first for a quick overview.**

---

### 2. **WORKSPACE_YML_ANALYSIS.md** (17 KB) 📖 DETAILED ANALYSIS
Complete breakdown of all workspace.yml dependencies:

**Sections:**
1. Executive Summary - Data flow & source of truth
2. workspace-config.js exports - All read/write operations
3. workspace.js IPC handlers - Handlers that read/write, startup sequence
4. workspace-watcher.js - File watching mechanism
5. default-workspace.js - Initialization logic
6. Data model - What's in workspace.yml vs elsewhere
7. Collection add/remove flow - Step-by-step
8. Active environment selection - How activeEnvironmentUid is managed
9. Complete startup sequence - Full app initialization
10. What breaks if removed - Impact analysis
11. Lock mechanism - Concurrency control
12. Dependency chain - Complete map

**Read this for deep understanding of every operation.**

---

### 3. **WORKSPACE_YML_DATAFLOW.md** (24 KB) 🔄 VISUAL DIAGRAMS
ASCII diagrams and flowcharts showing:

**1. Application Startup Sequence**
- Detailed flow from app launch to workspace loading
- All workspace.yml read operations during startup
- Watcher attachment process

**2. Add Collection Flow**
- User action through IPC to disk write
- YAML generation and atomic write

**3. Select Environment Flow**
- How activeEnvironmentUid is selected and persisted

**4. File Watching & External Changes**
- How workspace.yml changes are detected
- Debouncing and propagation to renderer

**5. Validation Failure Scenarios**
- What happens when workspace.yml is missing

**6. Concurrent Write Protection**
- How race conditions are prevented
- Lock mechanism in action

**Read this to visualize data flows and understand sequences.**

---

### 4. **WORKSPACE_YML_CODE_REFERENCE.md** (36 KB) 💻 CODE SNIPPETS
Actual code with line numbers showing:

**Files referenced:**
- workspace-config.js (590 lines)
- workspace.js (714 lines)
- workspace-watcher.js (230 lines)
- default-workspace.js (414 lines)
- workspace-environments.js (380+ lines)

**For each file:**
- Key functions with code
- Line numbers for cross-reference
- Critical operations highlighted
- IPC communication patterns
- Lock mechanism implementation

**Read this to see actual code and find specific implementations.**

---

## 🎯 Quick Navigation by Task

### I need to understand the big picture
→ Start with **WORKSPACE_YML_SUMMARY.txt**

### I need to migrate workspace.yml to IndexedDB
1. Read **WORKSPACE_YML_SUMMARY.txt** (Section 10)
2. Read **WORKSPACE_YML_ANALYSIS.md** (Sections 9 & 10)
3. Review **WORKSPACE_YML_CODE_REFERENCE.md** for each component

### I need to find where X is handled
1. Use **WORKSPACE_YML_CODE_REFERENCE.md** for line numbers
2. Check **WORKSPACE_YML_ANALYSIS.md** sections 2-5 for file locations
3. Look at **WORKSPACE_YML_DATAFLOW.md** for flow context

### I need to understand startup
→ **WORKSPACE_YML_DATAFLOW.md** Section 1 (Application Startup)
→ **WORKSPACE_YML_ANALYSIS.md** Section 5 (Startup Sequence)

### I need to understand a specific operation (add collection, select env, etc)
→ **WORKSPACE_YML_DATAFLOW.md** Sections 2-3
→ **WORKSPACE_YML_CODE_REFERENCE.md** for actual code

---

## 🔑 Key Findings Summary

### workspace.yml Is The Primary Source of Truth
- Main process reads it on startup
- All modifications go through its API
- Renderer never reads it directly
- File watchers monitor it for external changes

### What's Stored in workspace.yml
```yaml
collections:           # Collection REFERENCES (paths on disk)
specs:                # API spec file references
info: {name, type}:   # Workspace metadata
docs: ""              # Workspace documentation
activeEnvironmentUid: # Selected environment ID
```

### Critical Dependencies
1. **Startup** - Must read workspace.yml to load workspaces
2. **Validation** - validateWorkspacePath() requires it to exist
3. **Collections** - Collection paths stored only in workspace.yml
4. **Environment Selection** - activeEnvironmentUid persisted here
5. **File Watching** - Detects changes to workspace.yml
6. **Import/Export** - Validates presence in archives

### What Breaks Without workspace.yml
- ❌ Workspace startup fails
- ❌ Last-opened workspaces validation fails
- ❌ Collection locations unknown
- ❌ Active environment selection lost
- ❌ File watching breaks
- ❌ Import/Export fails
- ❌ Entire workspace system fails

### Data Flow Pattern
```
[Renderer/User Action]
        ↓ (IPC)
[Main Process Handler]
        ↓
[Read workspace.yml]
        ↓
[Modify in memory]
        ↓
[Write workspace.yml]
        ↓
[Send update to renderer]
        ↓
[Renderer updates UI]
```

---

## 📋 Migration Checklist for IndexedDB

### Phase 1: Move Data to IDB
- [ ] Move `collections` array to IDB
- [ ] Move `activeEnvironmentUid` to IDB
- [ ] Move `info` (name, type) to IDB
- [ ] Move `docs` to IDB
- [ ] Keep `specs` strategy (likely files)

### Phase 2: Update Validation
- [ ] Remove `validateWorkspacePath()` file check
- [ ] Create `validateWorkspaceInIDB()`
- [ ] Update `renderer:get-last-opened-workspaces` to query IDB
- [ ] Update all workspace validation

### Phase 3: Update Startup
- [ ] main:renderer-ready reads from IDB instead of disk
- [ ] defaultWorkspaceManager creates IDB record instead of workspace.yml
- [ ] isValidDefaultWorkspace() queries IDB
- [ ] Collection initialization from IDB

### Phase 4: Update Operations
- [ ] addCollectionToWorkspace() → IDB write
- [ ] removeCollectionFromWorkspace() → IDB write
- [ ] reorderWorkspaceCollections() → IDB write
- [ ] setActiveGlobalEnvironmentUid() → IDB write
- [ ] All operations maintain transaction safety

### Phase 5: Update Watchers
- [ ] Disable chokidar.watch() for workspace.yml
- [ ] Implement IDB change detection
- [ ] Sync external changes (git)

### Phase 6: Handle Concurrency
- [ ] workspace.yml uses file locks
- [ ] IDB needs transaction-based safety
- [ ] Multi-process scenarios need coordination

### Phase 7: Import/Export
- [ ] Validate workspace data in IDB during import
- [ ] Export workspace data to disk for archiving
- [ ] Maintain backward compatibility

---

## 🔗 File Locations in Codebase

```
packages/bruno-electron/src/
├── utils/
│   ├── workspace-config.js          ← Core read/write API
│   └── workspace-lock.js            ← Concurrency control
├── ipc/
│   ├── workspace.js                 ← IPC handlers (714 lines)
│   ├── preferences.js               ← Triggers main:renderer-ready
│   ├── collection.js                ← Collection operations
│   └── apiSpec.js
├── app/
│   ├── workspace-watcher.js         ← File watching
│   └── onboarding.js                ← Onboarding logic
└── store/
    ├── default-workspace.js         ← Default workspace init
    ├── workspace-environments.js    ← Environment UIDs
    └── last-opened-workspaces.js    ← Workspace list
```

---

## 📌 Critical Code Paths

**Reading workspace.yml:**
- Main: workspace-config.js:210 `readWorkspaceConfig()`
- Used by: workspace.js, workspace-watcher.js, default-workspace.js, workspace-environments.js

**Writing workspace.yml:**
- Main: workspace-config.js:285 `writeWorkspaceConfig()`
- Called by: addCollectionToWorkspace, removeCollectionFromWorkspace, updateWorkspaceName, etc.

**Startup sequence:**
- Entry: workspace.js:650 `main:renderer-ready` event
- Sequence: ensureDefaultWorkspaceExists → readWorkspaceConfig → addWatcher

**Active environment selection:**
- Read: workspace-environments.js:148 `getActiveGlobalEnvironmentUid()`
- Write: workspace-environments.js:167 `setActiveGlobalEnvironmentUid()`

---

## 💡 Implementation Tips

1. **Use IDB transactions** - Prevent race conditions like workspace.yml locks do
2. **Maintain version field** - Similar to `opencollection: 1.0.0`
3. **Keep path resolution logic** - Relative ↔ Absolute conversion is important
4. **Test multi-workspace scenarios** - Multiple workspaces may be open
5. **Handle recovery** - Corrupted IDB should have fallback strategy
6. **Import validation** - Ensure imported data structure is correct
7. **Export compatibility** - May need to export to YAML for portability

---

## 🚀 Getting Started

1. **Understand current system** (2-3 hours)
   - Read WORKSPACE_YML_SUMMARY.txt
   - Read WORKSPACE_YML_ANALYSIS.md
   - Scan WORKSPACE_YML_DATAFLOW.md

2. **Map the code** (1-2 hours)
   - Use WORKSPACE_YML_CODE_REFERENCE.md
   - Follow actual code paths
   - Identify IDB integration points

3. **Design IDB schema** (2-3 hours)
   - Plan collections structure
   - Plan activeEnvironmentUid storage
   - Consider transaction strategy

4. **Implement Phase 1** (4-6 hours)
   - Create IDB stores
   - Migrate readWorkspaceConfig → queryIDB
   - Migrate writeWorkspaceConfig → writeIDB

5. **Update operations** (6-8 hours)
   - Update all handlers
   - Update validation
   - Update watchers

---

## ❓ Questions?

Look for these patterns in the code:
- `readWorkspaceConfig()` - How to read config
- `writeWorkspaceConfig()` - How to write config  
- `withLock()` - How to handle concurrency
- `main:workspace-config-updated` - How to notify renderer
- `chokidar.watch()` - How file watching works
- `ipcMain.handle()` - How IPC handlers work

All answers are in the four documents above!

---

Generated: March 7, 2024
Analysis of: `/packages/bruno-electron/src/`
Goal: Migrate workspace.yml to IndexedDB
