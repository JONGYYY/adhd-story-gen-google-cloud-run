import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { updateProgress, setVideoFailed } from './status';
import fetchOriginal from 'node-fetch';
import type { VideoGenerationOptions } from './types';
import AWS from 'aws-sdk';

// Use node-fetch to ensure Node Readable stream body
async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchOriginal(url, { signal: (signal as any) || (controller as any).signal }) as any;
  } finally {
    clearTimeout(t);
  }
}

async function downloadToFile(url: string, destPath: string, videoId: string): Promise<number> {
  console.log(`[${videoId}] 🔽 Downloading background: ${url}`);
  // Allow large files: 4 minutes timeout
  const res = await fetchWithTimeout(url, 240000).catch((e) => {
    throw new Error(`Timeout or network error downloading ${url}: ${e?.message || e}`);
  });
  if (!res.ok) {
    throw new Error(`Failed to download background ${url}: ${res.status} ${res.statusText}`);
  }
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const fileStream = createWriteStream(destPath);
  let received = 0;
  let lastReported = 0;

  if (res.body && typeof (res.body as any).pipe === 'function') {
    // Node Readable stream path
    await new Promise<void>((resolve, reject) => {
      (res.body as any)
        .on('data', async (chunk: Buffer) => {
          fileStream.write(chunk);
          received += chunk.length;
          if (total > 0) {
            const pct = Math.floor((received / total) * 40);
            if (pct > lastReported) {
              lastReported = pct;
              try { await updateProgress(videoId, 5 + pct); } catch {}
            }
          }
        })
        .on('end', () => {
          fileStream.end();
          resolve();
        })
        .on('error', (err: any) => {
          fileStream.destroy();
          reject(err);
        });
    });
  } else if ((res.body as any)?.getReader) {
    // Web ReadableStream path (Undici)
    const reader = (res.body as any).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const chunk: Buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
        fileStream.write(chunk);
        received += chunk.length;
        if (total > 0) {
          const pct = Math.floor((received / total) * 40);
          if (pct > lastReported) {
            lastReported = pct;
            try { await updateProgress(videoId, 5 + pct); } catch {}
          }
        }
      }
    }
    await new Promise<void>((r) => fileStream.end(r));
  } else {
    // Final fallback to buffering
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    await fs.writeFile(destPath, buf);
    received = buf.length;
  }

  console.log(`[${videoId}] ✅ Downloaded ${received} bytes to ${destPath}`);
  return received;
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
  const cacheDir = path.join(os.tmpdir(), 'bg_cache');
  const cachePath = path.join(cacheDir, `${category}_${preferredClip}`);

  // If BACKGROUND_BASE_URL points to S3, prefer AWS SDK streaming (more robust than public HTTP)
  // Supports formats like:
  // - https://<bucket>.s3.<region>.amazonaws.com/<prefix>
  // - https://s3.<region>.amazonaws.com/<bucket>/<prefix>
  const s3Match = baseUrl.match(/^https?:\/\/(?:([^.]+)\.)?s3[.-]([a-z0-9-]+)\.amazonaws\.com\/?([^\s]*)$/i);
  const envBucket = process.env.S3_BUCKET;
  const envRegion = process.env.S3_REGION;

  if (s3Match || (envBucket && envRegion)) {
    const bucket = envBucket || (s3Match?.[1] || s3Match?.[3]?.split('/')[0]);
    let prefix: string | undefined;
    let region = envRegion || s3Match?.[2];
    if (!envBucket && s3Match) {
      // If bucket was in the path (s3.<region>.amazonaws.com/<bucket>/<prefix>)
      if (!s3Match[1] && s3Match[3]) {
        const parts = s3Match[3].split('/');
        parts.shift(); // remove bucket
        prefix = parts.join('/');
      } else {
        prefix = s3Match[3];
      }
    } else {
      // BACKGROUND_BASE_URL provided separately from bucket via env
      try {
        const u = new URL(baseUrl);
        // everything after host as prefix
        prefix = u.pathname.replace(/^\//, '');
      } catch {
        prefix = '';
      }
    }
    if (!bucket || !region) {
      console.warn(`[${videoId}] ⚠️ Could not determine S3 bucket/region from BACKGROUND_BASE_URL; falling back to HTTP`);
    } else {
      const key = [prefix, category, preferredClip].filter(Boolean).join('/');
      try { await fs.mkdir(cacheDir, { recursive: true }); } catch {}
      // Use cached file if present and sane size
      try {
        const st = await fs.stat(cachePath);
        if (st.size > 1024 * 1024) {
          console.log(`[${videoId}] ♻️ Using cached S3 background: ${cachePath} (${st.size} bytes)`);
          return cachePath;
        }
      } catch {}

      console.log(`[${videoId}] 🔽 Downloading background from S3 bucket=${bucket}, key=${key}`);
      const s3 = new AWS.S3({ region });
      // HeadObject to get total size for progress
      const head = await s3.headObject({ Bucket: bucket, Key: key }).promise();
      const total = Number(head.ContentLength || 0);
      const stream = s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
      const fileStream = createWriteStream(cachePath);
      let received = 0;
      let lastReported = 0;
      await new Promise<void>((resolve, reject) => {
        stream
          .on('data', async (chunk: Buffer) => {
            fileStream.write(chunk);
            received += chunk.length;
            if (total > 0) {
              const pct = Math.floor((received / total) * 40);
              if (pct > lastReported) {
                lastReported = pct;
                try { await updateProgress(videoId, 5 + pct); } catch {}
              }
            }
          })
          .on('end', () => {
            fileStream.end();
            resolve();
          })
          .on('error', (err) => {
            fileStream.destroy();
            reject(err);
          });
      });
      if (total && received < total) {
        throw new Error(`S3 download incomplete: ${received}/${total} bytes`);
      }
      console.log(`[${videoId}] ✅ Downloaded ${received} bytes from S3 to ${cachePath}`);
      return cachePath;
    }
  }

  // If BACKGROUND_BASE_URL points to http(s), download it
  if (/^https?:\/\//i.test(baseUrl)) {
    try { await fs.mkdir(cacheDir, { recursive: true }); } catch {}
    // Use cached file if present and sane size
    try {
      const st = await fs.stat(cachePath);
      if (st.size > 1024 * 1024) {
        console.log(`[${videoId}] ♻️ Using cached background: ${cachePath} (${st.size} bytes)`);
        return cachePath;
      }
    } catch {}

    const url = `${baseUrl.replace(/\/$/, '')}/${category}/${preferredClip}`;
    const bytes = await tryDownloadWithRetries(url, cachePath, videoId);
    if (bytes < 1024 * 1024) {
      throw new Error(`Background file too small (${bytes} bytes) from ${url}`);
    }
    return cachePath;
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
    console.log(`[${videoId}] ▶️ Remotion entry starting for category=${category}`);
    await updateProgress(videoId, 12);

    // Resolve or download a background clip
    const bgLocalPath = await resolveBackgroundLocalPath(category, videoId);
    await updateProgress(videoId, 50);

    // Simulate render by copying background to an output file for now
    const finalPath = path.join(os.tmpdir(), `output_${videoId}.mp4`);
    await fs.copyFile(bgLocalPath, finalPath);

    await updateProgress(videoId, 100);
    const finalUrl = `/api/videos/${path.basename(finalPath)}`;
    console.log(`[${videoId}] 🎉 Remotion stub finished: ${finalUrl}`);
    return finalUrl;
  } catch (e: any) {
    console.error(`[${videoId}] ❌ Remotion generation failed: ${e?.message || e}`);
    try { await setVideoFailed(videoId, e?.message || 'Remotion generation failed'); } catch {}
    throw e;
  }
} 