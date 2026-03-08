# workspace.yml: CODE REFERENCE & FILE LOCATIONS

## Key Files & Their Roles

### 1. Core API: workspace-config.js
**Path**: `/packages/bruno-electron/src/utils/workspace-config.js` (590 lines)

**READ Operations**:
```javascript
// Line 210: Main read function
readWorkspaceConfig(workspacePath) {
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error('Invalid workspace: workspace.yml not found');
  }
  const yamlContent = fs.readFileSync(workspaceFilePath, 'utf8');
  const workspaceConfig = yaml.load(yamlContent);
  return normalizeWorkspaceConfig(workspaceConfig);
}

// Line 440: Get collections with resolved paths
getWorkspaceCollections(workspacePath) {
  const config = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml
  return config.collections.map(collection => {
    if (!path.isAbsolute(collection.path)) {
      return { ...collection, path: path.resolve(workspacePath, collection.path) };
    }
    return collection;
  });
}

// Line 472: Get API specs
getWorkspaceApiSpecs(workspacePath) {
  const config = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml
  return config.specs || [];
}
```

**WRITE Operations**:
```javascript
// Line 285: Main write function (ALL writes go through this)
writeWorkspaceConfig = async (workspacePath, config) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);
  });
};

// Line 333: Add collection to workspace
addCollectionToWorkspace = async (workspacePath, collection) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const config = readWorkspaceConfig(workspacePath);  // ← READ
    if (!config.collections) config.collections = [];
    
    const normalizedCollection = {
      name: collection.name.trim(),
      path: posixifyPath(collection.path.trim())
    };
    
    const existingIndex = config.collections.findIndex(c => c.path === normalizedCollection.path);
    if (existingIndex >= 0) {
      config.collections[existingIndex] = normalizedCollection;
    } else {
      config.collections.push(normalizedCollection);
    }
    
    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);  // ← WRITE
    return config.collections;
  });
};

// Line 368: Remove collection from workspace
removeCollectionFromWorkspace = async (workspacePath, collectionPath) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const config = readWorkspaceConfig(workspacePath);  // ← READ
    
    config.collections = (config.collections || []).filter(c => {
      const absoluteCollectionPath = path.isAbsolute(c.path)
        ? c.path
        : path.resolve(workspacePath, c.path);
      return path.normalize(absoluteCollectionPath) !== path.normalize(collectionPath);
    });
    
    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);  // ← WRITE
    return { removedCollection, updatedConfig: config };
  });
};

// Line 409: Reorder collections
reorderWorkspaceCollections = async (workspacePath, collectionPaths) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const config = readWorkspaceConfig(workspacePath);  // ← READ
    const existing = config.collections || [];
    
    const inNewOrder = [];
    for (const absolutePath of collectionPaths) {
      const entry = existing.find(c => 
        posixifyPath(getNormalizedAbsoluteCollectionPath(workspacePath, c)) === 
        posixifyPath(path.normalize(absolutePath))
      );
      if (entry) inNewOrder.push(entry);
    }
    
    config.collections = [...inNewOrder, ...existing.filter(c => !inNewOrder.includes(c))];
    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);  // ← WRITE
  });
};
```

### 2. IPC Handlers: workspace.js
**Path**: `/packages/bruno-electron/src/ipc/workspace.js` (714 lines)

**Handlers that READ workspace.yml**:
```javascript
// Line 112: Open workspace
ipcMain.handle('renderer:open-workspace', async (event, workspacePath) => {
  validateWorkspacePath(workspacePath);  // ← checks workspace.yml exists
  const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS
  const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, ...);
  return { workspaceConfig: configForClient, workspaceUid, workspacePath };
});

// Line 181: Load workspace collections
ipcMain.handle('renderer:load-workspace-collections', async (event, workspacePath) => {
  validateWorkspacePath(workspacePath);
  return getWorkspaceCollections(workspacePath);  // ← READS workspace.yml
});

// Line 206: Load workspace API specs
ipcMain.handle('renderer:load-workspace-apispecs', async (event, workspacePath) => {
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error('Invalid workspace: workspace.yml not found');
  }
  const yamlContent = fs.readFileSync(workspaceFilePath, 'utf8');  // ← DIRECT READ
  const workspaceConfig = yaml.load(yamlContent);
  return workspaceConfig.specs || [];
});

// Line 245: Get last opened workspaces
ipcMain.handle('renderer:get-last-opened-workspaces', async () => {
  const workspacePaths = lastOpenedWorkspaces.getAll();
  const validWorkspaces = [];
  for (const workspacePath of workspacePaths) {
    const workspaceYmlPath = path.join(workspacePath, 'workspace.yml');
    if (fs.existsSync(workspaceYmlPath)) {  // ← FILE CHECK
      validWorkspaces.push(workspacePath);
    }
  }
  return validWorkspaces;
});
```

