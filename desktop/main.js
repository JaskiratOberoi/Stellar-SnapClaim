// Electron shell for the Windows build. It serves the static web export from
// ../dist (or resources/dist once packaged) over a custom app:// scheme so the
// root-relative asset paths Expo emits keep working. Run with --dev to load the
// Expo web dev server instead.

const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const DEV = process.argv.includes('--dev');
const DEV_URL = process.env.ASSISTANT_DEV_URL || 'http://localhost:8081';
const APP_ORIGIN = 'app://assistant';

const distDir = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function resolveDistFile(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  const candidates = [pathname, `${pathname}.html`, `${pathname}/index.html`];
  for (const candidate of candidates) {
    const file = path.normalize(path.join(distDir, candidate));
    if (!file.startsWith(distDir)) break;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  // Unknown route: let the client-side router handle it.
  return path.join(distDir, 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 400,
    minHeight: 560,
    title: 'Assistant',
    autoHideMenuBar: true,
    backgroundColor: '#0B0C0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV) {
    win.loadURL(DEV_URL);
  } else {
    win.loadURL(`${APP_ORIGIN}/`);
  }
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => net.fetch(pathToFileURL(resolveDistFile(request.url)).toString()));

  // Allow the microphone for voice input; deny everything else by default.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
