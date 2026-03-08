# DATA FLOW DIAGRAMS: workspace.yml Usage

## 1. APPLICATION STARTUP SEQUENCE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ELECTRON MAIN PROCESS STARTUP                                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. App launches
   │
2. IPC handlers registered (workspace.js:61)
   │
   ├─ registerWorkspaceIpc(mainWindow, workspaceWatcher)
   │  ├─ renderer:create-workspace
   │  ├─ renderer:open-workspace
   │  ├─ renderer:load-workspace-collections
   │  ├─ renderer:add-collection-to-workspace
   │  ├─ renderer:select-workspace-environment
   │  └─ ... (all other handlers)
   │
3. Renderer process launched
   │
4. Window created & ready → ipcMain.emit('main:renderer-ready', mainWindow)
   │                          [Emitted from preferences.js:38]
   │
5. TWO 'main:renderer-ready' listeners triggered:
   │
   ├─[A] workspace.js:650 ──────────────────────────────────────────────────┐
   │     │                                                                    │
   │     ├─ rendererReadyProcessed guard (dev mode)                          │
   │     │                                                                    │
   │     └─ FOR LOOP over workspacePaths (main:renderer-ready at 673):       │
   │        │                                                                 │
   │        ├─ defaultWorkspaceManager.ensureDefaultWorkspaceExists()        │
   │        │  │                                                              │
   │        │  ├─ Check if stored path is valid                             │
   │        │  │  ├─ If valid → return it                                   │
   │        │  │  │                                                          │
   │        │  │  ├─ If not → findLatestValidWorkspace()                    │
   │        │  │  │  └─ For each existing default-workspace-N directory:    │
   │        │  │  │     └─ isValidDefaultWorkspace()                        │
   │        │  │  │        └─ **READ workspace.yml** (line 164)             │
   │        │  │  │           └─ validateWorkspaceConfig()                  │
   │        │  │  │                                                          │
   │        │  │  └─ If none found → initializeDefaultWorkspace()          │
   │        │  │     └─ **WRITE workspace.yml** (line 291)                  │
   │        │  │                                                              │
   │        │  └─ Return { workspacePath, workspaceUid: 'default' }         │
   │        │                                                                 │
   │        └─ workspaceConfig = **readWorkspaceConfig(workspacePath)**      │
   │           (workspace.js:663) ← LINE 663: **READ workspace.yml**        │
   │           │                                                              │
   │           ├─ workspace-config.js:210 readWorkspaceConfig()             │
   │           │  ├─ fs.readFileSync(workspace.yml) ← FILE READ            │
   │           │  ├─ yaml.load(content)              ← PARSE YAML           │
   │           │  └─ normalizeWorkspaceConfig()      ← RETURN NORMALIZED    │
   │           │                                                              │
   │           └─ prepareWorkspaceConfigForClient(config, path, isDefault)  │
   │              ├─ Resolve relative collection paths to absolute         │
   │              ├─ Filter out invalid collections                        │
   │              └─ Return { collections: [...], ...}                     │
   │                                                                         │
   │           win.webContents.send('main:workspace-opened', path, uid,    │
   │                                 configForClient)                       │
   │                                                                         │
   │        FOR each lastOpenedWorkspaces.getAll():                         │
   │        ├─ workspaceYmlPath = path.join(workspacePath, 'workspace.yml')│
   │        │                                                               │
   │        ├─ fs.existsSync(workspaceYmlPath)  ← **FILE CHECK** !!!!       │
   │        │  ├─ If not exist → add to invalidPaths                       │
   │        │  │                                                            │
   │        │  └─ If exist:                                                │
   │        │     └─ workspaceConfig = **readWorkspaceConfig()**            │
   │        │        ← LINE 685: **READ workspace.yml** AGAIN             │
   │        │        │                                                      │
   │        │        ├─ validateWorkspaceConfig()                          │
   │        │        ├─ getWorkspaceUid()                                  │
   │        │        ├─ prepareWorkspaceConfigForClient()                  │
   │        │        │                                                      │
   │        │        └─ win.webContents.send('main:workspace-opened', ...) │
   │        │                                                               │
   │        └─ workspaceWatcher.addWatcher(win, workspacePath)             │
   │           │  ← ATTACH FILE WATCHER TO workspace.yml                  │
   │           │                                                            │
   │           └─ chokidar.watch(workspaceFilePath, {...})                │
   │              ├─ awaitWriteFinish: stabilityThreshold: 80ms           │
   │              │                                                        │
   │              └─ On 'change' event:                                   │
   │                 └─ handleWorkspaceFileChange()                       │
   │                    ├─ **RE-READ workspace.yml** from disk             │
   │                    └─ Send 'main:workspace-config-updated' to renderer│
   │
   │
   └─────────────────────────────────────────────────────────────────────────┘
   │
   ├─[B] onboarding.js:12  ─────────────────────────────────────────────────┐
   │     │                                                                    │
   │     └─ Load global environments                                         │
   │        ├─ globalEnvironmentsStore.getGlobalEnvironments()              │
   │        │  ├─ Read environment files from workspace/environments/*.yml  │
   │        │  └─ Return array of environments                             │
   │        │                                                                │
   │        ├─ globalEnvironmentsStore.getActiveGlobalEnvironmentUid()       │
   │        │  └─ **READ activeEnvironmentUid FROM workspace.yml**           │
   │        │     (workspace-environments.js:148)                           │
   │        │                                                                │
   │        └─ win.webContents.send('main:load-global-environments', {...}) │
   │
   │
   └─────────────────────────────────────────────────────────────────────────┘

6. Renderer receives all workspace and environment data via IPC
   │
7. UI renders workspaces and collections
```

**KEY INSIGHTS FROM STARTUP:**
- ✓ Main process reads `workspace.yml` on startup (multiple times!)
- ✓ Last-opened validation CHECKS if `workspace.yml` exists (filesystem check)
- ✓ Watchers attach to `workspace.yml` to detect external changes
- ✓ Renderer NEVER reads workspace.yml directly—always via IPC
- ✓ `activeEnvironmentUid` is READ from `workspace.yml` during startup


## 2. ADD COLLECTION FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER ADDS COLLECTION TO WORKSPACE                                           │
└─────────────────────────────────────────────────────────────────────────────┘

RENDERER (React)
│
├─ User clicks "Add Collection" → selects folder
│
└─ window.ipcRenderer.invoke('renderer:add-collection-to-workspace',
                              workspacePath, collection)
   │
   └─ IPC Bridge to Main Process
      │
      ↓ MAIN PROCESS (workspace.js:531)
      │
      ipcMain.handle('renderer:add-collection-to-workspace', async (event, 
                                                               workspacePath, 
                                                               collection) => {
        │
        ├─ normalizeCollectionEntry(workspacePath, collection)
        │  └─ makeRelativePath() to convert absolute → relative path
        │
        └─ updatedCollections = await addCollectionToWorkspace(
                                        workspacePath, 
                                        normalizedCollection)
           │
           └─ workspace-config.js:333 addCollectionToWorkspace()
              │
              └─ withLock(getWorkspaceLockKey(workspacePath), async () => {
                 │
                 ├─ config = **readWorkspaceConfig(workspacePath)**
                 │           ← **READ workspace.yml from disk**
                 │
                 ├─ config.collections = config.collections || []
                 │
                 ├─ normalizedCollection = {
                 │    name: collection.name.trim(),
                 │    path: posixifyPath(collection.path.trim()),
                 │    remote?: collection.remote
                 │  }
                 │
                 ├─ existingIndex = config.collections.findIndex(
                 │                   c => c.path === normalizedCollection.path)
                 │
                 ├─ if (existingIndex >= 0) {
                 │    config.collections[existingIndex] = normalizedCollection
                 │  } else {
                 │    config.collections.push(normalizedCollection)
                 │  }
                 │
                 ├─ yamlContent = generateYamlContent(config)
                 │                ← Generate YAML string from config
                 │
                 └─ await writeWorkspaceFileAtomic(workspacePath, yamlContent)
                    ← **WRITE workspace.yml to disk**
              })
        │
        ├─ Read fresh config after write
        │  workspaceConfig = readWorkspaceConfig(workspacePath)
        │
        ├─ Get workspace UID
        │  workspaceUid = getWorkspaceUid(workspacePath)
        │
        ├─ Prepare config for renderer
        │  configForClient = prepareWorkspaceConfigForClient(...)
        │
        └─ mainWindow.webContents.send('main:workspace-config-updated',
                                        workspacePath, 
                                        workspaceUid, 
                                        configForClient)
           │
           └─ IPC Bridge to Renderer
              │
              ↓ RENDERER
              │
              └─ Receives 'main:workspace-config-updated' event
                 │
                 └─ Updates Redux store with new collections
                    └─ UI re-renders with new collection
```

**WHAT HAPPENS TO workspace.yml:**
```
BEFORE:
collections:
  - name: "Existing"
    path: "collections/existing"

AFTER (after write):
collections:
  - name: "Existing"
    path: "collections/existing"
  - name: "New Collection"
    path: "collections/new-collection"
```


## 3. SELECT ENVIRONMENT FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER SELECTS ENVIRONMENT FOR WORKSPACE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

RENDERER (React)
│
├─ User clicks environment in dropdown
│
└─ window.ipcRenderer.invoke('renderer:select-workspace-environment',
                              workspacePath, 
                              environmentUid)
   │
   └─ IPC Bridge to Main Process
      │
      ↓ MAIN PROCESS (workspace.js:471)
      │
      ipcMain.handle('renderer:select-workspace-environment', async (event,
                                                               workspacePath,
                                                               environmentUid) => {
        │
        └─ await globalEnvironmentsManager.selectGlobalEnvironment(
                                           workspacePath, 
                                           { environmentUid })
           │
           └─ workspace-environments.js:317 selectGlobalEnvironment()
              │
              └─ await this.setActiveGlobalEnvironmentUid(workspacePath, 
                                                          environmentUid)
                 │
                 └─ workspace-environments.js:154 setActiveGlobalEnvironmentUid()
                    │
                    └─ withLock(getWorkspaceLockKey(workspacePath), async () => {
                       │
                       ├─ workspaceConfig = **readWorkspaceConfig(workspacePath)**
                       │                    ← **READ workspace.yml from disk**
                       │
                       ├─ workspaceConfig.activeEnvironmentUid = environmentUid
                       │
                       ├─ yamlOutput = generateYamlContent(workspaceConfig)
                       │               ← Generate YAML string
                       │
                       ├─ await writeWorkspaceFileAtomic(workspacePath, yamlOutput)
                       │  ← **WRITE workspace.yml to disk**
                       │
                       └─ return true
                    })
      │
      └─ return true
         │
         └─ IPC Bridge to Renderer
            │
            ↓ RENDERER
            │
            └─ Receives success
               │
               └─ Updates UI to show selected environment
```

**WHAT HAPPENS TO workspace.yml:**
```
BEFORE:
activeEnvironmentUid: "env-old-uid-123"
info:
  name: "My Workspace"
  type: workspace

AFTER (after write):
activeEnvironmentUid: "env-new-uid-456"      ← CHANGED
info:
  name: "My Workspace"
  type: workspace
```


## 4. FILE WATCHING & EXTERNAL CHANGES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL CHANGE TO workspace.yml (e.g., edited in git, external tool)      │
└─────────────────────────────────────────────────────────────────────────────┘

External Process
│
├─ Modifies workspace.yml on disk
│
└─ File system event triggered

CHOKIDAR WATCHER (workspace-watcher.js:132, line 150)
│
├─ Detects file change (debounced with 80ms stability threshold)
│
└─ handleWorkspaceFileChange(win, workspacePath) called
   │
   └─ workspace-watcher.js:32
      │
      ├─ workspaceFilePath = path.join(workspacePath, 'workspace.yml')
      │
      ├─ fs.readFileSync(workspaceFilePath, 'utf8')  ← **RE-READ workspace.yml**
      │
      ├─ yamlContent = readFileSync content
      │
      ├─ rawConfig = yaml.load(yamlContent)  ← **PARSE YAML**
      │
      ├─ workspaceConfig = normalizeWorkspaceConfig(rawConfig)
      │
      ├─ type = workspaceConfig.type
      │
      ├─ if (type !== 'workspace') return  ← Validate
      │
      ├─ workspaceUid = getWorkspaceUid(workspacePath)
      │
      └─ win.webContents.send('main:workspace-config-updated',
                               workspacePath, 
                               workspaceUid, 
                               workspaceConfig)
         │
         └─ IPC Bridge to Renderer
            │
            ↓ RENDERER
            │
            └─ Receives 'main:workspace-config-updated'
               │
               └─ Updates Redux store with fresh config
                  └─ UI re-renders to reflect external changes
```

**IMPLICATIONS:**
- If workspace.yml is manually edited externally, Bruno detects and updates
- If workspace.yml is deleted, watcher will stop functioning (file no longer exists)
- Watcher is PER-WORKSPACE (one watcher per open workspace)


## 5. VALIDATION FAILURE SCENARIO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ VALIDATION CHECKS THAT REQUIRE workspace.yml TO EXIST                      │
└─────────────────────────────────────────────────────────────────────────────┘

Case 1: User tries to OPEN non-existent workspace
  │
  └─ window.ipcRenderer.invoke('renderer:open-workspace', workspacePath)
     │
     └─ workspace.js:112 → validateWorkspacePath()
        │
        ├─ fs.existsSync(workspacePath)
        │  └─ if not exist → throw Error('Workspace path does not exist')
        │
        └─ fs.existsSync(path.join(workspacePath, 'workspace.yml'))
           │
           └─ ❌ if not exist → throw Error('Invalid workspace: workspace.yml not found')
              │
              └─ ❌ OPERATION FAILS

Case 2: Last opened workspaces validation
  │
  └─ workspace.js:673 main:renderer-ready
     │
     └─ FOR each workspacePath in lastOpenedWorkspaces:
        │
        └─ fs.existsSync(path.join(workspacePath, 'workspace.yml'))
           │
           ├─ ❌ if not exist → add to invalidPaths
           │  └─ lastOpenedWorkspaces.remove(workspacePath)
           │
           └─ ✓ if exist → proceed with loading

Case 3: Default workspace validation
  │
  └─ default-workspace.js:159 isValidDefaultWorkspace()
     │
     ├─ fs.existsSync(workspacePath)
     │  └─ if not exist → return false
     │
     └─ fs.existsSync(path.join(workspacePath, 'workspace.yml'))
        │
        └─ ❌ if not exist → return false (workspace marked invalid)

Case 4: Import workspace from zip
  │
  └─ workspace.js:354 renderer:import-workspace
     │
     ├─ Extract zip to temp directory
     │
     └─ workspaceYmlPath = path.join(workspaceDir, 'workspace.yml')
        │
        └─ fs.existsSync(workspaceYmlPath)
           │
           └─ ❌ if not exist → throw Error('Invalid workspace: workspace.yml not found in the zip file')
              │
              └─ ❌ IMPORT FAILS
```

---

## 6. CONCURRENT WRITE PROTECTION

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WHAT PREVENTS RACE CONDITIONS WHEN MULTIPLE OPERATIONS MODIFY workspace.yml│
└─────────────────────────────────────────────────────────────────────────────┘

Scenario: Multiple processes/handlers try to write to workspace.yml simultaneously

Operation 1: Add Collection A        Operation 2: Add Collection B
       │                                    │
       └─ renderer:add-collection           └─ renderer:add-collection
          │                                    │
          └─ addCollectionToWorkspace()       └─ addCollectionToWorkspace()
             │                                   │
             └─ withLock(                       └─ withLock(
                  getWorkspaceLockKey(...)        getWorkspaceLockKey(...) 
                                                   **← WAITS HERE UNTIL OP1 COMPLETES**
                  async () => {                     
                    readWorkspaceConfig()      
                    push(collectionA)          
                    generateYamlContent()      
                    writeWorkspaceFileAtomic() ← OP1 COMPLETES
                  }                              
                )                              THEN:
                   ↓                            async () => {
             Lock Released                       readWorkspaceConfig() ← NOW HAS BOTH A & B!
                                                 push(collectionB)
                                                 generateYamlContent()
                                                 writeWorkspaceFileAtomic()
                                               }

Result: workspace.yml correctly contains BOTH Collection A and Collection B
        (Order depends on lock acquisition, but both are present)
```

**Lock Implementation**: `/packages/bruno-electron/src/utils/workspace-lock.js`
```javascript
withLock(lockKey, async callback) {
  // Acquires mutex lock for lockKey
  // Prevents concurrent modifications to workspace.yml
  // Lock is workspace-specific via getWorkspaceLockKey()
}

getWorkspaceLockKey(workspacePath) {
  // Returns: `workspace-lock-${workspacePath}`
  // Each workspace has its own lock
  // Multiple workspaces can write simultaneously
}
```

---

## SUMMARY: workspace.yml is CRITICAL to every operation

```
Every significant operation touches workspace.yml:

1. Startup              → READ workspace.yml (multiple times)
2. Open workspace      → READ workspace.yml
3. Add collection      → READ + WRITE workspace.yml
4. Remove collection   → READ + WRITE workspace.yml
5. Reorder collections → READ + WRITE workspace.yml
6. Select environment  → READ + WRITE workspace.yml (activeEnvironmentUid)
7. Import workspace    → VALIDATE workspace.yml exists in zip
8. Export workspace    → INCLUDE workspace.yml in zip
9. File watching       → MONITOR workspace.yml for changes
10. Validation         → REQUIRE workspace.yml exists

Without workspace.yml, NONE of these operations can succeed.
```
