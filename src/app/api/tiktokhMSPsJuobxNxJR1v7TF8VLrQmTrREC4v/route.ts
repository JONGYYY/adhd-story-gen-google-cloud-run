import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('=== TikTok Verification File Request ===');
  console.log('URL:', request.url);
  console.log('User-Agent:', request.headers.get('user-agent'));
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  const verificationContent = '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
  
  return new NextResponse(verificationContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': verificationContent.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'X-TikTok-Verification': verificationContent
    }
  });
}

// Handle HEAD requests
export async function HEAD(request: NextRequest) {
  return GET(request);
} 