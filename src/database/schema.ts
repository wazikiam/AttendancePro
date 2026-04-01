// Attendance Pro Database Schema
// SQL.js (pure JavaScript SQLite) implementation
// ✅ Uses app-specific OS data directory by default (portable across PCs)
// ✅ Migrates legacy database from D:\AttendancePro\data when found

import initSqlJs from 'sql.js';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs';

/* ============================================================
   Types
   ============================================================ */

export interface DatabaseConfig {
  databasePath: string;
  wasmPath?: string;
}

export interface DatabaseStats {
  subscribers: number;
  active_subscribers: number;
  classes: number;
  attendance_records: number;
  users: number;
  database_size: number;
}

/* ============================================================
   Database Manager
   ============================================================ */

export class DatabaseManager {
  private db: any = null;
  private SQL: any = null;
  private config: DatabaseConfig;

  constructor(config?: Partial<DatabaseConfig>) {
    const legacyDataRoot = path.join('D:', 'AttendancePro', 'data');
    const defaultDataRoot = path.join(app.getPath('userData'), 'data');
    const defaultDbPath = path.join(defaultDataRoot, 'attendance-pro.db');
    const legacyDbPath = path.join(legacyDataRoot, 'attendance-pro.db');

    if (!fs.existsSync(defaultDataRoot)) {
      fs.mkdirSync(defaultDataRoot, { recursive: true });
    }

    // Preserve existing installs that used the old D: database location.
    // If the new location is empty and legacy DB exists, copy it once.
    if (!fs.existsSync(defaultDbPath) && fs.existsSync(legacyDbPath)) {
      try {
        fs.copyFileSync(legacyDbPath, defaultDbPath);
        console.log('[Database] Migrated legacy DB to userData path:', defaultDbPath);
      } catch (error) {
        console.warn('[Database] Legacy DB migration skipped:', error);
      }
    }

    this.config = {
      databasePath: defaultDbPath,
      wasmPath: path.join(
        app.getAppPath(),
        'node_modules',
        'sql.js',
        'dist',
        'sql-wasm.wasm'
      ),
      ...config,
    };
  }

  get databasePath(): string {
    return this.config.databasePath;
  }

  /* ============================================================
     Initialization
     ============================================================ */

