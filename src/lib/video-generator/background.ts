import { VideoBackground } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { join } from 'path';
import { readdirSync } from 'fs';

const execAsync = promisify(exec);

async function getVideosInDirectory(directory: string): Promise<string[]> {
  try {
    const files = await fs.readdir(directory);
    return files
      .filter(file => /\.(mp4|mov|webm|mkv)$/i.test(file))
      .map(file => path.join(directory, file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Directory ${directory} not found, creating it...`);
      await fs.mkdir(directory, { recursive: true });
      return [];
    }
    console.error(`Failed to read directory ${directory}:`, error);
    return [];
  }
}

// This will be populated dynamically when needed
let BACKGROUND_VIDEOS: Record<VideoBackground['category'], string[]> = {
  minecraft: [],
  subway: [],
  cooking: [],
  workers: [],
  random: [],
};

async function initializeBackgroundVideos() {
  try {
    // Only initialize if not already done
    if (BACKGROUND_VIDEOS.minecraft.length === 0) {
      const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');
      
      // Create backgrounds directory if it doesn't exist
      await fs.mkdir(backgroundsDir, { recursive: true });

      // Initialize each category
      for (const category of Object.keys(BACKGROUND_VIDEOS) as VideoBackground['category'][]) {
        if (category !== 'random') {
          const categoryPath = path.join(backgroundsDir, category);
          BACKGROUND_VIDEOS[category] = await getVideosInDirectory(categoryPath);
          console.log(`Found ${BACKGROUND_VIDEOS[category].length} videos in ${category} category`);
        }
      }

      // Populate random category with all videos except minecraft and subway
      BACKGROUND_VIDEOS.random = [];
      for (const category of Object.keys(BACKGROUND_VIDEOS) as VideoBackground['category'][]) {
        if (category !== 'minecraft' && category !== 'subway' && category !== 'random') {
          BACKGROUND_VIDEOS.random.push(...BACKGROUND_VIDEOS[category]);
        }
      }
      console.log(`Total random videos available: ${BACKGROUND_VIDEOS.random.length}`);
    }
  } catch (error) {
    console.error('Failed to initialize background videos:', error);
    throw error;
  }
}

interface VideoClip {
  path: string;
  startTime: number;
  duration: number;
  speed: number;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of json "${videoPath}"`
    );
    
    const data = JSON.parse(stdout);
    const stream = data.streams[0];
    
    return {
      duration: parseFloat(data.format.duration),
      width: stream.width,
      height: stream.height,
    };
  } catch (error) {
    console.error('Failed to get video metadata:', error);
    throw error;
  }
}

export async function selectBackgroundClips(
  background: VideoBackground,
  totalDuration: number,
  segmentDuration: number = 5 // Default to 5-second segments for ADHD-style quick cuts
): Promise<VideoClip[]> {
  await initializeBackgroundVideos();

  const clips: VideoClip[] = [];
  let availableVideos = BACKGROUND_VIDEOS[background.category];
  
  if (availableVideos.length === 0) {
    throw new Error(`No videos found for category: ${background.category}`);
  }

  // For random category, use all available videos
  if (background.category === 'random') {
    availableVideos = BACKGROUND_VIDEOS.random;
  }

  let currentTime = 0;
  let lastVideoIndex = -1;

  while (currentTime < totalDuration) {
    // Select a different video than the last one
    let videoIndex;
    do {
      videoIndex = Math.floor(Math.random() * availableVideos.length);
    } while (availableVideos.length > 1 && videoIndex === lastVideoIndex);
    
    lastVideoIndex = videoIndex;
    const videoPath = availableVideos[videoIndex];
    
    // Add the clip
    clips.push({
      path: videoPath,
      startTime: 0, // Will be randomized in processBackgroundClip
      duration: Math.min(segmentDuration, totalDuration - currentTime),
      speed: background.speedMultiplier,
    });

    currentTime += segmentDuration;
  }

  return clips;
}

export async function processBackgroundClip(clip: VideoClip): Promise<string> {
  try {
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    
    const metadata = await getVideoMetadata(clip.path);
    
    // Calculate random start time
    const maxStartTime = Math.max(0, metadata.duration - clip.duration - 1);
    const startTime = Math.random() * maxStartTime;
    
    const outputPath = path.join(tmpDir, `processed_${Date.now()}_${Math.random()}.mp4`);

    // Build FFmpeg command for 9:16 aspect ratio with proper scaling and muting
    const ffmpegCommand = `ffmpeg -y -ss ${startTime} -i "${clip.path}" -t ${clip.duration} -filter:v "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setpts=${1/clip.speed}*PTS" -an -r 30 -c:v libx264 -preset ultrafast -crf 22 "${outputPath}"`;

    console.log(`Processing clip from ${path.basename(clip.path)} at ${startTime}s for ${clip.duration}s`);

    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      if (stderr) console.error('FFmpeg stderr:', stderr);

      // Verify the output file
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('FFmpeg produced an empty output file');
      }

      return outputPath;
    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError);
      const errorMessage = ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error';
      throw new Error(`Failed to process background clip: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Failed to process background clip:', error);
    throw error;
  }
}

export type BackgroundCategory = 'minecraft' | 'subway' | 'cooking' | 'workers' | 'random';

export interface BackgroundOptions {
  category?: BackgroundCategory;
  excludeFiles?: string[];
}

export function getBackgroundVideo(options: BackgroundOptions = {}): string {
  const { category, excludeFiles = [] } = options;

  // Get all background videos
  const backgroundsDir = join(process.cwd(), 'public/backgrounds');
  const backgrounds: Record<BackgroundCategory, string[]> = {
    minecraft: [],
    subway: [],
    cooking: [],
    workers: [],
    random: [],
  };

  // Load available backgrounds
  try {
    for (const category of Object.keys(backgrounds) as BackgroundCategory[]) {
      if (category !== 'random') {
        const categoryDir = join(backgroundsDir, category);
        backgrounds[category] = readdirSync(categoryDir)
          .filter(file => !excludeFiles.includes(file))
          .map(file => `/backgrounds/${category}/${file}`);
      }
    }

    // Populate random category with all videos except minecraft and subway
    backgrounds.random = [];
    for (const cat of Object.keys(backgrounds) as BackgroundCategory[]) {
      if (cat !== 'minecraft' && cat !== 'subway' && cat !== 'random') {
        backgrounds.random.push(...backgrounds[cat]);
      }
    }
  } catch (error) {
    console.error('Error loading background videos:', error);
  }

  // Select category
  const selectedCategory = category || getRandomCategory();
  const categoryVideos = backgrounds[selectedCategory];

  if (!categoryVideos.length) {
    throw new Error(`No videos available for category: ${selectedCategory}`);
  }

  // Select random video from category
  const randomIndex = Math.floor(Math.random() * categoryVideos.length);
  return categoryVideos[randomIndex];
}

function getRandomCategory(): BackgroundCategory {
  const categories: BackgroundCategory[] = ['minecraft', 'subway', 'cooking', 'workers', 'random'];
  const randomIndex = Math.floor(Math.random() * categories.length);
  return categories[randomIndex];
} 