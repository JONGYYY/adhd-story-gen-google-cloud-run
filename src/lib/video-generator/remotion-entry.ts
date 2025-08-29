import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { updateProgress, setVideoFailed } from './status';
import fetchOriginal from 'node-fetch';
import type { VideoGenerationOptions } from './types';
import AWS from 'aws-sdk';
import { createCanvas, loadImage, Canvas } from '@napi-rs/canvas';
import ffmpeg from 'fluent-ffmpeg';

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
  const title = (options as any)?.story?.title || 'Your Title Here';

  try {
    console.log(`[${videoId}] ▶️ Remotion entry starting for category=${category}`);
    await updateProgress(videoId, 12);

    // Resolve or download a background clip
    const bgLocalPath = await resolveBackgroundLocalPath(category, videoId);
    await updateProgress(videoId, 40);

    // Assume 9:16 background (user updated 1.mp4). Use 1080x1920 canvas for overlay.
    const videoWidth = 1080;
    const videoHeight = 1920;
    console.log(`[${videoId}] 🎥 Using assumed background dimensions: ${videoWidth}x${videoHeight}`);

    // Prepare banners (download if present, otherwise fallback to local/public)
    const topBannerPath = await resolveBannerAsset('redditbannertop.png', videoId);
    const bottomBannerPath = await resolveBannerAsset('redditbannerbottom.png', videoId);

    // Create overlay with banners + white title box
    const overlayPath = path.join(os.tmpdir(), `overlay_${videoId}.png`);
    console.log(`[${videoId}] 🖼️ Creating banner overlay...`);
    await createBannerOverlay({
      videoWidth,
      videoHeight,
      title,
      topBannerPath,
      bottomBannerPath,
      outputPath: overlayPath,
    });
    await updateProgress(videoId, 60);

    // Composite overlay onto background using ffmpeg
    const finalPath = path.join(os.tmpdir(), `output_${videoId}.mp4`);
    console.log(`[${videoId}] 🎬 Starting ffmpeg composite...`);
    await updateProgress(videoId, 70);
    await compositeOverlay(bgLocalPath, overlayPath, finalPath, videoId);
    await updateProgress(videoId, 100);

    const finalUrl = `/api/videos/${path.basename(finalPath)}`;
    console.log(`[${videoId}] 🎉 Remotion composite finished: ${finalUrl}`);
    return finalUrl;
  } catch (e: any) {
    console.error(`[${videoId}] ❌ Remotion generation failed: ${e?.message || e}`);
    try { await setVideoFailed(videoId, e?.message || 'Remotion generation failed'); } catch {}
    throw e;
  }
} 

// No ffprobe: relying on user-provided 9:16 backgrounds