**Handlers that WRITE workspace.yml**:
```javascript
// Line 64: Create workspace
ipcMain.handle('renderer:create-workspace', async (event, ...) => {
  const workspaceConfig = createWorkspaceConfig(workspaceName);
  await writeWorkspaceConfig(dirPath, workspaceConfig);  // ← WRITES
  return { workspaceConfig: configForClient, workspaceUid, workspacePath: dirPath };
});

// Line 271: Rename workspace
ipcMain.handle('renderer:rename-workspace', async (event, workspacePath, newName) => {
  await updateWorkspaceName(workspacePath, newName);  // ← READS + WRITES
  return { success: true };
});

// Line 531: Add collection to workspace
ipcMain.handle('renderer:add-collection-to-workspace', async (event, workspacePath, collection) => {
  const normalizedCollection = normalizeCollectionEntry(workspacePath, collection);
  const updatedCollections = await addCollectionToWorkspace(workspacePath, normalizedCollection);  // ← READS + WRITES
  
  const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS AGAIN
  const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, ...);
  mainWindow.webContents.send('main:workspace-config-updated', workspacePath, workspaceUid, configForClient);
  return updatedCollections;
});

// Line 571: Remove collection from workspace
ipcMain.handle('renderer:remove-collection-from-workspace', async (event, ...) => {
  const result = await removeCollectionFromWorkspace(workspacePath, collectionPath);  // ← READS + WRITES
  const configForClient = prepareWorkspaceConfigForClient(result.updatedConfig, ...);
  mainWindow.webContents.send('main:workspace-config-updated', ...);
  return true;
});
```

**CRITICAL: main:renderer-ready (lines 647-711)**:
```javascript
ipcMain.on('main:renderer-ready', async (win) => {
  // Step 1: Ensure default workspace exists
  const defaultResult = await defaultWorkspaceManager.ensureDefaultWorkspaceExists();
  if (defaultResult) {
    const { workspacePath, workspaceUid } = defaultResult;
    const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml (line 663)
    const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, workspacePath, true);
    win.webContents.send('main:workspace-opened', workspacePath, workspaceUid, configForClient);
    if (workspaceWatcher) {
      workspaceWatcher.addWatcher(win, workspacePath);  // ← MONITORS workspace.yml
    }
  }

  // Step 2: Load last opened workspaces
  const workspacePaths = lastOpenedWorkspaces.getAll();
  for (const workspacePath of workspacePaths) {
    if (defaultWorkspacePath && workspacePath === defaultWorkspacePath) {
      continue;
    }
    
    const workspaceYmlPath = path.join(workspacePath, 'workspace.yml');
    if (fs.existsSync(workspaceYmlPath)) {  // ← FILE CHECK (line 683)
      try {
        const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml (line 685)
        validateWorkspaceConfig(workspaceConfig);
        const workspaceUid = getWorkspaceUid(workspacePath);
        const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, workspacePath, false);
        win.webContents.send('main:workspace-opened', workspacePath, workspaceUid, configForClient);
        if (workspaceWatcher) {
          workspaceWatcher.addWatcher(win, workspacePath);
        }
      } catch (error) {
        console.error(`Error loading workspace ${workspacePath}:`, error);
        invalidPaths.push(workspacePath);
      }
    } else {
      invalidPaths.push(workspacePath);
    }
  }
});
```

### 3. File Watching: workspace-watcher.js
**Path**: `/packages/bruno-electron/src/app/workspace-watcher.js` (230 lines)

