import { VideoSegment } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Helper function to convert seconds to SRT time format
function secondsToSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Generate SRT file from segments
export async function generateSrtFile(segments: VideoSegment[], outputPath: string): Promise<string> {
  let srtContent = '';
  
  segments.forEach((segment, index) => {
    srtContent += `${index + 1}\n`;
    srtContent += `${secondsToSrtTime(segment.startTime)} --> ${secondsToSrtTime(segment.endTime)}\n`;
    srtContent += `${segment.text}\n\n`;
  });

  await fs.writeFile(outputPath, srtContent);
  return outputPath;
}

// Generate ASS file with styled captions
export async function generateAssFile(
  segments: VideoSegment[],
  outputPath: string,
  videoWidth: number = 1080,
  videoHeight: number = 1920
): Promise<string> {
  const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,84,&H00FFFFFF,&H000000FF,&H00000000,&HFFFFFFFF,-1,0,0,0,100,100,0,0,3,4,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines = segments.map(segment => {
    const startTime = secondsToSrtTime(segment.startTime).replace(',', '.');
    const endTime = secondsToSrtTime(segment.endTime).replace(',', '.');
    // Add white background box and center alignment (2 = centered both vertically and horizontally)
    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,{\\blur0.6\\bord4\\shad0\\3c&H000000&\\c&HFFFFFF&}${segment.text}`;
  }).join('\n');

  await fs.writeFile(outputPath, assContent + dialogueLines);
  return outputPath;
}

// Split text into segments with timing
export async function generateTimedSegments(
  text: string,
  audioPath: string,
  tmpDir: string
): Promise<VideoSegment[]> {
  // Split text into words/phrases
  const words = text.split(/\s+/);
  const segments: VideoSegment[] = [];
  
  // Get audio duration
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
  );
  const totalDuration = parseFloat(stdout);
  
  // Estimate timing for each word/phrase
  const avgWordDuration = totalDuration / words.length;
  let currentTime = 0;
  
  // Process one or two words at a time with mandatory gaps
  for (let i = 0; i < words.length; i += 2) {
    const phrase = words.slice(i, Math.min(i + 2, words.length)).join(' ');
    const wordCount = phrase.split(/\s+/).length;
    const duration = avgWordDuration * wordCount;
    
    // Add a mandatory gap between segments (150ms)
    const gap = 0.15;
    
    segments.push({
      text: phrase,
      startTime: currentTime,
      endTime: currentTime + duration - gap
    });
    
    // Move time cursor forward including the gap
    currentTime += duration;
  }
  
  return segments;
}

// Generate banner overlay
export async function generateBannerOverlay(
  story: { title: string; author?: string; subreddit: string },
  outputPath: string,
  duration: number = 5
): Promise<string> {
  // Calculate dimensions for the box (2/3 width, 1/4 height)
  const boxWidth = Math.floor(1080 * (2/3));  // 2/3 of width
  const boxHeight = Math.floor(1920 * (1/4)); // 1/4 of height
  const boxX = Math.floor((1080 - boxWidth) / 2);
  const boxY = Math.floor((1920 - boxHeight) / 2);

  // Create a transparent background with a white box
  const ffmpegCommand = `ffmpeg -y -f lavfi -i color=c=white@0:s=1080x1920 -filter_complex "
    color=c=white:s=${boxWidth}x${boxHeight}[box];
    [0:v][box]overlay=x=${boxX}:y=${boxY}[base];
    [base]drawtext=
      text='u/${story.author || 'Anonymous'}':
      fontfile=/System/Library/Fonts/Helvetica.ttc:
      fontsize=36:
      fontcolor=black:
      x=${boxX + 50}:
      y=${boxY + 50},
    drawtext=
      text='${story.title.replace(/'/g, "'\\\\''")}':
      fontfile=/System/Library/Fonts/Helvetica.ttc:
      fontsize=48:
      fontcolor=black:
      x=(w-text_w)/2:
      y=${boxY + boxHeight/2}
  " -t ${duration} "${outputPath}"`;

  await execAsync(ffmpegCommand);
  return outputPath;
} 