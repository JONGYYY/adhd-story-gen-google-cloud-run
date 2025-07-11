import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

let adminApp: App | undefined;
let adminAuth: Auth | undefined;

async function initFirebaseAdmin() {
  if (!adminAuth) {
    try {
      const apps = getApps();
      
      if (!apps.length) {
        const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
          throw new Error('Missing Firebase Admin credentials');
        }

        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        adminApp = apps[0];
      }

      adminAuth = getAuth(adminApp);
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      throw error;
    }
  }

  return adminAuth;
}

export async function POST(request: Request) {
  try {
    console.log('Firebase Admin API request received');
    const { action, payload } = await request.json();
    console.log('Action:', action);
    
    const auth = await initFirebaseAdmin();
    console.log('Firebase Admin initialized');

    switch (action) {
      case 'verifySession': {
        const { sessionCookie, checkRevoked = true } = payload;
        console.log('Verifying session cookie');
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, checkRevoked);
        console.log('Session cookie verified');
        return NextResponse.json({ success: true, decodedClaims });
      }

      case 'createSession': {
        const { idToken, expiresIn } = payload;
        console.log('Creating session cookie');
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
        console.log('Session cookie created');
        return NextResponse.json({ success: true, sessionCookie });
      }

      default:
        console.error('Invalid action:', action);
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Firebase Admin API Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        code: error.code,
        details: error.stack
      },
      { status: error.status || 500 }
    );
  }
} 