import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { dbService, initializeDatabase } from '../database/index';
import { getDatabase } from '../database/schema';

/* ============================
   WINDOWS GPU / CACHE SAFETY
   ============================ */
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('disk-cache-size', '0');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

/* ============================
   DEV LOAD RETRY
   ============================ */
async function loadDevURLWithRetry(win: BrowserWindow, retries = 15): Promise<void> {
  try {
    await win.loadURL('http://localhost:5173');
  } catch {
    if (retries <= 0) throw new Error('Dev server not ready');
    await new Promise((res) => setTimeout(res, 1000));
    return loadDevURLWithRetry(win, retries - 1);
  }
}

/* ============================
   MAIN WINDOW
   ============================ */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  if (isDev) {
    await loadDevURLWithRetry(mainWindow);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => (mainWindow = null));
  createApplicationMenu();
}

/* ============================
   PRINT WINDOW
   ============================ */
function createPrintWindow(urlPath: string): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL(`http://localhost:5173/#${urlPath}`);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: urlPath });
  }
}

/* ============================
   MENU
   ============================ */
function createApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Backup Database',
          click: async () => {
            try {
              const backupPath = await dbService.backupDatabase();
              mainWindow?.webContents.send('notification', {
                type: 'success',
                message: `Database backed up to: ${backupPath}`,
              });
            } catch {
              mainWindow?.webContents.send('notification', {
                type: 'error',
                message: 'Backup failed.',
              });
            }
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ============================
   IPC HANDLERS
   ============================ */
function setupIpcHandlers(): void {
  /* -------- Window -------- */
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isWindowMaximized', () => mainWindow?.isMaximized() || false);
  ipcMain.handle('app:getVersion', () => app.getVersion());

  /* -------- Print -------- */
  ipcMain.handle('print:attendance', (_e, date: string) => {
    createPrintWindow(`/print/attendance?date=${date}`);
    return { success: true };
  });

  /* -------- Database -------- */
  ipcMain.handle('database:initialize', async () => {
    await initializeDatabase();
    return { success: true };
  });

  ipcMain.handle('database:getStats', async () => {
    const data = await dbService.getDatabaseStats();
    return { success: true, data };
  });

  ipcMain.handle('database:backup', async () => {
    const p = await dbService.backupDatabase();
    return { success: true, path: p };
  });

  ipcMain.handle('database:query', async (_e, sql: string, params?: any) => ({
    success: true,
    data: await dbService.executeRawSQL(sql, params || {}),
  }));

  /* ================= ADMIN ================= */
  ipcMain.handle('database:admin:reseedSubscriberCodes', async () => {
    // 🔧 FIXED: do NOT duplicate "success"
    return await dbService.reseedSubscriberCodes();
  });

  /* -------- Settings -------- */
  ipcMain.handle('settings:getAll', async () => ({
    success: true,
    data: await dbService.getAllSettings(),
  }));

  ipcMain.handle('settings:setMany', async (_e, updates) => {
    await dbService.setSettings(updates);
    return { success: true };
  });

  /* -------- Attendance -------- */
  ipcMain.handle('attendance:mark', async (_e, data) => {
    await dbService.markAttendance(data);
    return { success: true };
  });

  ipcMain.handle('attendance:unmark', async (_e, sid, date) => {
    await dbService.unmarkAttendance(sid, date);
    return { success: true };
  });

  /* -------- Subscribers -------- */
  ipcMain.handle('subscribers:get', async (_e, filters?: any, page = 1, limit = 20) => {
    const result = await dbService.getSubscribers(filters, page, limit);
    return {
      success: true,
      data: {
        rows: result.data,
        total: result.total,
        page,
        limit,
      },
    };
  });

  // NEW: strict primary-key fetch for details page
  ipcMain.handle('subscribers:getById', async (_e, id: number) => {
    const row = await dbService.getSubscriberById(id);
    return { success: true, data: row };
  });

  ipcMain.handle('subscribers:create', async (_e, data) => {
    const id = await dbService.createSubscriber(data);
    return { success: true, id };
  });

  ipcMain.handle('subscribers:update', async (_e, id, data) => {
    await dbService.updateSubscriber(id, data);
    return { success: true };
  });

  ipcMain.handle('subscribers:delete', async (_e, id) => {
    await dbService.deleteSubscriber(id);
    return { success: true };
  });

  ipcMain.handle('subscribers:import', async (_e, rows: any[]) => {
    const total = Array.isArray(rows) ? rows.length : 0;
    const { created, failed } = await dbService.importSubscribers(rows || []);
    return { success: true, inserted: created, skipped: failed, total };
  });
}

/* ============================
   BOOT
   ============================ */
app.whenReady().then(async () => {
  setupIpcHandlers();
  await initializeDatabase();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

app.on('before-quit', async () => {
  await dbService.close();
});
