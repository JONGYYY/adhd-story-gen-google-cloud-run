import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Force TikTok Connect Test ===');
    
    // This is a temporary test endpoint to bypass TikTok OAuth issues
    // It will simulate a successful OAuth callback
    
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'test_user';
    
    // Simulate OAuth callback parameters
    const testCode = 'test_authorization_code_' + Date.now();
    const testState = 'test_state_' + Date.now();
    
    // Redirect to our callback with test parameters
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback?code=${testCode}&state=${testState}`;
    
    console.log('Redirecting to callback URL:', callbackUrl);
    
    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error('Error in force TikTok connect:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 