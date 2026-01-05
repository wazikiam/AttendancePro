// Application constants
export const APP_CONSTANTS = {
  NAME: 'Attendance Pro',
  VERSION: '1.0.0',
  COMPANY: 'Your Company',
  COPYRIGHT_YEAR: new Date().getFullYear(),
  
  // File extensions
  ALLOWED_FILE_EXTENSIONS: {
    IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    DOCUMENTS: ['.pdf', '.doc', '.docx', '.txt'],
    EXCEL: ['.xlsx', '.xls', '.csv'],
  },
  
  // Max file sizes (in bytes)
  MAX_FILE_SIZES: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    DOCUMENT: 10 * 1024 * 1024, // 10MB
    EXCEL: 20 * 1024 * 1024, // 20MB
  },
  
  // Database
  DATABASE_NAME: 'attendance.db',
  DATABASE_VERSION: '1.0',
  
  // Local storage keys
  STORAGE_KEYS: {
    LANGUAGE: 'app-language',
    THEME: 'app-theme',
    USER_PREFERENCES: 'user-preferences',
    RECENT_FILES: 'recent-files',
    LICENSE_KEY: 'license-key',
  },
  
  // Default values
  DEFAULTS: {
    LANGUAGE: 'en',
    THEME: 'light',
    PAGE_SIZE: 50,
    DATE_FORMAT: 'YYYY-MM-DD',
    TIME_FORMAT: 'HH:mm',
  },
} as const;

// Language constants
export const LANGUAGES = {
  EN: { code: 'en', name: 'English', dir: 'ltr' },
  AR: { code: 'ar', name: 'Arabic', dir: 'rtl' },
  FR: { code: 'fr', name: 'French', dir: 'ltr' },
} as const;

// Status constants
export const STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  GRADUATED: 'GRADUATED',
} as const;

// Attendance status constants
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED',
} as const;

// User roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
  VIEWER: 'VIEWER',
} as const;

// Export types
export type LanguageCode = keyof typeof LANGUAGES;
export type StatusType = keyof typeof STATUS;
export type AttendanceStatusType = keyof typeof ATTENDANCE_STATUS;
export type UserRoleType = keyof typeof USER_ROLES;