import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';

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

// Initialize Firebase only if we have the required configuration
let app: FirebaseApp | undefined;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  console.log('Attempting to initialize Firebase...');
  console.log('Existing apps:', getApps().length);
  
  if (getApps().length === 0) {
    console.log('Initializing new Firebase app...');
    app = initializeApp(firebaseConfig);
    console.log('Firebase app initialized successfully');
  } else {
    console.log('Using existing Firebase app...');
    app = getApps()[0];
  }
  
  console.log('Getting Firebase auth...');
  auth = getAuth(app);
  console.log('Firebase auth obtained:', !!auth);
  
  console.log('Getting Firebase Firestore...');
  db = getFirestore(app);
  console.log('Firebase Firestore obtained:', !!db);

  // Enable offline persistence only on client side
  if (typeof window !== 'undefined') {
    console.log('Enabling offline persistence...');
    enableIndexedDbPersistence(db)
      .then(() => console.log('Offline persistence enabled'))
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser doesn\'t support persistence.');
        } else {
          console.error('Failed to enable offline persistence:', err);
        }
      });
  }

  // Initialize Analytics only on client side
  let analytics = null;
  if (typeof window !== 'undefined') {
    console.log('Checking analytics support...');
    isSupported().then(yes => {
      if (yes) {
        console.log('Analytics supported, initializing...');
        getAnalytics(app!);
        console.log('Analytics initialized');
      } else {
        console.log('Analytics not supported');
      }
    })
    .catch(err => console.error('Failed to initialize analytics:', err));
  }
  
  console.log('Firebase initialization completed successfully');
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  console.error('Error details:', {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  // Create fallback objects to prevent crashes
  auth = null;
  db = null;
}

export type { Auth };
export { auth, db }; 