import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(config).every((value) => Boolean(value?.trim()));
let auth = null;
let db = null;
let firebaseError = hasFirebaseConfig
  ? ''
  : 'Chat is unavailable because Firebase is not configured for this deployment.';

if (hasFirebaseConfig) {
  try {
    const app = getApps().length ? getApp() : initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    firebaseError = `Chat is unavailable because Firebase could not initialize: ${error.message}`;
  }
}

export { auth, db, firebaseError };
