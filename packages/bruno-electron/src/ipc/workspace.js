const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fsExtra = require('fs-extra');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const { ipcMain, dialog } = require('electron');
const { sanitizeName } = require('../utils/filesystem');
const yaml = require('js-yaml');
const {
  parseRequest,
  parseCollection,
  parseFolder,
  parseEnvironment
} = require('@usebruno/filestore');

/**
 * Recursively parse a collection directory from the filesystem into a plain data object.
 * Returns null if the directory is not a Bruno collection.
 */
const readCollectionFromDirectory = (dirPath) => {
  const openCollectionYmlPath = path.join(dirPath, 'opencollection.yml');
  const brunoJsonPath = path.join(dirPath, 'bruno.json');

  let format = 'yml';
  let brunoConfig = null;
  let root = {};

  if (fs.existsSync(openCollectionYmlPath)) {
    try {
      const content = fs.readFileSync(openCollectionYmlPath, 'utf8');
      const parsed = parseCollection(content, { format: 'yml' });
      brunoConfig = parsed.brunoConfig || { name: path.basename(dirPath), version: '1' };
      root = parsed.root || {};
      format = 'yml';
    } catch (e) {
      console.error('[import-workspace] Failed to parse opencollection.yml:', e.message);
      return null;
    }
  } else if (fs.existsSync(brunoJsonPath)) {
    try {
      brunoConfig = JSON.parse(fs.readFileSync(brunoJsonPath, 'utf8'));
      format = 'bru';
    } catch (e) {
      console.error('[import-workspace] Failed to parse bruno.json:', e.message);
      return null;
    }
  } else {
    return null;
  }

  const folders = [];
  const requests = [];
  const SKIP_DIRS = new Set(['environments', 'node_modules', '.git']);

  const scanDirectory = (currentDir, parentUid) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    let seq = 0;

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;

        const folderUid = crypto.randomUUID();
        let folderRoot = null;

        const folderConfigName = format === 'yml' ? 'folder.yml' : 'folder.bru';
        const folderConfigPath = path.join(fullPath, folderConfigName);
        if (fs.existsSync(folderConfigPath)) {
          try {
            const content = fs.readFileSync(folderConfigPath, 'utf8');
            const parsed = parseFolder(content, { format });
            folderRoot = parsed.root || null;
          } catch (_) {}
        }

        folders.push({
          uid: folderUid,
          parentUid: parentUid || null,
          name: entry.name,
          root: folderRoot,
          seq: seq++
        });

        scanDirectory(fullPath, folderUid);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext !== '.bru' && ext !== '.yml') continue;

        const SKIP_FILES = new Set(['folder.bru', 'folder.yml', 'opencollection.yml', 'opencollection.bru']);
        if (SKIP_FILES.has(entry.name)) continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const parsed = parseRequest(content, { format });
          if (!parsed || !parsed.meta) continue;

          requests.push({
            uid: crypto.randomUUID(),
            folderUid: parentUid || null,
            name: parsed.meta.name || path.basename(entry.name, ext),
            type: parsed.meta.type || 'http-request',
            filename: entry.name,
            seq: parsed.meta.seq != null ? parsed.meta.seq : seq++,
            request: parsed.request || {},
            settings: parsed.settings || { encodeUrl: true }
          });
        } catch (e) {
          console.error(`[import-workspace] Failed to parse ${fullPath}:`, e.message);
        }
      }
    }
  };

  scanDirectory(dirPath, null);

  // Read environments
  const environments = [];
  const envDir = path.join(dirPath, 'environments');
  if (fs.existsSync(envDir) && fs.statSync(envDir).isDirectory()) {
    const envFiles = fs.readdirSync(envDir).filter((f) => f.endsWith('.bru') || f.endsWith('.yml'));
    for (const envFile of envFiles) {
      try {
        const content = fs.readFileSync(path.join(envDir, envFile), 'utf8');
        const parsed = parseEnvironment(content, { format });
        if (parsed) {
          environments.push({
            uid: crypto.randomUUID(),
            name: path.basename(envFile, path.extname(envFile)),
            variables: parsed.variables || []
          });
        }
      } catch (e) {
        console.error(`[import-workspace] Failed to parse env ${envFile}:`, e.message);
      }
    }
  }

  return { brunoConfig, root, format, folders, requests, environments };
};

