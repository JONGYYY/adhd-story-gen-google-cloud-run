import { NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('=== TikTok Full Debug Started ===');
    
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectUri = `${appUrl}/api/auth/tiktok/callback`;
    
    // Test the OAuth URL generation
    const tiktokApi = new TikTokAPI();
    const oauthUrl = tiktokApi.getAuthUrl();
    
    // Parse the OAuth URL to check parameters
    const parsedUrl = new URL(oauthUrl);
    const params = Object.fromEntries(parsedUrl.searchParams.entries());
    
    // Test if the callback URL is accessible
    let callbackTest = null;
    try {
      const callbackResponse = await fetch(`${redirectUri}?test=true`, {
        method: 'GET',
        headers: { 'User-Agent': 'TikTok-Debug-Test' }
      });
      callbackTest = {
        status: callbackResponse.status,
        accessible: callbackResponse.status < 500,
        headers: Object.fromEntries(callbackResponse.headers.entries())
      };
    } catch (error) {
      callbackTest = {
        status: 'ERROR',
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test TikTok OAuth endpoint accessibility
    let tiktokEndpointTest = null;
    try {
      const tiktokResponse = await fetch('https://www.tiktok.com/auth/authorize', {
        method: 'HEAD',
        headers: { 'User-Agent': 'TikTok-Debug-Test' }
      });
      tiktokEndpointTest = {
        status: tiktokResponse.status,
        accessible: tiktokResponse.status < 400
      };
    } catch (error) {
      tiktokEndpointTest = {
        status: 'ERROR',
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        appUrl: appUrl,
        redirectUri: redirectUri
      },
      tiktokConfig: {
        clientKey: clientKey ? `${clientKey.substring(0, 8)}...` : 'NOT_SET',
        clientSecret: clientSecret ? 'SET' : 'NOT_SET',
        clientKeyLength: clientKey?.length || 0,
        clientSecretLength: clientSecret?.length || 0
      },
      oauthUrl: {
        full: oauthUrl,
        parsed: {
          host: parsedUrl.host,
          pathname: parsedUrl.pathname,
          params: params
        }
      },
      validation: {
        hasClientKey: !!clientKey,
        hasClientSecret: !!clientSecret,
        hasAppUrl: !!appUrl,
        redirectUriValid: redirectUri.startsWith('https://'),
        domainMatch: parsedUrl.searchParams.get('app_source_domain') === new URL(appUrl || '').hostname
      },
      tests: {
        callbackAccessible: callbackTest,
        tiktokEndpointAccessible: tiktokEndpointTest
      },
      diagnostics: {
        possibleIssues: [
          !clientKey && 'Missing TIKTOK_CLIENT_KEY environment variable',
          !clientSecret && 'Missing TIKTOK_CLIENT_SECRET environment variable',
          !appUrl && 'Missing NEXT_PUBLIC_APP_URL environment variable',
          !redirectUri.startsWith('https://') && 'Redirect URI must use HTTPS',
          'App may not be approved in TikTok Developer Console',
          'Redirect URI may not match exactly in TikTok Developer Console',
          'App source domain may not be verified in TikTok Developer Console',
          'Test users may not be configured in sandbox mode',
          'Login Kit may not be enabled in TikTok app settings'
        ].filter(Boolean),
        nextSteps: [
          'Check TikTok Developer Console app status',
          'Verify redirect URI matches exactly: ' + redirectUri,
          'Ensure app source domain is verified: ' + new URL(appUrl || '').hostname,
          'Add test users in sandbox mode',
          'Check if app is approved for production use',
          'Verify Login Kit is enabled in app settings',
          'Test OAuth URL directly in browser to see exact error'
        ]
      },
      troubleshooting: {
        commonErrors: {
          'Something went wrong': 'Usually indicates app configuration issues in TikTok Developer Console',
          'Invalid client_key': 'Client key is incorrect or app is not approved',
          'Invalid redirect_uri': 'Redirect URI does not match exactly in app settings',
          'App not found': 'App ID is incorrect or app is deleted',
          'Unauthorized': 'App is not approved or in wrong mode'
        },
        checkList: [
          '✓ Client key is correct and matches TikTok Developer Console',
          '✓ Redirect URI matches exactly (including https://)',
          '✓ App source domain is verified',
          '✓ Login Kit is enabled',
          '✓ App is in correct mode (sandbox/production)',
          '✓ Test users are added (for sandbox)',
          '✓ App has required permissions',
          '✓ App is approved (for production)'
        ]
      }
    });
  } catch (error) {
    console.error('Error in TikTok full debug:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 