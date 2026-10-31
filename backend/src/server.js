import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initSchema } from './db.js';
import { ensureAdmin } from './bootstrap.js';
import { notFound, errorHandler } from './middleware/error.js';
initSchema();
ensureAdmin();
const [
  { default: authRoutes },
  { default: propertyRoutes },
  { default: interestRoutes },
  { default: appointmentRoutes },
  { default: complianceRoutes },
  { default: adminRoutes },
] = await Promise.all([
  import('./routes/auth.js'),
  import('./routes/properties.js'),
  import('./routes/interests.js'),
  import('./routes/appointments.js'),
  import('./routes/compliance.js'),
  import('./routes/admin.js'),
]);
const app = express();
app.set('trust proxy', true);
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads/properties', express.static(config.propertyUploadDir));
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);
app.listen(config.port, () => {
  console.log(`[propflow] API listening on http://localhost:${config.port}`);
});
