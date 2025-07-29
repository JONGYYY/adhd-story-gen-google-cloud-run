import { VideoOptions, SubredditStory, VideoSegment, VideoGenerationOptions } from './types';
import { generateSpeech, getAudioDuration } from './voice';
import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { generateBanner } from '../banner-generator';
import { generateVideo as generateMoviePyVideo } from './moviepy-generator';
import { generateVideo as generateNodeVideo } from './node-generator';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Test if Python video generation is available
async function testPythonAvailability(): Promise<boolean> {
  try {
    console.log('Testing Python video generation availability...');
    
    // On Vercel, Python is not available
    if (process.env.VERCEL) {
      console.log('Running on Vercel - Python not available');
      return false;
    }
    
    // On localhost, try to use the venv Python and test for whisper module
    console.log('Running on localhost - checking for Python');
    const { spawn } = require('child_process');
    
    // Use the same Python path as moviepy-generator
    const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3');
    
    return new Promise((resolve) => {
      // Test if Python exists and has whisper module
      const pythonProcess = spawn(pythonPath, ['-c', 'import whisper; print("whisper available")']);
      
      pythonProcess.on('close', (code: number | null) => {
        const available = code === 0;
        console.log(`Python availability check: ${available ? 'available' : 'not available'}`);
        resolve(available);
      });
      
      pythonProcess.on('error', (error: Error) => {
        console.log('Python not available:', error.message);
        resolve(false);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        pythonProcess.kill();
        console.log('Python check timed out');
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.error('Error testing Python availability:', error);
    return false;
  }
}

export async function generateVideo(
  options: VideoGenerationOptions,
  videoId: string
): Promise<string> {
  try {
    console.log('Starting hybrid video generation...');
    
    // First, try to use Python-based video generation
    const pythonAvailable = await testPythonAvailability();
    
    if (pythonAvailable) {
      console.log('Python available - using MoviePy generator for high-quality video');
      try {
        return await generateMoviePyVideo(options, videoId);
      } catch (error) {
        console.error('Python video generation failed, falling back to Node.js:', error);
        // Fall through to Node.js generation
      }
    } else {
      console.log('Python not available - using Node.js generator');
    }
    
    // Fallback to Node.js generator
    return await generateNodeVideo(options, videoId);
    
  } catch (error) {
    console.error('Error in hybrid video generation:', error);
    // Set video status to failed with error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await setVideoFailed(videoId, errorMessage);
    throw error;
  }
} 