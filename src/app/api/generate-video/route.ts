import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateVideo } from '@/lib/video-generator';
import { VideoOptions, SubredditStory, VideoGenerationOptions } from '@/lib/video-generator/types';
import { generateStory } from '@/lib/story-generator/openai';
import { createVideoStatus, setVideoReady, setVideoFailed, updateVideoStatus } from '@/lib/video-generator/status';

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    const options: VideoOptions = await request.json();
    console.log('Received video generation request with options:', JSON.stringify(options, null, 2));

    // Initialize video status
    await createVideoStatus(videoId);

    // Generate or use custom story
    let story: SubredditStory;
    if (options.customStory) {
      console.log('Using custom story:', JSON.stringify(options.customStory, null, 2));
      story = {
        title: options.customStory.title,
        story: options.customStory.story,
        subreddit: options.customStory.subreddit || 'r/stories',
        author: 'Anonymous',
      };
    } else {
      // Ensure subreddit has r/ prefix
      const subreddit = options.subreddit.startsWith('r/') ? options.subreddit : `r/${options.subreddit}`;
      console.log('Normalized subreddit:', subreddit);
      
      const storyParams = {
        subreddit,
        isCliffhanger: options.isCliffhanger,
        narratorGender: options.voice.gender,
      };
      console.log('Generating story with params:', JSON.stringify(storyParams, null, 2));
      story = await generateStory(storyParams);
    }

    // Log story data before validation
    console.log('Story data before validation:', JSON.stringify(story, null, 2));

    // Validate story data
    if (!story.title || !story.story) {
      console.error('Invalid story data:', JSON.stringify(story, null, 2));
      throw new Error('Story is missing required fields (title or story content)');
    }

    // Update status with title and description
    await updateVideoStatus(videoId, {
      title: story.title,
      description: story.story
    });

    // Generate video
    const generationOptions: VideoGenerationOptions = {
      ...options,
      story,
    };

    const videoUrl = await generateVideo(generationOptions, videoId);
    await setVideoReady(videoId, videoUrl);

    return NextResponse.json({
      success: true,
      videoId,
      title: story.title,
      description: story.story
    });
  } catch (error) {
    console.error('Video generation error:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error occurred');
    return NextResponse.json(
      { error: 'Failed to generate video' },
      { status: 500 }
    );
  }
} 