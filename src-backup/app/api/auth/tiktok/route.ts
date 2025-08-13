import { NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';

// Prevent static generation
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log('Initiating TikTok OAuth flow...');
    
    // Verify environment variables
    if (!process.env.TIKTOK_CLIENT_KEY) {
      console.error('TIKTOK_CLIENT_KEY is not set');
      return NextResponse.json(
        { error: 'TikTok client key is not configured' },
        { status: 500 }
      );
    }

    if (!process.env.TIKTOK_CLIENT_SECRET) {
      console.error('TIKTOK_CLIENT_SECRET is not set');
      return NextResponse.json(
        { error: 'TikTok client secret is not configured' },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('NEXT_PUBLIC_APP_URL is not set');
      return NextResponse.json(
        { error: 'App URL is not configured' },
        { status: 500 }
      );
    }

    console.log('Initializing TikTok API...');
    const tiktokApi = new TikTokAPI();
    
    console.log('Generating OAuth URL...');
    const authUrl = tiktokApi.getAuthUrl();
    
    console.log('OAuth URL generated successfully:', authUrl);
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating TikTok OAuth:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate TikTok authentication',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 