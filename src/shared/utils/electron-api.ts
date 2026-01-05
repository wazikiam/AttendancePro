// Safe access to electronAPI
export const getElectronAPI = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  throw new Error('electronAPI is not available. Make sure you are running in Electron.');
};

/**
 * Normalize IPC responses so renderer logic is deterministic
 */
const unwrap = async (promise: Promise<any>) => {
  const res = await promise;

  if (res && typeof res === 'object' && 'success' in res) {
    if (!res.success) throw new Error(res.message || 'IPC call failed');
    return res;
  }

  return { success: true, ...res };
};

/* ============================================================
   Window controls
   ============================================================ */
export const windowControls = {
  minimize: () => getElectronAPI().minimizeWindow(),
  maximize: () => getElectronAPI().maximizeWindow(),
  close: () => getElectronAPI().closeWindow(),
  isMaximized: () => getElectronAPI().isWindowMaximized(),
};

/* ============================================================
   Database API (READ-ONLY)
   ============================================================ */
export const database = {
  initialize: async () => unwrap(getElectronAPI().database.initialize()),
  getStats: async () => unwrap(getElectronAPI().database.getStats()),
  backup: async () => unwrap(getElectronAPI().database.backup()),
  query: async (sql: string, params?: any) =>
    unwrap(getElectronAPI().database.query(sql, params)),
};

/* ============================================================
   Classes API
   ============================================================ */
export const classes = {
  list: async (filters?: any) =>
    unwrap(getElectronAPI().classes.list(filters)),

  create: async (data: any) =>
    unwrap(getElectronAPI().classes.create(data)),

  getById: async (id: number) =>
    unwrap(getElectronAPI().classes.getById(id)),

  update: async (id: number, data: any) =>
    unwrap(getElectronAPI().classes.update(id, data)),

  delete: async (id: number) =>
    unwrap(getElectronAPI().classes.delete(id)),
};

/* ============================================================
   Subscriptions API (NEW)
   ============================================================ */
export const subscriptions = {
  listForClassOnDate: async (classId: number, date: string) =>
    unwrap(
      getElectronAPI().subscriptions.listForClassOnDate(classId, date)
    ),

  add: async (subscriberId: number, classId: number, startDate?: string) =>
    unwrap(
      getElectronAPI().subscriptions.add(subscriberId, classId, startDate)
    ),

  end: async (subscriberId: number, classId: number, endDate?: string) =>
    unwrap(
      getElectronAPI().subscriptions.end(subscriberId, classId, endDate)
    ),
};

/* ============================================================
   Subscribers API
   ============================================================ */
export const subscribers = {
  get: async (filters?: any, page?: number, limit?: number) =>
    unwrap(getElectronAPI().subscribers.get(filters, page, limit)),

  create: async (data: any) =>
    unwrap(getElectronAPI().subscribers.create(data)),

  update: async (id: number, data: any) =>
    unwrap(getElectronAPI().subscribers.update(id, data)),

  delete: async (id: number) =>
    unwrap(getElectronAPI().subscribers.delete(id)),

  import: async (rows: any[]) =>
    unwrap(getElectronAPI().subscribers.import(rows)),

  uploadPhoto: async (
    subscriberId: number,
    fileName: string,
    bytes: Uint8Array
  ) =>
    unwrap(
      getElectronAPI().subscribers.uploadPhoto(
        subscriberId,
        fileName,
        bytes
      )
    ),

  uploadDocument: async (
    subscriberId: number,
    fileName: string,
    bytes: Uint8Array
  ) =>
    unwrap(
      getElectronAPI().subscribers.uploadDocument(
        subscriberId,
        fileName,
        bytes
      )
    ),
};

/* ============================================================
   Attendance API
   ============================================================ */
export const attendance = {
  mark: async (data: any) =>
    unwrap(getElectronAPI().attendance.mark(data)),

  getByDate: async (date: string) =>
    unwrap(getElectronAPI().attendance.getByDate(date)),

  unmark: async (subscriber_id: number, date: string) =>
    unwrap(getElectronAPI().attendance.unmark(subscriber_id, date)),
};

/* ============================================================
   Auth API
   ============================================================ */
export const auth = {
  login: async (username: string, password: string) =>
    unwrap(getElectronAPI().auth.login(username, password)),
};
