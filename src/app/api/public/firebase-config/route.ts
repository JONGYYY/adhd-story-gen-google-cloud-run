import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const nodeProcess = await import('process');
    const env = nodeProcess.env as Record<string, string | undefined>;
    const cfg = {
      apiKey: env['NEXT_PUBLIC_FIREBASE_API_KEY'] || '',
      authDomain: env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] || '',
      projectId: env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] || '',
      storageBucket: env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] || '',
      messagingSenderId: env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] || '',
      appId: env['NEXT_PUBLIC_FIREBASE_APP_ID'] || '',
      measurementId: env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'] || '',
    };

    const presence = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => [k, v ? { present: true, length: v.length, preview: v.slice(0, 6) } : { present: false }])
    );

    return NextResponse.json({ success: true, firebase: cfg, presence });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 });
  }
}


