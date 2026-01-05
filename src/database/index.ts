import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { getDatabase } from './schema';

type AnyObj = Record<string, any>;

const isSelectLike = (sql: string) => {
  const s = sql.trim().toUpperCase();
  return s.startsWith('SELECT') || s.startsWith('PRAGMA') || s.startsWith('EXPLAIN');
};

const ensureUploadsDir = (subscriberId: number) => {
  const base = path.join(app.getPath('userData'), 'uploads', 'subscribers', String(subscriberId));
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
};

const safeFileName = (name: string) =>
  name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 120);

const todayISO = () => new Date().toISOString().slice(0, 10);

const isoAddDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* ================== SETTINGS DEFAULTS ================== */
const SETTINGS_DEFAULTS: Record<string, any> = {
  'org.name': '',
  'org.address': '',
  'org.phone': '',
  'org.email': '',
  'org.city': '',
  'org.country': '',
  'org.logo_path': '',
  'org.stamp_path': '',

  'locale.ui_language': 'en',
  'locale.print_language_mode': 'same_as_ui',
  'locale.print_language': 'en',
  'locale.timezone': 'Africa/Casablanca',
  'locale.date_format': 'YYYY-MM-DD',
  'locale.time_format': '24h',
  'locale.week_start': 'mon',

  'attendance.default_status': 'present',
  'attendance.allow_late_marking': true,
  'attendance.lock_after_days': 0,

  'print.privacy_level': 'internal',
  'print.fields': {
    full_name: true,
    id_number: false,
    phone: false,
    email: false,
    address: false,
    signature: false,
  },
  'print.header.enabled': true,
  'print.header.include_org': true,
  'print.disclaimer.enabled': true,
  'print.disclaimer.text': {
    en: 'This document is issued for administrative purposes only.',
    fr: 'Ce document est délivré à des fins administratives uniquement.',
    ar: 'هذه الوثيقة صادرة لأغراض إدارية فقط.',
  },
};

class DatabaseService {
  private _subscribersSchemaReady = false;

  /* ================== CORE ================== */

  async close() {
    const db = await getDatabase();
    db.close();
  }

  async getDatabaseStats() {
    const db = await getDatabase();
    return db.getDatabaseStats();
  }

  async backupDatabase() {
    const db = await getDatabase();
    const dir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(dir, `attendance-pro-backup-${ts}.db`);
    db.backup(dest);
    return dest;
  }

  async executeRawSQL(sql: string, params: AnyObj = {}) {
    const db = await getDatabase();
    if (!isSelectLike(sql)) throw new Error('database:query is READ-ONLY.');
    return db.query(sql, params);
  }

  /* ================== SETTINGS ================== */

