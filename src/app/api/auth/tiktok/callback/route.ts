// Prevent static generation but use Node.js runtime for Firebase Admin
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { setSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { APP_CONFIG } from '@/lib/config';

export async function GET(request: NextRequest) {
  console.log('=== TikTok OAuth Callback Started ===');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  
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
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        `TikTok OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }
    
    if (!code) {
      console.error('No authorization code received');
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        'No authorization code received from TikTok'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    if (!state) {
      console.error('No state parameter received');
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        'Invalid OAuth state - possible CSRF attack'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    console.log('OAuth parameters validated successfully');
    console.log('Code received:', code ? `${code.substring(0, 10)}...` : 'NONE');
    console.log('State received:', state ? `${state.substring(0, 10)}...` : 'NONE');

    // TODO: Validate state parameter against stored value

    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    console.log('Session cookie present:', !!sessionCookie);
    
    if (!sessionCookie) {
      console.error('No session cookie found');
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        'Not authenticated - please log in'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    // Verify session cookie and get user
    console.log('Verifying session cookie...');
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      console.error('Invalid session cookie');
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        'Invalid session - please log in again'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated successfully:', userId);

    console.log('Initializing TikTok API...');
    const tiktokApi = new TikTokAPI();
    
    console.log('Getting tokens from code...');
    let tokens;
    try {
      tokens = await tiktokApi.getAccessToken(code);
      console.log('Tokens received successfully:', !!tokens.access_token);
    } catch (error) {
      console.error('Error getting access token:', error);
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Failed to get access token'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    if (!tokens.access_token) {
      console.error('No access token received:', tokens);
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        'No access token received from TikTok'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    console.log('Getting user info...');
    let userInfo;
    try {
      userInfo = await tiktokApi.getUserInfo(tokens.access_token);
      console.log('User info received successfully:', !!userInfo);
    } catch (error) {
      console.error('Error getting user info:', error);
      const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Failed to get user info'
      )}`;
      console.log('Redirecting to error page:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
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
    let firestoreError = null;
    try {
      await setSocialMediaCredentialsServer(userId, 'tiktok', credentials);
      console.log('Credentials saved successfully');
    } catch (error) {
      console.error('Error saving credentials:', error);
      firestoreError = error;
      
      // Check if it's a Firestore API disabled error
      const isFirestoreDisabled = error instanceof Error && 
        (error.message.includes('SERVICE_DISABLED') || 
         error.message.includes('Firestore API has not been used'));
      
      if (isFirestoreDisabled) {
        console.error('Firestore API is disabled. Please enable it at https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=redditstories-531a8');
      }
    }

    // Even if Firestore save fails, we've successfully authenticated with TikTok
    // Return success but with a warning about the Firestore error
    const successMessage = firestoreError 
      ? 'TikTok connected successfully, but there was an error saving the credentials. Please try reconnecting later.'
      : 'TikTok connected successfully';

    console.log('TikTok OAuth callback completed successfully');
    const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?${firestoreError ? 'warning' : 'success'}=${encodeURIComponent(successMessage)}`;
    console.log('Redirecting to success page:', redirectUrl);
    console.log('=== TikTok OAuth Callback Completed ===');
    
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('=== UNHANDLED ERROR IN TIKTOK CALLBACK ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const redirectUrl = `${APP_CONFIG.APP_URL}/settings/social-media?error=${encodeURIComponent(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )}`;
    console.log('Redirecting to error page:', redirectUrl);
    console.log('=== TikTok OAuth Callback Failed ===');
    
    return NextResponse.redirect(redirectUrl);
  }
} 