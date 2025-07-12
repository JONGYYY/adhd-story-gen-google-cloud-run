import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

let adminApp: App | undefined;
let adminAuth: Auth | undefined;

export async function initFirebaseAdmin() {
  if (!adminAuth) {
    try {
      console.log('Initializing Firebase Admin...');
      const apps = getApps();
      console.log('Existing Firebase apps:', apps.length);
      
      if (!apps.length) {
        const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

        console.log('Environment variables check:');
        console.log('- FIREBASE_ADMIN_PROJECT_ID:', projectId ? 'Set' : 'Missing');
        console.log('- FIREBASE_ADMIN_CLIENT_EMAIL:', clientEmail ? 'Set' : 'Missing');
        console.log('- FIREBASE_ADMIN_PRIVATE_KEY:', privateKey ? 'Set' : 'Missing');

        if (!projectId || !clientEmail || !privateKey) {
          throw new Error('Missing Firebase Admin credentials');
        }

        // Handle private key formatting - it might be escaped in environment variables
        let formattedPrivateKey = privateKey;
        if (privateKey.includes('\\n')) {
          formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        }

        console.log('Creating Firebase Admin app...');
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formattedPrivateKey,
          }),
        });
        console.log('Firebase Admin app created successfully');
      } else {
        console.log('Using existing Firebase app');
        adminApp = apps[0];
      }

      adminAuth = getAuth(adminApp);
      console.log('Firebase Admin auth initialized');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      throw error;
    }
  }

  return adminAuth;
}

export async function verifySessionCookie(sessionCookie: string, checkRevoked = true) {
  try {
    const auth = await initFirebaseAdmin();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, checkRevoked);
    return decodedClaims;
  } catch (error) {
    console.error('Failed to verify session cookie:', error);
    return null;
  }
}

export async function createSessionCookie(idToken: string, expiresIn: number) {
  try {
    const auth = await initFirebaseAdmin();
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    return sessionCookie;
  } catch (error) {
    console.error('Failed to create session cookie:', error);
    throw error;
  }
} 