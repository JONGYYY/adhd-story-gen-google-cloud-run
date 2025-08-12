import { VideoGenerationOptions } from './types';
import { generateSpeech, getAudioDuration } from './voice';
import { updateProgress } from './status';
import { generateBanner } from '../banner-generator';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { spawn } from 'child_process';

interface WordTimestamp {
  text: string;
  start: number;
  end: number;
  emphasis?: boolean;
}

// Efficient video generator inspired by FullyAutomatedRedditVideoMakerBot
export async function generateVideo(
  options: VideoGenerationOptions,
  videoId: string
): Promise<string> {
  const tempFiles: string[] = [];

  try {
    console.log('🎬 Starting efficient video generation...');
    await updateProgress(videoId, 5);

    // Create temp directory
    const tmpDir = os.tmpdir();
    const workingDir = path.join(tmpDir, `efficient_video_${videoId}`);
    await fs.mkdir(workingDir, { recursive: true });

    // Generate speech with precise timing
    console.log('🎙️ Generating speech...');
    const openingText = `${options.story.title}`;
    const storyText = options.story.story.split('[BREAK]')[0].trim();

    const openingAudio = await generateSpeech({
      text: openingText,
      voice: options.voice,
    });

    const storyAudio = await generateSpeech({
      text: storyText,
      voice: options.voice,
    });

    // Save audio files
    const openingAudioPath = path.join(workingDir, 'opening.mp3');
    const storyAudioPath = path.join(workingDir, 'story.mp3');
    
    await fs.writeFile(openingAudioPath, Buffer.from(openingAudio));
    await fs.writeFile(storyAudioPath, Buffer.from(storyAudio));

    tempFiles.push(openingAudioPath, storyAudioPath);

    const openingDuration = await getAudioDuration(openingAudio);
    const storyDuration = await getAudioDuration(storyAudio);

    await updateProgress(videoId, 25);

    // Generate dynamic banner
    console.log('🎨 Creating dynamic banner...');
    const bannerImagePath = path.join(workingDir, 'banner.png');
    
    try {
      await generateBanner({
        story: options.story,
        upvotes: Math.floor(Math.random() * 500 + 100),
        comments: Math.floor(Math.random() * 100 + 20),
      }, bannerImagePath);
      console.log('✅ Dynamic banner generated successfully');
    } catch (error) {
      console.log('⚠️ Dynamic banner failed, creating simple fallback');
      // Create a simple colored banner as fallback
      const { createCanvas } = await import('canvas');
      const canvas = createCanvas(800, 200);
      const ctx = canvas.getContext('2d');
      
      // Orange background
      ctx.fillStyle = '#FF4500';
      ctx.fillRect(0, 0, 800, 200);
      
      // White text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(options.story.title, 400, 100);
      
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(bannerImagePath, buffer);
    }
    
    tempFiles.push(bannerImagePath);
    await updateProgress(videoId, 40);

    // Get word timestamps using simple approach
    console.log('⏱️ Getting word timestamps...');
    const wordTimestamps = await getWordTimestamps(storyAudioPath, storyText);
    await updateProgress(videoId, 60);

    // Generate final video with efficient FFmpeg composition
    console.log('🎬 Composing final video...');
    const outputPath = path.join(tmpDir, `efficient_output_${videoId}.mp4`);
    await composeEfficientVideo(
      bannerImagePath,
      openingAudioPath,
      storyAudioPath,
      options.background.category,
      outputPath,
      openingDuration,
      storyDuration,
      wordTimestamps
    );

    await updateProgress(videoId, 100);

    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`Failed to cleanup temp file: ${file}`);
      }
    }

    try {
      await fs.rmdir(workingDir);
    } catch (error) {
      console.warn(`Failed to cleanup working directory: ${workingDir}`);
    }

    console.log('✅ Efficient video generation completed!');
    return outputPath;

  } catch (error) {
    console.error('❌ Error in efficient video generation:', error);
    
    // Cleanup on error
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (e) {
        console.warn(`Failed to cleanup temp file: ${e}`);
      }
    }

    throw error;
  }
}

// Get word timestamps using a simplified approach (similar to FullyAutomatedRedditVideoMakerBot)
async function getWordTimestamps(audioPath: string, text: string): Promise<WordTimestamp[]> {
  try {
    // For now, use a simple word-splitting approach with estimated timing
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const totalDuration = await getAudioDurationFromFile(audioPath);
    
    const wordTimestamps: WordTimestamp[] = [];
    const avgWordDuration = totalDuration / words.length;
    
    for (let i = 0; i < words.length; i++) {
      const start = i * avgWordDuration;
      const end = (i + 1) * avgWordDuration;
      const isEmphasis = /[!?]/.test(words[i]) || words[i].toUpperCase() === words[i];
      
      wordTimestamps.push({
        text: words[i],
        start: start,
        end: end,
        emphasis: isEmphasis
      });
    }
    
    return wordTimestamps;
  } catch (error) {
    console.error('Failed to get word timestamps:', error);
    return [];
  }
}

// Get audio duration from file
async function getAudioDurationFromFile(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(duration);
      } else {
        reject(new Error(`FFprobe failed with code ${code}`));
      }
    });

    ffprobe.on('error', reject);
  });
}

