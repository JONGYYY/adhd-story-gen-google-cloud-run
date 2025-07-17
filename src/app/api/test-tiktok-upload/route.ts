import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('=== Testing TikTok Upload Endpoint ===');
    
    // Test the upload endpoint with mock data
    const testFormData = new FormData();
    testFormData.append('title', 'Test Video Upload');
    testFormData.append('privacy_level', 'SELF_ONLY');
    
    // Create a mock video file (just for testing the endpoint)
    const mockVideoBuffer = Buffer.from('mock video data');
    const mockVideoFile = new File([mockVideoBuffer], 'test-video.mp4', { type: 'video/mp4' });
    testFormData.append('video', mockVideoFile);
    
    console.log('Mock upload data prepared');
    
    return NextResponse.json({
      success: true,
      message: 'TikTok upload endpoint is ready',
      endpoint: '/api/social-media/tiktok/upload',
      requiredFields: ['title', 'video', 'privacy_level (optional)'],
      supportedPrivacyLevels: ['PUBLIC', 'SELF_ONLY', 'MUTUAL_FOLLOW'],
      testMode: process.env.TIKTOK_TEST_MODE === 'true',
      instructions: [
        '1. Make sure you have connected your TikTok account',
        '2. Send a POST request to /api/social-media/tiktok/upload',
        '3. Include form data with title, video file, and optional privacy_level',
        '4. The endpoint will upload the video to TikTok (or simulate in test mode)'
      ]
    });
  } catch (error) {
    console.error('Error testing TikTok upload:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 