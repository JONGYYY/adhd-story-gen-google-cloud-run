export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAPI } from '@/lib/social-media/youtube';
import { auth } from '@/lib/firebase';
import { setSocialMediaCredentials } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=No authorization code received`);
    }

    const youtubeApi = new YouTubeAPI();
    const tokens = await youtubeApi.getAccessToken(code);

    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${tokens.error || 'No access token received'}`);
    }

    // Get user info
    const userInfo = await youtubeApi.getUserInfo(tokens.access_token);

    // Store credentials in Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Not authenticated`);
    }

    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      username: userInfo.username,
      expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : Date.now() + 3600000,
      platform: 'youtube' as const,
      userId: currentUser.uid,
      profileId: userInfo.id
    };

    await setSocialMediaCredentials(currentUser.uid, 'youtube', credentials);

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=YouTube connected successfully`);
  } catch (error) {
    console.error('Error handling YouTube OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Failed to connect YouTube`);
  }
} 