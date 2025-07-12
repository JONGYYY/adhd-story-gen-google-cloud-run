export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/social-media/instagram';
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

    const instagramApi = new InstagramAPI();
    const tokens = await instagramApi.getAccessToken(code);

    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${tokens.error || 'No access token received'}`);
    }

    // Get user info
    const userInfo = await instagramApi.getUserInfo(tokens.access_token);

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
      platform: 'instagram' as const,
      userId: currentUser.uid,
      profileId: userInfo.id
    };

    await setSocialMediaCredentials(currentUser.uid, 'instagram', credentials);

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=Instagram connected successfully`);
  } catch (error) {
    console.error('Error handling Instagram OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Failed to connect Instagram`);
  }
} 