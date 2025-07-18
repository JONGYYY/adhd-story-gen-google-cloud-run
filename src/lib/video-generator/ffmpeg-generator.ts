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

// Helper function to create simple captions using FFmpeg
async function createCaptionsWithFFmpeg(
  text: string,
  audioPath: string,
  outputPath: string,
  videoDuration: number
): Promise<void> {
  // Split text into words for simple timing
  const words = text.split(' ');
  const timePerWord = videoDuration / words.length;
  
  // Create a simple subtitle file
  const tmpDir = getTmpDir();
  const subtitlePath = path.join(tmpDir, `subtitles_${Date.now()}.srt`);
  
  let srtContent = '';
  for (let i = 0; i < words.length; i++) {
    const startTime = i * timePerWord;
    const endTime = (i + 1) * timePerWord;
    
    const startSrt = formatTimeForSrt(startTime);
    const endSrt = formatTimeForSrt(endTime);
    
    srtContent += `${i + 1}\n${startSrt} --> ${endSrt}\n${words[i].toUpperCase()}\n\n`;
  }
  
  await fs.writeFile(subtitlePath, srtContent);
  
  // Apply subtitles using FFmpeg
  const ffmpegCommand = `ffmpeg -y -i "${outputPath}" -vf "subtitles='${subtitlePath}':force_style='Fontsize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'" -c:a copy "${outputPath.replace('.mp4', '_with_subs.mp4')}"`;
  
  await execAsync(ffmpegCommand);
  
  // Replace original with subtitled version
  await fs.rename(outputPath.replace('.mp4', '_with_subs.mp4'), outputPath);
  
  // Cleanup
  await fs.unlink(subtitlePath).catch(() => {});
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
    
    console.log('Starting FFmpeg-based video generation...');
    
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

    // 3. Save audio files
    const openingAudioPath = path.join(tmpDir, `opening_${videoId}.mp3`);
    const storyAudioPath = path.join(tmpDir, `story_${videoId}.mp3`);
    
    await fs.writeFile(openingAudioPath, arrayBufferToBuffer(openingAudio));
    await fs.writeFile(storyAudioPath, arrayBufferToBuffer(storyAudio));
    
    // 4. Get audio durations
    const openingDurationCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${openingAudioPath}"`;
    const storyDurationCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${storyAudioPath}"`;
    
    const openingDuration = parseFloat((await execAsync(openingDurationCmd)).stdout.trim());
    const storyDuration = parseFloat((await execAsync(storyDurationCmd)).stdout.trim());
    const totalDuration = openingDuration + storyDuration;
    
    await updateProgress(videoId, 45);

    // 5. Select background video (60%)
    const backgroundPath = path.join(process.cwd(), 'public', 'backgrounds', options.background.category, '1.mp4');
    await updateProgress(videoId, 60);

    // 6. Generate final video using FFmpeg (90%)
    const outputFilename = `output_${videoId}.mp4`;
    const outputPath = path.join(tmpDir, outputFilename);
    
    // Concatenate audio files
    const combinedAudioPath = path.join(tmpDir, `combined_${videoId}.mp3`);
    const concatListPath = path.join(tmpDir, `concat_${videoId}.txt`);
    
    // Create concat file
    const concatContent = `file '${openingAudioPath}'\nfile '${storyAudioPath}'`;
    await fs.writeFile(concatListPath, concatContent);
    
    // Concatenate audio
    await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${combinedAudioPath}"`);
    
    // Create video with background and audio
    const ffmpegCommand = `ffmpeg -y -stream_loop -1 -i "${backgroundPath}" -i "${combinedAudioPath}" -c:v libx264 -c:a aac -shortest -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -r 30 -preset ultrafast "${outputPath}"`;
    
    console.log('Running FFmpeg command:', ffmpegCommand);
    await execAsync(ffmpegCommand);
    
    // Add simple captions
    await createCaptionsWithFFmpeg(story.title + ' ' + storyText, combinedAudioPath, outputPath, totalDuration);
    
    await updateProgress(videoId, 90);

    // 7. Cleanup and set video URL (100%)
    await fs.unlink(openingAudioPath).catch(() => {});
    await fs.unlink(storyAudioPath).catch(() => {});
    await fs.unlink(combinedAudioPath).catch(() => {});
    await fs.unlink(concatListPath).catch(() => {});

    // Set the video URL
    const videoUrl = `/api/videos/${outputFilename}`;
    await setVideoReady(videoId, videoUrl);
    await updateProgress(videoId, 100);

    console.log('FFmpeg video generation completed successfully');
    return videoUrl;
  } catch (error) {
    console.error('Error in FFmpeg video generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await setVideoFailed(videoId, errorMessage);
    throw error;
  }
} 