import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { verification: string[] } }) {
  const path = params.verification.join('/');
  
  console.log('=== Catch-all Verification Request ===');
  console.log('Path:', path);
  console.log('Full URL:', request.url);
  console.log('User-Agent:', request.headers.get('user-agent'));
  
  // Check if this looks like a TikTok verification request
  const isTikTokVerification = 
    path.includes('tiktok') || 
    path.includes('5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj') ||
    path.includes('tiktokhMSPsJuobxNxJR1v7TF8VLrQmTrREC4v') ||
    request.headers.get('user-agent')?.toLowerCase().includes('tiktok');
  
  if (isTikTokVerification) {
    console.log('TikTok verification request detected');
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
  
  // Not a TikTok verification request, return 404
  return new NextResponse('Not Found', { status: 404 });
} 