  async initialize(): Promise<void> {
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          const unpacked = path.join(
            process.resourcesPath,
            'app.asar.unpacked',
            file
          );
          if (fs.existsSync(unpacked)) return unpacked;

          const wasm =
            this.config.wasmPath ||
            path.join(
              app.getAppPath(),
              'node_modules',
              'sql.js',
              'dist',
              file
            );

          if (fs.existsSync(wasm)) return wasm;
          return file;
        },
      });

      this.SQL = SQL;

      const dbDir = path.dirname(this.config.databasePath);
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

      if (fs.existsSync(this.config.databasePath)) {
        const buffer = fs.readFileSync(this.config.databasePath);
        this.db = new SQL.Database(buffer);
        this.migrateSchema(); // 🔴 IMPORTANT
      } else {
        this.db = new SQL.Database();
        this.createTables();
        this.createDefaultAdmin();
        this.saveToFile();
      }

      this.db.exec(`PRAGMA foreign_keys = ON;`);

      console.log('Database initialized at:', this.config.databasePath);
    } catch (err) {
      console.error('Database initialization failed:', err);
      throw err;
    }
  }

  /* ============================================================
     Schema
     ============================================================ */

  private createTables(): void {
    if (!this.db) throw new Error('DB not initialized');

    this.db.exec(`PRAGMA foreign_keys = ON;`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT DEFAULT '{}',
        instructor_id INTEGER,
        max_capacity INTEGER,
        current_enrollment INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        start_date TEXT NOT NULL,
        end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // IMPORTANT: id_number is UNIQUE but nullable (NULL allowed).
    // This enables CSV import to succeed when ID is empty/duplicated,
    // while the UI can still enforce ID number required for manual entry.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        id_number TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        notes TEXT,
        address TEXT,
        photo_path TEXT,
        documents_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        amount REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        UNIQUE(subscriber_id, class_id, start_date)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'absent',
        notes TEXT,
        recorded_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
        UNIQUE(subscriber_id, date)
      )
    `);
  }

  /**
   * 🔒 SAFE SCHEMA MIGRATION
   * - Ensures subscriber_code exists
   * - Ensures photo_path/documents_path exist
   * - Ensures unique indexes exist
   * - Ensures id_number is nullable (rebuild subscribers table if required)
   * - Does NOT drop other tables
   */
  private migrateSchema(): void {
    if (!this.db) return;

    this.db.exec(`PRAGMA foreign_keys = ON;`);

    const cols = this.query<any>(`PRAGMA table_info(subscribers)`);

    const hasSubscriberCode = cols.some(
      (c: any) => String(c.name).toLowerCase() === 'subscriber_code'
    );

    if (!hasSubscriberCode) {
      this.db.exec(`ALTER TABLE subscribers ADD COLUMN subscriber_code TEXT`);
    }

    const hasPhotoPath = cols.some(
      (c: any) => String(c.name).toLowerCase() === 'photo_path'
    );
    if (!hasPhotoPath) {
      this.db.exec(`ALTER TABLE subscribers ADD COLUMN photo_path TEXT`);
    }

    const hasDocsPath = cols.some(
      (c: any) => String(c.name).toLowerCase() === 'documents_path'
    );
    if (!hasDocsPath) {
      this.db.exec(`ALTER TABLE subscribers ADD COLUMN documents_path TEXT`);
    }

    // Ensure indexes exist (safe even if table rebuilt later)
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_subscriber_code
      ON subscribers(subscriber_code)
    `);

    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_id_number
      ON subscribers(id_number)
    `);

    // -------- Make id_number nullable if it was created as NOT NULL --------
    // SQLite cannot ALTER COLUMN to drop NOT NULL, so we rebuild the table if needed.
    const idCol = cols.find((c: any) => String(c.name).toLowerCase() === 'id_number');
    const idIsNotNull = Boolean(idCol && Number(idCol.notnull) === 1);

    if (idIsNotNull) {
      // Rebuild subscribers table while preserving data and ids.
      // This is safe because subscriptions/attendance reference subscriber_id,
      // and we keep the same id values.
      this.db.exec(`PRAGMA foreign_keys = OFF;`);
      this.db.exec(`BEGIN;`);

      try {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS subscribers__new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscriber_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            id_number TEXT UNIQUE,
            status TEXT DEFAULT 'active',
            notes TEXT,
            address TEXT,
            photo_path TEXT,
            documents_path TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Copy (keep ids)
        this.db.exec(`
          INSERT INTO subscribers__new
            (id, subscriber_code, name, phone, email, id_number, status, notes, address, photo_path, documents_path, created_at, updated_at)
          SELECT
            id,
            COALESCE(subscriber_code, ''),
            name,
            phone,
            email,
            id_number,
            COALESCE(status, 'active'),
            notes,
            address,
            photo_path,
            documents_path,
            created_at,
            updated_at
          FROM subscribers
        `);

        // Replace
        this.db.exec(`DROP TABLE subscribers;`);
        this.db.exec(`ALTER TABLE subscribers__new RENAME TO subscribers;`);

        // Recreate indexes
        this.db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_subscriber_code
          ON subscribers(subscriber_code)
        `);
        this.db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_id_number
          ON subscribers(id_number)
        `);

        this.db.exec(`COMMIT;`);
      } catch (e) {
        try {
          this.db.exec(`ROLLBACK;`);
        } catch {
          // ignore
        }
        // Re-enable FK before rethrow
        try {
          this.db.exec(`PRAGMA foreign_keys = ON;`);
        } catch {
          // ignore
        }
        throw e;
      }

      this.db.exec(`PRAGMA foreign_keys = ON;`);
    }

    this.saveToFile();
  }

  /* ============================================================
     Default Admin
     ============================================================ */

  private createDefaultAdmin(): void {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM users`);
    stmt.step();
    const res = stmt.getAsObject() as { count: number };
    stmt.free();

    if (res.count === 0) {
      this.db.exec(`
        INSERT INTO users
          (username, email, password_hash, role, full_name)
        VALUES
          ('admin', 'admin@attendancepro.local', 'admin123', 'admin', 'System Administrator')
      `);
    }
  }

  /* ============================================================
     Persistence
     ============================================================ */

  saveToFile(): void {
    const data = this.db.export();
    fs.writeFileSync(this.config.databasePath, Buffer.from(data));
  }

  close(): void {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  backup(dest: string): void {
    this.saveToFile();
    fs.copyFileSync(this.config.databasePath, dest);
  }

  /* ============================================================
     Query API
     ============================================================ */

  query<T = any>(sql: string, params: Record<string, any> = {}): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(
      Object.fromEntries(
        Object.entries(params).map(([k, v]) => [`:${k}`, v])
      )
    );

    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  queryOne<T = any>(sql: string, params: Record<string, any> = {}): T | null {
    const r = this.query<T>(sql, params);
    return r.length ? r[0] : null;
  }

  execute(sql: string, params: Record<string, any> = {}): void {
    const stmt = this.db.prepare(sql);
    stmt.bind(
      Object.fromEntries(
        Object.entries(params).map(([k, v]) => [`:${k}`, v])
      )
    );
    stmt.step();
    stmt.free();
    this.saveToFile();
  }

  getDatabaseStats(): DatabaseStats {
    const stats: DatabaseStats = {
      subscribers: 0,
      active_subscribers: 0,
      classes: 0,
      attendance_records: 0,
      users: 0,
      database_size: 0,
    };

    if (!fs.existsSync(this.config.databasePath)) return stats;

    stats.database_size = fs.statSync(this.config.databasePath).size;
    return stats;
  }
}

/* ============================================================
   Singleton
   ============================================================ */

let instance: DatabaseManager | null = null;

export async function getDatabase(): Promise<DatabaseManager> {
  if (!instance) {
    instance = new DatabaseManager();
    await instance.initialize();
  }
  return instance;
}
