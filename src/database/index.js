"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.dbService = void 0;
exports.initializeDatabase = initializeDatabase;

const path = require("path");
const fs = require("fs");
const electron_1 = require("electron");
const schema_1 = require("./schema");

const isSelectLike = (sql) => {
  const s = String(sql || "").trim().toUpperCase();
  return s.startsWith("SELECT") || s.startsWith("PRAGMA") || s.startsWith("EXPLAIN");
};

const ensureUploadsDir = (subscriberId) => {
  const base = path.join(electron_1.app.getPath("userData"), "uploads", "subscribers", String(subscriberId));
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
};

const safeFileName = (name) => {
  return String(name || "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 120);
};

class DatabaseService {
  async close() {
    const db = await (0, schema_1.getDatabase)();
    db.close();
  }

  async getDatabaseStats() {
    const db = await (0, schema_1.getDatabase)();
    return db.getDatabaseStats();
  }

  async backupDatabase() {
    const db = await (0, schema_1.getDatabase)();
    const dir = path.join(electron_1.app.getPath("userData"), "backups");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(dir, `attendance-pro-backup-${ts}.db`);
    db.backup(dest);
    return dest;
  }

  // READ ONLY raw query endpoint
  async executeRawSQL(sql, params = {}) {
    const db = await (0, schema_1.getDatabase)();
    if (!isSelectLike(sql)) {
      throw new Error("database:query is READ-ONLY. Use the dedicated IPC methods for mutations.");
    }
    return db.query(sql, params);
  }

  // Subscribers
  async getSubscribers(filters = {}, page = 1, limit = 50) {
    const db = await (0, schema_1.getDatabase)();

    const where = [];
    const params = {};

    if (filters?.status && String(filters.status).toLowerCase() !== "all") {
      where.push(`LOWER(status) = LOWER(:status)`);
      params.status = String(filters.status);
    }

    if (filters?.search && String(filters.search).trim()) {
      where.push(`(
        name LIKE :q OR
        id_number LIKE :q OR
        phone LIKE :q OR
        email LIKE :q
      )`);
      params.q = `%${String(filters.search).trim()}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = Math.max(0, (page - 1) * limit);

    const totalRow = db.queryOne(
      `SELECT COUNT(*) as count FROM subscribers ${whereSql}`,
      params
    );

    const data = db.query(
      `
      SELECT *
      FROM subscribers
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      { ...params, limit, offset }
    );

    return { total: Number(totalRow?.count ?? 0), data };
  }

  async createSubscriber(data) {
    const db = await (0, schema_1.getDatabase)();

    const name = String(data?.name ?? "").trim();
    const idNumber = String(data?.id_number ?? "").trim();
    const phone = String(data?.phone ?? "").trim();

    if (!name) throw new Error("Name is required");
    if (!idNumber) throw new Error("ID Number is required");
    if (!phone) throw new Error("Phone is required");

    try {
      db.execute(
        `
        INSERT INTO subscribers (
          name, phone, email, id_number, status,
          notes, address, date_of_birth, emergency_contact, emergency_phone,
          created_at, updated_at
        )
        VALUES (
          :name, :phone, :email, :id_number, :status,
          :notes, :address, :date_of_birth, :emergency_contact, :emergency_phone,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        `,
        {
          name,
          phone,
          email: data?.email ? String(data.email).trim() : null,
          id_number: idNumber,
          status: data?.status ? String(data.status) : "active",
          notes: data?.notes ? String(data.notes) : null,
          address: data?.address ? String(data.address) : null,
          date_of_birth: data?.date_of_birth ? String(data.date_of_birth) : null,
          emergency_contact: data?.emergency_contact ? String(data.emergency_contact) : null,
          emergency_phone: data?.emergency_phone ? String(data.emergency_phone) : null
        }
      );

      const row = db.queryOne(`SELECT last_insert_rowid() as id`);
      return row?.id;
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("UNIQUE constraint failed: subscribers.id_number")) {
        throw new Error("ID Number already exists. Please use a different ID Number.");
      }
      throw e;
    }
  }

  async updateSubscriber(id, data) {
    const db = await (0, schema_1.getDatabase)();

    const name = String(data?.name ?? "").trim();
    const idNumber = String(data?.id_number ?? "").trim();
    const phone = String(data?.phone ?? "").trim();

    if (!name) throw new Error("Name is required");
    if (!idNumber) throw new Error("ID Number is required");
    if (!phone) throw new Error("Phone is required");

    try {
      db.execute(
        `
        UPDATE subscribers
        SET
          name = :name,
          phone = :phone,
          email = :email,
          id_number = :id_number,
          status = :status,
          notes = :notes,
          address = :address,
          date_of_birth = :date_of_birth,
          emergency_contact = :emergency_contact,
          emergency_phone = :emergency_phone,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
        `,
        {
          id,
          name,
          phone,
          email: data?.email ? String(data.email).trim() : null,
          id_number: idNumber,
          status: data?.status ? String(data.status) : "active",
          notes: data?.notes ? String(data.notes) : null,
          address: data?.address ? String(data.address) : null,
          date_of_birth: data?.date_of_birth ? String(data.date_of_birth) : null,
          emergency_contact: data?.emergency_contact ? String(data.emergency_contact) : null,
          emergency_phone: data?.emergency_phone ? String(data.emergency_phone) : null
        }
      );

      return true;
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("UNIQUE constraint failed: subscribers.id_number")) {
        throw new Error("ID Number already exists. Please use a different ID Number.");
      }
      throw e;
    }
  }

  async deleteSubscriber(id) {
    const db = await (0, schema_1.getDatabase)();
    db.execute(`DELETE FROM subscribers WHERE id = :id`, { id });
    return true;
  }

  async importSubscribers(rows) {
    const db = await (0, schema_1.getDatabase)();

    if (!Array.isArray(rows)) throw new Error("Invalid import payload");

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const name = String(r.name ?? "").trim();
      const id_number = String(r.id_number ?? "").trim();
      const phone = String(r.phone ?? "").trim();

      if (!name || !id_number || !phone) {
        failed++;
        continue;
      }

      const statusRaw = String(r.status ?? "").trim().toLowerCase();
      const status =
        statusRaw === "inactive" ? "inactive" :
        statusRaw === "suspended" ? "suspended" :
        "active";

      const email = r.email ? String(r.email).trim() : null;
      const address = r.address ? String(r.address).trim() : null;
      const notes = r.notes ? String(r.notes).trim() : null;

      try {
        const exists = db.queryOne(
          `SELECT id FROM subscribers WHERE id_number = :id_number LIMIT 1`,
          { id_number }
        );

        db.execute(
          `
          INSERT INTO subscribers (name, phone, email, id_number, status, address, notes, created_at, updated_at)
          VALUES (:name, :phone, :email, :id_number, :status, :address, :notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id_number) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            email = excluded.email,
            status = excluded.status,
            address = excluded.address,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
          `,
          { name, phone, email, id_number, status, address, notes }
        );

        if (exists) updated++;
        else created++;
      } catch (e) {
        failed++;
      }
    }

    return { created, updated, failed };
  }

  async uploadSubscriberPhoto(subscriberId, fileName, bytes) {
    const db = await (0, schema_1.getDatabase)();
    const dir = ensureUploadsDir(subscriberId);

    const safe = safeFileName(fileName || "photo");
    const photoPath = path.join(dir, `photo_${Date.now()}_${safe}`);

    fs.writeFileSync(photoPath, Buffer.from(bytes));

    db.execute(
      `UPDATE subscribers SET photo_path = :photo_path, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { id: subscriberId, photo_path: photoPath }
    );

    return { path: photoPath };
  }

  async uploadSubscriberDocument(subscriberId, fileName, bytes) {
    const db = await (0, schema_1.getDatabase)();
    const dir = ensureUploadsDir(subscriberId);

    const docsDir = path.join(dir, "documents");
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const safe = safeFileName(fileName || "document");
    const docPath = path.join(docsDir, `${Date.now()}_${safe}`);

    fs.writeFileSync(docPath, Buffer.from(bytes));

    db.execute(
      `UPDATE subscribers SET documents_path = :documents_path, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { id: subscriberId, documents_path: docsDir }
    );

    return { path: docPath };
  }

  // Attendance (minimal safe)
  async markAttendance(data) {
    const db = await (0, schema_1.getDatabase)();
    db.execute(
      `
      INSERT OR REPLACE INTO attendance (subscriber_id, date, status, notes, recorded_by, created_at)
      VALUES (:subscriber_id, :date, :status, :notes, :recorded_by, CURRENT_TIMESTAMP)
      `,
      {
        subscriber_id: data.subscriber_id,
        date: data.date,
        status: data.status || "absent",
        notes: data.notes || null,
        recorded_by: data.recorded_by || 1
      }
    );
    return true;
  }

  async getAttendanceByDate(date) {
    const db = await (0, schema_1.getDatabase)();
    return db.query(`SELECT * FROM attendance WHERE date = :date`, { date });
  }

  async authenticateUser(username, password) {
    const db = await (0, schema_1.getDatabase)();
    const user = db.queryOne(`SELECT * FROM users WHERE username = :u LIMIT 1`, { u: username });
    if (!user) return null;
    if (String(user.password_hash) !== String(password)) return null;
    return user;
  }
}

exports.dbService = new DatabaseService();

async function initializeDatabase() {
  await (0, schema_1.getDatabase)();
}
