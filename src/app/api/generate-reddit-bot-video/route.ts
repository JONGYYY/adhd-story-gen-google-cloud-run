import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/video-generator/voice';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Helper function to convert ArrayBuffer to Buffer
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

// Helper function to run Python script
async function runPythonScript(scriptPath: string, args: string[]): Promise<void> {
  const pythonPath = process.env.VERCEL 
    ? 'python3'  // Use system Python on Vercel
    : path.join(process.cwd(), 'venv', 'bin', 'python3'); // Use venv locally
  
  console.log('Using Python path:', pythonPath);
  
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonPath, [scriptPath, ...args]);
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`Reddit Bot Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Reddit Bot Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Reddit Bot Python script failed with code ${code}.\nStdout: ${stdoutData}\nStderr: ${stderrData}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Reddit Bot Python process: ${err.message}`));
    });
  });
}

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    const body = await request.json();
    console.log('Received Reddit Bot video generation request:', body);

    const { subreddit, title, story, voice, background } = body;

    if (!title || !story) {
      return NextResponse.json(
        { success: false, error: 'Title and story are required' },
        { status: 400 }
      );
    }

    // Set initial status
    await setVideoGenerating(videoId);

    // Start async video generation
    generateRedditBotVideo({
      subreddit: subreddit || 'r/test',
      title,
      story,
      voice: voice || 'adam',
      background: background || 'minecraft'
    }, videoId).catch(async (error) => {
      console.error('Reddit Bot video generation failed:', error);
      await setVideoFailed(videoId, error.message);
    });

    return NextResponse.json({
      success: true,
      videoId,
      message: 'Reddit Bot video generation started'
    });

  } catch (error) {
    console.error('Error in Reddit Bot video generation API:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateRedditBotVideo(
  options: {
    subreddit: string;
    title: string;
    story: string;
    voice: string;
    background: string;
  },
  videoId: string
): Promise<void> {
  try {
    console.log('🤖 Starting Reddit Bot video generation...');
    await updateProgress(videoId, 5);

    // Create necessary directories
    const tmpDir = getTmpDir();
    await fs.mkdir(tmpDir, { recursive: true });

    // Generate speech for title and story (25%)
    console.log('🎙️ Generating speech...');
    const titleAudio = await generateSpeech({
      text: options.title,
      voice: { id: options.voice, gender: options.voice === 'rachel' || options.voice === 'bella' ? 'female' : 'male' },
    });
    await updateProgress(videoId, 15);

    const storyText = options.story.includes('[BREAK]') 
      ? options.story.split('[BREAK]')[0].trim()
      : options.story;

    const storyAudio = await generateSpeech({
      text: storyText,
      voice: { id: options.voice, gender: options.voice === 'rachel' || options.voice === 'bella' ? 'female' : 'male' },
    });
    await updateProgress(videoId, 25);

    // Save audio files
    const titleAudioPath = path.join(tmpDir, `reddit_bot_title_${videoId}.mp3`);
    const storyAudioPath = path.join(tmpDir, `reddit_bot_story_${videoId}.mp3`);
    
    await fs.writeFile(titleAudioPath, arrayBufferToBuffer(titleAudio));
    await fs.writeFile(storyAudioPath, arrayBufferToBuffer(storyAudio));

    await updateProgress(videoId, 35);

    // Select background video (45%)
    const backgroundPath = path.join(process.cwd(), 'public', 'backgrounds', options.background, '1.mp4');
    await updateProgress(videoId, 45);

    // Generate video using Reddit Bot Python script (85%)
    console.log('🎬 Generating video with Reddit Bot Python script...');
    const outputPath = path.join(tmpDir, `reddit_bot_output_${videoId}.mp4`);
    
    const pythonScriptPath = path.join(process.cwd(), 'src', 'python', 'reddit_bot_generator.py');
    
    const storyData = {
      title: options.title,
      story: options.story,
      subreddit: options.subreddit,
      author: 'Anonymous'
    };

    const pythonArgs = [
      videoId,
      titleAudioPath,
      storyAudioPath,
      backgroundPath,
      '', // Banner path (not used)
      outputPath,
      JSON.stringify(storyData)
    ];

    console.log('Running Reddit Bot Python script...');
    await runPythonScript(pythonScriptPath, pythonArgs);
    
    await updateProgress(videoId, 90);

    // Cleanup audio files
    await fs.unlink(titleAudioPath).catch(() => {});
    await fs.unlink(storyAudioPath).catch(() => {});

    // Set video ready
    const outputFilename = `reddit_bot_output_${videoId}.mp4`;
    const videoUrl = `/api/videos/${outputFilename}`;
    await setVideoReady(videoId, videoUrl);
    await updateProgress(videoId, 100);

    console.log('✅ Reddit Bot video generation completed successfully!');

  } catch (error) {
    console.error('❌ Error in Reddit Bot video generation:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error occurred');
    throw error;
  }
} 