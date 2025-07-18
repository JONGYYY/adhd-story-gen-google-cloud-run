import { VideoOptions, SubredditStory, VideoGenerationOptions } from './types';
import { generateSpeech } from './voice';
import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { generateBanner } from '../banner-generator';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const execAsync = promisify(exec);

// Set ffmpeg path
if (ffmpegPath) {
  console.log('ffmpeg-static path:', ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
  
  // Don't try to set ffprobe path since we're not using it
  console.log('FFmpeg path configured successfully');
} else {
  console.error('ffmpeg-static path not found!');
}

// Helper function to convert ArrayBuffer to Buffer
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

// Helper function to get audio duration using ffprobe with fallback
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    // First try to get file stats for fallback calculation
    const stats = await fs.stat(audioPath);
    // Rough estimate: 128kbps MP3 = ~16KB per second
    const estimatedDuration = stats.size / (16 * 1024);
    
    console.log(`Using estimated duration: ${estimatedDuration}s for ${path.basename(audioPath)}`);
    return Math.max(estimatedDuration, 1); // Ensure minimum 1 second
  } catch (error) {
    console.warn('Could not estimate audio duration, using default:', error);
    return 10; // Default fallback
  }
}

// Helper function to create simple word-by-word captions
function createWordTimings(text: string, duration: number): Array<{text: string, startTime: number, endTime: number}> {
  const words = text.split(' ').filter(word => word.trim());
  const timePerWord = duration / words.length;
  
  return words.map((word, index) => ({
    text: word.toUpperCase(),
    startTime: index * timePerWord,
    endTime: (index + 1) * timePerWord
  }));
}

