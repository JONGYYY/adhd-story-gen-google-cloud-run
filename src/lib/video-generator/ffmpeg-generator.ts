import { VideoOptions, SubredditStory, VideoGenerationOptions } from './types';
import { generateSpeech } from './voice';
import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

// Helper function to convert ArrayBuffer to Buffer
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

// Simple audio duration calculation by reading MP3 header
function getMP3Duration(buffer: Buffer): number {
  // This is a simplified approach - for production, you'd want a proper MP3 parser
  // For now, we'll estimate based on file size and bitrate
  // Average MP3 bitrate is around 128kbps
  const fileSizeInBytes = buffer.length;
  const estimatedBitrate = 128 * 1000; // 128 kbps in bits per second
  const durationInSeconds = (fileSizeInBytes * 8) / estimatedBitrate;
  return durationInSeconds;
}

export async function generateVideo(
  options: VideoGenerationOptions,
  videoId: string
): Promise<string> {
  try {
    const tmpDir = getTmpDir();
    await fs.mkdir(tmpDir, { recursive: true });
    
    console.log('Starting simplified video generation...');
    
    // 1. Story is already provided (10%)
    await updateProgress(videoId, 0);
    const story = options.story;
    await updateProgress(videoId, 10);

    // 2. Generate speech for opening and story (35%)
    const openingAudio = await generateSpeech({
      text: story.title,
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

    // 3. Save audio files and estimate durations
    const openingAudioPath = path.join(tmpDir, `opening_${videoId}.mp3`);
    const storyAudioPath = path.join(tmpDir, `story_${videoId}.mp3`);
    
    const openingBuffer = arrayBufferToBuffer(openingAudio);
    const storyBuffer = arrayBufferToBuffer(storyAudio);
    
    await fs.writeFile(openingAudioPath, openingBuffer);
    await fs.writeFile(storyAudioPath, storyBuffer);
    
    // Estimate durations (simplified approach)
    const openingDuration = getMP3Duration(openingBuffer);
    const storyDuration = getMP3Duration(storyBuffer);
    const totalDuration = openingDuration + storyDuration;
    
    console.log(`Estimated durations: opening=${openingDuration}s, story=${storyDuration}s, total=${totalDuration}s`);
    
    await updateProgress(videoId, 45);

    // 4. Create a combined audio file by concatenating buffers
    const combinedAudioPath = path.join(tmpDir, `combined_${videoId}.mp3`);
    
    // Simple concatenation - just append the buffers (this is a simplified approach)
    const combinedBuffer = Buffer.concat([openingBuffer, storyBuffer]);
    await fs.writeFile(combinedAudioPath, combinedBuffer);
    
    await updateProgress(videoId, 60);

    // 5. For now, create a simple video response without complex processing
    // Since we can't use FFmpeg on Vercel, we'll create a minimal video file
    // that can be processed client-side or use a different approach
    
    const outputFilename = `output_${videoId}.mp4`;
    const outputPath = path.join(tmpDir, outputFilename);
    
    // Create a basic MP4 container with just the audio
    // This is a simplified approach - in production you'd want proper video encoding
    try {
      // Try to use ffmpeg-static if available (it might be bundled)
      const ffmpegPath = require('ffmpeg-static');
      if (ffmpegPath) {
        const backgroundPath = path.join(process.cwd(), 'public', 'backgrounds', options.background.category, '1.mp4');
        
        // Use ffmpeg-static for video processing
        const ffmpegCommand = `"${ffmpegPath}" -y -stream_loop -1 -i "${backgroundPath}" -i "${combinedAudioPath}" -c:v libx264 -c:a aac -shortest -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -r 30 -preset ultrafast -t ${Math.ceil(totalDuration)} "${outputPath}"`;
        
        console.log('Using ffmpeg-static:', ffmpegCommand);
        await execAsync(ffmpegCommand);
      } else {
        throw new Error('ffmpeg-static not available');
      }
    } catch (error) {
      console.log('FFmpeg not available, creating audio-only response:', error);
      
      // Fallback: Just copy the audio file as the "video" output
      // The client can handle this appropriately
      await fs.copyFile(combinedAudioPath, outputPath.replace('.mp4', '.mp3'));
      
      // Update the filename to reflect it's audio-only
      const audioFilename = `output_${videoId}.mp3`;
      const audioPath = path.join(tmpDir, audioFilename);
      await fs.rename(outputPath.replace('.mp4', '.mp3'), audioPath);
      
      // Set the video URL to point to the audio file
      const videoUrl = `/api/videos/${audioFilename}`;
      await setVideoReady(videoId, videoUrl);
      await updateProgress(videoId, 100);
      
      console.log('Created audio-only output');
      return videoUrl;
    }
    
    await updateProgress(videoId, 90);

    // 6. Cleanup and set video URL (100%)
    await fs.unlink(openingAudioPath).catch(() => {});
    await fs.unlink(storyAudioPath).catch(() => {});
    await fs.unlink(combinedAudioPath).catch(() => {});

    // Set the video URL
    const videoUrl = `/api/videos/${outputFilename}`;
    await setVideoReady(videoId, videoUrl);
    await updateProgress(videoId, 100);

    console.log('Video generation completed successfully');
    return videoUrl;
  } catch (error) {
    console.error('Error in video generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await setVideoFailed(videoId, errorMessage);
    throw error;
  }
} 