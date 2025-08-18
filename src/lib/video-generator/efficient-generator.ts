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
      const bannerBuffer = await generateBanner({
        title: options.story.title,
        author: options.story.author,
        subreddit: options.story.subreddit,
        upvotes: Math.floor(Math.random() * 500 + 100),
        comments: Math.floor(Math.random() * 100 + 20),
      });
      
      // Write the buffer to file
      await fs.writeFile(bannerImagePath, bannerBuffer);
      console.log('✅ Dynamic banner generated successfully');
    } catch (error) {
      console.log('⚠️ Dynamic banner failed, creating simple fallback');
      // Create a simple fallback PNG (1x1 transparent pixel)
      const fallbackPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      await fs.writeFile(bannerImagePath, fallbackPng);
    }
    
    tempFiles.push(bannerImagePath);
    await updateProgress(videoId, 40);

    // Get word timestamps using simple approach
    console.log('⏱️ Getting word timestamps...');
    // Build word timestamps for both opening (title) and story, then merge with offsets so captions start at t=0
    const openingWordTimestamps = await getWordTimestamps(openingAudioPath, openingText);
    const storyWordTimestampsRaw = await getWordTimestamps(storyAudioPath, storyText);
    const wordTimestamps = [
      ...openingWordTimestamps.map(w => ({ ...w })),
      ...storyWordTimestampsRaw.map(w => ({ ...w, start: w.start + openingDuration, end: w.end + openingDuration }))
    ];
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
  // Resolve background path
  async function downloadToTmp(url: string, name: string): Promise<string> {
    const tmpDir = os.tmpdir();
    const out = path.join(tmpDir, `${name}-${Date.now()}.mp4`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to download background ${url}: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    await fs.writeFile(out, Buffer.from(buf));
    return out;
  }

  const BG_URLS: Record<string, string | undefined> = {
    minecraft: process.env.BG_MINECRAFT_URL,
    subway: process.env.BG_SUBWAY_URL,
    cooking: process.env.BG_COOKING_URL,
    workers: process.env.BG_WORKERS_URL,
    asmr: process.env.BG_ASMR_URL,
    random: process.env.BG_RANDOM_URL,
  };

  let backgroundPath = '';
  try {
    const remote = BG_URLS[backgroundCategory];
    console.log('[BG] category =', backgroundCategory, 'remote url =', remote ? 'set' : 'unset');
    if (remote && remote.startsWith('http')) {
      backgroundPath = await downloadToTmp(remote, `bg-${backgroundCategory}`);
      console.log('[BG] using remote URL ->', backgroundPath);
    } else {
      const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_STATIC_URL || !!process.env.RAILWAY_ENVIRONMENT;
      if (!isProd) {
        const localPath = path.join(process.cwd(), 'public', 'backgrounds', backgroundCategory, '1.mp4');
        try {
          await fs.access(localPath);
          backgroundPath = localPath;
          console.log('[BG] using local public file ->', backgroundPath);
        } catch {
          const fallback = BG_URLS.random;
          if (fallback && fallback.startsWith('http')) {
            backgroundPath = await downloadToTmp(fallback, 'bg-random');
            console.log('[BG] local missing; using BG_RANDOM_URL ->', backgroundPath);
          } else {
            backgroundPath = await downloadToTmp('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'bg-sample');
            console.log('[BG] local missing; using sample ->', backgroundPath);
          }
        }
      } else {
        // In production containers, avoid relying on bundled public assets.
        const fallback = BG_URLS.random;
        if (fallback && fallback.startsWith('http')) {
          backgroundPath = await downloadToTmp(fallback, 'bg-random');
          console.log('[BG] prod mode; using BG_RANDOM_URL ->', backgroundPath);
        } else {
          backgroundPath = await downloadToTmp('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'bg-sample');
          console.log('[BG] prod mode; using sample ->', backgroundPath);
        }
      }
    }
  } catch (e) {
    console.warn('[BG] error resolving background, falling back to sample:', (e as Error).message);
    backgroundPath = await downloadToTmp('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', 'bg-sample2');
  }
  
  // Try to find a system font via fontconfig, fallback to common paths
  async function resolveFontFile(): Promise<string> {
    return new Promise((resolve) => {
      try {
        const fc = spawn('fc-list', [':', 'file']);
        let out = '';
        fc.stdout.on('data', (d) => (out += d.toString()));
        fc.on('close', () => {
          const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const picked = lines.find((l) => /\.(ttf|ttc|otf)$/i.test(l));
          if (picked) return resolve(picked);
          resolve('');
        });
        fc.on('error', () => resolve(''));
      } catch {
        resolve('');
      }
    });
  }

  let fontPath = await resolveFontFile();
  if (!fontPath) {
    const possibleFonts = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/System/Library/Fonts/Helvetica.ttc',
      '/System/Library/Fonts/Arial.ttf',
      '/Windows/Fonts/arial.ttf'
    ];
    for (const font of possibleFonts) {
      try {
        await fs.access(font);
        fontPath = font;
        break;
      } catch {}
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
    const grade = 'eq=brightness=0.05:contrast=1.15:saturation=1.05';
    let filterComplex = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${grade}[bg];[1:v]scale=900:-1[banner_scaled]`;

    // Banner placement: centered for dev, top-pinned for production
    const isProd = (process.env.NODE_ENV === 'production');
    const bannerY = isProd ? '120' : '(main_h-h)/2+120';
    filterComplex += `;[bg][banner_scaled]overlay=(main_w-w)/2:${bannerY}:enable='between(t,0,${openingDuration})'[with_banner]`;

    // Add dyslexic-style one-word captions (inspired by FullyAutomatedRedditVideoMakerBot)
    let currentInput = 'with_banner';
    wordTimestamps.forEach((word, index) => {
      const startTime = word.start;
      const endTime = word.end;
      const duration = endTime - startTime;
      
      // Create bouncing animation for each word
      const fadeInDuration = Math.min(0.12, Math.max(0.06, duration * 0.25));
      const fadeOutDuration = Math.min(0.12, Math.max(0.06, duration * 0.25));
      
      // Clean the word text for FFmpeg
      const cleanText = word.text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/:/g, '\\:');
      
      // Captions at lower third with bounce (y animates from baseY-6 to baseY over fadeInDuration)
      const baseYExpr = '(h-320-text_h-40)';
      const bounceYExpr = `(${baseYExpr})- (between(t,${startTime},${(startTime + fadeInDuration).toFixed(2)}) ? 6*(1-((t-${startTime})/${fadeInDuration.toFixed(2)})) : 0)`;
      const commonStyle = `fontsize=86:fontcolor=white:borderw=3:bordercolor=black@0.5:shadowx=3:shadowy=3:shadowcolor=black@0.8:x=(w-text_w)/2:y=${bounceYExpr}:enable='between(t,${startTime},${endTime})':alpha='if(between(t,${startTime},${(startTime + fadeInDuration).toFixed(2)}),(t-${startTime})/${fadeInDuration.toFixed(2)},if(between(t,${(endTime - fadeOutDuration).toFixed(2)},${endTime}),1-(t-${(endTime - fadeOutDuration).toFixed(2)})/${fadeOutDuration.toFixed(2)},1))'`;
      const drawTextFilter = fontPath 
        ? `drawtext=fontfile='${fontPath}':text='${cleanText.toUpperCase()}':${commonStyle}`
        : `drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':text='${cleanText.toUpperCase()}':${commonStyle}`;
      
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
      '-preset', 'fast',
      '-crf', '20',
      '-profile:v', 'high',
      '-level', '4.1',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-r', '30',
      '-b:a', '128k', // Efficient audio bitrate
      '-ar', '44100',
      '-t', (openingDuration + storyDuration + 1.5).toFixed(2),
      outputPath
    );

    console.log('🔧 Starting efficient FFmpeg composition...');
    console.log('[BG] final background path ->', backgroundPath);
    console.log(`📊 Processing ${wordTimestamps.length} animated captions`);
    console.log(`🎵 Audio: ${openingDuration.toFixed(1)}s opening + ${storyDuration.toFixed(1)}s story`);
    console.log(`🎨 Font: ${fontPath || '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'}`);

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