const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;

// Pastikan hanya satu jendela aplikasi berjalan agar penyimpanan data lokal tetap aman
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function resolveStartTarget() {
  if (process.env.ELECTRON_DEV_URL) {
    return { type: 'url', value: process.env.ELECTRON_DEV_URL };
  }

  const bundledPath = path.join(__dirname, 'web-dist', 'index.html');
  if (fs.existsSync(bundledPath)) {
    return { type: 'file', value: bundledPath };
  }

  const fallbackDistPath = path.join(__dirname, '..', 'dist', 'index.html');
  return { type: 'file', value: fallbackDistPath };
}

function createApplicationMenu() {
  const template = [
    {
      label: 'Aplikasi',
      submenu: [
        {
          label: 'Cetak / Simpan PDF',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) mainWindow.webContents.print();
          },
        },
        {
          label: 'Muat Ulang',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          },
        },
        { type: 'separator' },
        {
          label: 'Keluar',
          accelerator: 'Alt+F4',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Potong', role: 'cut' },
        { label: 'Salin', role: 'copy' },
        { label: 'Tempel', role: 'paste' },
        { label: 'Pilih Semua', role: 'selectAll' },
      ],
    },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Perbesar', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Perkecil', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Ukuran Normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Layar Penuh', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  const hasIcon = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    center: true,
    show: false,
    title: 'NiagaAngkut — Pendataan & Nota Transportasi Curah',
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    ...(hasIcon ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.maximize();
    mainWindow.show();
  });

  // Buka tautan eksternal di browser default PC, bukan di dalam aplikasi
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const target = resolveStartTarget();
  if (target.type === 'url') {
    mainWindow.loadURL(target.value);
  } else {
    mainWindow.loadFile(target.value);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
