import { NextRequest, NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing TikTok Upload Endpoint ===');
    
    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);

    // Get TikTok credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'tiktok');
    if (!credentials) {
      return NextResponse.json({ 
        error: 'TikTok not connected. Please connect your TikTok account first.' 
      }, { status: 400 });
    }

    // Create a small test video (a 1-second black screen)
    const videoData = Buffer.from([
      0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
      0x6D, 0x70, 0x34, 0x31
    ]);

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI();

    // Try uploading the test video
    const result = await tiktokApi.uploadVideo(credentials.accessToken, {
      title: 'Test Upload ' + new Date().toISOString(),
      video_file: videoData,
      privacy_level: 'SELF_ONLY'
    });

    return NextResponse.json({
      success: true,
      message: 'Test upload completed',
      result,
      nextSteps: [
        'Video was uploaded with SELF_ONLY privacy',
        'Check your TikTok account drafts',
        'If successful, you can now implement the full upload feature'
      ]
    });
  } catch (error) {
    console.error('Error testing TikTok upload:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      help: 'Make sure you have connected your TikTok account and are in sandbox mode'
    }, { status: 500 });
  }
} 