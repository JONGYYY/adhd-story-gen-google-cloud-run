import { VideoOptions, SubredditStory, VideoSegment, VideoGenerationOptions } from './types';
import { generateStory } from '../story-generator/openai';
import { generateSpeech, getAudioDuration } from './voice';
import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { generateBanner } from '../banner-generator';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

// Helper function to convert ArrayBuffer to Buffer
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  // Use /tmp for Vercel, os.tmpdir() for local development
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

// Helper function to run Python script
async function runPythonScript(scriptPath: string, args: string[]): Promise<void> {
  // Use different Python paths for local vs Vercel
  const pythonPath = process.env.VERCEL 
    ? 'python3'  // Use system Python on Vercel
    : path.join(process.cwd(), 'venv', 'bin', 'python3'); // Use venv locally
  
  console.log('Using Python path:', pythonPath);
  
  return new Promise((resolve, reject) => {
    // Run Python script
    const pythonProcess = spawn(pythonPath, [scriptPath, ...args]);
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python script failed with code ${code}.\nStdout: ${stdoutData}\nStderr: ${stderrData}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

async function saveBannerToFile(bannerBuffer: Buffer, videoId: string): Promise<string> {
  const tmpDir = getTmpDir();
  await fs.mkdir(tmpDir, { recursive: true });
  const bannerPath = path.join(tmpDir, `banner_${videoId}.png`);
  await fs.writeFile(bannerPath, bannerBuffer);
  return bannerPath;
}

export async function generateVideo(
  options: VideoGenerationOptions,
  videoId: string
): Promise<string> {
  try {
    // Create necessary directories
    const tmpDir = getTmpDir();
    const pythonScriptsDir = path.join(process.cwd(), 'src', 'python');
    
    console.log('Creating directories:', {
      tmpDir,
      pythonScriptsDir
    });
    
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(pythonScriptsDir, { recursive: true });

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

    // 4. Generate banner (45%)
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

    // 5. Select background video (60%)
    const backgroundPath = path.join(process.cwd(), 'public', 'backgrounds', options.background.category, '1.mp4');
    await updateProgress(videoId, 60);

    // 6. Generate final video (90%)
    const outputFilename = `output_${videoId}.mp4`;
    const outputPath = path.join(tmpDir, outputFilename);

    console.log('Running Python script with args:', {
      videoId,
      openingAudioPath,
      storyAudioPath,
      backgroundPath,
      bannerPath,
      outputPath,
      story
    });

    await runPythonScript(path.join(pythonScriptsDir, 'generate_video.py'), [
      videoId,
      openingAudioPath,
      storyAudioPath,
      backgroundPath,
      bannerPath,
      outputPath,
      JSON.stringify(story)
    ]);
    
    await updateProgress(videoId, 90);

    // 7. Cleanup and set video URL (100%)
    await fs.unlink(openingAudioPath).catch(() => {});
    await fs.unlink(storyAudioPath).catch(() => {});
    await fs.unlink(bannerPath).catch(() => {});

    // Set the video URL with the correct format
    const videoUrl = `/api/videos/${outputFilename}`;
    await setVideoReady(videoId, videoUrl);
    await updateProgress(videoId, 100);

    return videoUrl;
  } catch (error) {
    console.error('Error in generateVideo:', error);
    // Set video status to failed with error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await setVideoFailed(videoId, errorMessage);
    throw error;
  }
} 