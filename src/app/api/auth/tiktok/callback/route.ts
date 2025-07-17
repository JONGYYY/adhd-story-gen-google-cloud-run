// Prevent static generation but use Node.js runtime for Firebase Admin
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { setSocialMediaCredentialsServer } from '@/lib/social-media/schema';

export async function GET(request: NextRequest) {
  try {
    console.log('TikTok OAuth callback received');
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Log all query parameters for debugging
    const allParams = Object.fromEntries(searchParams.entries());
    console.log('TikTok OAuth callback - all params:', allParams);
    
    if (error) {
      console.error('TikTok OAuth error from callback:', { error, errorDescription });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          `TikTok OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`
        )}`
      );
    }
    
    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          'No authorization code received from TikTok'
        )}`
      );
    }

    if (!state) {
      console.error('No state parameter received');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          'Invalid OAuth state - possible CSRF attack'
        )}`
      );
    }

    // TODO: Validate state parameter against stored value

    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      console.error('No session cookie found');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          'Not authenticated - please log in'
        )}`
      );
    }

    // Verify session cookie and get user
    console.log('Verifying session cookie...');
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      console.error('Invalid session cookie');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          'Invalid session - please log in again'
        )}`
      );
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);

    console.log('Initializing TikTok API...');
    const tiktokApi = new TikTokAPI();
    
    console.log('Getting tokens from code...');
    let tokens;
    try {
      tokens = await tiktokApi.getAccessToken(code);
    } catch (error) {
      console.error('Error getting access token:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Failed to get access token'
        )}`
      );
    }

    if (!tokens.access_token) {
      console.error('No access token received:', tokens);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          'No access token received from TikTok'
        )}`
      );
    }

    console.log('Getting user info...');
    let userInfo;
    try {
      userInfo = await tiktokApi.getUserInfo(tokens.access_token);
    } catch (error) {
      console.error('Error getting user info:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Failed to get user info'
        )}`
      );
    }
    
    console.log('TikTok user info:', userInfo);

    // Store credentials in Firebase using server-side function
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      username: userInfo.username,
      expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : Date.now() + 3600000,
      platform: 'tiktok' as const,
      userId: userId,
      profileId: userInfo.open_id
    };

    console.log('Saving credentials to Firebase...');
    try {
      await setSocialMediaCredentialsServer(userId, 'tiktok', credentials);
    } catch (error) {
      console.error('Error saving credentials:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
          'Failed to save TikTok credentials'
        )}`
      );
    }

    console.log('TikTok OAuth callback completed successfully');
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=${encodeURIComponent(
        'TikTok connected successfully'
      )}`
    );
  } catch (error) {
    console.error('Unhandled error in TikTok OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(
        `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )}`
    );
  }
} 