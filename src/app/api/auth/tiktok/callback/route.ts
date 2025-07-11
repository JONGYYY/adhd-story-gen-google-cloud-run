import { NextRequest, NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { auth } from '@/lib/firebase';
import { setSocialMediaCredentials } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code) {
      return NextResponse.redirect('/settings/social-media?error=No authorization code received');
    }

    const tiktokApi = new TikTokAPI();
    const tokens = await tiktokApi.getAccessToken(code);

    if (tokens.error) {
      return NextResponse.redirect(`/settings/social-media?error=${tokens.error}`);
    }

    // Get user info
    const userInfo = await tiktokApi.getUserInfo(tokens.access_token);

    // Store credentials in Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.redirect('/settings/social-media?error=Not authenticated');
    }

    await setSocialMediaCredentials(currentUser.uid, 'tiktok', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      username: userInfo.username,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    });

    return NextResponse.redirect('/settings/social-media?success=TikTok connected successfully');
  } catch (error) {
    console.error('Error handling TikTok OAuth callback:', error);
    return NextResponse.redirect('/settings/social-media?error=Failed to connect TikTok');
  }
} 