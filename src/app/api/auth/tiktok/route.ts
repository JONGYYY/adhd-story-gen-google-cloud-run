import { NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';

export async function GET() {
  try {
    const tiktokApi = new TikTokAPI();
    const authUrl = tiktokApi.getAuthUrl();
    
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating TikTok OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authentication' },
      { status: 500 }
    );
  }
} 