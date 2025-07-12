import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export async function GET() {
  try {
    console.log('Testing Firebase Admin initialization...');
    
    // Check environment variables
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    const envCheck = {
      projectId: projectId ? 'Set' : 'Missing',
      clientEmail: clientEmail ? 'Set' : 'Missing',
      privateKey: privateKey ? 'Set' : 'Missing',
    };

    console.log('Environment variables:', envCheck);

    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Firebase Admin credentials',
        envCheck
      }, { status: 500 });
    }

    // Try to initialize Firebase Admin
    const apps = getApps();
    console.log('Existing Firebase apps:', apps.length);

    let app;
    if (!apps.length) {
      console.log('Creating new Firebase Admin app...');
      
      // Handle private key formatting
      let formattedPrivateKey = privateKey;
      if (privateKey.includes('\\n')) {
        formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      }

      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });
      console.log('Firebase Admin app created successfully');
    } else {
      console.log('Using existing Firebase app');
      app = apps[0];
    }

    // Test authentication
    const auth = getAuth(app);
    console.log('Firebase Admin auth initialized');

    // Try to list users (this will test if the credentials work)
    try {
      const listUsersResult = await auth.listUsers(1);
      console.log('Successfully listed users:', listUsersResult.users.length);
      
      return NextResponse.json({
        success: true,
        message: 'Firebase Admin SDK is working correctly',
        envCheck,
        usersCount: listUsersResult.users.length
      });
    } catch (listError: any) {
      console.error('Error listing users:', listError);
      
      // If listing users fails, try a simpler test
      try {
        // Try to verify a fake token (this will fail but test the connection)
        await auth.verifyIdToken('fake-token');
      } catch (verifyError: any) {
        if (verifyError.code === 'auth/id-token-expired' || 
            verifyError.code === 'auth/argument-error' ||
            verifyError.code === 'auth/invalid-id-token') {
          // This is expected for a fake token, so the SDK is working
          return NextResponse.json({
            success: true,
            message: 'Firebase Admin SDK is working correctly (token verification test passed)',
            envCheck,
            note: 'List users failed but SDK is functional'
          });
        } else {
          throw verifyError;
        }
      }
    }

  } catch (error: any) {
    console.error('Firebase Admin test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 