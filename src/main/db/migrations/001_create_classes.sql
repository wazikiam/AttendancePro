-- AttendancePro
-- Migration: 001_create_classes
-- Purpose: Define classes table (additive, non-breaking)
-- Notes:
-- - No hard delete (status-based lifecycle)
-- - SQLite compatible
-- - Safe to run multiple times

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  schedule_days TEXT,
  schedule_time TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classes_status
  ON classes(status);

CREATE INDEX IF NOT EXISTS idx_classes_name
  ON classes(name);

COMMIT;
