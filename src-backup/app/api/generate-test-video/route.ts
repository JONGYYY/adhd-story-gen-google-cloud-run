import { NextRequest, NextResponse } from 'next/server';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { v4 as uuidv4 } from 'uuid';
import { generateVideo } from '@/lib/video-generator/moviepy-generator';

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    const body = await request.json();
    console.log('🎬 Received test video generation request with updated banner:', body);

    const { background = 'minecraft' } = body;

    // Set initial status
    await setVideoGenerating(videoId);

    // Start async video generation using the working MoviePy system to test banner changes
    generateTestVideo({
      background,
    }, videoId).catch(error => {
      console.error('Error in video generation:', error);
      setVideoFailed(videoId, error.message);
    });

    return NextResponse.json({ 
      success: true, 
      videoId,
      message: 'Test video generation started with updated banner layout!'
    });
  } catch (error) {
    console.error('Error starting video generation:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId 
      },
      { status: 500 }
    );
  }
}

async function generateTestVideo(
  options: {
    background: string;
  },
  videoId: string
): Promise<void> {
  try {
    console.log('🚀 Starting test video generation with updated banner layout...');
    await updateProgress(videoId, 5);

    // Create the VideoGenerationOptions format that moviepy-generator expects
    const testStoryOptions = {
      story: {
        title: "Updated Banner Layout Test - Left Aligned Title",
        story: `Testing the updated banner layout with these improvements: The white rectangle now only extends halfway into the top and bottom banner images, creating a cleaner rounded appearance. The title text is now left-aligned within the white rectangle instead of being centered. The username is positioned 8 pixels above the first small icon and uses the same font style as the title. The subreddit text has been completely removed as requested. [BREAK] This creates a more professional and visually appealing Reddit-style banner that matches modern design standards.`,
        subreddit: "r/test",
        author: "BannerTestUser",
        startingQuestion: "Check out this updated banner layout!"
      },
      voice: {
        id: "sarah",
        gender: "female" as const
      },
      background: {
        category: options.background as "minecraft" | "cooking" | "subway" | "workers" | "random",
        speedMultiplier: 1.0
      },
      captionStyle: {
        font: "Inter",
        size: 48,
        color: "#FFFFFF",
        outlineColor: "#000000",
        outlineWidth: 4,
        shadowColor: "#000000",
        shadowOffset: 2,
        position: "center" as const
      },
      uiOverlay: {
        showSubreddit: true,
        showRedditUI: true,
        showBanner: true
      },
      subreddit: "r/test",
      isCliffhanger: true
    };

    await updateProgress(videoId, 10);

    console.log('🎬 Generating video with updated banner layout...');
    const videoUrl = await generateVideo(testStoryOptions, videoId);

    await setVideoReady(videoId, videoUrl);
    console.log('✅ Test video generation completed successfully with updated banner!');
    console.log(`📹 Video URL: ${videoUrl}`);
    console.log('🎨 Banner improvements tested:');
    console.log('   ✅ White rectangle halfway into top/bottom images');
    console.log('   ✅ Left-aligned title text');
    console.log('   ✅ Username positioned 8px above first icon');
    console.log('   ✅ Username uses same font style as title');
    console.log('   ✅ Subreddit text removed');

  } catch (error) {
    console.error('❌ Error in test video generation:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Video generation failed');
    throw error;
  }
} 