import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { oneOf, HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
import { publicUser } from '../utils/auth.js';
const router = Router();
// All admin routes require an authenticated admin
router.use(authenticate, requireRole('admin'));
// GET /api/admin/stats — headline numbers for the owner dashboard
router.get('/stats', (req, res) => {
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
      buyers: usersByRole.buyer || 0,
      sellers: usersByRole.seller || 0,
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
router.get('/users', (req, res) => {
  const { role, kyc } = req.query;
  const where = [];
  const params = {};
  if (role) {
    oneOf(role, ['buyer', 'seller', 'admin'], 'role');
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
  res.json({ data: rows.map(publicUser) });
});
// PATCH /api/admin/users/:id/kyc — approve/reject KYC
router.patch('/users/:id/kyc', (req, res) => {
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
  res.json({ data: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});
// PATCH /api/admin/users/:id/active — activate/deactivate account
router.patch('/users/:id/active', (req, res) => {
  const { active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role === 'admin') throw new HttpError(400, 'Cannot deactivate an admin');
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, user.id);
  audit({
    actorId: req.user.id,
    action: 'admin.user_active',
    entity: 'user',
    entityId: user.id,
    meta: { active: !!active },
    ip: req.ip,
  });
  res.json({ data: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});
// GET /api/admin/listings/pending — compliance review queue
router.get('/listings/pending', (req, res) => {
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
router.patch('/listings/:id/review', (req, res) => {
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
router.patch('/listings/:id/feature', (req, res) => {
  const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!prop) throw new HttpError(404, 'Property not found');
  const featured = prop.featured ? 0 : 1;
  db.prepare('UPDATE properties SET featured = ? WHERE id = ?').run(featured, prop.id);
  audit({ actorId: req.user.id, action: 'admin.listing_feature', entity: 'property', entityId: prop.id, meta: { featured: !!featured }, ip: req.ip });
  res.json({ data: db.prepare('SELECT * FROM properties WHERE id = ?').get(prop.id) });
});
// GET /api/admin/audit — compliance audit trail (paginated)
router.get('/audit', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS actor_name, u.role AS actor_role
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
router.get('/appointments', (req, res) => {
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
export default router;
