// src/db/init.js — SQLite nativo de Node.js (node:sqlite, Node 22.5+)
// Sin dependencias nativas externas — funciona en Node 24 sin compilación.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(__dirname, "../../data/licenses.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id          TEXT PRIMARY KEY,
    key         TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL CHECK(plan IN ('FREE','PRO','STUDIO')),
    email       TEXT NOT NULL,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
                CHECK(status IN ('ACTIVE','REVOKED','EXPIRED','SUSPENDED')),
    max_devices INTEGER NOT NULL DEFAULT 1,
    expires_at  INTEGER,
    notes       TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS devices (
    id           TEXT PRIMARY KEY,
    license_id   TEXT NOT NULL,
    device_id    TEXT NOT NULL,
    device_name  TEXT,
    platform     TEXT,
    app_version  TEXT,
    activated_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    UNIQUE(license_id, device_id)
  );

  CREATE TABLE IF NOT EXISTS validation_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id  TEXT,
    device_id   TEXT,
    action      TEXT NOT NULL,
    result      TEXT NOT NULL,
    ip          TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_licenses_key    ON licenses(key);
  CREATE INDEX IF NOT EXISTS idx_licenses_email  ON licenses(email);
  CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
  CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);
  CREATE INDEX IF NOT EXISTS idx_devices_device  ON devices(device_id);
  CREATE INDEX IF NOT EXISTS idx_log_created     ON validation_log(created_at);
`);

/**
 * Wrapper compatible con la API de better-sqlite3.
 * node:sqlite usa una API diferente — este wrapper la iguala
 * para no tener que cambiar routes/admin.js ni routes/licenses.js.
 */
const wrapper = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    return {
      run(...params) { return stmt.run(...params); },
      get(...params) { return stmt.get(...params); },
      all(...params) { return stmt.all(...params); },
    };
  },
  exec(sql) { return db.exec(sql); },
};

console.log("[db] SQLite nativo (node:sqlite) inicializado en:", DB_PATH);
export default wrapper;