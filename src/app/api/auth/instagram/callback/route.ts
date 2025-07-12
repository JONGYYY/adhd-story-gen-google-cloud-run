export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/social-media/instagram';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { setSocialMediaCredentialsServer } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=No authorization code received`);
    }

    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Not authenticated`);
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Invalid session`);
    }

    const userId = decodedClaims.uid;

    const instagramApi = new InstagramAPI();
    const tokens = await instagramApi.getAccessToken(code);

    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${tokens.error || 'No access token received'}`);
    }

    // Get user info
    const userInfo = await instagramApi.getUserInfo(tokens.access_token);

    // Store credentials in Firebase using server-side function
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      username: userInfo.username,
      expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : Date.now() + 3600000,
      platform: 'instagram' as const,
      userId: userId,
      profileId: userInfo.id
    };

    await setSocialMediaCredentialsServer(userId, 'instagram', credentials);

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=Instagram connected successfully`);
  } catch (error) {
    console.error('Error handling Instagram OAuth callback:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Failed to connect Instagram`);
  }
} 