```javascript
// Line 32: Handle workspace file changes
const handleWorkspaceFileChange = (win, workspacePath) => {
  try {
    const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
    
    if (!fs.existsSync(workspaceFilePath)) {
      return;
    }
    
    const yamlContent = fs.readFileSync(workspaceFilePath, 'utf8');  // ← RE-READ on change
    const rawConfig = yaml.load(yamlContent);
    const workspaceConfig = normalizeWorkspaceConfig(rawConfig);
    
    const type = workspaceConfig.info?.type || workspaceConfig.type;
    if (type !== 'workspace') {
      return;
    }
    
    const workspaceUid = getWorkspaceUid(workspacePath);
    const isDefault = workspaceUid === 'default';
    
    win.webContents.send('main:workspace-config-updated', workspacePath, workspaceUid, {
      ...workspaceConfig,
      name: isDefault ? DEFAULT_WORKSPACE_NAME : workspaceConfig.name,
      type: isDefault ? 'default' : workspaceConfig.type
    });
  } catch (error) {
    console.error('Error handling workspace file change:', error);
  }
};

// Line 132: Add watcher for workspace
addWatcher(win, workspacePath) {
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  const workspaceUid = getWorkspaceUid(workspacePath);
  
  const watcher = chokidar.watch(workspaceFilePath, {
    ignoreInitial: true,
    persistent: true,
    ignorePermissionErrors: true,
    awaitWriteFinish: {
      stabilityThreshold: 80,
      pollInterval: 10
    }
  });
  
  watcher.on('change', () => handleWorkspaceFileChange(win, workspacePath));
  this.watchers[workspacePath] = watcher;
}
```

### 4. Initialization: default-workspace.js
**Path**: `/packages/bruno-electron/src/store/default-workspace.js` (414 lines)

```javascript
// Line 159: Validate workspace exists
isValidDefaultWorkspace(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return false;
  }
  
  const workspaceYmlPath = path.join(workspacePath, 'workspace.yml');
  if (!fs.existsSync(workspaceYmlPath)) {  // ← REQUIRES workspace.yml
    return false;
  }
  
  try {
    const config = readWorkspaceConfig(workspacePath);
    validateWorkspaceConfig(config);
    return true;
  } catch (error) {
    return false;
  }
}

// Line 231: Initialize default workspace
async initializeDefaultWorkspace(options = {}) {
  const { migrateFromPreferences = true, recoveredData = null } = options;
  
  const configDir = app.getPath('userData');
  const baseWorkspacePath = path.join(configDir, 'default-workspace');
  
  let workspacePath = baseWorkspacePath;
  let counter = 1;
  while (fs.existsSync(workspacePath) && counter < MAX_WORKSPACE_CREATION_ATTEMPTS) {
    workspacePath = `${baseWorkspacePath}-${counter}`;
    counter++;
  }
  
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'collections'), { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'environments'), { recursive: true });
  
  const workspaceConfig = {
    opencollection: OPENCOLLECTION_VERSION,
    info: {
      name: 'My Workspace',
      type: WORKSPACE_TYPE
    },
    collections: [],
    specs: [],
    docs: ''
  };
  
  if (migrateFromPreferences) {
    await this.migrateFromPreferences(workspacePath, workspaceConfig);
  }
  
  const yamlContent = generateYamlContent(workspaceConfig);
  await writeFile(path.join(workspacePath, 'workspace.yml'), yamlContent);  // ← WRITES workspace.yml
  
  await this.setDefaultWorkspacePath(workspacePath);
  return workspacePath;
}
```

### 5. Active Environment: workspace-environments.js
**Path**: `/packages/bruno-electron/src/store/workspace-environments.js` (380+ lines)

```javascript
// Line 135: Read active environment UID from workspace.yml
getActiveGlobalEnvironmentUid(workspacePath) {
  try {
    const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
    if (!fs.existsSync(workspaceFilePath)) {
      return null;
    }
    
    const yamlContent = fs.readFileSync(workspaceFilePath, 'utf8');
    const workspaceConfig = yaml.load(yamlContent);  // ← READS workspace.yml (line 145-146)
    
    return workspaceConfig.activeEnvironmentUid || null;  // ← line 148: READS activeEnvironmentUid
  } catch (error) {
    return null;
  }
}

// Line 154: Write active environment UID to workspace.yml
async setActiveGlobalEnvironmentUid(workspacePath, environmentUid) {
  if (!workspacePath) {
    throw new Error('Workspace path is required');
  }
  
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error('Invalid workspace: workspace.yml not found');
  }
  
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const workspaceConfig = readWorkspaceConfig(workspacePath);  // ← READS workspace.yml
    workspaceConfig.activeEnvironmentUid = environmentUid;  // ← line 167: WRITES activeEnvironmentUid
    const yamlOutput = generateYamlContent(workspaceConfig);
    await writeWorkspaceFileAtomic(workspacePath, yamlOutput);  // ← WRITES workspace.yml
    return true;
  });
}

// Line 317: Select global environment
async selectGlobalEnvironment(workspacePath, { environmentUid }) {
  try {
    if (!workspacePath) {
      throw new Error('Workspace path is required');
    }
    
    await this.setActiveGlobalEnvironmentUid(workspacePath, environmentUid);  // ← Updates workspace.yml
    return true;
  } catch (error) {
    throw error;
  }
}
```

