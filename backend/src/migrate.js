import { closeDatabase, initSchema } from './db.js';

try {
  await initSchema();
  console.log('[database] PostgreSQL schema is up to date');
} finally {
  await closeDatabase();
}
