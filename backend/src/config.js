import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const config = {
  port: Number(process.env.PORT || 5112),
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || '',
  databasePoolSize: Number(process.env.DATABASE_POOL_SIZE || 10),
  databaseSsl: process.env.DATABASE_SSL === 'true',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '',
  uploadDir: path.join(__dirname, '..', 'uploads'),
  propertyUploadDir: path.join(__dirname, '..', 'uploads', 'properties'),
  kycUploadDir: path.join(__dirname, '..', 'uploads', 'kyc'),
  admin: {
    email: process.env.ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'admin@propflow.test'),
    password: process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'Admin@12345'),
  },
};
