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

    if (!tokens.access_token) {
      return NextResponse.redirect('/settings/social-media?error=No access token received');
    }

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

    // Ensure we have the required fields
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      username: channelInfo.title,
      expiresAt: tokens.expiry_date ? Date.now() + tokens.expiry_date : Date.now() + 3600000,
      platform: 'youtube' as const,
      userId: currentUser.uid,
      profileId: data.items[0].id
    };

    await setSocialMediaCredentials(currentUser.uid, 'youtube', credentials);

    return NextResponse.redirect('/settings/social-media?success=YouTube connected successfully');
  } catch (error) {
    console.error('Error handling YouTube OAuth callback:', error);
    return NextResponse.redirect('/settings/social-media?error=Failed to connect YouTube');
  }
} 