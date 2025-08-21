import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { updateProgress } from './status';
import type { VideoGenerationOptions } from './types';

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download background: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
}

async function resolveBackgroundLocalPath(category: string, videoId: string): Promise<string> {
  const preferredClip = '1.mp4';
  const baseUrl = process.env.BACKGROUND_BASE_URL || '';
  const tmpPath = path.join(os.tmpdir(), `bg_${videoId}.mp4`);

  // If BACKGROUND_BASE_URL points to http(s), download it
  if (/^https?:\/\//i.test(baseUrl)) {
    const url = `${baseUrl.replace(/\/$/, '')}/${category}/${preferredClip}`;
    await downloadToFile(url, tmpPath);
    return tmpPath;
  }

  // Otherwise, try local public file
  const localPath = path.join(process.cwd(), 'public', 'backgrounds', category, preferredClip);
  await fs.access(localPath);
  return localPath;
}

export async function generateVideoWithRemotion(options: VideoGenerationOptions, videoId: string): Promise<string> {
  const category = options.background?.category || 'minecraft';

  // Progress bookkeeping
  await updateProgress(videoId, 5);

  // Resolve or download a background clip
  const bgLocalPath = await resolveBackgroundLocalPath(category, videoId);
  await updateProgress(videoId, 50);

  // Simulate render by copying background to an output file for now
  const finalPath = path.join(os.tmpdir(), `output_${videoId}.mp4`);
  await fs.copyFile(bgLocalPath, finalPath);

  await updateProgress(videoId, 100);
  return finalPath;
} 