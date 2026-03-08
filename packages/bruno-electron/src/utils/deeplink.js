const { handleOauth2ProtocolUrl } = require('./oauth2-protocol-handler');

let _mainWindow = null;

const setMainWindow = (win) => {
  _mainWindow = win;
};

// Store appProtocolUrl - will be handled in the `did-finish-load` event handler
const getAppProtocolUrlFromArgv = (argv) => {
  return argv.find((arg) => arg.startsWith('bruno://'));
};

// Handle app protocol URLs
const handleAppProtocolUrl = (url) => {
  // Handle Bruno Cloud OAuth callback: `bruno://oauth?code=...&provider=...`
  if (isCloudOauthUrl(url)) {
    handleCloudOauthUrl(url);
    return;
  }
  // Handle OAuth2 callback URLs - `bruno://app/oauth2/callback`
  if (isOauth2Url(url)) {
    handleOauth2ProtocolUrl(url);
  }
};

const isCloudOauthUrl = (url) => {
  try {
    const urlObj = new URL(url);
    // matches: bruno://oauth?code=...
    return urlObj.host === 'oauth' || urlObj.pathname === '/oauth';
  } catch {
    return false;
  }
};

const handleCloudOauthUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const provider = urlObj.searchParams.get('provider');
    const error = urlObj.searchParams.get('error');

    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('oauth:callback', { code, provider, error });
      if (_mainWindow.isMinimized()) {
        _mainWindow.restore();
      }
      _mainWindow.focus();
    }
  } catch (e) {
    console.error('[DeepLink] Failed to handle cloud OAuth URL:', e);
  }
};

const isOauth2Url = (url) => {
  try {
    const urlObj = new URL(url);

    if (urlObj.pathname === '/oauth2/callback') {
      return true;
    }
  } catch (error) {
    console.error('[Protocol Handler] Error handling protocol URL:', error);
  }
  return false;
};

module.exports = { handleAppProtocolUrl, getAppProtocolUrlFromArgv, setMainWindow };
