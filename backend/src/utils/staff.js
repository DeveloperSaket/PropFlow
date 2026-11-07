import { db } from '../db.js';
import { publicUser } from './auth.js';

export function getStaffAccess(userId) {
  const rows = db.prepare(`
    SELECT r.role_key, p.permission_key
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ?
    ORDER BY r.role_key, p.permission_key
  `).all(userId);
  return {
    staff_roles: [...new Set(rows.map((row) => row.role_key))],
    permissions: [...new Set(rows.map((row) => row.permission_key).filter(Boolean))],
    staff_profile: db.prepare('SELECT * FROM staff_profiles WHERE user_id = ?').get(userId) || null,
  };
}

export function userWithStaffAccess(user) {
  if (!user) return null;
  return publicUser({ ...user, ...getStaffAccess(user.id) });
}

export function ensureStaffRole(userId, roleKey, grantedBy = null) {
  const role = db.prepare('SELECT id FROM roles WHERE role_key = ?').get(roleKey);
  if (!role) throw new Error(`Unknown staff role: ${roleKey}`);
  db.prepare('INSERT OR IGNORE INTO staff_profiles (user_id) VALUES (?)').run(userId);
  db.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_by)
    VALUES (?, ?, ?)
  `).run(userId, role.id, grantedBy);
}
