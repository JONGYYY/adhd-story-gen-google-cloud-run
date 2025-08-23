import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Debug: Log all environment variables that start with NEXT_PUBLIC_
const allEnvVars = Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_'));
console.log('Available NEXT_PUBLIC_ environment variables:', allEnvVars);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Debug: Log Firebase config (without sensitive values)
console.log('Firebase config check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId
});

// Validate Firebase configuration
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0) {
  console.error('Missing Firebase configuration keys:', missingKeys);
  if (typeof window !== 'undefined') {
    console.error('Firebase configuration is incomplete. Please check your environment variables.');
  }
}

// Initialize Firebase (robust to incognito/private mode)
let app: FirebaseApp | undefined;
let auth: Auth | null = null;
let db: Firestore | null = null;

console.log('Attempting to initialize Firebase...');
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
} catch (e) {
  console.error('initializeApp failed:', e);
}

try {
  if (app) {
    auth = getAuth(app);
  }
} catch (e) {
  console.error('getAuth failed:', e);
}

try {
  if (app) {
    db = getFirestore(app);
  }
} catch (e) {
  console.error('getFirestore failed:', e);
}

// Optional features (never block auth)
if (typeof window !== 'undefined' && db) {
  try {
    enableIndexedDbPersistence(db).catch((err: any) => {
      if (err?.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err?.code === 'unimplemented') {
        console.warn('Persistence not supported in this browser.');
      } else {
        console.warn('Offline persistence disabled:', err?.message || err);
      }
    });
  } catch (e) {
    console.warn('Skipping persistence setup:', e);
  }
}

if (typeof window !== 'undefined' && app) {
  try {
    isSupported()
      .then((yes) => {
        if (yes) {
          try { getAnalytics(app!); } catch {}
        }
      })
      .catch(() => {});
  } catch {}
}

export type { Auth };
export { auth, db }; 