import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawRailway = (process.env.RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL || '').trim();
    const effectiveRailway = rawRailway.replace(/\/$/, '');

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      firebaseConfig: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Missing',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Set' : 'Missing',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
      },
      firebaseAdmin: {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'Set' : 'Missing',
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'Set' : 'Missing',
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? 'Set' : 'Missing',
      },
      railway: {
        apiUrlSet: !!effectiveRailway,
        usingNextPublic: !!process.env.NEXT_PUBLIC_RAILWAY_API_URL && !process.env.RAILWAY_API_URL,
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