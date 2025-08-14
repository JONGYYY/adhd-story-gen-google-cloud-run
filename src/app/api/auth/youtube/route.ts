import { NextResponse } from 'next/server';
import { YouTubeAPI } from '@/lib/social-media/youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const youtubeApi = new YouTubeAPI();
    const authUrl = youtubeApi.getAuthUrl();
    
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate YouTube authentication' },
      { status: 500 }
    );
  }
} 