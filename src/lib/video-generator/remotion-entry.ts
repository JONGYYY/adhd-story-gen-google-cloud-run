import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { updateProgress, setVideoFailed } from './status';
import type { VideoGenerationOptions } from './types';

async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: signal || controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function downloadToFile(url: string, destPath: string, videoId: string): Promise<number> {
  console.log(`[${videoId}] 🔽 Downloading background: ${url}`);
  const res = await fetchWithTimeout(url, 30000).catch((e) => {
    throw new Error(`Timeout or network error downloading ${url}: ${e?.message || e}`);
  });
  if (!res.ok) {
    throw new Error(`Failed to download background ${url}: ${res.status} ${res.statusText}`);
  }
  const arr = await res.arrayBuffer();
  const buf = Buffer.from(arr);
  await fs.writeFile(destPath, buf);
  console.log(`[${videoId}] ✅ Downloaded ${buf.length} bytes to ${destPath}`);
  return buf.length;
}

async function tryDownloadWithRetries(url: string, destPath: string, videoId: string): Promise<number> {
  let attempt = 0;
  let delay = 1000;
  while (attempt < 3) {
    try {
      return await downloadToFile(url, destPath, videoId);
    } catch (e: any) {
      attempt++;
      if (attempt >= 3) throw e;
      console.warn(`[${videoId}] ⚠️ Download failed (attempt ${attempt}): ${e?.message}. Retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  return 0;
}

async function resolveBackgroundLocalPath(category: string, videoId: string): Promise<string> {
  const preferredClip = '1.mp4';
  const baseUrl = process.env.BACKGROUND_BASE_URL || '';
  const tmpPath = path.join(os.tmpdir(), `bg_${videoId}.mp4`);

  // If BACKGROUND_BASE_URL points to http(s), download it
  if (/^https?:\/\//i.test(baseUrl)) {
    const url = `${baseUrl.replace(/\/$/, '')}/${category}/${preferredClip}`;
    const bytes = await tryDownloadWithRetries(url, tmpPath, videoId);
    if (bytes < 1024 * 1024) {
      throw new Error(`Background file too small (${bytes} bytes) from ${url}`);
    }
    return tmpPath;
  }

  // Otherwise, try local public file
  const localPath = path.join(process.cwd(), 'public', 'backgrounds', category, preferredClip);
  await fs.access(localPath);
  console.log(`[${videoId}] 📂 Using local background: ${localPath}`);
  return localPath;
}

export async function generateVideoWithRemotion(options: VideoGenerationOptions, videoId: string): Promise<string> {
  const category = options.background?.category || 'minecraft';

  try {
    await updateProgress(videoId, 5);

    // Resolve or download a background clip
    const bgLocalPath = await resolveBackgroundLocalPath(category, videoId);
    await updateProgress(videoId, 50);

    // Simulate render by copying background to an output file for now
    const finalPath = path.join(os.tmpdir(), `output_${videoId}.mp4`);
    await fs.copyFile(bgLocalPath, finalPath);

    await updateProgress(videoId, 100);
    console.log(`[${videoId}] 🎉 Remotion stub finished: ${finalPath}`);
    return finalPath;
  } catch (e: any) {
    console.error(`[${videoId}] ❌ Remotion generation failed: ${e?.message || e}`);
    try { await setVideoFailed(videoId, e?.message || 'Remotion generation failed'); } catch {}
    throw e;
  }
} 