// Helper function to create SRT subtitle file
async function createSubtitleFile(
  titleText: string,
  storyText: string,
  titleDuration: number,
  storyDuration: number,
  outputPath: string
): Promise<void> {
  const titleTimings = createWordTimings(titleText, titleDuration);
  const storyTimings = createWordTimings(storyText, storyDuration);
  
  // Offset story timings by title duration
  const offsetStoryTimings = storyTimings.map(timing => ({
    ...timing,
    startTime: timing.startTime + titleDuration,
    endTime: timing.endTime + titleDuration
  }));
  
  const allTimings = [...titleTimings, ...offsetStoryTimings];
  
  let srtContent = '';
  allTimings.forEach((timing, index) => {
    const startTime = formatTimeForSrt(timing.startTime);
    const endTime = formatTimeForSrt(timing.endTime);
    srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${timing.text}\n\n`;
  });
  
  await fs.writeFile(outputPath, srtContent);
}

function formatTimeForSrt(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

export async function generateVideo(
  options: VideoGenerationOptions,
  videoId: string
): Promise<string> {
  try {
    const tmpDir = getTmpDir();
    await fs.mkdir(tmpDir, { recursive: true });
    
    console.log('Starting Node.js-based video generation (recreating MoviePy functionality)...');
    console.log('Environment:', process.env.VERCEL ? 'Vercel' : 'Local');
    console.log('FFmpeg path from ffmpeg-static:', ffmpegPath);
    console.log('Temp directory:', tmpDir);
    
    // Test if ffmpeg binary exists and is executable
    if (ffmpegPath) {
      try {
        await fs.access(ffmpegPath);
        console.log('FFmpeg binary exists and is accessible');
      } catch (err) {
        console.error('FFmpeg binary not accessible:', err);
        throw new Error(`FFmpeg binary not accessible: ${ffmpegPath}`);
      }
    } else {
      throw new Error('FFmpeg path not found from ffmpeg-static');
    }
    
    // 1. Story is already provided (10%)
    await updateProgress(videoId, 0);
    const story = options.story;
    await updateProgress(videoId, 10);

    // 2. Generate speech for opening and story (35%)
    const openingAudio = await generateSpeech({
      text: story.startingQuestion || story.title,
      voice: options.voice,
    });
    await updateProgress(videoId, 25);

    const storyText = options.isCliffhanger && story.story.includes('[BREAK]')
      ? story.story.split('[BREAK]')[0].trim()
      : story.story;

    const storyAudio = await generateSpeech({
      text: storyText,
      voice: options.voice,
    });
    await updateProgress(videoId, 35);

    // 3. Save audio files
    const openingAudioPath = path.join(tmpDir, `opening_${videoId}.mp3`);
    const storyAudioPath = path.join(tmpDir, `story_${videoId}.mp3`);
    
    await fs.writeFile(openingAudioPath, arrayBufferToBuffer(openingAudio));
    await fs.writeFile(storyAudioPath, arrayBufferToBuffer(storyAudio));

    // 4. Get audio durations
    const openingDuration = await getAudioDuration(openingAudioPath);
    const storyDuration = await getAudioDuration(storyAudioPath);
    const totalDuration = openingDuration + storyDuration;

    console.log(`Audio durations: opening=${openingDuration}s, story=${storyDuration}s, total=${totalDuration}s`);

    // 5. Generate banner (45%)
    const bannerBuffer = await generateBanner({
      title: story.title,
      author: story.author || 'Anonymous',
      subreddit: story.subreddit,
      upvotes: 99,
      comments: 99,
      awards: ['Helpful', 'Wholesome', 'Silver']
    });
    const bannerPath = path.join(tmpDir, `banner_${videoId}.png`);
    await fs.writeFile(bannerPath, bannerBuffer);
    await updateProgress(videoId, 45);

    // 6. Concatenate audio files
    const combinedAudioPath = path.join(tmpDir, `combined_${videoId}.mp3`);
    
    // Create a simple concatenation using direct buffer combination
    const openingBuffer = await fs.readFile(openingAudioPath);
    const storyBuffer = await fs.readFile(storyAudioPath);
    
    // For MP3, we can simply concatenate the buffers (this is a simplified approach)
    const combinedBuffer = Buffer.concat([openingBuffer, storyBuffer]);
    await fs.writeFile(combinedAudioPath, combinedBuffer);
    
    console.log('Audio files concatenated successfully');

    await updateProgress(videoId, 60);

    // 7. Create subtitle file
    const subtitlePath = path.join(tmpDir, `subtitles_${videoId}.srt`);
    await createSubtitleFile(
      story.title,
      storyText,
      openingDuration,
      storyDuration,
      subtitlePath
    );

    // 8. Process background video and create final video (90%)
    const backgroundPath = path.join(process.cwd(), 'public', 'backgrounds', options.background.category, '1.mp4');
    const outputFilename = `output_${videoId}.mp4`;
    const outputPath = path.join(tmpDir, outputFilename);

    console.log('Background video path:', backgroundPath);
    console.log('Combined audio path:', combinedAudioPath);
    console.log('Subtitle path:', subtitlePath);
    console.log('Output path:', outputPath);

    // Check if background video exists
    try {
      await fs.access(backgroundPath);
      console.log('Background video exists');
    } catch (err) {
      console.error('Background video not found:', backgroundPath);
      throw new Error(`Background video not found: ${backgroundPath}`);
    }

    // Create the final video with background, audio, and subtitles
    console.log('Creating video using direct ffmpeg execution...');
    
    const ffmpegArgs = [
      '-stream_loop', '-1',
      '-i', backgroundPath,
      '-i', combinedAudioPath,
      '-vf', [
        'scale=1080:1920:force_original_aspect_ratio=decrease',
        'pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        `subtitles=${subtitlePath}:force_style='Fontsize=72,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=4,Shadow=2'`
      ].join(','),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      '-r', '30',
      '-preset', 'medium',
      '-crf', '22',
      '-movflags', '+faststart',
      '-y', // Overwrite output file
      outputPath
    ];
    
    console.log('FFmpeg command:', ffmpegPath, ffmpegArgs.join(' '));
    
    try {
      const { stdout, stderr } = await execAsync(`"${ffmpegPath}" ${ffmpegArgs.map(arg => `"${arg}"`).join(' ')}`);
      console.log('FFmpeg stdout:', stdout);
      if (stderr) console.log('FFmpeg stderr:', stderr);
      console.log('Video generation completed successfully');
    } catch (error) {
      console.error('FFmpeg execution failed:', error);
      throw error;
    }
    
    await updateProgress(videoId, 90);

    // 9. Cleanup and set video URL (100%)
    await fs.unlink(openingAudioPath).catch(() => {});
    await fs.unlink(storyAudioPath).catch(() => {});
    await fs.unlink(combinedAudioPath).catch(() => {});
    await fs.unlink(bannerPath).catch(() => {});
    await fs.unlink(subtitlePath).catch(() => {});

    // Set the video URL
    const videoUrl = `/api/videos/${outputFilename}`;
    await setVideoReady(videoId, videoUrl);
    await updateProgress(videoId, 100);

    console.log('Node.js video generation completed successfully');
    return videoUrl;
  } catch (error) {
    console.error('Error in Node.js video generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await setVideoFailed(videoId, errorMessage);
    throw error;
  }
} 