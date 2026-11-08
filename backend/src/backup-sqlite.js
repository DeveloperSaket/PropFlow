import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

const sourcePath = process.env.SQLITE_SOURCE;
if (!sourcePath) throw new Error('Set SQLITE_SOURCE to the SQLite database to back up.');

const destinationPath = path.resolve(
  process.env.SQLITE_BACKUP || './data/propflow-migration-backup.db'
);
await fs.mkdir(path.dirname(destinationPath), { recursive: true });
try {
  await fs.access(destinationPath);
  throw new Error(`Backup destination already exists: ${destinationPath}`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const source = new DatabaseSync(path.resolve(sourcePath), { readOnly: true });
try {
  await backup(source, destinationPath);
  console.log(`[sqlite-backup] consistent backup written to ${destinationPath}`);
} finally {
  source.close();
}
