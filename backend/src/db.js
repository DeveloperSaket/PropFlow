import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
// Ensure data + upload directories exist
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
export const db = new DatabaseSync(config.dbPath);
// Pragmas for reliability / concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role          TEXT NOT NULL CHECK (role IN ('buyer','seller','admin')),
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone         TEXT,
      kyc_status    TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
      terms_accepted_at TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS properties (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      description   TEXT,
      property_type TEXT NOT NULL CHECK (property_type IN ('apartment','house','plot','commercial','villa')),
      listing_type  TEXT NOT NULL CHECK (listing_type IN ('sale','rent')),
      price         REAL NOT NULL,
      area_sqft     REAL,
      bedrooms      INTEGER,
      bathrooms     INTEGER,
      address       TEXT,
      city          TEXT,
      state         TEXT,
      country       TEXT DEFAULT 'India',
      pincode       TEXT,
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('draft','pending','approved','rejected','sold')),
      rejection_reason TEXT,
      featured      INTEGER NOT NULL DEFAULT 0,
      views         INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS property_images (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url         TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS interests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      buyer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message     TEXT,
      status      TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','negotiating','closed','withdrawn')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (property_id, buyer_id)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      buyer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scheduled_at TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'requested'
                     CHECK (status IN ('requested','confirmed','completed','cancelled')),
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS compliance_docs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doc_type    TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','verified','rejected')),
      reviewed_by INTEGER REFERENCES users(id),
      note        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id   INTEGER REFERENCES users(id),
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      meta       TEXT,
      ip         TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
    CREATE INDEX IF NOT EXISTS idx_properties_seller ON properties(seller_id);
    CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
    CREATE INDEX IF NOT EXISTS idx_interests_buyer ON interests(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_interests_property ON interests(property_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_buyer ON appointments(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_seller ON appointments(seller_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
  `);
}
