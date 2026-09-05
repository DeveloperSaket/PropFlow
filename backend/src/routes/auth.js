import { Router } from 'express';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
} from '../utils/auth.js';
import { required, isEmail, oneOf, HttpError } from '../utils/validate.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
const router = Router();
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(
  `INSERT INTO users (role, name, email, password_hash, phone, terms_accepted_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const getById = db.prepare('SELECT * FROM users WHERE id = ?');
// POST /api/auth/register
router.post('/register', (req, res) => {
  const { role, name, email, password, phone, acceptTerms } = req.body;
  required(req.body, ['role', 'name', 'email', 'password']);
  oneOf(role, ['buyer', 'seller'], 'role'); // admins are not self-registered
  if (!isEmail(email)) throw new HttpError(400, 'Invalid email address');
  if (String(password).length < 8)
    throw new HttpError(400, 'Password must be at least 8 characters');
  if (!acceptTerms)
    throw new HttpError(400, 'You must accept the Terms & Compliance policy');
  if (findByEmail.get(email.toLowerCase()))
    throw new HttpError(409, 'An account with this email already exists');
  const info = insertUser.run(
    role,
    name,
    email.toLowerCase(),
    hashPassword(password),
    phone || null,
    new Date().toISOString()
  );
  const user = getById.get(info.lastInsertRowid);
  audit({
    actorId: user.id,
    action: 'user.register',
    entity: 'user',
    entityId: user.id,
    meta: { role },
    ip: req.ip,
  });
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});
// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  required(req.body, ['email', 'password']);
  const user = findByEmail.get(String(email).toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.active) throw new HttpError(403, 'Account is deactivated');
  audit({
    actorId: user.id,
    action: 'user.login',
    entity: 'user',
    entityId: user.id,
    ip: req.ip,
  });
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});
// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = getById.get(req.user.id);
  res.json({ user: publicUser(user) });
});
export default router;
