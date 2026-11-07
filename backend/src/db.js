import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
// Ensure data + upload directories exist
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(config.propertyUploadDir, { recursive: true });
fs.mkdirSync(config.kycUploadDir, { recursive: true });
export const db = new DatabaseSync(config.dbPath);
// Pragmas for reliability / concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role          TEXT NOT NULL CHECK (role IN ('member','admin')),
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone         TEXT,
      is_agent      INTEGER NOT NULL DEFAULT 0 CHECK (is_agent IN (0, 1)),
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
      property_type TEXT NOT NULL CHECK (property_type IN ('detached','semi_detached','freehold_townhouse','condo_townhouse','condo_apt','link','vacant_land','other','apartment','house','plot','commercial','villa')),
      listing_type  TEXT NOT NULL CHECK (listing_type IN ('sale','rent')),
      price         REAL NOT NULL,
      area_sqft     REAL,
      bedrooms      INTEGER,
      bathrooms     INTEGER,
      address       TEXT,
      city          TEXT,
      state         TEXT,
      country       TEXT DEFAULT 'Canada',
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

  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some((column) => column.name === 'is_agent')) {
    db.exec('ALTER TABLE users ADD COLUMN is_agent INTEGER NOT NULL DEFAULT 0 CHECK (is_agent IN (0, 1))');
  }

  const userTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!userTable.sql.includes("'member'") || userTable.sql.includes("'buyer'") || userTable.sql.includes("'seller'")) {
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec(`
        BEGIN;
        CREATE TABLE users_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          role          TEXT NOT NULL CHECK (role IN ('member','admin')),
          name          TEXT NOT NULL,
          email         TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          phone         TEXT,
          is_agent      INTEGER NOT NULL DEFAULT 0 CHECK (is_agent IN (0, 1)),
          kyc_status    TEXT NOT NULL DEFAULT 'unverified'
                          CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
          terms_accepted_at TEXT,
          active        INTEGER NOT NULL DEFAULT 1,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO users_new
          SELECT id, CASE WHEN role IN ('buyer','seller') THEN 'member' ELSE role END,
                 name, email, password_hash, phone, is_agent, kyc_status,
                 terms_accepted_at, active, created_at
          FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        COMMIT;
      `);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }

  const propertyTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'properties'").get();
  if (!propertyTable.sql.includes("'detached'") || propertyTable.sql.includes("DEFAULT 'India'")) {
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec(`
        BEGIN;
        CREATE TABLE properties_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          seller_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title         TEXT NOT NULL,
          description   TEXT,
          property_type TEXT NOT NULL CHECK (property_type IN ('detached','semi_detached','freehold_townhouse','condo_townhouse','condo_apt','link','vacant_land','other','apartment','house','plot','commercial','villa')),
          listing_type  TEXT NOT NULL CHECK (listing_type IN ('sale','rent')),
          price         REAL NOT NULL,
          area_sqft     REAL,
          bedrooms      INTEGER,
          bathrooms     INTEGER,
          address       TEXT,
          city          TEXT,
          state         TEXT,
          country       TEXT DEFAULT 'Canada',
          pincode       TEXT,
          status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('draft','pending','approved','rejected','sold')),
          rejection_reason TEXT,
          featured      INTEGER NOT NULL DEFAULT 0,
          views         INTEGER NOT NULL DEFAULT 0,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO properties_new SELECT * FROM properties;
        DROP TABLE properties;
        ALTER TABLE properties_new RENAME TO properties;
        CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
        CREATE INDEX IF NOT EXISTS idx_properties_seller ON properties(seller_id);
        CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
        COMMIT;
      `);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
  }

  for (const [prefix, destination] of [
    ['property_', config.propertyUploadDir],
    ['kyc_', config.kycUploadDir],
  ]) {
    for (const entry of fs.readdirSync(config.uploadDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
      fs.renameSync(
        path.join(config.uploadDir, entry.name),
        path.join(destination, entry.name)
      );
    }
  }
  db.prepare(`
    UPDATE property_images
    SET url = '/uploads/properties/' || substr(url, 10)
    WHERE url GLOB '/uploads/property_*'
  `).run();

  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_profiles (
      user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
      job_title           TEXT,
      team                TEXT,
      manager_user_id     INTEGER REFERENCES staff_profiles(user_id) ON DELETE SET NULL,
      employment_status   TEXT NOT NULL DEFAULT 'active'
                            CHECK (employment_status IN ('active', 'on_leave', 'departed')),
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS roles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role_key      TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      description   TEXT,
      is_system_role INTEGER NOT NULL DEFAULT 1 CHECK (is_system_role IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      permission_key  TEXT NOT NULL UNIQUE,
      description     TEXT
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id     INTEGER NOT NULL REFERENCES staff_profiles(user_id) ON DELETE CASCADE,
      role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      granted_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS staff_role_requests (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      justification TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at   TEXT,
      review_note   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS app_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_role_requests_pending
      ON staff_role_requests(user_id, role_id) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_staff_role_requests_status
      ON staff_role_requests(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
  `);

  const permissions = [
    ['dashboard.read', 'View staff dashboard metrics'],
    ['users.read', 'View platform user accounts'],
    ['users.manage', 'Activate and deactivate platform accounts'],
    ['users.agent', 'Manage agent flags on platform accounts'],
    ['kyc.review', 'Review KYC submissions'],
    ['listings.read', 'View listings awaiting moderation'],
    ['listings.review', 'Approve or reject listings'],
    ['listings.feature', 'Feature listings'],
    ['appointments.read', 'View platform appointments'],
    ['audit.read', 'View audit records'],
    ['staff.manage', 'Assign and revoke staff roles'],
    ['staff.requests.review', 'Approve or reject staff role requests'],
  ];
  const roles = [
    ['owner', 'Owner / Super Admin', 'Manage staff and all platform administration'],
    ['listing_moderator', 'Listing Moderator', 'Review and feature property listings'],
    ['compliance_reviewer', 'Compliance Reviewer', 'Review user KYC submissions'],
    ['support_agent', 'Support Agent', 'Look up users and view appointments'],
    ['read_only_analyst', 'Read-only Analyst', 'View dashboard metrics and audit records'],
  ];
  const permissionsByRole = {
    owner: permissions.map(([key]) => key),
    listing_moderator: ['dashboard.read', 'listings.read', 'listings.review', 'listings.feature'],
    compliance_reviewer: ['dashboard.read', 'users.read', 'kyc.review'],
    support_agent: ['dashboard.read', 'users.read', 'appointments.read'],
    read_only_analyst: ['dashboard.read', 'audit.read'],
  };
  const insertPermission = db.prepare(
    'INSERT OR IGNORE INTO permissions (permission_key, description) VALUES (?, ?)'
  );
  for (const [key, description] of permissions) insertPermission.run(key, description);
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (role_key, name, description) VALUES (?, ?, ?)'
  );
  for (const [key, name, description] of roles) insertRole.run(key, name, description);
  const getPermissionId = db.prepare('SELECT id FROM permissions WHERE permission_key = ?');
  const getRoleId = db.prepare('SELECT id FROM roles WHERE role_key = ?');
  const insertRolePermission = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
  );
  for (const [roleKey, permissionKeys] of Object.entries(permissionsByRole)) {
    const roleId = getRoleId.get(roleKey).id;
    for (const permissionKey of permissionKeys) {
      insertRolePermission.run(roleId, getPermissionId.get(permissionKey).id);
    }
  }

  const legacyAdminMigration = 'staff-roles-owner-backfill-v1';
  if (!db.prepare('SELECT 1 FROM app_migrations WHERE migration_key = ?').get(legacyAdminMigration)) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("INSERT OR IGNORE INTO staff_profiles (user_id) SELECT id FROM users WHERE role = 'admin'").run();
      db.prepare(`
        INSERT OR IGNORE INTO user_roles (user_id, role_id)
        SELECT id, ? FROM users WHERE role = 'admin'
      `).run(getRoleId.get('owner').id);
      db.prepare('INSERT INTO app_migrations (migration_key) VALUES (?)').run(legacyAdminMigration);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
