import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = (process.env.REMOTION_ENABLED || '').toLowerCase() === 'true';
  const base = process.env.BACKGROUND_BASE_URL || '';
  const testUrl = base && /^https?:\/\//i.test(base) ? `${base.replace(/\/$/, '')}/minecraft/1.mp4` : null;
  let headStatus: number | null = null;
  let contentLength: string | null = null;
  try {
    if (testUrl) {
      const res = await fetch(testUrl, { method: 'HEAD' });
      headStatus = res.status;
      contentLength = res.headers.get('content-length');
    }
  } catch (e: any) {
    headStatus = -1;
  }
  return NextResponse.json({
    remotionEnabled: enabled,
    backgroundBaseUrl: base,
    testUrl,
    headStatus,
    contentLength,
  });
} 