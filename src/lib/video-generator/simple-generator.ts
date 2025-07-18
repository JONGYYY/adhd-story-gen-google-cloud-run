import { VideoOptions, SubredditStory, VideoGenerationOptions } from './types';
import { generateSpeech } from './voice';
import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { generateBanner } from '../banner-generator';
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

// Helper function to estimate audio duration from file size
function estimateAudioDuration(fileSizeBytes: number): number {
  // Rough estimate: 128kbps MP3 = ~16KB per second
  return Math.max(fileSizeBytes / (16 * 1024), 1);
}

// Helper function to create simple SRT subtitles
function createSimpleSubtitles(text: string, duration: number): string {
  const words = text.split(' ').filter(word => word.trim());
  const timePerWord = duration / words.length;
  
  let srtContent = '';
  words.forEach((word, index) => {
    const startTime = index * timePerWord;
    const endTime = (index + 1) * timePerWord;
    
    const startTimeFormatted = formatTimeForSrt(startTime);
    const endTimeFormatted = formatTimeForSrt(endTime);
    
    srtContent += `${index + 1}\n`;
    srtContent += `${startTimeFormatted} --> ${endTimeFormatted}\n`;
    srtContent += `${word.toUpperCase()}\n\n`;
  });
  
  return srtContent;
}

function formatTimeForSrt(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Helper function to create a simple HTML video player with audio and subtitles
function createVideoHTML(audioUrl: string, subtitlesContent: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Arial', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .video-container {
            background: rgba(0, 0, 0, 0.8);
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        .title {
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .audio-player {
            width: 100%;
            margin-bottom: 30px;
        }
        .subtitles {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 20px;
            max-height: 200px;
            overflow-y: auto;
            color: white;
            font-size: 16px;
            line-height: 1.6;
            text-align: left;
        }
        .subtitle-line {
            margin-bottom: 10px;
            padding: 5px 10px;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.1);
        }
        .download-link {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .download-link:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="video-container">
        <div class="title">${title}</div>
        <audio controls class="audio-player">
            <source src="${audioUrl}" type="audio/mpeg">
            Your browser does not support the audio element.
        </audio>
        <div class="subtitles">
            <div class="subtitle-line">🎧 Play the audio above to hear the story</div>
            <div class="subtitle-line">📝 Subtitles will be displayed here when we add video support</div>
        </div>
        <a href="${audioUrl}" download class="download-link">Download Audio</a>
    </div>
</body>
</html>
  `;
}

export async function generateVideo(
  options: VideoGenerationOptions,
  videoId: string
): Promise<string> {
  try {
    const tmpDir = getTmpDir();
    await fs.mkdir(tmpDir, { recursive: true });
    
    console.log('Starting enhanced audio generation with preview...');
    console.log('Environment:', process.env.VERCEL ? 'Vercel' : 'Local');
    console.log('Temp directory:', tmpDir);
    
    // 1. Story is already provided (10%)
    await updateProgress(videoId, 0);
    const story = options.story;
    await updateProgress(videoId, 10);

    // 2. Generate speech for opening and story (40%)
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
    await updateProgress(videoId, 40);

    // 3. Save audio files and combine them
    const openingAudioPath = path.join(tmpDir, `opening_${videoId}.mp3`);
    const storyAudioPath = path.join(tmpDir, `story_${videoId}.mp3`);
    const combinedAudioPath = path.join(tmpDir, `combined_${videoId}.mp3`);
    
    await fs.writeFile(openingAudioPath, arrayBufferToBuffer(openingAudio));
    await fs.writeFile(storyAudioPath, arrayBufferToBuffer(storyAudio));

    // Simple audio concatenation by combining buffers
    const openingBuffer = await fs.readFile(openingAudioPath);
    const storyBuffer = await fs.readFile(storyAudioPath);
    const combinedBuffer = Buffer.concat([openingBuffer, storyBuffer]);
    await fs.writeFile(combinedAudioPath, combinedBuffer);
    
    await updateProgress(videoId, 60);

    // 4. Estimate durations and create subtitles
    const openingStats = await fs.stat(openingAudioPath);
    const storyStats = await fs.stat(storyAudioPath);
    const openingDuration = estimateAudioDuration(openingStats.size);
    const storyDuration = estimateAudioDuration(storyStats.size);
    const totalDuration = openingDuration + storyDuration;

    console.log(`Estimated durations: opening=${openingDuration}s, story=${storyDuration}s, total=${totalDuration}s`);

    // Create combined subtitles
    const titleSubs = createSimpleSubtitles(story.title, openingDuration);
    const storySubs = createSimpleSubtitles(storyText, storyDuration);
    
    // Offset story subtitles by opening duration
    const storySubsOffset = storySubs.split('\n\n').map((sub, index) => {
      if (sub.trim()) {
        const lines = sub.split('\n');
        if (lines.length >= 2) {
          const timeLine = lines[1];
          const [startTime, endTime] = timeLine.split(' --> ');
          const newStartTime = addTimeOffset(startTime, openingDuration);
          const newEndTime = addTimeOffset(endTime, openingDuration);
          lines[1] = `${newStartTime} --> ${newEndTime}`;
          // Update subtitle number
          lines[0] = (titleSubs.split('\n\n').length + index).toString();
        }
        return lines.join('\n');
      }
      return sub;
    }).join('\n\n');
    
    const combinedSubs = titleSubs + storySubsOffset;
    const subtitlePath = path.join(tmpDir, `subtitles_${videoId}.srt`);
    await fs.writeFile(subtitlePath, combinedSubs);

    await updateProgress(videoId, 80);

    // 5. Create an HTML video player with the audio and subtitles
    const audioFilename = `audio_${videoId}.mp3`;
    const audioPath = path.join(tmpDir, audioFilename);
    const htmlFilename = `video_${videoId}.html`;
    const htmlPath = path.join(tmpDir, htmlFilename);
    
    // Copy the combined audio as our audio file
    await fs.copyFile(combinedAudioPath, audioPath);
    
    // Create HTML video player
    const audioUrl = `/api/videos/${audioFilename}`;
    const htmlContent = createVideoHTML(audioUrl, combinedSubs, story.title);
    await fs.writeFile(htmlPath, htmlContent);
    
    await updateProgress(videoId, 90);

    // 6. Cleanup
    await fs.unlink(openingAudioPath).catch(() => {});
    await fs.unlink(storyAudioPath).catch(() => {});
    await fs.unlink(combinedAudioPath).catch(() => {});
    await fs.unlink(subtitlePath).catch(() => {});

    // Set the video URL (pointing to the HTML player)
    const videoUrl = `/api/videos/${htmlFilename}`;
    await setVideoReady(videoId, videoUrl);
    await updateProgress(videoId, 100);

    console.log('Enhanced audio generation with preview completed successfully');
    return videoUrl;
  } catch (error) {
    console.error('Error in enhanced audio generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await setVideoFailed(videoId, errorMessage);
    throw error;
  }
}

function addTimeOffset(timeString: string, offsetSeconds: number): string {
  const [time, ms] = timeString.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + offsetSeconds;
  const newHours = Math.floor(totalSeconds / 3600);
  const newMinutes = Math.floor((totalSeconds % 3600) / 60);
  const newSeconds = Math.floor(totalSeconds % 60);
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')},${ms}`;
} 