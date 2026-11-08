import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';

const router = Router();
const STAFF_EMAIL_DOMAIN = '@negobrick.com';
router.use(authenticate);

function hasEligibleEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith(STAFF_EMAIL_DOMAIN);
}

router.get('/roles', async (req, res) => {
  const eligible = hasEligibleEmail(req.user.email);
  const roles = eligible
    ? await db.prepare(`
      SELECT r.role_key, r.name, r.description
      FROM roles r
      WHERE r.role_key <> 'owner'
      ORDER BY r.name
    `).all()
    : [];
  const assigned = await db.prepare(`
    SELECT r.role_key
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ?
  `).all(req.user.id).then((rows) => rows.map((row) => row.role_key));
  const requests = await db.prepare(`
    SELECT sr.id, r.role_key, r.name AS role_name, sr.justification,
      sr.status, sr.review_note, sr.created_at, sr.reviewed_at
    FROM staff_role_requests sr
    JOIN roles r ON r.id = sr.role_id
    WHERE sr.user_id = ?
    ORDER BY sr.created_at DESC, sr.id DESC
  `).all(req.user.id);
  res.json({ eligible, data: { roles, assigned, requests } });
});

router.post('/role-requests', async (req, res) => {
  if (!hasEligibleEmail(req.user.email)) {
    throw new HttpError(403, `A ${STAFF_EMAIL_DOMAIN} email address is required to request a staff role`);
  }
  const body = req.body || {};
  const roleKey = typeof body.role_key === 'string' ? body.role_key.trim() : '';
  const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
  if (justification.length < 30 || justification.length > 2000) {
    throw new HttpError(400, 'Justification must be between 30 and 2000 characters');
  }
  const role = await db.prepare(`
    SELECT id, role_key FROM roles WHERE role_key = ? AND role_key <> 'owner'
  `).get(roleKey);
  if (!role) throw new HttpError(400, 'Select an available staff role');
  if (await db.prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?').get(req.user.id, role.id)) {
    throw new HttpError(409, 'You already have this staff role');
  }
  if (await db.prepare(`
    SELECT 1 FROM staff_role_requests WHERE user_id = ? AND role_id = ? AND status = 'pending'
  `).get(req.user.id, role.id)) {
    throw new HttpError(409, 'A request for this role is already pending');
  }

  const result = await db.prepare(`
    INSERT INTO staff_role_requests (user_id, role_id, justification)
    VALUES (?, ?, ?)
  `).run(req.user.id, role.id, justification);
  await audit({
    actorId: req.user.id,
    action: 'staff.role_request_created',
    entity: 'staff_role_request',
    entityId: result.lastInsertRowid,
    meta: { role_key: role.role_key },
    ip: req.ip,
  });
  res.status(201).json({
    data: {
      id: result.lastInsertRowid,
      role_key: role.role_key,
      status: 'pending',
    },
  });
});

export default router;
