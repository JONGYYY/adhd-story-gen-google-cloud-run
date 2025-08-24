import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = process.env as Record<string, string | undefined>;
  const keys = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    'NEXT_PUBLIC_APP_URL',
    'NODE_ENV',
    'PORT',
  ];
  const snapshot = Object.fromEntries(
    keys.map((k) => [k, env[k] ? { present: true, length: env[k]!.length, preview: env[k]!.slice(0, 6) } : { present: false }])
  );
  return NextResponse.json({ success: true, snapshot });
}


