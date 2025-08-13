import { NextRequest, NextResponse } from 'next/server';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    const body = await request.json();
    console.log('🎬 Received Remotion test video generation request:', body);

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
      message: 'Remotion-based video generation started'
    });

  } catch (error) {
    console.error('❌ Error in Remotion test video generation API:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateRemotionTestVideo(
  options: {
    background: string;
  },
  videoId: string
): Promise<void> {
  try {
    console.log('🎬 Starting Remotion test video generation...');
    await updateProgress(videoId, 5);

    // Create test story data for the production system
    const renderRequest = {
      id: videoId,
      script: "Welcome to the new production-grade video generation system! This demonstrates professional-quality Reddit story videos with CapCut-style bouncing captions, pixel-perfect banners, and seamless background transitions. The system uses Remotion for deterministic frame-based animation and ElevenLabs for high-quality text-to-speech synthesis.",
      voiceId: 'ErXwobaYiN019PkySvjV', // Antoni voice
      avatarUrl: 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png',
      authorName: 'ProductionTestUser',
      title: 'Production-Grade Video Generation System Demo',
      subreddit: 'r/technology',
      bgClips: [
        `/backgrounds/${options.background}/1.mp4`,
        `/backgrounds/${options.background}/2.mp4`,
        `/backgrounds/${options.background}/3.mp4`
      ].map(path => `${process.cwd()}/public${path}`),
      fps: 30,
      width: 1080,
      height: 1920
    } as const;

    await updateProgress(videoId, 10);

    // Dynamically import to avoid bundling native deps during build
    const { RemotionVideoGenerator } = await import('@/lib/video-generator/remotion-generator');

    const generator = new RemotionVideoGenerator();
    console.log('🎬 Generating video with Remotion production system (fallback on Vercel)...');
    const result = await generator.generateVideo(renderRequest as any);
    
    // Set video ready with the result URL
    await setVideoReady(videoId, result.outputUrl!);
    
    console.log('✅ Remotion test video generation completed successfully!');
    console.log(`📹 Video URL: ${result.outputUrl}`);

  } catch (error) {
    console.error('❌ Error in Remotion test video generation:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error occurred');
    throw error;
  }
} 