import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'success',
      firebaseAuth: !!auth,
      firebaseAuthType: auth ? typeof auth : 'null',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      firebaseConfig: {
        hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 