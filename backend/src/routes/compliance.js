import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { required, HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
const router = Router();
const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `kyc_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const ALLOWED = ['.pdf', '.png', '.jpg', '.jpeg'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED.includes(ext));
  },
});
// POST /api/compliance/kyc — upload a KYC document (buyer/seller)
router.post('/kyc', authenticate, upload.single('document'), (req, res) => {
  required(req.body, ['doc_type']);
  if (!req.file)
    throw new HttpError(400, 'A document file (pdf/png/jpg, <=5MB) is required');
  const info = db
    .prepare(
      'INSERT INTO compliance_docs (user_id, doc_type, file_path) VALUES (?, ?, ?)'
    )
    .run(req.user.id, req.body.doc_type, path.basename(req.file.path));
  // Move the user into "pending" review state
  db.prepare("UPDATE users SET kyc_status='pending' WHERE id=?").run(req.user.id);
  audit({
    actorId: req.user.id,
    action: 'kyc.submit',
    entity: 'compliance_doc',
    entityId: info.lastInsertRowid,
    meta: { doc_type: req.body.doc_type },
    ip: req.ip,
  });
  res.status(201).json({
    data: db.prepare('SELECT * FROM compliance_docs WHERE id = ?').get(info.lastInsertRowid),
    kyc_status: 'pending',
  });
});
// GET /api/compliance/kyc/mine — my submitted documents + status
router.get('/kyc/mine', authenticate, (req, res) => {
  const docs = db
    .prepare('SELECT * FROM compliance_docs WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  const user = db.prepare('SELECT kyc_status FROM users WHERE id = ?').get(req.user.id);
  res.json({ data: docs, kyc_status: user.kyc_status });
});
export default router;