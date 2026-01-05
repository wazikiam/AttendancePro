// src/main/db/runMigrations.ts
//
// Safe SQLite migration runner
// - Additive only
// - Explicit execution
// - Tracks applied migrations
// - Robust path resolution

import * as fs from 'fs';
import * as path from 'path';
import type { Database } from 'sqlite3';

export async function runMigrations(db: Database): Promise<void> {
  await ensureMigrationTable(db);

  const migrationsDir = path.join(
    process.cwd(),
    'src',
    'main',
    'db',
    'migrations'
  );

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await isMigrationApplied(db, file);
    if (applied) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await execSQL(db, sql);
    await recordMigration(db, file);
  }
}

/* ============================
   INTERNAL HELPERS
   ============================ */

function execSQL(db: Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function ensureMigrationTable(db: Database): Promise<void> {
  return execSQL(
    db,
    `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    `
  );
}

function isMigrationApplied(db: Database, filename: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 1 FROM schema_migrations WHERE filename = ? LIMIT 1`,
      [filename],
      (err, row) => (err ? reject(err) : resolve(!!row))
    );
  });
}

function recordMigration(db: Database, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO schema_migrations (filename) VALUES (?)`,
      [filename],
      (err) => (err ? reject(err) : resolve())
    );
  });
}
