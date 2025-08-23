import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all environment variables
    const allEnvVars = process.env;
    
    // Filter to just show the keys (not values for security)
    const envKeys = Object.keys(allEnvVars).sort();
    
    // Check specific Firebase keys
    const firebaseKeys = envKeys.filter(key => key.includes('FIREBASE'));
    const nextPublicKeys = envKeys.filter(key => key.startsWith('NEXT_PUBLIC_'));
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      totalEnvVars: envKeys.length,
      allEnvKeys: envKeys,
      firebaseKeys: firebaseKeys,
      nextPublicKeys: nextPublicKeys,
      // Test a few specific values (first few chars only)
      testValues: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? 'SET' : 'NOT_SET',
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT_SET',
        // Show first 10 chars of API key if it exists
        API_KEY_PREFIX: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 10) + '...' : 'NOT_SET'
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