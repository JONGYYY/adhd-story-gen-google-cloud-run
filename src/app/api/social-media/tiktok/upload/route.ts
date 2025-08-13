import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { TikTokAPI } from '@/lib/social-media/tiktok';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== TikTok Video Upload Started ===');
    
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

    console.log('TikTok credentials found');

    // Parse form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const videoFile = formData.get('video') as File;
    const privacyLevel = formData.get('privacy_level') as 'PUBLIC' | 'SELF_ONLY' | 'MUTUAL_FOLLOW' || 'SELF_ONLY';

    if (!title || !videoFile) {
      return NextResponse.json({ 
        error: 'Missing required fields: title and video file' 
      }, { status: 400 });
    }

    console.log('Upload request:', {
      title,
      videoSize: videoFile.size,
      videoType: videoFile.type,
      privacyLevel
    });

    // Convert file to buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI();

    // Upload video
    const result = await tiktokApi.uploadVideo(credentials.accessToken, {
      title,
      video_file: videoBuffer,
      privacy_level: privacyLevel
    });

    console.log('Video upload successful:', result);
    console.log('=== TikTok Video Upload Completed ===');

    return NextResponse.json({
      success: true,
      message: 'Video uploaded successfully',
      result
    });

  } catch (error) {
    console.error('=== TikTok Video Upload Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 