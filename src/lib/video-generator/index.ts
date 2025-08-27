import { VideoOptions, SubredditStory, VideoSegment, VideoMetadata, VideoGenerationOptions } from './types';
import { generateStory } from '../story-generator/openai';
import { selectBackgroundClips, processBackgroundClip } from './background';
import { generateSpeech, getAudioDuration } from './voice';
import { generateTimedSegments, generateAssFile, generateBannerOverlay } from './subtitles';
import { updateProgress } from './status';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
// Use the new hybrid generator (pluggable engines)
import { generateVideo as generateHybridVideo } from './new-hybrid-generator';
import { generateVideoWithRemotion } from './remotion-entry';

const execAsync = promisify(exec);

// Helper function to convert ArrayBuffer to Buffer
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Helper function to split text into caption segments
function splitIntoSegments(text: string): string[] {
  // Split by punctuation and spaces
  return text
    .split(/([,.!?]|\s+)/)
    .filter(segment => segment.trim().length > 0)
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);
}

export { generateVideo as generateMoviePyVideo } from './moviepy-generator';
export { generateVideo as generateHybridVideoLegacy } from './hybrid-generator';

export async function generateVideo(options: VideoOptions, videoId: string): Promise<string> {
  // Generate or use custom story
  let story: SubredditStory;
  if (options.customStory) {
    story = {
      title: options.customStory.title,
      story: options.customStory.story,
      subreddit: options.customStory.subreddit || options.subreddit,
      author: 'Anonymous', // Add the required author field
    };
  } else {
    story = await generateStory({
      subreddit: options.subreddit,
      isCliffhanger: options.isCliffhanger,
      narratorGender: options.voice.gender,
    });
  }

  const generationOptions: VideoGenerationOptions = {
    ...options,
    story,
  };

  // Feature flag: prefer Remotion pipeline when enabled
  if ((process.env.REMOTION_ENABLED || '').toLowerCase() === 'true') {
    console.log(`[gen ${videoId}] REMOTION_ENABLED=true -> using Remotion pipeline`);
    return await generateVideoWithRemotion(generationOptions as any, videoId);
  }

  // Use the new hybrid generator with MoviePy engine and fallbacks
  console.log(`[gen ${videoId}] REMOTION_ENABLED!=true -> using Hybrid(MoviePy) pipeline`);
  return generateHybridVideo(generationOptions as any, videoId);
} 