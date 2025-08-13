import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // This endpoint will return the TikTok verification content
  // You'll need to update this with the actual verification code from TikTok
  
  const verificationContent = process.env.TIKTOK_VERIFICATION_CODE || 'tiktok-verification-placeholder';
  
  return new NextResponse(verificationContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600'
    }
  });
} 