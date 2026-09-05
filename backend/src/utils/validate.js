// Tiny validation helpers (no external deps).
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export function required(body, fields) {
  const missing = fields.filter(
    (f) => body[f] === undefined || body[f] === null || body[f] === ''
  );
  if (missing.length) {
    throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}
export function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
export function oneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new HttpError(
      400,
      `Invalid ${fieldName}: "${value}". Allowed: ${allowed.join(', ')}`
    );
  }
}
export function toNumber(v, fallback = undefined) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}
