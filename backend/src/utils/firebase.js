import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from '../config.js';

const appName = 'propflow-admin';

function getFirebaseAdminApp() {
  if (!config.firebaseProjectId) {
    throw new Error('FIREBASE_PROJECT_ID is not configured.');
  }

  const existingApp = getApps().find((app) => app.name === appName);
  return existingApp || initializeApp({
    credential: applicationDefault(),
    projectId: config.firebaseProjectId,
  }, appName);
}

export function createFirebaseCustomToken(uid) {
  return getAuth(getFirebaseAdminApp()).createCustomToken(String(uid));
}