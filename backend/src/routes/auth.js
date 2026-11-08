import { Router } from 'express';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
} from '../utils/auth.js';
import { required, isEmail, HttpError } from '../utils/validate.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { createFirebaseCustomToken } from '../utils/firebase.js';
import { userWithStaffAccess } from '../utils/staff.js';
const router = Router();
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(
  `INSERT INTO users (role, name, email, password_hash, phone, terms_accepted_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const getById = db.prepare('SELECT * FROM users WHERE id = ?');
// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, phone, acceptTerms } = req.body;
  const role = 'member';
  required(req.body, ['name', 'email', 'password']);
  if (!isEmail(email)) throw new HttpError(400, 'Invalid email address');
  if (String(password).length < 8)
    throw new HttpError(400, 'Password must be at least 8 characters');
  if (!acceptTerms)
    throw new HttpError(400, 'You must accept the Terms & Compliance policy');
  if (await findByEmail.get(email.toLowerCase()))
    throw new HttpError(409, 'An account with this email already exists');
  const info = await insertUser.run(
    role,
    name,
    email.toLowerCase(),
    hashPassword(password),
    phone || null,
    new Date().toISOString()
  );
  const user = await getById.get(info.lastInsertRowid);
  await audit({
    actorId: user.id,
    action: 'user.register',
    entity: 'user',
    entityId: user.id,
    meta: { role },
    ip: req.ip,
  });
  const token = signToken(user);
  res.status(201).json({ token, user: await userWithStaffAccess(user) });
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  required(req.body, ['email', 'password']);
  const user = await findByEmail.get(String(email).toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.active) throw new HttpError(403, 'Account is deactivated');
  await audit({
    actorId: user.id,
    action: 'user.login',
    entity: 'user',
    entityId: user.id,
    ip: req.ip,
  });
  const token = signToken(user);
  res.json({ token, user: await userWithStaffAccess(user) });
});
// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await getById.get(req.user.id);
  res.json({ user: await userWithStaffAccess(user) });
});
// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw new HttpError(400, 'Current password and new password are required');
  }
  if (newPassword.length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters');
  }

  const user = await getById.get(req.user.id);
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  if (verifyPassword(newPassword, user.password_hash)) {
    throw new HttpError(400, 'New password must be different from the current password');
  }

  await db.prepare(`
    UPDATE users
    SET password_hash = ?, token_version = token_version + 1
    WHERE id = ?
  `).run(hashPassword(newPassword), user.id);
  const updatedUser = await getById.get(user.id);
  await audit({
    actorId: user.id,
    action: 'user.password_changed',
    entity: 'user',
    entityId: user.id,
    ip: req.ip,
  });
  res.json({
    token: signToken(updatedUser),
    user: await userWithStaffAccess(updatedUser),
  });
});
// GET /api/auth/firebase-token — exchange the app JWT identity for Firebase Auth
router.get('/firebase-token', authenticate, async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const customToken = await createFirebaseCustomToken(uid);
    res.json({ customToken, uid });
  } catch (error) {
    console.error('[propflow] Firebase custom token creation failed:', error.message);
    next(new HttpError(503, 'Firebase authentication is not configured on the server'));
  }
});
export default router;
