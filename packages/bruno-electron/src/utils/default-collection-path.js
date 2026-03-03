const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * Get the default collections base directory
 * Returns: ~/Library/Application Support/Bruno/collections/
 */
const getCollectionsBaseDir = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'collections');
};

/**
 * Get the default collection directory for current user
 * - Not logged in: collections/anonymous/
 * - Logged in: collections/user_{userId}/
 */
const getDefaultCollectionDir = (userId = null) => {
  const baseDir = getCollectionsBaseDir();
  const userDir = userId ? `user_${userId}` : 'anonymous';
  const fullPath = path.join(baseDir, userDir);

  // Ensure directory exists
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created default collections directory: ${fullPath}`);
  }

  return fullPath;
};

/**
 * Get path for a new collection
 * Auto-generates name if not provided: "My Collection", "My Collection 2", etc.
 */
const getNewCollectionPath = (userId = null, collectionName = null) => {
  const userDir = getDefaultCollectionDir(userId);

  // If no name provided, generate one
  if (!collectionName) {
    collectionName = generateCollectionName(userDir);
  }

  // Sanitize collection name (remove special chars)
  const safeName = collectionName.replace(/[^a-zA-Z0-9-_ ]/g, '');
  const collectionPath = path.join(userDir, safeName);

  return collectionPath;
};

/**
 * Generate unique collection name
 * Returns: "My Collection", "My Collection 2", "My Collection 3", etc.
 */
const generateCollectionName = (userDir) => {
  const baseName = 'My Collection';

  // Check if base name exists
  if (!fs.existsSync(path.join(userDir, baseName))) {
    return baseName;
  }

  // Find next available number
  let counter = 2;
  while (fs.existsSync(path.join(userDir, `${baseName} ${counter}`))) {
    counter++;
  }

  return `${baseName} ${counter}`;
};

/**
 * List all collections for current user
 */
const listUserCollections = (userId = null) => {
  const userDir = getDefaultCollectionDir(userId);

  try {
    const entries = fs.readdirSync(userDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: path.join(userDir, entry.name)
      }));
  } catch (error) {
    console.error('Failed to list collections:', error);
    return [];
  }
};

/**
 * Clear all collections for a user (start fresh)
 */
const clearUserCollections = (userId = null) => {
  const userDir = getDefaultCollectionDir(userId);

  try {
    if (fs.existsSync(userDir)) {
      const entries = fs.readdirSync(userDir);
      entries.forEach((entry) => {
        const fullPath = path.join(userDir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`Removed collection: ${entry}`);
        }
      });
      console.log(`Cleared all collections for user: ${userId || 'anonymous'}`);
      return true;
    }
  } catch (error) {
    console.error('Failed to clear collections:', error);
    return false;
  }
};

module.exports = {
  getCollectionsBaseDir,
  getDefaultCollectionDir,
  getNewCollectionPath,
  generateCollectionName,
  listUserCollections,
  clearUserCollections
};