const registerWorkspaceIpc = (mainWindow) => {
  ipcMain.handle('renderer:export-workspace', async (event, workspacePath, workspaceName) => {
    try {
      if (!workspacePath || !fs.existsSync(workspacePath)) {
        throw new Error('Workspace path does not exist');
      }

      const defaultFileName = `${sanitizeName(workspaceName)}.zip`;
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Workspace',
        defaultPath: defaultFileName,
        filters: [{ name: 'Zip Files', extensions: ['zip'] }]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const ignoredDirectories = ['node_modules', '.git'];

      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
          resolve();
        });

        archive.on('error', (err) => {
          reject(err);
        });

        archive.pipe(output);

        const addDirectoryToArchive = (dirPath, archivePath) => {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const entryArchivePath = archivePath ? path.join(archivePath, entry.name) : entry.name;

            if (entry.isDirectory()) {
              if (!ignoredDirectories.includes(entry.name)) {
                addDirectoryToArchive(fullPath, entryArchivePath);
              }
            } else {
              archive.file(fullPath, { name: entryArchivePath });
            }
          }
        };

        addDirectoryToArchive(workspacePath, '');
        archive.finalize();
      });

      return { success: true, filePath };
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:import-workspace', async (event, zipFilePath, extractLocation) => {
    try {
      if (!zipFilePath || !fs.existsSync(zipFilePath)) {
        throw new Error('Zip file does not exist');
      }

      if (!extractLocation || !fs.existsSync(extractLocation)) {
        throw new Error('Extract location does not exist');
      }

      const tempDir = path.join(extractLocation, `_bruno_temp_${Date.now()}`);
      await fsExtra.ensureDir(tempDir);

      try {
        await extractZip(zipFilePath, { dir: tempDir });

        const extractedItems = fs.readdirSync(tempDir);
        let workspaceDir = tempDir;

        if (extractedItems.length === 1) {
          const singleItem = path.join(tempDir, extractedItems[0]);
          if (fs.statSync(singleItem).isDirectory()) {
            workspaceDir = singleItem;
          }
        }

        // Derive workspace name: prefer workspace.yml info.name, fall back to zip filename
        let workspaceName = 'Imported Workspace';
        const workspaceYmlPath = path.join(workspaceDir, 'workspace.yml');
        if (fs.existsSync(workspaceYmlPath)) {
          try {
            const workspaceConfig = yaml.load(fs.readFileSync(workspaceYmlPath, 'utf8'));
            workspaceName = workspaceConfig?.info?.name || workspaceName;
          } catch (_) {}
        }
        const sanitizedName = sanitizeName(workspaceName);

        let finalWorkspacePath = path.join(extractLocation, sanitizedName);
        let counter = 1;
        while (fs.existsSync(finalWorkspacePath)) {
          finalWorkspacePath = path.join(extractLocation, `${sanitizedName} (${counter})`);
          counter++;
        }

        if (workspaceDir !== tempDir) {
          await fsExtra.move(workspaceDir, finalWorkspacePath);
          await fsExtra.remove(tempDir);
        } else {
          await fsExtra.move(tempDir, finalWorkspacePath);
        }

        return {
          success: true,
          workspaceName,
          workspacePath: finalWorkspacePath,
          collections: (() => {
            const result = [];
            try {
              const entries = fs.readdirSync(finalWorkspacePath, { withFileTypes: true });
              for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const fullPath = path.join(finalWorkspacePath, entry.name);
                const collectionData = readCollectionFromDirectory(fullPath);
                if (collectionData) {
                  result.push(collectionData);
                }
              }
            } catch (e) {
              console.error('[import-workspace] Error scanning collections:', e.message);
            }
            return result;
          })()
        };
      } catch (error) {
        await fsExtra.remove(tempDir).catch(() => {});
        throw error;
      }
    } catch (error) {
      throw error;
    }
  });
};

module.exports = registerWorkspaceIpc;
