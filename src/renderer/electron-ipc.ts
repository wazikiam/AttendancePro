// Direct IPC access for development (nodeIntegration: true)
const { ipcRenderer } = require('electron');

export const electronAPI = {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Database operations
  database: {
    initialize: () => ipcRenderer.invoke('database:initialize'),
    getStats: () => ipcRenderer.invoke('database:getStats'),
    backup: () => ipcRenderer.invoke('database:backup'),
    query: (sql: string, params?: any) => ipcRenderer.invoke('database:query', sql, params),
  },

  // Subscriber operations
  subscribers: {
    get: (filters?: any, page?: number, limit?: number) =>
      ipcRenderer.invoke('subscribers:get', filters, page, limit),
    create: (data: any) => ipcRenderer.invoke('subscribers:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('subscribers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('subscribers:delete', id),
  },

  // Attendance operations
  attendance: {
    mark: (data: any) => ipcRenderer.invoke('attendance:mark', data),
    getByDate: (date: string) => ipcRenderer.invoke('attendance:getByDate', date),
  },

  // Authentication
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
  },
};

// Also expose to window for compatibility
if (typeof window !== 'undefined') {
  (window as any).electronAPI = electronAPI;
}

export default electronAPI;