// Efficient video composition using FFmpeg (inspired by FullyAutomatedRedditVideoMakerBot)
async function composeEfficientVideo(
  bannerPath: string,
  openingAudio: string,
  storyAudio: string,
  backgroundCategory: string,
  outputPath: string,
  openingDuration: number,
  storyDuration: number,
  wordTimestamps: WordTimestamp[]
): Promise<void> {
  // Get background video path
  const backgroundPath = path.join(process.cwd(), 'public', 'backgrounds', backgroundCategory, '1.mp4');
  
  // Try to find a system font, fallback to no font
  let fontPath = '';
  const possibleFonts = [
    '/System/Library/Fonts/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/Windows/Fonts/arial.ttf'
  ];
  
  for (const font of possibleFonts) {
    try {
      await fs.access(font);
      fontPath = font;
      break;
    } catch (error) {
      // Font not found, try next
    }
  }

  return new Promise((resolve, reject) => {
    // Build efficient FFmpeg command
    const ffmpegArgs = [
      '-y', // Overwrite output
      '-i', backgroundPath, // Background video
      '-i', bannerPath, // Banner image
      '-i', openingAudio, // Opening audio
      '-i', storyAudio, // Story audio
    ];

    // Create efficient filter complex with animated captions
    let filterComplex = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=0.1:contrast=1.2:saturation=1.1[bg];[1:v]scale=800:-1[banner_scaled];[bg][banner_scaled]overlay=40:40:enable='between(t,0,${openingDuration})'[with_banner]`;

    // Add dyslexic-style one-word captions (inspired by FullyAutomatedRedditVideoMakerBot)
    let currentInput = 'with_banner';
    wordTimestamps.forEach((word, index) => {
      const startTime = openingDuration + word.start;
      const endTime = openingDuration + word.end;
      const duration = endTime - startTime;
      
      // Create bouncing animation for each word
      const fadeInDuration = Math.min(0.15, duration * 0.3);
      const fadeOutDuration = Math.min(0.15, duration * 0.3);
      
      // Clean the word text for FFmpeg
      const cleanText = word.text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/:/g, '\\:');
      
      // Dyslexic-style caption with bouncing effect
      const drawTextFilter = fontPath 
        ? `drawtext=fontfile='${fontPath}':text='${cleanText.toUpperCase()}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h-400:enable='between(t,${startTime},${endTime})':alpha='if(between(t,${startTime},${startTime + fadeInDuration}),(t-${startTime})/${fadeInDuration},if(between(t,${endTime - fadeOutDuration},${endTime}),1-(t-${endTime - fadeOutDuration})/${fadeOutDuration},1))':box=1:boxcolor=black@0.7:boxborderw=15:shadowx=3:shadowy=3:shadowcolor=black@0.8`
        : `drawtext=text='${cleanText.toUpperCase()}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h-400:enable='between(t,${startTime},${endTime})':alpha='if(between(t,${startTime},${startTime + fadeInDuration}),(t-${startTime})/${fadeInDuration},if(between(t,${endTime - fadeOutDuration},${endTime}),1-(t-${endTime - fadeOutDuration})/${fadeOutDuration},1))':box=1:boxcolor=black@0.7:boxborderw=15:shadowx=3:shadowy=3:shadowcolor=black@0.8`;
      
      filterComplex += `;[${currentInput}]${drawTextFilter}[text_${index}]`;
      currentInput = `text_${index}`;
    });

    // Audio mixing
    filterComplex += `;[2:a]volume=1.0,afade=t=in:st=0:d=0.1,afade=t=out:st=${openingDuration-0.1}:d=0.1[opening_audio];[3:a]volume=1.0,afade=t=in:st=0:d=0.1,afade=t=out:st=${storyDuration-0.1}:d=0.1[story_audio];[opening_audio][story_audio]concat=n=2:v=0:a=1[final_audio]`;

    ffmpegArgs.push(
      '-filter_complex', filterComplex,
      '-map', `[${currentInput}]`,
      '-map', '[final_audio]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast', // Faster encoding
      '-crf', '25', // Good quality but efficient
      '-profile:v', 'high',
      '-level', '4.1',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-b:a', '128k', // Efficient audio bitrate
      '-ar', '44100',
      outputPath
    );

    console.log('🔧 Starting efficient FFmpeg composition...');
    console.log(`📊 Processing ${wordTimestamps.length} animated captions`);
    console.log(`🎵 Audio: ${openingDuration.toFixed(1)}s opening + ${storyDuration.toFixed(1)}s story`);
    console.log(`🎨 Font: ${fontPath || 'system default'}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    let stderrOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderrOutput += output;
      if (output.includes('frame=') || output.includes('time=')) {
        console.log('FFmpeg progress:', output.trim());
      } else if (output.includes('Error') || output.includes('error')) {
        console.error('FFmpeg error:', output.trim());
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Efficient video composition completed!');
        resolve();
      } else {
        console.error('❌ FFmpeg failed with code:', code);
        console.error('FFmpeg stderr output:', stderrOutput);
        reject(new Error(`FFmpeg composition failed with code ${code}. Error: ${stderrOutput}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('❌ FFmpeg spawn error:', error);
      reject(error);
    });
  });
} 