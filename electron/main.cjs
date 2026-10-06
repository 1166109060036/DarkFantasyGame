// Desktop shell for Moonmire. The game itself is plain HTML/JS; Electron bundles its own
// Chromium so it runs as a normal Windows program with no browser or web server.
const { app, BrowserWindow, protocol, net, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');

// Serve the game from app://game/... ES modules are blocked on file://, and a standard,
// secure scheme also gives us localStorage (save games) and pointer lock.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Let older or blocklisted GPUs still run WebGL; fall back to software rendering if there is no GPU.
// The content is our own local files, so the software renderer's "unsafe" flag is not a concern here.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 450,
    title: 'Moonmire',
    backgroundColor: '#02040c',
    icon: path.join(ROOT, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
  // Never navigate the game window away; send any web link to the system browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://game/')) event.preventDefault();
  });

  win.loadURL('app://game/index.html');
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (request) => {
    const { host, pathname } = new URL(request.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (host !== 'game' || !file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
