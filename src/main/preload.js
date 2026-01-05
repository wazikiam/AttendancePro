const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Database operations
  database: {
    initialize: () => ipcRenderer.invoke('database:initialize'),
    getStats: () => ipcRenderer.invoke('database:getStats'),
    backup: () => ipcRenderer.invoke('database:backup'),
    query: (sql, params) => ipcRenderer.invoke('database:query', sql, params),
  },

  // Subscriber operations
  subscribers: {
    get: (filters, page, limit) => ipcRenderer.invoke('subscribers:get', filters, page, limit),
    create: (data) => ipcRenderer.invoke('subscribers:create', data),
    update: (id, data) => ipcRenderer.invoke('subscribers:update', id, data),
    delete: (id) => ipcRenderer.invoke('subscribers:delete', id),
  },

  // Attendance operations
  attendance: {
    mark: (data) => ipcRenderer.invoke('attendance:mark', data),
    getByDate: (date) => ipcRenderer.invoke('attendance:getByDate', date),
  },

  // Authentication
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  },

  // Notifications
  onNotification: (callback) => ipcRenderer.on('notification', (event, data) => callback(data)),
  onDatabaseStats: (callback) => ipcRenderer.on('database:stats', (event, data) => callback(data)),
  onAppError: (callback) => ipcRenderer.on('app:error', (event, data) => callback(data)),

  // Remove listeners
  removeNotificationListener: () => ipcRenderer.removeAllListeners('notification'),
  removeDatabaseStatsListener: () => ipcRenderer.removeAllListeners('database:stats'),
  removeAppErrorListener: () => ipcRenderer.removeAllListeners('app:error'),
});