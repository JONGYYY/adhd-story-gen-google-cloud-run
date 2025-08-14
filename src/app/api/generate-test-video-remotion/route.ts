import { NextRequest, NextResponse } from 'next/server';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    const body = await request.json();
    console.log('🎬 Received Remotion test video generation request:', body);

    // Disable this endpoint during build to avoid webpack issues
    if (process.env.NODE_ENV === 'production' && !process.env.RAILWAY_ENVIRONMENT) {
      return NextResponse.json({
        success: false,
        error: 'Remotion video generation not available in this environment',
        videoId
      }, { status: 503 });
    }

    const { background = 'minecraft' } = body;

    // Set initial status
    await setVideoGenerating(videoId);

    // Start async video generation using Remotion architecture
    generateRemotionTestVideo({
      background,
    }, videoId).catch(async (error) => {
      console.error('❌ Remotion test video generation failed:', error);
      await setVideoFailed(videoId, error.message);
    });

    return NextResponse.json({
      success: true,
      videoId,
      message: 'Remotion test video generation started'
    });

  } catch (error) {
    console.error('❌ Error in Remotion test video generation:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      videoId
    }, { status: 500 });
  }
}

async function generateRemotionTestVideo(
  options: { background: string },
  videoId: string
) {
  console.log('🎬 Starting Remotion test video generation for video:', videoId);
  
  try {
    // Update progress
    await updateProgress(videoId, 10);
    console.log('Initializing Remotion renderer...');

    // Dynamic import to avoid build-time issues
    const { RemotionVideoGenerator } = await import('@/lib/video-generator/remotion-generator');
    
    const generator = new RemotionVideoGenerator();
    await generator.initializeRenderer();
    
    // Update progress
    await updateProgress(videoId, 25);
    console.log('Generating test content...');
    
    const testStory = "This is a test story for Remotion video generation. It should create a simple video with background and text overlay.";
    
    // Generate video using Remotion
    const result = await generator.generateVideo({
      videoId,
      story: testStory,
      background: options.background,
    });
    
    if (result.success && result.videoPath) {
      await setVideoReady(videoId, result.videoPath);
      console.log('✅ Remotion test video generated successfully:', result.videoPath);
    } else {
      throw new Error(result.error || 'Failed to generate video');
    }
    
  } catch (error) {
    console.error('❌ Remotion test video generation failed:', error);
    throw error;
  }
} 