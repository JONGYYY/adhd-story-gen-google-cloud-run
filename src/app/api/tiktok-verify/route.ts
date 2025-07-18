import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Get the verification code from the URL or use the default
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code') || '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
  
  // Return the verification content
  return new NextResponse(code, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

// Also handle POST requests in case TikTok uses them
export async function POST(request: NextRequest) {
  return GET(request);
} 