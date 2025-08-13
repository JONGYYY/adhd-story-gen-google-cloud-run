import { NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';

// Prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;
    
    // Test the OAuth URL generation using TikTok API class
    const tiktokApi = new TikTokAPI();
    const oauthUrl = tiktokApi.getAuthUrl();

    return NextResponse.json({
      success: true,
      debug: {
        clientKey: clientKey ? `${clientKey.substring(0, 8)}...` : 'NOT_SET',
        clientSecret: clientSecret ? 'SET' : 'NOT_SET',
        redirectUri,
        oauthUrl,
        appUrl: process.env.NEXT_PUBLIC_APP_URL
      },
      recommendations: [
        '1. Verify client_key is correct in TikTok Developer Console',
        '2. Ensure redirect_uri matches exactly in TikTok app settings',
        '3. Check that Login Kit is enabled in TikTok app',
        '4. Verify app is in Sandbox mode',
        '5. Add your TikTok account as a target user in sandbox',
        '6. Try accessing the OAuth URL directly in browser to see the exact error',
        '7. Check TikTok Developer Console for any app review status',
        '8. Verify that Content Posting API is completely removed from app settings'
      ],
      nextSteps: [
        'Try the OAuth flow again with the simplified URL',
        'If still failing, check TikTok Developer Console for any error messages',
        'Verify that your TikTok account is properly added as a target user',
        'Check if there are any pending app review requirements'
      ]
    });
  } catch (error) {
    console.error('TikTok debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        clientKey: process.env.TIKTOK_CLIENT_KEY ? 'SET' : 'NOT_SET',
        clientSecret: process.env.TIKTOK_CLIENT_SECRET ? 'SET' : 'NOT_SET',
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
      }
    }, { status: 500 });
  }
} 