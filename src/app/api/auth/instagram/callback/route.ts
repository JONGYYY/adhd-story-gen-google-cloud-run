import { NextRequest, NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/social-media/instagram';
import { auth } from '@/lib/firebase';
import { setSocialMediaCredentials } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.redirect('/settings/social-media?error=No authorization code received');
    }

    const instagramApi = new InstagramAPI();
    const tokens = await instagramApi.getAccessToken(code);

    if (tokens.error) {
      return NextResponse.redirect(`/settings/social-media?error=${tokens.error}`);
    }

    // Get user info
    const userInfo = await instagramApi.getUserInfo(tokens.access_token);

    // Store credentials in Firebase
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.redirect('/settings/social-media?error=Not authenticated');
    }

    await setSocialMediaCredentials(currentUser.uid, 'instagram', {
      accessToken: tokens.access_token,
      username: userInfo.username,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    });

    return NextResponse.redirect('/settings/social-media?success=Instagram connected successfully');
  } catch (error) {
    console.error('Error handling Instagram OAuth callback:', error);
    return NextResponse.redirect('/settings/social-media?error=Failed to connect Instagram');
  }
} 