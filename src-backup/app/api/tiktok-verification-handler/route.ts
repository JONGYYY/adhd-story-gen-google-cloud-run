import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';
  
  // Log the request details
  console.log('=== TikTok Verification Request ===');
  console.log('URL:', url.toString());
  console.log('User-Agent:', userAgent);
  console.log('Referer:', referer);
  console.log('All headers:', Object.fromEntries(request.headers.entries()));
  
  // The verification content TikTok is expecting
  const verificationContent = '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
  
  // Return the verification content with various headers to ensure compatibility
  return new NextResponse(verificationContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': verificationContent.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, User-Agent, Referer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-TikTok-Verification': verificationContent
    }
  });
}

// Handle HEAD requests
export async function HEAD(request: NextRequest) {
  const response = await GET(request);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers
  });
}

// Handle OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, User-Agent, Referer',
    }
  });
} 