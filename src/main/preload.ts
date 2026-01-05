import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('=== PRELOAD SCRIPT LOADED (SECURE) ===');

const electronAPI = {
  /* ---------------- Window ---------------- */
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isWindowMaximized'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  /* ---------------- Database ---------------- */
  database: {
    initialize: () => ipcRenderer.invoke('database:initialize'),
    getStats: () => ipcRenderer.invoke('database:getStats'),
    backup: () => ipcRenderer.invoke('database:backup'),
    query: (sql: string, params?: any) =>
      ipcRenderer.invoke('database:query', sql, params),
  },

  /* ================= ADMIN (DEV ONLY) ================= */
  admin: {
    reseedSubscriberCodes: () =>
      ipcRenderer.invoke('database:admin:reseedSubscriberCodes'),
  },

  /* ---------------- Settings ---------------- */
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    setMany: (updates: Record<string, any>) =>
      ipcRenderer.invoke('settings:setMany', updates),
  },

  /* ---------------- Classes ---------------- */
  classes: {
    list: (filters?: any) =>
      ipcRenderer.invoke('classes:list', filters),
    create: (data: any) =>
      ipcRenderer.invoke('classes:create', data),
    getById: (id: number) =>
      ipcRenderer.invoke('classes:getById', id),
    update: (id: number, data: any) =>
      ipcRenderer.invoke('classes:update', id, data),
    delete: (id: number) =>
      ipcRenderer.invoke('classes:delete', id),
  },

  /* ---------------- Subscriptions ---------------- */
  subscriptions: {
    listForClassOnDate: (classId: number, date: string) =>
      ipcRenderer.invoke(
        'subscriptions:listForClassOnDate',
        classId,
        date
      ),
    add: (subscriberId: number, classId: number, startDate?: string) =>
      ipcRenderer.invoke(
        'subscriptions:add',
        subscriberId,
        classId,
        startDate
      ),
    end: (subscriberId: number, classId: number, endDate?: string) =>
      ipcRenderer.invoke(
        'subscriptions:end',
        subscriberId,
        classId,
        endDate
      ),
  },

  /* ---------------- Subscribers ---------------- */
  subscribers: {
    /* EXISTING */
    get: (filters?: any, page?: number, limit?: number) =>
      ipcRenderer.invoke('subscribers:get', filters, page, limit),

    create: (data: any) =>
      ipcRenderer.invoke('subscribers:create', data),

    update: (id: number, data: any) =>
      ipcRenderer.invoke('subscribers:update', id, data),

    delete: (id: number) =>
      ipcRenderer.invoke('subscribers:delete', id),

    import: (rows: any[]) =>
      ipcRenderer.invoke('subscribers:import', rows),

    uploadPhoto: (
      subscriberId: number,
      fileName: string,
      bytes: Uint8Array
    ) =>
      ipcRenderer.invoke(
        'subscribers:uploadPhoto',
        subscriberId,
        fileName,
        bytes
      ),

    uploadDocument: (
      subscriberId: number,
      fileName: string,
      bytes: Uint8Array
    ) =>
      ipcRenderer.invoke(
        'subscribers:uploadDocument',
        subscriberId,
        fileName,
        bytes
      ),

    /* ✅ MISSING — NOW ADDED (CRITICAL) */
    getById: (id: number) =>
      ipcRenderer.invoke('subscribers:getById', id),

    listDocuments: (subscriberId: number) =>
      ipcRenderer.invoke('subscribers:listDocuments', subscriberId),

    revealInFolder: (path: string) =>
      ipcRenderer.invoke('subscribers:revealInFolder', path),
  },

  /* ---------------- Attendance ---------------- */
  attendance: {
    mark: (data: any) =>
      ipcRenderer.invoke('attendance:mark', data),
    getByDate: (date: string) =>
      ipcRenderer.invoke('attendance:getByDate', date),
    unmark: (subscriber_id: number, date: string) =>
      ipcRenderer.invoke('attendance:unmark', subscriber_id, date),
    pdf: (date: string) =>
      ipcRenderer.invoke('attendance:pdf', date),
    printPreview: (date: string) =>
      ipcRenderer.invoke('attendance:print', date),
  },

  /* ---------------- Printing ---------------- */
  printAttendance: (date: string) =>
    ipcRenderer.invoke('print:attendance', date),

  /* ---------------- Auth ---------------- */
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
  },

  /* ---------------- Events ---------------- */
  onNotification: (callback: (data: any) => void) => {
    ipcRenderer.on('notification', (_e: IpcRendererEvent, data: any) =>
      callback(data)
    );
  },

  onDatabaseStats: (callback: (data: any) => void) => {
    ipcRenderer.on('database:stats', (_e: IpcRendererEvent, data: any) =>
      callback(data)
    );
  },

  onAppError: (callback: (data: any) => void) => {
    ipcRenderer.on('app:error', (_e: IpcRendererEvent, data: any) =>
      callback(data)
    );
  },

  removeNotificationListener: () =>
    ipcRenderer.removeAllListeners('notification'),

  removeDatabaseStatsListener: () =>
    ipcRenderer.removeAllListeners('database:stats'),

  removeAppErrorListener: () =>
    ipcRenderer.removeAllListeners('app:error'),
};

/* ---------------- Secure Exposure ---------------- */
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('=== ELECTRON API EXPOSED ===');
