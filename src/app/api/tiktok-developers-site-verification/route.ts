import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Return the TikTok verification code
  const verificationContent = '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
  
  return new NextResponse(verificationContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600'
    }
  });
} 