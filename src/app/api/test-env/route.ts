import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allEnvVars = {
      // Firebase config
      NEXT_PUBLIC_FIREBASE_API_KEY: {
        exists: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        length: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.length || 0,
        startsWith: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) || 'undefined',
        hasQuotes: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.includes('"') || false
      },
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: {
        exists: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'undefined'
      },
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: {
        exists: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'undefined'
      },
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: {
        exists: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'undefined'
      },
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: {
        exists: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'undefined'
      },
      NEXT_PUBLIC_FIREBASE_APP_ID: {
        exists: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'undefined'
      },
      NEXT_PUBLIC_APP_URL: {
        exists: !!process.env.NEXT_PUBLIC_APP_URL,
        value: process.env.NEXT_PUBLIC_APP_URL || 'undefined'
      },
      // Other important vars
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      // Count total NEXT_PUBLIC vars
      totalNextPublicVars: Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_')).length,
      allNextPublicKeys: Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_'))
    };

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      envVars: allEnvVars
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 