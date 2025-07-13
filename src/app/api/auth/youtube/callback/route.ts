export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAPI } from '@/lib/social-media/youtube';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { setSocialMediaCredentialsServer } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    console.log('YouTube OAuth callback received');
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    console.log('YouTube OAuth callback params:', { code: !!code, state: !!state, error });
    
    if (error) {
      console.error('YouTube OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=OAuth error: ${error}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=No authorization code received`);
    }

    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      console.error('No session cookie found');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Not authenticated`);
    }

    // Verify session cookie and get user
    console.log('Verifying session cookie...');
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      console.error('Invalid session cookie');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Invalid session`);
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);

    console.log('Initializing YouTube API...');
    const youtubeApi = new YouTubeAPI();
    
    console.log('Getting tokens from code...');
    const tokens = await youtubeApi.getTokensFromCode(code);

    if (!tokens.access_token) {
      console.error('No access token received from YouTube');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=No access token received`);
    }

    console.log('Getting user info...');
    // Get user info
    const userInfo = await youtubeApi.getUserInfo(tokens.access_token);

    console.log('YouTube user info:', userInfo);

    // Store credentials in Firebase using server-side function
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      username: userInfo.username,
      expiresAt: tokens.expiry_date ?? (Date.now() + 3600000),
      platform: 'youtube' as const,
      userId: userId,
      profileId: userInfo.id ?? undefined
    };

    console.log('Saving credentials to Firebase...');
    await setSocialMediaCredentialsServer(userId, 'youtube', credentials);

    console.log('YouTube OAuth callback completed successfully');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=YouTube connected successfully`);
  } catch (error) {
    console.error('Error handling YouTube OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Failed to connect YouTube: ${errorMessage}`);
  }
} 