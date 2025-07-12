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

export async function POST(request: Request) {
  try {
    console.log('Firebase Admin API request received');
    const { action, payload } = await request.json();
    console.log('Action:', action);
    console.log('Payload keys:', Object.keys(payload || {}));
    
    const auth = await initFirebaseAdmin();
    console.log('Firebase Admin initialized successfully');

    switch (action) {
      case 'verifySession': {
        const { sessionCookie, checkRevoked = true } = payload;
        console.log('Verifying session cookie...');
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, checkRevoked);
        console.log('Session cookie verified successfully');
        return NextResponse.json({ success: true, decodedClaims });
      }

      case 'createSession': {
        const { idToken, expiresIn } = payload;
        console.log('Creating session cookie...');
        console.log('Expires in:', expiresIn);
        
        if (!idToken) {
          throw new Error('No ID token provided for session creation');
        }
        
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
        console.log('Session cookie created successfully');
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
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
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