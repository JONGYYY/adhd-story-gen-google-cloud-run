import { NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/social-media/instagram';

export async function GET() {
  try {
    const instagramApi = new InstagramAPI();
    const authUrl = instagramApi.getAuthUrl();
    
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating Instagram OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Instagram authentication' },
      { status: 500 }
    );
  }
} 