import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAPI } from '@/lib/social-media/youtube';
import { auth } from '@/lib/firebase';
import { getSocialMediaCredentials, setSocialMediaCredentials } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.redirect('/settings/social-media?error=No authorization code received');
    }

    const youtubeApi = new YouTubeAPI();
    const tokens = await youtubeApi.getTokensFromCode(code);

    // Get user info from YouTube
    const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    const data = await response.json();
    const channelInfo = data.items[0].snippet;

    // Store credentials in Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.redirect('/settings/social-media?error=Not authenticated');
    }

    await setSocialMediaCredentials(currentUser.uid, 'youtube', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      username: channelInfo.title,
      expiresAt: Date.now() + (tokens.expiry_date || 3600000),
    });

    return NextResponse.redirect('/settings/social-media?success=YouTube connected successfully');
  } catch (error) {
    console.error('Error handling YouTube OAuth callback:', error);
    return NextResponse.redirect('/settings/social-media?error=Failed to connect YouTube');
  }
} 