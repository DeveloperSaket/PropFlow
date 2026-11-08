import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

await Promise.all([
  config.uploadDir,
  config.propertyUploadDir,
  config.kycUploadDir,
].map((directory) => fs.mkdir(directory, { recursive: true })));

const { Pool, types } = pg;
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  options: '-c timezone=UTC',
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
});
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Configure a PostgreSQL connection before starting PropFlow.');
}

function prepareQuery(sql, input) {
  const ignoreConflicts = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  const values = [];
  if (input.length === 1 && input[0] && typeof input[0] === 'object' && !Array.isArray(input[0])) {
    sql = sql.replace(/@([a-zA-Z_]\w*)/g, (_match, key) => {
      values.push(input[0][key]);
      return `$${values.length}`;
    });
  } else {
    let index = 0;
    sql = sql.replace(/\?/g, () => {
      values.push(input[index++]);
      return `$${values.length}`;
    });
  }
  sql = sql
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
  if (ignoreConflicts && !/\bON\s+CONFLICT\b/i.test(sql)) {
    sql = sql.replace(/;\s*$/, '') + ' ON CONFLICT DO NOTHING';
  }
  const insertTable = sql.match(/^\s*INSERT\s+INTO\s+([a-z_]+)/i)?.[1]?.toLowerCase();
  const idTables = new Set([
    'users', 'properties', 'property_images', 'interests', 'appointments',
    'compliance_docs', 'audit_logs', 'roles', 'permissions', 'staff_role_requests',
  ]);
  if (idTables.has(insertTable) && !/\bRETURNING\b/i.test(sql)) {
    sql += ' RETURNING id';
  }
  return { sql, values };
}

function statement(sql) {
  return {
    async get(...input) {
      const { sql: text, values } = prepareQuery(sql, input);
      const result = await pool.query(text, values);
      return result.rows[0];
    },
    async all(...input) {
      const { sql: text, values } = prepareQuery(sql, input);
      const result = await pool.query(text, values);
      return result.rows;
    },
    async run(...input) {
      const { sql: text, values } = prepareQuery(sql, input);
      const result = await pool.query(text, values);
      return { lastInsertRowid: result.rows[0]?.id, changes: result.rowCount };
    },
  };
}

export const db = { prepare: statement };

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query(text, values = []) {
        return client.query(text, values);
      },
      prepare(sql) {
        return {
          async get(...input) {
            const { sql: text, values } = prepareQuery(sql, input);
            return (await client.query(text, values)).rows[0];
          },
          async all(...input) {
            const { sql: text, values } = prepareQuery(sql, input);
            return (await client.query(text, values)).rows;
          },
          async run(...input) {
            const { sql: text, values } = prepareQuery(sql, input);
            const queryResult = await client.query(text, values);
            return { lastInsertRowid: queryResult.rows[0]?.id, changes: queryResult.rowCount };
          },
        };
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
export async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(42042, 1)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE migration_name = $1', [name]);
      if (applied.rowCount) continue;
      const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
      await client.query('BEGIN');
      try {
        for (const command of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
          await client.query(command);
        }
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.log(`[database] applied migration ${name}`);
    }
    const legacyAdminMigration = 'staff-roles-owner-backfill-v1';
    await client.query('BEGIN');
    try {
      const applied = await client.query(
        'SELECT 1 FROM app_migrations WHERE migration_key = $1',
        [legacyAdminMigration]
      );
      if (!applied.rowCount) {
        await client.query(`
          INSERT INTO staff_profiles (user_id)
          SELECT id FROM users WHERE role = 'admin'
          ON CONFLICT DO NOTHING
        `);
        await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          SELECT u.id, r.id
          FROM users u CROSS JOIN roles r
          WHERE u.role = 'admin' AND r.role_key = 'owner'
          ON CONFLICT DO NOTHING
        `);
        await client.query(
          'INSERT INTO app_migrations (migration_key) VALUES ($1)',
          [legacyAdminMigration]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(42042, 1)');
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}
