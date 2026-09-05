import { verifyToken } from '../utils/auth.js';
import { db } from '../db.js';
import { HttpError } from '../utils/validate.js';
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
/** Require a valid JWT. Attaches req.user (fresh from DB). */
export function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = verifyToken(token);
    const user = getUser.get(payload.id);
    if (!user) throw new HttpError(401, 'User no longer exists');
    if (!user.active) throw new HttpError(403, 'Account is deactivated');
    const { password_hash, ...safe } = user;
    req.user = safe;
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    next(new HttpError(401, 'Invalid or expired token'));
  }
}
/** Optional auth: attaches req.user if a valid token is present, else continues. */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = getUser.get(payload.id);
    if (user && user.active) {
      const { password_hash, ...safe } = user;
      req.user = safe;
    }
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
}
/** Restrict a route to one or more roles. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}
/** Compliance gate: action requires a verified KYC status. */
export function requireKyc(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (req.user.role === 'admin') return next();
  if (req.user.kyc_status !== 'verified') {
    return next(
      new HttpError(403, 'KYC verification required before performing this action', {
        kyc_status: req.user.kyc_status,
      })
    );
  }
  next();
}
