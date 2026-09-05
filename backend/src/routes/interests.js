import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { oneOf, HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
const router = Router();
const getProperty = db.prepare('SELECT * FROM properties WHERE id = ?');
const existing = db.prepare(
    'SELECT * FROM interests WHERE property_id = ? AND buyer_id = ?'
);
const insertInterest = db.prepare(
    'INSERT INTO interests (property_id, buyer_id, message) VALUES (?, ?, ?)'
);
// POST /api/interests — buyer expresses interest in a property
router.post('/', authenticate, requireRole('buyer'), (req, res) => {
    const { property_id, message } = req.body;
    const prop = getProperty.get(property_id);
    if (!prop || prop.status !== 'approved')
        throw new HttpError(404, 'Property not available');
    if (existing.get(property_id, req.user.id))
        throw new HttpError(409, 'You have already expressed interest in this property');
    const info = insertInterest.run(property_id, req.user.id, message || null);
    audit({
        actorId: req.user.id,
        action: 'interest.create',
        entity: 'property',
        entityId: property_id,
        ip: req.ip,
    });
    res.status(201).json({
        data: db.prepare('SELECT * FROM interests WHERE id = ?').get(info.lastInsertRowid),
    });
});
// GET /api/interests/mine — buyer's tracked interests (dashboard)
router.get('/mine', authenticate, requireRole('buyer'), (req, res) => {
    const rows = db
        .prepare(
            `SELECT i.*, p.title, p.price, p.city, p.status AS property_status,
              p.property_type, p.listing_type, u.name AS seller_name
       FROM interests i
       JOIN properties p ON p.id = i.property_id
       JOIN users u ON u.id = p.seller_id
       WHERE i.buyer_id = ?
       ORDER BY i.created_at DESC`
        )
        .all(req.user.id);
    res.json({ data: rows });
});
// GET /api/interests/received — seller sees leads on their properties
router.get('/received', authenticate, requireRole('seller'), (req, res) => {
    const rows = db
        .prepare(
            `SELECT i.*, p.title, p.city, p.price,
              b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
              b.kyc_status AS buyer_kyc
       FROM interests i
       JOIN properties p ON p.id = i.property_id
       JOIN users b ON b.id = i.buyer_id
       WHERE p.seller_id = ?
       ORDER BY i.created_at DESC`
        )
        .all(req.user.id);
    res.json({ data: rows });
});
// PATCH /api/interests/:id/status — seller updates lead status
router.patch('/:id/status', authenticate, requireRole('seller', 'buyer'), (req, res) => {
    const { status } = req.body;
    oneOf(status, ['new', 'contacted', 'negotiating', 'closed', 'withdrawn'], 'status');
    const row = db
        .prepare(
            `SELECT i.*, p.seller_id FROM interests i
       JOIN properties p ON p.id = i.property_id WHERE i.id = ?`
        )
        .get(req.params.id);
    if (!row) throw new HttpError(404, 'Interest not found');
    // Seller can manage leads on own listings; buyer can withdraw own interest.
    const isSeller = req.user.role === 'seller' && row.seller_id === req.user.id;
    const isBuyer = req.user.role === 'buyer' && row.buyer_id === req.user.id;
    if (!isSeller && !isBuyer) throw new HttpError(403, 'Not allowed');
    if (isBuyer && status !== 'withdrawn')
        throw new HttpError(403, 'Buyers can only withdraw their interest');
    db.prepare('UPDATE interests SET status = ? WHERE id = ?').run(status, row.id);
    audit({
        actorId: req.user.id,
        action: 'interest.status',
        entity: 'interest',
        entityId: row.id,
        meta: { status },
        ip: req.ip,
    });
    res.json({ data: db.prepare('SELECT * FROM interests WHERE id = ?').get(row.id) });
});
export default router;