  private async ensureSettingsTable() {
    const db = await getDatabase();
    db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  async getAllSettings(): Promise<Record<string, any>> {
    const db = await getDatabase();
    await this.ensureSettingsTable();

    const rows = db.query(`SELECT key, value FROM settings`) as { key: string; value: string }[];
    const result: Record<string, any> = {};

    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value);
      } catch {
        result[r.key] = null;
      }
    }

    const now = new Date().toISOString();
    for (const [key, def] of Object.entries(SETTINGS_DEFAULTS)) {
      if (!(key in result)) {
        db.execute(
          `INSERT INTO settings (key, value, created_at, updated_at)
           VALUES (:key, :value, :c, :u)`,
          { key, value: JSON.stringify(def), c: now, u: now }
        );
        result[key] = def;
      }
    }

    return result;
  }

  async setSettings(updates: Record<string, any>): Promise<void> {
    const db = await getDatabase();
    await this.ensureSettingsTable();
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(updates)) {
      db.execute(
        `
        INSERT INTO settings (key, value, created_at, updated_at)
        VALUES (:key, :value, :c, :u)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
        `,
        { key, value: JSON.stringify(value), c: now, u: now }
      );
    }
  }

  /* ================== SUBSCRIBER CODE ================== */

  private normalizeText(v: any): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
  }

  private parseSubscriberCodeNumber(code: any): number {
    const s = String(code ?? '').trim().toUpperCase();
    const m = /^S(\d+)$/.exec(s);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : 0;
  }

  private async syncSubscriberCodeSequence(db: any) {
    // Find max numeric Sxxxxx in subscribers
    const rows = db.query(
      `SELECT subscriber_code AS c FROM subscribers WHERE subscriber_code IS NOT NULL AND TRIM(subscriber_code) <> ''`
    ) as { c?: string }[];

    let maxN = 0;
    for (const r of rows) {
      const n = this.parseSubscriberCodeNumber(r.c);
      if (n > maxN) maxN = n;
    }

    if (maxN <= 0) return;

    const seqRow = db.queryOne(`SELECT MAX(id) AS id FROM subscriber_code_seq`) as { id?: number } | null;
    const current = Number(seqRow?.id ?? 0);

    if (current >= maxN) return;

    // Advance sequence to >= maxN (never decreases)
    for (let i = current; i < maxN; i++) {
      db.execute(`INSERT INTO subscriber_code_seq DEFAULT VALUES`);
    }
  }

  private async ensureSubscribersSchema() {
    if (this._subscribersSchemaReady) return;
    const db = await getDatabase();

    const cols = db.query(`PRAGMA table_info(subscribers)`) as { name: string }[];
    if (!cols.some((c) => String(c.name).toLowerCase() === 'subscriber_code')) {
      db.execute(`ALTER TABLE subscribers ADD COLUMN subscriber_code TEXT`);
    }

    db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_code ON subscribers(subscriber_code)`);

    db.execute(`
      CREATE TABLE IF NOT EXISTS subscriber_code_seq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Backfill legacy rows without consuming sequence
    db.execute(`
      UPDATE subscribers
      SET subscriber_code = 'LEGACY-' || id
      WHERE subscriber_code IS NULL OR TRIM(subscriber_code) = ''
    `);

    // Ensure sequence cannot generate duplicates vs existing Sxxxxx
    await this.syncSubscriberCodeSequence(db);

    this._subscribersSchemaReady = true;
  }

  private generateNextSubscriberCodeWithDb(db: any): string {
    db.execute(`INSERT INTO subscriber_code_seq DEFAULT VALUES`);
    const row = db.queryOne(`SELECT MAX(id) AS id FROM subscriber_code_seq`) as { id?: number } | null;
    const n = Number(row?.id ?? 0);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Failed to generate subscriber code sequence id');
    return `S${String(n).padStart(6, '0')}`;
  }

  async reseedSubscriberCodes(): Promise<{ success: true; next: string }> {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    const cRow = db.queryOne(`SELECT COUNT(*) AS c FROM subscribers`) as { c?: number } | null;
    const count = Number(cRow?.c ?? 0);
    if (count > 0) throw new Error('Cannot reseed: subscribers table is not empty.');

    db.execute(`DELETE FROM subscriber_code_seq`);
    try {
      db.execute(`DELETE FROM sqlite_sequence WHERE name = 'subscriber_code_seq'`);
    } catch {
      // ignore
    }

    // Next generated after reseed will be S000001
    const next = 'S000001';
    return { success: true, next };
  }

  private normalizeSubscriberImportRow(r: AnyObj): {
    name: string;
    phone: string | null;
    email: string | null;
    id_number: string | null;
    status: string;
    notes: string | null;
    address: string | null;
  } {
    const name = this.normalizeText(r.name);

    const phoneRaw = this.normalizeText(r.phone);
    const phone = phoneRaw.length > 0 ? phoneRaw : null;

    const idRaw = this.normalizeText(r.id_number);
    const id_number = idRaw.length > 0 ? idRaw : null;

    const emailRaw = this.normalizeText(r.email);
    const email = emailRaw.length > 0 ? emailRaw : null;

    const statusRaw = this.normalizeText(r.status);
    const status = statusRaw.length > 0 ? statusRaw : 'active';

    const notesRaw = this.normalizeText(r.notes);
    const notes = notesRaw.length > 0 ? notesRaw : null;

    const addressRaw = this.normalizeText(r.address);
    const address = addressRaw.length > 0 ? addressRaw : null;

    return { name, phone, email, id_number, status, notes, address };
  }

  /* ================== CLASSES ================== */
  async getClasses() {
    const db = await getDatabase();
    return db.query(`SELECT * FROM classes ORDER BY created_at DESC`);
  }

  async createClass(data: AnyObj) {
    const db = await getDatabase();
    db.execute(
      `
      INSERT INTO classes
        (name, description, schedule, status, start_date, created_at)
      VALUES
        (:name, :description, :schedule, :status, :start_date, CURRENT_TIMESTAMP)
      `,
      {
        name: String(data.name).trim(),
        description: data.description ?? null,
        schedule: data.schedule ?? '{}',
        status: data.status ?? 'active',
        start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
      }
    );

    return (db.queryOne(`SELECT last_insert_rowid() as id`) as any)?.id;
  }

  async updateClass(id: number, data: AnyObj) {
    const db = await getDatabase();

    const existing = db.queryOne(`SELECT * FROM classes WHERE id = :id`, { id }) as any;
    if (!existing) throw new Error(`Class not found (id=${id})`);

    const merged = {
      id,
      name: data.name !== undefined ? String(data.name).trim() : String(existing.name).trim(),
      description: data.description !== undefined ? data.description ?? null : existing.description ?? null,
      schedule: data.schedule !== undefined ? data.schedule ?? '{}' : existing.schedule ?? '{}',
      instructor_id: data.instructor_id !== undefined ? data.instructor_id ?? null : existing.instructor_id ?? null,
      max_capacity: data.max_capacity !== undefined ? data.max_capacity ?? null : existing.max_capacity ?? null,
      current_enrollment:
        data.current_enrollment !== undefined ? data.current_enrollment ?? 0 : existing.current_enrollment ?? 0,
      status: data.status !== undefined ? data.status ?? 'active' : existing.status ?? 'active',
      start_date:
        data.start_date !== undefined
          ? data.start_date ?? new Date().toISOString().slice(0, 10)
          : existing.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: data.end_date !== undefined ? data.end_date ?? null : existing.end_date ?? null,
    };

    db.execute(
      `
      UPDATE classes
      SET
        name = :name,
        description = :description,
        schedule = :schedule,
        instructor_id = :instructor_id,
        max_capacity = :max_capacity,
        current_enrollment = :current_enrollment,
        status = :status,
        start_date = :start_date,
        end_date = :end_date
      WHERE id = :id
      `,
      merged
    );

    return { updated: true };
  }

  async deleteClass(id: number) {
    const db = await getDatabase();
    const existing = db.queryOne(`SELECT id FROM classes WHERE id = :id`, { id }) as any;
    if (!existing) throw new Error(`Class not found (id=${id})`);
    db.execute(`DELETE FROM classes WHERE id = :id`, { id });
    return { deleted: true };
  }

  /* ================== SUBSCRIPTIONS ================== */
  async getSubscribersForClassOnDate(classId: number, date: string) {
    const db = await getDatabase();
    const d = String(date).slice(0, 10);

    await this.ensureSubscribersSchema();

    return db.query(
      `
      SELECT
        s.id,
        s.subscriber_code,
        s.name,
        s.id_number,
        s.phone,
        sub.id AS subscription_id,
        sub.start_date,
        sub.end_date
      FROM subscriptions sub
      INNER JOIN subscribers s ON s.id = sub.subscriber_id
      WHERE
        sub.class_id = :classId
        AND :date BETWEEN sub.start_date AND sub.end_date
      ORDER BY s.name COLLATE NOCASE ASC
      `,
      { classId, date: d }
    );
  }

  async addSubscription(subscriberId: number, classId: number, startDate?: string) {
    const db = await getDatabase();

    const s = Number(subscriberId);
    const c = Number(classId);
    if (!Number.isFinite(s) || s <= 0) throw new Error('Invalid subscriberId');
    if (!Number.isFinite(c) || c <= 0) throw new Error('Invalid classId');

    const start = String(startDate ? startDate : todayISO()).slice(0, 10);
    const end = '9999-12-31';

    const subExists = db.queryOne(`SELECT id FROM subscribers WHERE id = :id`, { id: s }) as any;
    if (!subExists) throw new Error(`Subscriber not found (id=${s})`);

    const classExists = db.queryOne(`SELECT id FROM classes WHERE id = :id`, { id: c }) as any;
    if (!classExists) throw new Error(`Class not found (id=${c})`);

    const overlaps = db.query(
      `
      SELECT id, start_date, end_date
      FROM subscriptions
      WHERE subscriber_id = :subscriberId
        AND class_id = :classId
        AND :date BETWEEN start_date AND end_date
      ORDER BY start_date DESC
      `,
      { subscriberId: s, classId: c, date: start }
    ) as any[];

    if (overlaps.length > 0) {
      const desiredEnd = isoAddDays(start, -1);

      for (const row of overlaps) {
        const clampedEnd = desiredEnd < String(row.start_date) ? String(row.start_date) : desiredEnd;
        db.execute(`UPDATE subscriptions SET end_date = :end_date WHERE id = :id`, {
          end_date: clampedEnd,
          id: row.id,
        });
      }
    }

    try {
      db.execute(
        `
        INSERT INTO subscriptions
          (subscriber_id, class_id, start_date, end_date, payment_status, amount, created_at)
        VALUES
          (:subscriber_id, :class_id, :start_date, :end_date, 'pending', 0, CURRENT_TIMESTAMP)
        `,
        {
          subscriber_id: s,
          class_id: c,
          start_date: start,
          end_date: end,
        }
      );
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.toLowerCase().includes('unique')) {
        throw new Error('Subscription already exists for this subscriber, class, and start date.');
      }
      throw e;
    }

    return (db.queryOne(`SELECT last_insert_rowid() as id`) as any)?.id;
  }

  async endSubscription(subscriberId: number, classId: number, endDate?: string) {
    const db = await getDatabase();

    const s = Number(subscriberId);
    const c = Number(classId);
    if (!Number.isFinite(s) || s <= 0) throw new Error('Invalid subscriberId');
    if (!Number.isFinite(c) || c <= 0) throw new Error('Invalid classId');

    const sub = db.queryOne(
      `
      SELECT id, start_date, end_date
      FROM subscriptions
      WHERE subscriber_id = :subscriberId
        AND class_id = :classId
      ORDER BY start_date DESC
      LIMIT 1
      `,
      { subscriberId: s, classId: c }
    ) as any;

    if (!sub) throw new Error('No subscription found for this subscriber and class.');

    const base = String(endDate ?? todayISO()).slice(0, 10);
    let newEnd = isoAddDays(base, -1);

    if (newEnd < String(sub.start_date)) {
      newEnd = isoAddDays(String(sub.start_date), -1);
    }

    db.execute(`UPDATE subscriptions SET end_date = :end_date WHERE id = :id`, {
      end_date: newEnd,
      id: sub.id,
    });

    return { ended: true, end_date: newEnd, subscription_id: sub.id };
  }

  /* ================== SUBSCRIBERS ================== */

  /**
   * Strict single-record load by primary key.
   * Does not affect subscriber code generation/import/reseed.
   */
  async getSubscriberById(id: number) {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    const sid = Number(id);
    if (!Number.isFinite(sid) || sid <= 0) throw new Error('Invalid subscriber id');

    const row = db.queryOne(`SELECT * FROM subscribers WHERE id = :id LIMIT 1`, { id: sid }) as any;
    return row || null;
  }

  /**
   * Production-grade list:
   * - Server-side pagination
   * - Deterministic order: subscriber_code ASC
   * - Typed search (code/name/id/phone)
   * - Optional filters (id, status) supported safely
   */
  async getSubscribers(filters: AnyObj = {}, page = 1, limit = 50) {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    const p = Number(page);
    const l = Number(limit);

    const safePage = Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
    const safeLimit = Number.isFinite(l) && l > 0 ? Math.floor(l) : 50;

    const offset = Math.max(0, (safePage - 1) * safeLimit);

    const where: string[] = [];
    const params: AnyObj = { l: safeLimit, o: offset };

    // Filter by id (when provided)
    if (filters && filters.id !== undefined && filters.id !== null && String(filters.id).trim() !== '') {
      const sid = Number(filters.id);
      if (Number.isFinite(sid) && sid > 0) {
        where.push(`id = :fid`);
        params.fid = sid;
      }
    }

    // Filter by status (optional)
    if (filters && filters.status !== undefined && filters.status !== null && String(filters.status).trim() !== '') {
      where.push(`LOWER(status) = LOWER(:fstatus)`);
      params.fstatus = String(filters.status).trim();
    }

    // Professional search
    const rawSearch = filters?.search !== undefined && filters?.search !== null ? String(filters.search).trim() : '';
    if (rawSearch.length > 0) {
      const s = rawSearch;
      const upper = s.toUpperCase();

      // Exact subscriber code: S + digits
      if (/^S\d{1,}$/i.test(s)) {
        where.push(`UPPER(subscriber_code) = :scode`);
        params.scode = upper;
      } else {
        const digitsOnly = s.replace(/\D/g, '');

        // If user typed something phone-like (mostly digits)
        const isMostlyDigits = digitsOnly.length >= Math.max(3, Math.floor(s.length * 0.7));

        if (isMostlyDigits && digitsOnly.length > 0) {
          // Match phone/id_number loosely by digits
          // We do NOT rewrite stored values; we just use LIKE safely.
          const like = `%${digitsOnly}%`;
          where.push(`(
            REPLACE(REPLACE(REPLACE(COALESCE(phone,''), ' ', ''), '-', ''), '+', '') LIKE :dig
            OR COALESCE(id_number,'') LIKE :dig
            OR UPPER(COALESCE(subscriber_code,'')) LIKE :ucodeLike
          )`);
          params.dig = like;
          params.ucodeLike = `%${upper}%`;
        } else {
          // Text search: name / id_number / phone / code
          where.push(`(
            COALESCE(name,'') LIKE :q COLLATE NOCASE
            OR COALESCE(id_number,'') LIKE :q COLLATE NOCASE
            OR COALESCE(phone,'') LIKE :q COLLATE NOCASE
            OR COALESCE(subscriber_code,'') LIKE :q COLLATE NOCASE
          )`);
          params.q = `%${s}%`;
        }
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Deterministic order: subscriber_code ASC (NULL/empty last)
    const orderSql = `
      ORDER BY
        CASE
          WHEN subscriber_code IS NULL OR TRIM(subscriber_code) = '' THEN 1
          ELSE 0
        END ASC,
        subscriber_code ASC
    `;

    const data = db.query(
      `SELECT * FROM subscribers ${whereSql} ${orderSql} LIMIT :l OFFSET :o`,
      params
    );

    const total = (db.queryOne(
      `SELECT COUNT(*) AS c FROM subscribers ${whereSql}`,
      params
    ) as any)?.c ?? 0;

    return { data, total };
  }

  // Manual create remains strict
  async createSubscriber(data: AnyObj) {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    const name = this.normalizeText(data.name);
    const phone = this.normalizeText(data.phone);
    const id_number = this.normalizeText(data.id_number);

    if (!name) throw new Error('Name is required');
    if (!phone) throw new Error('Phone is required');
    if (!id_number) throw new Error('ID Number is required');

    try {
      db.execute('BEGIN IMMEDIATE');
    } catch {}

    try {
      const code = this.generateNextSubscriberCodeWithDb(db);

      db.execute(
        `
        INSERT INTO subscribers
          (subscriber_code, name, phone, email, id_number, status, notes, address, created_at, updated_at)
        VALUES
          (:c, :n, :p, :e, :i, :s, :no, :a, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        {
          c: code,
          n: name,
          p: phone,
          e: data.email ?? null,
          i: id_number,
          s: data.status ?? 'active',
          no: data.notes ?? null,
          a: data.address ?? null,
        }
      );

      try {
        db.execute('COMMIT');
      } catch {}

      return (db.queryOne(`SELECT last_insert_rowid() AS id`) as any)?.id;
    } catch (e) {
      try {
        db.execute('ROLLBACK');
      } catch {}
      throw e;
    }
  }

  async updateSubscriber(id: number, data: AnyObj) {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    db.execute(
      `
      UPDATE subscribers SET
        name = :n, phone = :p, email = :e,
        status = :s, notes = :no, address = :a,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      `,
      {
        id,
        n: data.name,
        p: data.phone,
        e: data.email,
        s: data.status,
        no: data.notes,
        a: data.address,
      }
    );
  }

  async deleteSubscriber(id: number) {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();
    db.execute(`DELETE FROM subscribers WHERE id = :id`, { id });
  }

  /**
   * ✅ IMPORT (LENIENT, CONSISTENT WITH schema.ts):
   * - Requires ONLY name
   * - phone/id_number/email optional
   * - If id_number duplicates, force NULL so UNIQUE does not break the row
   * - Generates subscriber_code via subscriber_code_seq
   * - One transaction for the whole batch
   */
  async importSubscribers(rows: AnyObj[]) {
    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    let created = 0;
    let failed = 0;

    try {
      db.execute('BEGIN IMMEDIATE');
    } catch {}

    try {
      for (const raw of rows) {
        try {
          const normalized = this.normalizeSubscriberImportRow(raw);

          // import requires only name
          if (!normalized.name) {
            failed++;
            continue;
          }

          // If id_number exists already, store NULL to avoid UNIQUE constraint failure
          let id_number = normalized.id_number;
          if (id_number) {
            const exists = db.queryOne(`SELECT id FROM subscribers WHERE id_number = :id LIMIT 1`, {
              id: id_number,
            }) as any;
            if (exists) id_number = null;
          }

          const code = this.generateNextSubscriberCodeWithDb(db);

          db.execute(
            `
            INSERT INTO subscribers
              (subscriber_code, name, phone, email, id_number, status, notes, address, created_at, updated_at)
            VALUES
              (:c, :name, :phone, :email, :id_number, :status, :notes, :address, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            {
              c: code,
              name: normalized.name,
              phone: normalized.phone,
              email: normalized.email,
              id_number,
              status: normalized.status,
              notes: normalized.notes,
              address: normalized.address,
            }
          );

          created++;
        } catch {
          failed++;
        }
      }

      try {
        db.execute('COMMIT');
      } catch {}

      return { created, failed };
    } catch (e) {
      try {
        db.execute('ROLLBACK');
      } catch {}
      throw e;
    }
  }

  async uploadSubscriberPhoto(subscriberId: number, fileName: string, bytes: Uint8Array) {
    const dir = ensureUploadsDir(subscriberId);
    const safe = safeFileName(fileName);
    const filePath = path.join(dir, `photo_${Date.now()}_${safe}`);
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const db = await getDatabase();
    await this.ensureSubscribersSchema();

    db.execute(`UPDATE subscribers SET photo_path = :p WHERE id = :id`, { p: filePath, id: subscriberId });
    return { path: filePath };
  }

  async uploadSubscriberDocument(subscriberId: number, fileName: string, bytes: Uint8Array) {
    const dir = ensureUploadsDir(subscriberId);
    const safe = safeFileName(fileName);
    const filePath = path.join(dir, `${Date.now()}_${safe}`);
    fs.writeFileSync(filePath, Buffer.from(bytes));
    return { path: filePath };
  }

  /* ================== ATTENDANCE ================== */

  async markAttendance(data: AnyObj) {
    const db = await getDatabase();
    db.execute(
      `
      INSERT OR REPLACE INTO attendance
        (subscriber_id, date, status, notes, recorded_by, created_at)
      VALUES
        (:s, :d, :st, :n, :r, CURRENT_TIMESTAMP)
      `,
      {
        s: data.subscriber_id,
        d: data.date,
        st: data.status,
        n: data.notes,
        r: data.recorded_by ?? 1,
      }
    );
  }

  async unmarkAttendance(subscriber_id: number, date: string) {
    const db = await getDatabase();
    db.execute(`DELETE FROM attendance WHERE subscriber_id = :i AND date = :d`, {
      i: subscriber_id,
      d: date,
    });
  }

  async getAttendanceByDate(date: string) {
    const db = await getDatabase();
    return db.query(`SELECT * FROM attendance WHERE date = :d`, { d: date });
  }

  /* ================== AUTH ================== */

  async authenticateUser(username: string, password: string) {
    const db = await getDatabase();
    const u = db.queryOne(`SELECT * FROM users WHERE username = :u`, { u: username }) as any;
    if (!u) return null;
    if (String(u.password_hash) !== String(password)) return null;
    return u;
  }
}

export const dbService = new DatabaseService();
export async function initializeDatabase() {
  await getDatabase();
}
