const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
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

async function saveCurrentPageAsPdf(win, defaultFileName) {
  if (!win) return { canceled: true };
  const safeName = (defaultFileName || 'NiagaAngkut-Dokumen.pdf').replace(/[<>:"/\\|?*]+/g, '-');
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Simpan Dokumen PDF',
    defaultPath: path.join(app.getPath('documents'), safeName),
    filters: [{ name: 'Dokumen PDF', extensions: ['pdf'] }],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const pdfBuffer = await win.webContents.printToPDF({
    landscape: true,
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  fs.writeFileSync(filePath, pdfBuffer);
  return { canceled: false, filePath };
}

function createApplicationMenu() {
  const template = [
    {
      label: 'Aplikasi',
      submenu: [
        {
          label: 'Cetak / Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.print({ silent: false, printBackground: true });
            }
          },
        },
        {
          label: 'Simpan Sebagai PDF...',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            if (mainWindow) {
              saveCurrentPageAsPdf(mainWindow, 'NiagaAngkut-Dokumen.pdf').catch(() => {});
            }
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

ipcMain.handle('niaga:print-page', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return { success: false, reason: 'No active window' };

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: false,
        printBackground: true,
      },
      (success, failureReason) => {
        resolve({ success, reason: failureReason || '' });
      }
    );
  });
});

ipcMain.handle('niaga:save-pdf', async (event, defaultFileName) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return saveCurrentPageAsPdf(win, defaultFileName);
});

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  const hasIcon = fs.existsSync(iconPath);
  const preloadPath = path.join(__dirname, 'preload.cjs');

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
      preload: preloadPath,
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
