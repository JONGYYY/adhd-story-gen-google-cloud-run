import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  Auth,
} from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Attempt to read from injected env; if missing (SSR hydration differences), fetch at runtime
function readEnvConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  } as Record<string, string | undefined>;
}

let firebaseConfig = readEnvConfig();

// If keys appear missing on the client, fetch from public config endpoint once
if (typeof window !== 'undefined') {
  const missing = Object.values(firebaseConfig).filter(v => !v).length > 0;
  if (missing) {
    try {
      fetch('/api/public/firebase-config')
        .then(r => r.json())
        .then((j) => {
          if (j?.success && j?.firebase) {
            firebaseConfig = { ...firebaseConfig, ...j.firebase } as any;
          }
        })
        .catch(() => {});
    } catch {}
  }
}

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
// Do not hard-fail on missing keys here; the runtime fetch can populate them.

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

// Initialize Auth only in the browser, with robust persistence fallbacks
if (typeof window !== 'undefined' && app) {
  try {
    // Prefer explicit initialization with available persistences
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (e) {
    // Fallback to default getAuth
    try {
      auth = getAuth(app);
    } catch (e2) {
      console.warn('initializeAuth/getAuth failed, falling back to in-memory:', e2);
      try {
        auth = getAuth();
      } catch {}
    }
  }
  // Ensure a persistence is set even in restricted modes (e.g., Safari Private)
  try {
    if (auth) {
      setPersistence(auth as any, browserLocalPersistence).catch(() => {
        try { setPersistence(auth as any, inMemoryPersistence as any); } catch {}
      });
    }
  } catch {}
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

// Helper to safely retrieve a client-side Auth instance on demand
export function getClientAuth(): Auth | null {
  try {
    if (typeof window === 'undefined') return null;
    if (getApps().length === 0) {
      try { initializeApp(firebaseConfig); } catch {}
    }
    return getAuth();
  } catch (e) {
    console.warn('getClientAuth failed:', e);
    return null;
  }
}