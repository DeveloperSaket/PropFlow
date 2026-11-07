import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initSchema } from './db.js';
import { ensureAdmin } from './bootstrap.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import interestRoutes from './routes/interests.js';
import appointmentRoutes from './routes/appointments.js';
import complianceRoutes from './routes/compliance.js';
import adminRoutes from './routes/admin.js';
initSchema();
ensureAdmin();
<<<<<<< Updated upstream
=======
const [
  { default: authRoutes },
  { default: propertyRoutes },
  { default: interestRoutes },
  { default: appointmentRoutes },
  { default: complianceRoutes },
  { default: adminRoutes },
  { default: staffRoutes },
] = await Promise.all([
  import('./routes/auth.js'),
  import('./routes/properties.js'),
  import('./routes/interests.js'),
  import('./routes/appointments.js'),
  import('./routes/compliance.js'),
  import('./routes/admin.js'),
  import('./routes/staff.js'),
]);
>>>>>>> Stashed changes
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
app.use('/api/staff', staffRoutes);
app.use(notFound);
app.use(errorHandler);
app.listen(config.port, () => {
  console.log(`[propflow] API listening on http://localhost:${config.port}`);
});
