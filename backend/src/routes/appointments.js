import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { required, oneOf, HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
const router = Router();
const getProperty = db.prepare('SELECT * FROM properties WHERE id = ?');
const insertAppt = db.prepare(
  `INSERT INTO appointments (property_id, buyer_id, seller_id, scheduled_at, notes)
   VALUES (?, ?, ?, ?, ?)`
);
// POST /api/appointments — buyer requests a property viewing
router.post('/', authenticate, requireRole('buyer'), (req, res) => {
  const { property_id, scheduled_at, notes } = req.body;
  required(req.body, ['property_id', 'scheduled_at']);
  const prop = getProperty.get(property_id);
  if (!prop || prop.status !== 'approved')
    throw new HttpError(404, 'Property not available');
  const when = new Date(scheduled_at);
  if (Number.isNaN(when.getTime())) throw new HttpError(400, 'Invalid date/time');
  if (when.getTime() < Date.now())
    throw new HttpError(400, 'Appointment must be in the future');
  const info = insertAppt.run(
    property_id,
    req.user.id,
    prop.seller_id,
    when.toISOString(),
    notes || null
  );
  audit({
    actorId: req.user.id,
    action: 'appointment.request',
    entity: 'property',
    entityId: property_id,
    ip: req.ip,
  });
  res.status(201).json({
    data: db.prepare('SELECT * FROM appointments WHERE id = ?').get(info.lastInsertRowid),
  });
});
// GET /api/appointments/mine — role-aware list for dashboards
router.get('/mine', authenticate, (req, res) => {
  let rows;
  if (req.user.role === 'buyer') {
    rows = db
      .prepare(
        `SELECT a.*, p.title, p.city, u.name AS seller_name, u.phone AS seller_phone
         FROM appointments a
         JOIN properties p ON p.id = a.property_id
         JOIN users u ON u.id = a.seller_id
         WHERE a.buyer_id = ? ORDER BY a.scheduled_at DESC`
      )
      .all(req.user.id);
  } else if (req.user.role === 'seller') {
    rows = db
      .prepare(
        `SELECT a.*, p.title, p.city, u.name AS buyer_name, u.phone AS buyer_phone
         FROM appointments a
         JOIN properties p ON p.id = a.property_id
         JOIN users u ON u.id = a.buyer_id
         WHERE a.seller_id = ? ORDER BY a.scheduled_at DESC`
      )
      .all(req.user.id);
  } else {
    rows = db
      .prepare(
        `SELECT a.*, p.title, bu.name AS buyer_name, su.name AS seller_name
         FROM appointments a
         JOIN properties p ON p.id = a.property_id
         JOIN users bu ON bu.id = a.buyer_id
         JOIN users su ON su.id = a.seller_id
         ORDER BY a.scheduled_at DESC`
      )
      .all();
  }
  res.json({ data: rows });
});
// PATCH /api/appointments/:id/status
router.patch('/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  oneOf(status, ['requested', 'confirmed', 'completed', 'cancelled'], 'status');
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!appt) throw new HttpError(404, 'Appointment not found');
  const isParticipant =
    appt.buyer_id === req.user.id || appt.seller_id === req.user.id;
  if (!isParticipant && req.user.role !== 'admin')
    throw new HttpError(403, 'Not allowed');
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, appt.id);
  audit({
    actorId: req.user.id,
    action: 'appointment.status',
    entity: 'appointment',
    entityId: appt.id,
    meta: { status },
    ip: req.ip,
  });
  res.json({ data: db.prepare('SELECT * FROM appointments WHERE id = ?').get(appt.id) });
});
export default router;