import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { oneOf, HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
import { userWithStaffAccess } from '../utils/staff.js';
const router = Router();
router.use(authenticate);
// GET /api/admin/stats — headline numbers for the owner dashboard
router.get('/stats', requirePermission('dashboard.read'), (req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p).c;
  const usersByRole = db
    .prepare('SELECT role, COUNT(*) AS c FROM users GROUP BY role')
    .all()
    .reduce((acc, r) => ((acc[r.role] = r.c), acc), {});
  const propsByStatus = db
    .prepare('SELECT status, COUNT(*) AS c FROM properties GROUP BY status')
    .all()
    .reduce((acc, r) => ((acc[r.status] = r.c), acc), {});
  const revenuePotential = db
    .prepare("SELECT COALESCE(SUM(price),0) AS c FROM properties WHERE status='approved'")
    .get().c;
  res.json({
    users: {
      total: one('SELECT COUNT(*) AS c FROM users'),
      members: usersByRole.member || 0,
      agents: one('SELECT COUNT(*) AS c FROM users WHERE is_agent = 1'),
      admins: usersByRole.admin || 0,
      pending_kyc: one("SELECT COUNT(*) AS c FROM users WHERE kyc_status='pending'"),
    },
    properties: {
      total: one('SELECT COUNT(*) AS c FROM properties'),
      pending: propsByStatus.pending || 0,
      approved: propsByStatus.approved || 0,
      rejected: propsByStatus.rejected || 0,
      sold: propsByStatus.sold || 0,
      listed_value: revenuePotential,
    },
    engagement: {
      interests: one('SELECT COUNT(*) AS c FROM interests'),
      appointments: one('SELECT COUNT(*) AS c FROM appointments'),
      appointments_pending: one("SELECT COUNT(*) AS c FROM appointments WHERE status='requested'"),
    },
  });
});
// GET /api/admin/users — list/manage users
router.get('/users', requirePermission('users.read'), (req, res) => {
  const { role, kyc } = req.query;
  const where = [];
  const params = {};
  if (role) {
    oneOf(role, ['member', 'admin'], 'role');
    where.push('role = @role');
    params.role = role;
  }
  if (kyc) {
    oneOf(kyc, ['unverified', 'pending', 'verified', 'rejected'], 'kyc');
    where.push('kyc_status = @kyc');
    params.kyc = kyc;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM users ${whereSql} ORDER BY created_at DESC`).all(params);
  res.json({ data: rows.map(userWithStaffAccess) });
});
// PATCH /api/admin/users/:id/kyc — approve/reject KYC
router.patch('/users/:id/kyc', requirePermission('kyc.review'), (req, res) => {
  const { status, note } = req.body;
  oneOf(status, ['verified', 'rejected', 'pending', 'unverified'], 'status');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  db.prepare('UPDATE users SET kyc_status = ? WHERE id = ?').run(status, user.id);
  // reflect on latest doc if present
  db.prepare(
    `UPDATE compliance_docs SET status = ?, reviewed_by = ?, note = ?
     WHERE id = (SELECT id FROM compliance_docs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)`
  ).run(status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending', req.user.id, note || null, user.id);
  audit({
    actorId: req.user.id,
    action: 'admin.kyc_review',
    entity: 'user',
    entityId: user.id,
    meta: { status, note },
    ip: req.ip,
  });
  res.json({ data: userWithStaffAccess(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});
// PATCH /api/admin/users/:id/active — activate/deactivate account
router.patch('/users/:id/active', requirePermission('users.manage'), (req, res) => {
  const { active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (typeof active !== 'boolean') throw new HttpError(400, 'active must be a boolean');
  if (user.role === 'admin') throw new HttpError(400, 'Cannot deactivate an admin');
  if (!active && db.prepare(`
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.role_key = 'owner'
  `).get(user.id)) throw new HttpError(400, 'Remove the owner role before deactivating this account');
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, user.id);
  audit({
    actorId: req.user.id,
    action: 'admin.user_active',
    entity: 'user',
    entityId: user.id,
    meta: { active: !!active },
    ip: req.ip,
  });
  res.json({ data: userWithStaffAccess(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});
// PATCH /api/admin/users/:id/agent — flag an identified agent account
router.patch('/users/:id/agent', requirePermission('users.agent'), (req, res) => {
  const { is_agent } = req.body;
  if (typeof is_agent !== 'boolean') throw new HttpError(400, 'is_agent must be a boolean');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role === 'admin') throw new HttpError(400, 'Admin accounts cannot be flagged as agents');
  db.prepare('UPDATE users SET is_agent = ? WHERE id = ?').run(is_agent ? 1 : 0, user.id);
  audit({
    actorId: req.user.id,
    action: 'admin.user_agent_flag',
    entity: 'user',
    entityId: user.id,
    meta: { is_agent },
    ip: req.ip,
  });
  res.json({ data: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});
// GET /api/admin/listings/pending — compliance review queue
router.get('/listings/pending', requirePermission('listings.read'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email, u.kyc_status AS seller_kyc
       FROM properties p JOIN users u ON u.id = p.seller_id
       WHERE p.status = 'pending' ORDER BY p.created_at ASC`
    )
    .all();
  res.json({ data: rows });
});
// PATCH /api/admin/listings/:id/review — approve or reject a listing
router.patch('/listings/:id/review', requirePermission('listings.review'), (req, res) => {
  const { decision, reason } = req.body;
  oneOf(decision, ['approve', 'reject'], 'decision');
  const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!prop) throw new HttpError(404, 'Property not found');
  if (decision === 'approve') {
    db.prepare("UPDATE properties SET status='approved', rejection_reason=NULL, updated_at=datetime('now') WHERE id=?").run(prop.id);
  } else {
    if (!reason) throw new HttpError(400, 'A rejection reason is required');
    db.prepare("UPDATE properties SET status='rejected', rejection_reason=?, updated_at=datetime('now') WHERE id=?").run(reason, prop.id);
  }
  audit({
    actorId: req.user.id,
    action: `admin.listing_${decision}`,
    entity: 'property',
    entityId: prop.id,
    meta: { reason: reason || null },
    ip: req.ip,
  });
  res.json({ data: db.prepare('SELECT * FROM properties WHERE id = ?').get(prop.id) });
});
// PATCH /api/admin/listings/:id/feature — toggle featured flag
router.patch('/listings/:id/feature', requirePermission('listings.feature'), (req, res) => {
  const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!prop) throw new HttpError(404, 'Property not found');
  const featured = prop.featured ? 0 : 1;
  db.prepare('UPDATE properties SET featured = ? WHERE id = ?').run(featured, prop.id);
  audit({ actorId: req.user.id, action: 'admin.listing_feature', entity: 'property', entityId: prop.id, meta: { featured: !!featured }, ip: req.ip });
  res.json({ data: db.prepare('SELECT * FROM properties WHERE id = ?').get(prop.id) });
});
// GET /api/admin/audit — compliance audit trail (paginated)
router.get('/audit', requirePermission('audit.read'), (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS actor_name, u.role AS actor_role,
         (SELECT GROUP_CONCAT(r.name, ', ')
          FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id) AS actor_staff_roles
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, (page - 1) * limit);
  res.json({
    data: rows.map((r) => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
// GET /api/admin/appointments — all appointments overview
router.get('/appointments', requirePermission('appointments.read'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, p.title, bu.name AS buyer_name, su.name AS seller_name
       FROM appointments a
       JOIN properties p ON p.id = a.property_id
       JOIN users bu ON bu.id = a.buyer_id
       JOIN users su ON su.id = a.seller_id
       ORDER BY a.scheduled_at DESC`
    )
    .all();
  res.json({ data: rows });
});

router.get('/staff/roles', requirePermission('staff.manage'), (_req, res) => {
  const rows = db.prepare(`
    SELECT r.role_key, r.name, r.description,
      COALESCE(GROUP_CONCAT(p.permission_key), '') AS permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    GROUP BY r.id
    ORDER BY r.role_key
  `).all();
  res.json({
    data: rows.map((row) => ({
      role_key: row.role_key,
      name: row.name,
      description: row.description,
      permissions: row.permissions ? row.permissions.split(',') : [],
    })),
  });
});

router.patch('/users/:id/staff-roles', requirePermission('staff.manage'), (req, res) => {
  const { role_key: roleKey, assigned } = req.body || {};
  if (typeof assigned !== 'boolean') throw new HttpError(400, 'assigned must be a boolean');
  if (typeof roleKey !== 'string' || !roleKey.trim()) throw new HttpError(400, 'role_key is required');
  const normalizedRoleKey = roleKey.trim();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  const role = db.prepare('SELECT id FROM roles WHERE role_key = ?').get(normalizedRoleKey);
  if (!role) throw new HttpError(400, 'Unknown staff role');

  db.exec('BEGIN IMMEDIATE');
  try {
    if (assigned) {
      if (!user.active) throw new HttpError(409, 'Cannot assign a staff role to an inactive account');
      db.prepare('INSERT OR IGNORE INTO staff_profiles (user_id) VALUES (?)').run(user.id);
      db.prepare(`
        INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_by)
        VALUES (?, ?, ?)
      `).run(user.id, role.id, req.user.id);
    } else {
      if (normalizedRoleKey === 'owner') {
        const activeOwners = db.prepare(`
          SELECT COUNT(*) AS count
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          JOIN users u ON u.id = ur.user_id
          WHERE r.role_key = 'owner' AND u.active = 1
        `).get().count;
        if (activeOwners <= 1) throw new HttpError(409, 'At least one active owner must remain');
      }
      db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(user.id, role.id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  audit({
    actorId: req.user.id,
    action: assigned ? 'staff.role_assigned' : 'staff.role_revoked',
    entity: 'user',
    entityId: user.id,
    meta: { role_key: normalizedRoleKey },
    ip: req.ip,
  });
  res.json({ data: userWithStaffAccess(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

router.get('/staff/role-requests', requirePermission('staff.requests.review'), (_req, res) => {
  const rows = db.prepare(`
    SELECT sr.*, u.name AS requester_name, u.email AS requester_email,
      r.role_key, r.name AS role_name
    FROM staff_role_requests sr
    JOIN users u ON u.id = sr.user_id
    JOIN roles r ON r.id = sr.role_id
    WHERE sr.status = 'pending'
    ORDER BY sr.created_at ASC, sr.id ASC
  `).all();
  res.json({ data: rows });
});

router.patch('/staff/role-requests/:id', requirePermission('staff.requests.review'), (req, res) => {
  const { decision, review_note: reviewNote } = req.body || {};
  oneOf(decision, ['approve', 'reject'], 'decision');
  if (reviewNote !== undefined && (typeof reviewNote !== 'string' || reviewNote.length > 2000)) {
    throw new HttpError(400, 'review_note must be a string of at most 2000 characters');
  }
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId < 1) throw new HttpError(400, 'Invalid request id');

  let request;
  db.exec('BEGIN IMMEDIATE');
  try {
    request = db.prepare(`
      SELECT sr.*, r.role_key
      FROM staff_role_requests sr
      JOIN roles r ON r.id = sr.role_id
      WHERE sr.id = ? AND sr.status = 'pending'
    `).get(requestId);
    if (!request) throw new HttpError(404, 'Pending role request not found');
    if (decision === 'approve') {
      const requester = db.prepare('SELECT active FROM users WHERE id = ?').get(request.user_id);
      if (!requester?.active) throw new HttpError(409, 'Cannot approve a request for an inactive account');
      db.prepare('INSERT OR IGNORE INTO staff_profiles (user_id) VALUES (?)').run(request.user_id);
      db.prepare(`
        INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_by)
        VALUES (?, ?, ?)
      `).run(request.user_id, request.role_id, req.user.id);
    }
    db.prepare(`
      UPDATE staff_role_requests
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
      WHERE id = ? AND status = 'pending'
    `).run(decision === 'approve' ? 'approved' : 'rejected', req.user.id, reviewNote?.trim() || null, requestId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  audit({
    actorId: req.user.id,
    action: `staff.role_request_${decision}`,
    entity: 'staff_role_request',
    entityId: requestId,
    meta: { user_id: request.user_id, role_key: request.role_key },
    ip: req.ip,
  });
  res.json({ data: { id: requestId, status: decision === 'approve' ? 'approved' : 'rejected' } });
});

export default router;
