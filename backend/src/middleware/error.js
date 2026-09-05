import multer from 'multer';
import { HttpError } from '../utils/validate.js';
export function notFound(_req, res) {
  res.status(404).json({ error: 'Route not found' });
}
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  // Malformed JSON body (body-parser) and similar client errors
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  if (err && err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message || 'Bad request' });
  }
  // SQLite constraint errors -> 409
  if (err && typeof err.message === 'string' && err.message.includes('UNIQUE constraint')) {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
