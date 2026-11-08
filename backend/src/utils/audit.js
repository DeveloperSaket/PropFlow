import { db } from '../db.js';
/**
 * Record a compliance / activity audit entry.
 * Never throws - auditing should not break the main flow.
 */
export async function audit({ actorId = null, action, entity = null, entityId = null, meta = null, ip = null }) {
  try {
    await db.prepare(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta, ip)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      actorId,
      action,
      entity,
      entityId,
      meta ? JSON.stringify(meta) : null,
      ip
    );
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}
