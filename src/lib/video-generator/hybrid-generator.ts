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
    
    // Test the Python function
    const response = await fetch('/api/generate-video-python', {
      method: 'GET',
    });
    
    if (!response.ok) {
      console.log('Python function not available:', response.status);
      return false;
    }
    
    const data = await response.json();
    console.log('Python function response:', data);
    
    return data.success && data.dependencies_available;
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