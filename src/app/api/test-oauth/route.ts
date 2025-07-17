import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const oauthConfig = {
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
      youtubeClientId: process.env.YOUTUBE_CLIENT_ID ? 'Set' : 'Missing',
      youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET ? 'Set' : 'Missing',
      tiktokClientKey: process.env.TIKTOK_CLIENT_KEY ? 'Set' : 'Missing',
      tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET ? 'Set' : 'Missing',
      redirectUrls: {
        youtube: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
        tiktok: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
      }
    };

    return NextResponse.json({
      success: true,
      oauthConfig,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('OAuth test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 