async function resolveBannerAsset(filename: string, videoId: string): Promise<string | null> {
  const baseUrl = process.env.BACKGROUND_BASE_URL || '';
  // Prefer S3 via AWS SDK when BACKGROUND_BASE_URL points to S3
  const s3Match = baseUrl.match(/^https?:\/\/(?:([^.]+)\.)?s3[.-]([a-z0-9-]+)\.amazonaws\.com\/?([^\s]*)$/i);
  const envBucket = process.env.S3_BUCKET;
  const envRegion = process.env.S3_REGION;
  if (s3Match || (envBucket && envRegion)) {
    const bucket = envBucket || (s3Match?.[1] || s3Match?.[3]?.split('/')[0]);
    let prefix: string | undefined;
    let region = envRegion || s3Match?.[2];
    if (!envBucket && s3Match) {
      if (!s3Match[1] && s3Match[3]) {
        const parts = s3Match[3].split('/');
        parts.shift();
        prefix = parts.join('/');
      } else {
        prefix = s3Match[3];
      }
    } else {
      try {
        const u = new URL(baseUrl);
        prefix = u.pathname.replace(/^\//, '');
      } catch {
        prefix = '';
      }
    }
    if (bucket && region !== undefined) {
      const basePrefix = (prefix ? prefix.replace(/\/?backgrounds\/?$/, '') : '');
      const tryKeys = [
        [basePrefix, 'banners', filename].filter(Boolean).join('/'),
        [basePrefix, 'assets', filename].filter(Boolean).join('/'),
      ];
      const s3 = new AWS.S3({ region: region as string });
      for (const key of tryKeys) {
        try {
          // Try head first to confirm existence
          await s3.headObject({ Bucket: bucket, Key: key }).promise();
          const cacheDir = path.join(os.tmpdir(), 'banner_cache');
          const localPath = path.join(cacheDir, filename);
          try { await fs.mkdir(cacheDir, { recursive: true }); } catch {}
          await new Promise<void>((resolve, reject) => {
            const ws = createWriteStream(localPath);
            s3.getObject({ Bucket: bucket, Key: key })
              .createReadStream()
              .on('error', reject)
              .pipe(ws)
              .on('finish', () => resolve())
              .on('error', reject);
          });
          console.log(`[${videoId}] 🖼️ Downloaded banner asset from S3: ${key}`);
          return localPath;
        } catch {}
      }
    }
  }
  // HTTP fallback under assets/ at same root as BACKGROUND_BASE_URL
  if (/^https?:\/\//i.test(baseUrl)) {
    const root = baseUrl.replace(/\/?backgrounds\/?$/, '');
    const base = root.replace(/\/$/, '');
    const urls = [
      `${base}/banners/${filename}`,
      `${base}/assets/${filename}`,
    ];
    const cacheDir = path.join(os.tmpdir(), 'banner_cache');
    const localPath = path.join(cacheDir, filename);
    try { await fs.mkdir(cacheDir, { recursive: true }); } catch {}
    for (const url of urls) {
      try {
        await downloadToFile(url, localPath, videoId);
        return localPath;
      } catch {}
    }
  }
  // Local public fallback
  const localPublic = path.join(process.cwd(), 'public', 'assets', filename);
  try {
    await fs.access(localPublic);
    return localPublic;
  } catch {}
  console.warn(`[${videoId}] ⚠️ Banner asset not found: ${filename}`);
  return null;
}

type OverlayParams = {
  videoWidth: number;
  videoHeight: number;
  title: string;
  topBannerPath: string | null;
  bottomBannerPath: string | null;
  outputPath: string;
};

async function createBannerOverlay(params: OverlayParams): Promise<void> {
  const { videoWidth, videoHeight, title, topBannerPath, bottomBannerPath, outputPath } = params;
  const canvas: Canvas = createCanvas(videoWidth, videoHeight);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, videoWidth, videoHeight);

  // Draw top banner
  if (topBannerPath) {
    try {
      const img = await loadImage(topBannerPath);
      const scale = videoWidth / img.width;
      const drawW = Math.round(img.width * scale);
      const drawH = Math.round(img.height * scale);
      ctx.drawImage(img as any, 0, 0, drawW, drawH);
    } catch {}
  }

  // Draw bottom banner
  if (bottomBannerPath) {
    try {
      const img = await loadImage(bottomBannerPath);
      const scale = videoWidth / img.width;
      const drawW = Math.round(img.width * scale);
      const drawH = Math.round(img.height * scale);
      ctx.drawImage(img as any, 0, videoHeight - drawH, drawW, drawH);
    } catch {}
  }

  // Title box metrics
  const sidePadding = Math.floor(videoWidth * 0.06);
  const maxTextWidth = videoWidth - sidePadding * 2;
  // Base font size relative to height; we'll adjust for wrapping
  const baseFontSize = Math.floor(videoHeight * 0.05);
  ctx.font = `${baseFontSize}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';
  
  // Word wrap
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    const metrics = ctx.measureText(test);
    if (metrics.width > maxTextWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  // Adjust font size if too many lines
  let fontSize = baseFontSize;
  const maxLines = 4;
  while (lines.length > maxLines && fontSize > Math.floor(baseFontSize * 0.7)) {
    fontSize -= 2;
    ctx.font = `${fontSize}px Arial`;
    // recompute lines with smaller font
    const newLines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxTextWidth && cur) {
        newLines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) newLines.push(cur);
    lines.length = 0;
    lines.push(...newLines);
  }

  const lineHeight = Math.floor(fontSize * 1.25);
  const textBlockHeight = lines.length * lineHeight;
  const boxPaddingY = Math.floor(videoHeight * 0.015);
  const boxHeight = textBlockHeight + boxPaddingY * 2;
  const boxY = Math.max(0, Math.floor((videoHeight - boxHeight) / 2));

  // White box
  ctx.fillStyle = 'white';
  ctx.globalAlpha = 1;
  ctx.fillRect(sidePadding, boxY, videoWidth - sidePadding * 2, boxHeight);

  // Draw text centered within box
  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px Arial`;
  let y = boxY + boxPaddingY;
  for (const line of lines) {
    const m = ctx.measureText(line);
    const x = Math.floor((videoWidth - m.width) / 2);
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  // Save overlay image
  const png = (canvas as any).toBuffer('image/png');
  await fs.writeFile(outputPath, png);
}

async function compositeOverlay(bgPath: string, overlayPath: string, outputPath: string, videoId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(bgPath)
      .input(overlayPath)
      .complexFilter([
        {
          filter: 'scale2ref',
          options: 'w=iw:h=ih',
          inputs: '[1][0]',
          outputs: ['ol', 'v0']
        },
        {
          filter: 'overlay',
          options: 'x=0:y=0:format=auto',
          inputs: ['v0', 'ol'],
          outputs: 'vout'
        }
      ])
      .outputOptions([
        '-map', '[vout]',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'copy',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ])
      .on('start', (cmd) => {
        console.log(`[${videoId}] ▶️ ffmpeg command: ${cmd}`);
      })
      .on('progress', async (p) => {
        try { await updateProgress(videoId, Math.min(95, 70 + Math.floor((p.percent || 0) / 3))); } catch {}
      })
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}