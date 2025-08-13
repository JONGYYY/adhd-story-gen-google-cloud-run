import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Test the callback URL directly
    const testUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback?code=test_code&state=test_state`;
    
    console.log('Testing TikTok callback URL:', testUrl);
    
    // Make a request to the callback endpoint
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Cookie': 'session=test_session_cookie',
        'User-Agent': 'Test-Agent'
      }
    });
    
    console.log('Callback response status:', response.status);
    console.log('Callback response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Callback response body:', responseText);
    
    return NextResponse.json({
      success: true,
      testUrl,
      callbackStatus: response.status,
      callbackHeaders: Object.fromEntries(response.headers.entries()),
      callbackBody: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
      message: 'TikTok callback test completed'
    });
  } catch (error) {
    console.error('Error testing TikTok callback:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'TikTok callback test failed'
    }, { status: 500 });
  }
} 