import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import type { BackgroundOptions } from './types';

// Set FFmpeg paths (using installed binaries)
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export class FFmpegProcessor {
  
  /**
   * Build background track from multiple clips
   */
  async buildBackgroundTrack(
    inputClips: string[], 
    opts: BackgroundOptions
  ): Promise<string> {
    const { width, height, fps, switchEverySec } = opts;
    
    console.log(`🎬 Building background track: ${width}x${height}@${fps}fps`);
    console.log(`📹 Input clips: ${inputClips.length}, switch every ${switchEverySec}s`);
    
    if (inputClips.length === 0) {
      throw new Error('No input clips provided');
    }
    
    // Validate input files exist
    for (const clip of inputClips) {
      if (!existsSync(clip)) {
        throw new Error(`Input clip not found: ${clip}`);
      }
    }
    
    const outputPath = join(tmpdir(), `bg_track_${Date.now()}.mp4`);
    
    try {
      // Process each clip to normalize format
      const processedClips = await this.normalizeClips(inputClips, { width, height, fps });
      
      // Create segments for each clip
      const segments = await this.createSegments(processedClips, switchEverySec);
      
      // Concatenate segments
      await this.concatenateSegments(segments, outputPath);
      
      console.log(`✅ Background track created: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      console.error('❌ Background track creation failed:', error);
      throw new Error(`Background track creation failed: ${error.message}`);
    }
  }
  
  /**
   * Normalize clips to consistent format
   */
  private async normalizeClips(
    inputClips: string[],
    opts: { width: number; height: number; fps: number }
  ): Promise<string[]> {
    console.log('🔄 Normalizing clips...');
    
    const normalizedClips: string[] = [];
    
    for (let i = 0; i < inputClips.length; i++) {
      const inputClip = inputClips[i];
      const outputClip = join(tmpdir(), `normalized_${i}_${Date.now()}.mp4`);
      
      await this.normalizeClip(inputClip, outputClip, opts);
      normalizedClips.push(outputClip);
    }
    
    return normalizedClips;
  }
  
  /**
   * Normalize a single clip
   */
  private async normalizeClip(
    inputPath: string,
    outputPath: string,
    opts: { width: number; height: number; fps: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .size(`${opts.width}x${opts.height}`)
        .fps(opts.fps)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-crf 20',
          '-preset fast',
          '-movflags +faststart',
          '-vf scale=' + opts.width + ':' + opts.height + ':force_original_aspect_ratio=increase,crop=' + opts.width + ':' + opts.height,
          '-r ' + opts.fps, // Force constant frame rate
          '-vsync cfr' // Constant frame rate
        ])
        .on('start', (commandLine) => {
          console.log(`🔄 Normalizing: ${inputPath}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r⏳ Progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log(`\n✅ Normalized: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`\n❌ Normalization failed: ${error.message}`);
          reject(error);
        })
        .save(outputPath);
    });
  }
  
  /**
   * Create segments from normalized clips
   */
  private async createSegments(
    clips: string[],
    switchEverySec: number
  ): Promise<string[]> {
    console.log(`🔪 Creating ${switchEverySec}s segments...`);
    
    const segments: string[] = [];
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const segmentPath = join(tmpdir(), `segment_${i}_${Date.now()}.mp4`);
      
      await this.createSegment(clip, segmentPath, switchEverySec);
      segments.push(segmentPath);
    }
    
    return segments;
  }
  
  /**
   * Create a segment of specified duration from a clip
   */
  private async createSegment(
    inputPath: string,
    outputPath: string,
    durationSec: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(0) // Start from beginning
        .duration(durationSec)
        .videoCodec('copy') // Copy video stream (already normalized)
        .audioCodec('copy') // Copy audio stream
        .on('start', () => {
          console.log(`🔪 Creating segment: ${durationSec}s from ${inputPath}`);
        })
        .on('end', () => {
          console.log(`✅ Segment created: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`❌ Segment creation failed: ${error.message}`);
          reject(error);
        })
        .save(outputPath);
    });
  }
  
  /**
   * Concatenate segments with optional crossfade
   */
  private async concatenateSegments(
    segments: string[],
    outputPath: string,
    crossfadeDuration: number = 0.4
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔗 Concatenating ${segments.length} segments...`);
      
      if (segments.length === 1) {
        // Single segment, just copy
        ffmpeg(segments[0])
          .videoCodec('copy')
          .audioCodec('copy')
          .save(outputPath)
          .on('end', resolve)
          .on('error', reject);
        return;
      }
      
      // Multiple segments - use concat with crossfade
      const command = ffmpeg();
      
      // Add all inputs
      segments.forEach(segment => {
        command.input(segment);
      });
      
      // Build complex filter for crossfade
      const filterComplex = this.buildCrossfadeFilter(segments.length, crossfadeDuration);
      
      command
        .complexFilter(filterComplex)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-crf 20',
          '-preset fast',
          '-movflags +faststart'
        ])
        .on('start', (commandLine) => {
          console.log('🔗 Concatenation started');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r⏳ Concatenation: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log(`\n✅ Background track completed: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`\n❌ Concatenation failed: ${error.message}`);
          reject(error);
        })
        .save(outputPath);
    });
  }
  
  /**
   * Build FFmpeg complex filter for crossfade transitions
   */
  private buildCrossfadeFilter(segmentCount: number, crossfadeDuration: number): string {
    if (segmentCount <= 1) {
      return '[0:v][0:a]';
    }
    
    const filters: string[] = [];
    let videoLabel = '0:v';
    let audioLabel = '0:a';
    
    for (let i = 1; i < segmentCount; i++) {
      const prevVideoLabel = videoLabel;
      const prevAudioLabel = audioLabel;
      const currentVideoLabel = `${i}:v`;
      const currentAudioLabel = `${i}:a`;
      const outputVideoLabel = `v${i}`;
      const outputAudioLabel = `a${i}`;
      
      // Video crossfade
      filters.push(
        `[${prevVideoLabel}][${currentVideoLabel}]xfade=transition=fade:duration=${crossfadeDuration}:offset=0[${outputVideoLabel}]`
      );
      
      // Audio crossfade
      filters.push(
        `[${prevAudioLabel}][${currentAudioLabel}]acrossfade=d=${crossfadeDuration}[${outputAudioLabel}]`
      );
      
      videoLabel = outputVideoLabel;
      audioLabel = outputAudioLabel;
    }
    
    return filters.join(';');
  }
  
  /**
   * Get video duration
   */
  async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }
        
        const duration = metadata.format.duration;
        if (typeof duration === 'number') {
          resolve(duration);
        } else {
          reject(new Error('Could not determine video duration'));
        }
      });
    });
  }
  
  /**
   * Get video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error);
        } else {
          resolve(metadata);
        }
      });
    });
  }
}

/**
 * Factory function to create FFmpeg processor
 */
export function createFFmpegProcessor(): FFmpegProcessor {
  return new FFmpegProcessor();
}

/**
 * Main function to build background track
 */
export async function buildBackgroundTrack(
  inputClips: string[], 
  opts: BackgroundOptions
): Promise<string> {
  const processor = createFFmpegProcessor();
  return processor.buildBackgroundTrack(inputClips, opts);
} 