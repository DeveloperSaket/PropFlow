import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, initSchema, pool, withTransaction } from './db.js';

const sourcePath = process.env.SQLITE_SOURCE
  ? path.resolve(process.env.SQLITE_SOURCE)
  : '';
const tableOrder = [
  'users',
  'properties',
  'property_images',
  'interests',
  'appointments',
  'compliance_docs',
  'audit_logs',
  'staff_profiles',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'staff_role_requests',
  'app_migrations',
];
const serialTables = [
  'users', 'properties', 'property_images', 'interests', 'appointments',
  'compliance_docs', 'audit_logs', 'roles', 'permissions', 'staff_role_requests',
];
const businessTables = [
  ...tableOrder.filter((table) => !['roles', 'permissions', 'role_permissions', 'app_migrations'].includes(table)),
];

if (!sourcePath) {
  throw new Error('Set SQLITE_SOURCE to a consistent SQLite backup before importing.');
}
if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite source database does not exist: ${sourcePath}`);
}

await initSchema();
const source = new DatabaseSync(sourcePath, { readOnly: true });

try {
  const sourceTables = new Set(
    source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );
  const sourceRoleCount = sourceTables.has('roles')
    ? Number(source.prepare('SELECT COUNT(*) AS count FROM roles').get().count)
    : 0;
  const sourcePermissionCount = sourceTables.has('permissions')
    ? Number(source.prepare('SELECT COUNT(*) AS count FROM permissions').get().count)
    : 0;
  if ((sourceRoleCount > 0) !== (sourcePermissionCount > 0)) {
    throw new Error('SQLite role and permission catalogs are inconsistent; refusing to import.');
  }
  const targetCounts = await Promise.all(
    businessTables.map(async (table) => {
      const { rows } = await pool.query(`SELECT COUNT(*) AS count FROM "${table}"`);
      return [table, Number(rows[0].count)];
    })
  );
  const occupied = targetCounts.filter(([, count]) => count > 0);
  if (occupied.length) {
    throw new Error(
      `Target PostgreSQL database is not empty (${occupied.map(([table, count]) => `${table}=${count}`).join(', ')}). Import requires an empty application database.`
    );
  }

  await withTransaction(async (tx) => {
    if (sourceRoleCount > 0 && sourcePermissionCount > 0) {
      await tx.query('DELETE FROM user_roles');
      await tx.query('DELETE FROM staff_role_requests');
      await tx.query('DELETE FROM role_permissions');
      await tx.query('DELETE FROM roles');
      await tx.query('DELETE FROM permissions');
    }

    for (const table of tableOrder) {
      if (!sourceTables.has(table)) continue;
      const target = await tx.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1',
        [table]
      );
      const targetColumns = new Set(target.rows.map((row) => row.column_name));
      const sourceCount = Number(
        source.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count
      );
      if (!sourceCount) continue;
      const firstBatch = source.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`).all(1, 0);
      const columns = Object.keys(firstBatch[0]).filter((column) => targetColumns.has(column));
      if (!columns.length) continue;
      const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
      const pageSize = Math.min(500, Math.max(1, Math.floor(60000 / columns.length)));
      for (let start = 0; start < sourceCount; start += pageSize) {
        const batch = source.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`).all(pageSize, start);
        const values = [];
        const valueRows = batch.map((row, rowIndex) => {
          const placeholders = columns.map((column, columnIndex) => {
            values.push(row[column] ?? null);
            return `$${rowIndex * columns.length + columnIndex + 1}`;
          });
          return `(${placeholders.join(', ')})`;
        });
        await tx.query(
          `INSERT INTO "${table}" (${quotedColumns}) VALUES ${valueRows.join(', ')}${table === 'app_migrations' ? ' ON CONFLICT DO NOTHING' : ''}`,
          values
        );
      }
      console.log(`[sqlite-import] ${table}: ${sourceCount} rows`);
    }

    await tx.query(`
      INSERT INTO staff_profiles (user_id)
      SELECT id FROM users WHERE role = 'admin'
      ON CONFLICT DO NOTHING
    `);
    await tx.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u CROSS JOIN roles r
      WHERE u.role = 'admin' AND r.role_key = 'owner'
      ON CONFLICT DO NOTHING
    `);

    for (const table of serialTables) {
      await tx.query(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1),
          EXISTS (SELECT 1 FROM "${table}")
        )
      `);
    }

    for (const table of tableOrder) {
      if (!sourceTables.has(table)) continue;
      const sourceCount = Number(
        source.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count
      );
      const targetCount = Number(
        (await tx.query(`SELECT COUNT(*) AS count FROM "${table}"`)).rows[0].count
      );
      const derivedRows = ['staff_profiles', 'user_roles', 'app_migrations'].includes(table);
      if (derivedRows ? targetCount < sourceCount : targetCount !== sourceCount) {
        throw new Error(
          `Import validation failed for ${table}: SQLite=${sourceCount}, PostgreSQL=${targetCount}`
        );
      }
    }
  });
  console.log('[sqlite-import] import completed. Upload files remain on disk and must be copied with the app.');
} finally {
  source.close();
  await closeDatabase();
}
