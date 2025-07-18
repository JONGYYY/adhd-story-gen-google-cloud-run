import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createVideoStatus, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    console.log('Testing video generation flow...');
    
    // Test 1: Create video status
    await createVideoStatus(videoId);
    console.log('✓ Created video status');
    
    // Test 2: Check if we can set video ready
    const testVideoUrl = '/api/videos/test.mp4';
    await setVideoReady(videoId, testVideoUrl);
    console.log('✓ Set video ready');
    
    return NextResponse.json({
      success: true,
      videoId,
      message: 'Video generation flow test passed',
      testVideoUrl
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Test failed';
    console.error('Video generation test failed:', error);
    
    // Update status to failed
    await setVideoFailed(videoId, errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      videoId
    });
  }
} 