// Type declarations for Electron API exposed via preload script

export interface DatabaseStats {
  subscribers: number;
  active_subscribers: number;
  classes: number;
  attendance_records: number;
  users: number;
  database_size: number;
}

export interface Subscriber {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  id_number: string;
  photo_path?: string;
  documents_path?: string;
  class_id?: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  notes?: string;
  address?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  emergency_phone?: string;
}

export interface SubscriberListResult {
  data: Subscriber[];
  total: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  path?: string;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'assistant' | 'viewer';
  permissions: Record<string, boolean>;
}

declare global {
  interface Window {
    electronAPI: {
      // Window controls
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      isWindowMaximized: () => Promise<boolean>;
      getAppVersion: () => Promise<string>;
      
      // Database operations
      database: {
        initialize: () => Promise<ApiResponse>;
        getStats: () => Promise<ApiResponse<DatabaseStats>>;
        backup: () => Promise<ApiResponse<{ path: string }>>;
        query: (sql: string, params?: any) => Promise<ApiResponse<any[]>>;
      };
      
      // Subscriber operations
      subscribers: {
        get: (filters?: any, page?: number, limit?: number) => Promise<ApiResponse<SubscriberListResult>>;
        create: (data: any) => Promise<ApiResponse<{ id: number }>>;
        update: (id: number, data: any) => Promise<ApiResponse>;
        delete: (id: number) => Promise<ApiResponse>;
      };
      
      // Attendance operations
      attendance: {
        mark: (data: any) => Promise<ApiResponse>;
        getByDate: (date: string) => Promise<ApiResponse<any[]>>;
      };
      
      // Authentication
      auth: {
        login: (username: string, password: string) => Promise<ApiResponse<{ user: User }>>;
      };
      
      // Event listeners
      onNotification: (callback: (data: any) => void) => void;
      onDatabaseStats: (callback: (data: any) => void) => void;
      onAppError: (callback: (data: any) => void) => void;
      
      // Remove listeners
      removeNotificationListener: () => void;
      removeDatabaseStatsListener: () => void;
      removeAppErrorListener: () => void;
    };
  }
}