## Critical Dependencies Summary

| Function | Reads workspace.yml | Writes workspace.yml | When Called |
|----------|:-------------------:|:--------------------:|------------|
| `readWorkspaceConfig()` | ✓ | ✗ | Every read operation |
| `writeWorkspaceConfig()` | ✗ | ✓ | Every write operation |
| `addCollectionToWorkspace()` | ✓ | ✓ | User adds collection |
| `removeCollectionFromWorkspace()` | ✓ | ✓ | User removes collection |
| `reorderWorkspaceCollections()` | ✓ | ✓ | User reorders collections |
| `setActiveGlobalEnvironmentUid()` | ✓ | ✓ | User selects environment |
| `validateWorkspacePath()` | ✗ | ✗ | Checks file exists |
| `handleWorkspaceFileChange()` | ✓ | ✗ | File watcher triggers |
| `ensureDefaultWorkspaceExists()` | ✓ | ✓ | App startup |
| `isValidDefaultWorkspace()` | ✓ | ✗ | Workspace validation |

## What workspace.yml Contains

```yaml
# workspace.yml structure
opencollection: "1.0.0"

info:
  name: "My Workspace"          # Workspace name
  type: workspace               # Always "workspace"

collections:                    # Collection references (PATHS, not actual files)
  - name: "API Collection"
    path: "collections/api"     # Relative to workspace root
    remote: "https://..."       # Optional git remote

specs:                          # API Specifications
  - name: "OpenAPI Spec"
    path: "specs/openapi.json"

docs: "Workspace documentation"

activeEnvironmentUid: "env-uid-1234"  # Currently selected environment
```

## Lock Mechanism

All writes use `withLock()` to prevent race conditions:

```javascript
// workspace-lock.js (from workspace-config.js)
const withLock = require('./workspace-lock');
const getWorkspaceLockKey = require('./workspace-lock');

writeWorkspaceConfig(workspacePath, config) {
  return withLock(
    getWorkspaceLockKey(workspacePath),  // Lock key is workspace-specific
    async () => {
      // Only one operation can modify this workspace at a time
      const yamlContent = generateYamlContent(config);
      await writeWorkspaceFileAtomic(workspacePath, yamlContent);
    }
  );
}
```

## IPC Communication Pattern

```javascript
// RENDERER (react)
window.ipcRenderer.invoke('renderer:add-collection-to-workspace', workspacePath, collection)
  .then(result => console.log('Collection added'))
  .catch(error => console.error('Failed to add collection'))

// MAIN PROCESS (workspace.js)
ipcMain.handle('renderer:add-collection-to-workspace', async (event, workspacePath, collection) => {
  // 1. Normalize collection paths
  const normalized = normalizeCollectionEntry(workspacePath, collection);
  
  // 2. Add to workspace.yml
  const updatedCollections = await addCollectionToWorkspace(workspacePath, normalized);
  
  // 3. Broadcast update to renderer
  const workspaceConfig = readWorkspaceConfig(workspacePath);
  const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, ...);
  mainWindow.webContents.send('main:workspace-config-updated', workspacePath, workspaceUid, configForClient);
  
  // 4. Return result
  return updatedCollections;
});

// RENDERER receives update
ipcRenderer.on('main:workspace-config-updated', (event, workspacePath, workspaceUid, config) => {
  // Update Redux store
  store.dispatch(actions.updateWorkspaceConfig(workspacePath, config));
});
```

---

This is the complete code reference. Every workspace operation flows through these functions.
