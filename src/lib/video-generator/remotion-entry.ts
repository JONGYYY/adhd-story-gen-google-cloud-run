import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { updateProgress, setVideoFailed } from './status';
import fetchOriginal from 'node-fetch';
import type { VideoGenerationOptions } from './types';
import AWS from 'aws-sdk';
import { createCanvas, loadImage, Canvas, GlobalFonts } from '@napi-rs/canvas';
import ffmpeg from 'fluent-ffmpeg';
import { generateTitleAndStoryAudio } from './shared/audio';
import type { WordAlignment } from './engines/types';

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
  const fullStory = (options as any)?.story?.story || (options as any)?.story?.content || '';
  // Prefer logged-in/account username; fallback to story author, then Anonymous
  const author = (options as any)?.user?.username || (options as any)?.author || (options as any)?.story?.author || process.env.DEFAULT_AUTHOR_USERNAME || 'Anonymous';

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

    // TTS for title + story
    const voiceProvider = (options as any)?.voice?.provider || 'elevenlabs';
    const voiceId = (options as any)?.voice?.voiceId || 'adam';
    const { titleAudio, storyAudio } = await generateTitleAndStoryAudio(
      title,
      fullStory || title,
      { provider: voiceProvider, voiceId } as any,
      `${videoId}_tts`
    );

    // Create overlay with banners + white title box
    const overlayPath = path.join(os.tmpdir(), `overlay_${videoId}.png`);
    console.log(`[${videoId}] 🖼️ Creating banner overlay...`);
    await createBannerOverlay({
      videoWidth,
      videoHeight,
      title,
      author,
      topBannerPath,
      bottomBannerPath,
      outputPath: overlayPath,
    });
    await updateProgress(videoId, 60);

    // Composite with audio, overlay only during title audio, then remove for captions area
    const finalPath = path.join(os.tmpdir(), `output_${videoId}.mp4`);
    console.log(`[${videoId}] 🎬 Starting ffmpeg composite...`);
    await updateProgress(videoId, 70);
    await compositeWithAudioAndTimedOverlay({
      bgPath: bgLocalPath,
      overlayPath,
      outputPath: finalPath,
      titleAudioPath: titleAudio.path,
      storyAudioPath: storyAudio.path,
      titleDuration: Math.max(0.1, titleAudio.duration || 2)
    }, videoId);
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
  author: string;
  topBannerPath: string | null;
  bottomBannerPath: string | null;
  outputPath: string;
};

async function createBannerOverlay(params: OverlayParams): Promise<void> {
  const { videoWidth, videoHeight, title, author, topBannerPath, bottomBannerPath, outputPath } = params;
  const canvas: Canvas = createCanvas(videoWidth, videoHeight);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, videoWidth, videoHeight);

  // Layout metrics to match screenshot
  const cardWidthRatio = 0.88; // width of the white card (and banners) relative to video width
  const cardWidth = Math.floor(videoWidth * cardWidthRatio);
  const sidePadding = Math.floor((videoWidth - cardWidth) / 2);
  const innerPad = Math.floor(videoWidth * 0.02);
  const maxTextWidth = cardWidth - innerPad * 2;
  // Base size derived from card width for stable ratio + hard cap
  // Scale base sizes by 1.5x to enlarge typography
  const baseFontSize = Math.floor(cardWidth * 0.056 * 1.5);
  const maxFontPx = Math.floor(cardWidth * 0.060 * 1.5);

  // Register Inter fonts if available
  const interBold = await resolveFontAsset('Inter-Bold.ttf');
  const interSemiBold = await resolveFontAsset('Inter-SemiBold.ttf');
  if (interBold) { try { GlobalFonts.registerFromPath(interBold, 'InterBold'); } catch {} }
  if (interSemiBold) { try { GlobalFonts.registerFromPath(interSemiBold, 'InterSemiBold'); } catch {} }
  const titleFontFamily = GlobalFonts.has('InterBold') ? 'InterBold' : 'Arial';
  const authorFontFamily = GlobalFonts.has('InterSemiBold') ? 'InterSemiBold' : 'Arial';
  ctx.font = `bold ${baseFontSize}px ${titleFontFamily}`;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';
  
  // Word wrap with target 3 lines max, try to keep big size
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
  // Shrink-to-fit loop with target fill ratio and line cap
  let fontSize = baseFontSize;
  const maxLines = 3;
  const targetFill = 0.60; // longest line <= 60% of available width
  const recomputeWrapped = () => {
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
    return newLines;
  };
  let longest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  while ((lines.length > maxLines || longest > maxTextWidth * targetFill || fontSize > maxFontPx) && fontSize > Math.max(18, Math.floor(baseFontSize * 0.6))) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px ${titleFontFamily}`;
    const newLines = recomputeWrapped();
    lines.length = 0; lines.push(...newLines);
    longest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  }

  // Post-fit upscale by 1.3x, then shrink-to-fit again if needed
  fontSize = Math.floor(fontSize * 1.3);
  ctx.font = `bold ${fontSize}px ${titleFontFamily}`;
  {
    const newLines = recomputeWrapped();
    lines.length = 0; lines.push(...newLines);
    longest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  }
  while ((lines.length > maxLines || longest > maxTextWidth * targetFill) && fontSize > Math.max(18, Math.floor(baseFontSize * 0.6))) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px ${titleFontFamily}`;
    const newLines = recomputeWrapped();
    lines.length = 0; lines.push(...newLines);
    longest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  }

  const lineHeight = Math.floor(fontSize * 1.22);
  const textBlockHeight = lines.length * lineHeight;
  // Reduce white box vertical padding by ~15px overall (7-8px top/bottom)
  const basePaddingY = Math.floor(videoHeight * 0.018);
  const boxPaddingY = Math.max(0, basePaddingY - 8);
  const boxHeight = textBlockHeight + boxPaddingY * 2;
  // Load banners to compute their scaled heights at card width
  let topH = 0, botH = 0;
  let topImg: any = null, botImg: any = null;
  if (topBannerPath) {
    try {
      topImg = await loadImage(topBannerPath);
      const scale = cardWidth / (topImg as any).width;
      topH = Math.round((topImg as any).height * scale);
    } catch {}
  }
  if (bottomBannerPath) {
    try {
      botImg = await loadImage(bottomBannerPath);
      const scale = cardWidth / (botImg as any).width;
      botH = Math.round((botImg as any).height * scale);
    } catch {}
  }
  // Fallback heights when banner assets are missing so layout/author still render
  const FALLBACK_TOP_RATIO = 376 / 1858;
  const FALLBACK_BOTTOM_RATIO = 234 / 1676;
  if (!topImg) {
    topH = Math.round(cardWidth * FALLBACK_TOP_RATIO);
  }
  if (!botImg) {
    botH = Math.round(cardWidth * FALLBACK_BOTTOM_RATIO);
  }
  // Center the trio (top banner + box + bottom banner) vertically
  const totalH = topH + boxHeight + botH;
  const boxY = Math.max(0, Math.floor((videoHeight - totalH) / 2) + topH);

  // White box
  ctx.fillStyle = 'white';
  ctx.globalAlpha = 1;
  ctx.fillRect(sidePadding, boxY, cardWidth, boxHeight);

  // Draw title left-aligned within the card
  ctx.fillStyle = 'black';
  ctx.font = `bold ${fontSize}px ${titleFontFamily}`;
  let y = boxY + boxPaddingY;
  for (const line of lines) {
    const x = sidePadding + innerPad + 15; // shift 10px to the right
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  // Draw author on top banner using ratios (will be placed after banner draw)

  // Helpers to draw rounded images
  const drawRounded = (img: any, x: number, y: number, w: number, h: number, radii: {tl:number; tr:number; br:number; bl:number}) => {
    ctx.save();
    ctx.beginPath();
    const r = radii;
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img as any, x, y, w, h);
    ctx.restore();
  };
  const cornerRadius = Math.floor(cardWidth * 0.03);
  // Draw top banner bottom-flush with the white box, rounded top corners (with fallback)
  {
    const drawW = cardWidth;
    const drawH = topH; // use computed top height (fallback if no image)
    const drawX = sidePadding;
    const drawY = boxY - drawH;
    if (topImg) {
      drawRounded(topImg, drawX, drawY, drawW, drawH, { tl: cornerRadius, tr: cornerRadius, br: 0, bl: 0 });
    } else {
      // Fallback: solid Reddit orange bar
      ctx.save();
      ctx.beginPath();
      const r = { tl: cornerRadius, tr: cornerRadius, br: 0, bl: 0 };
      ctx.moveTo(drawX + r.tl, drawY);
      ctx.lineTo(drawX + drawW - r.tr, drawY);
      ctx.quadraticCurveTo(drawX + drawW, drawY, drawX + drawW, drawY + r.tr);
      ctx.lineTo(drawX + drawW, drawY + drawH - r.br);
      ctx.quadraticCurveTo(drawX + drawW, drawY + drawH, drawX + drawW - r.br, drawY + drawH);
      ctx.lineTo(drawX + r.bl, drawY + drawH);
      ctx.quadraticCurveTo(drawX, drawY + drawH, drawX, drawY + drawH - r.bl);
      ctx.lineTo(drawX, drawY + r.tl);
      ctx.quadraticCurveTo(drawX, drawY, drawX + r.tl, drawY);
      ctx.closePath();
      ctx.fillStyle = '#FF4500';
      ctx.fill();
      ctx.restore();
    }

    // Author text on top banner
    const refW = 1858;
    const refH = 376;
    const usernameXRatio = 388 / refW;
    const usernameYRatio = 130 / refH;
    const ux = drawX + Math.round(drawW * usernameXRatio) + 5 - 3; // nudge 3px left
    const uy = drawY + Math.round(drawH * usernameYRatio) + 20; // lower by additional 10px
    // Match author font size exactly to computed title size
    ctx.font = `600 ${fontSize}px ${authorFontFamily}`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`u/${author}`, ux, uy);
  }
  // Draw bottom banner top-flush with the white box, rounded bottom corners
  if (botImg) {
    const scale = cardWidth / (botImg as any).width;
    const drawW = cardWidth;
    const drawH = Math.round((botImg as any).height * scale);
    drawRounded(botImg, sidePadding, boxY + boxHeight, drawW, drawH, { tl: 0, tr: 0, br: cornerRadius, bl: cornerRadius });
  }

  // Save overlay image
  const png = (canvas as any).toBuffer('image/png');
  await fs.writeFile(outputPath, png);
}

async function resolveFontAsset(filename: string): Promise<string | null> {
  // Search S3 banners/fonts/, then assets/fonts/, then local public/fonts
  const baseUrl = process.env.BACKGROUND_BASE_URL || '';
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
      try { const u = new URL(baseUrl); prefix = u.pathname.replace(/^\//, ''); } catch { prefix = ''; }
    }
    if (bucket && region !== undefined) {
      const basePrefix = (prefix ? prefix.replace(/\/?backgrounds\/?$/, '') : '');
      const tryKeys = [
        [basePrefix, 'banners', 'fonts', filename].filter(Boolean).join('/'),
        [basePrefix, 'assets', 'fonts', filename].filter(Boolean).join('/'),
      ];
      const s3 = new AWS.S3({ region: region as string });
      for (const key of tryKeys) {
        try {
          await s3.headObject({ Bucket: bucket, Key: key }).promise();
          const cacheDir = path.join(os.tmpdir(), 'font_cache');
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
          return localPath;
        } catch {}
      }
    }
  }
  // HTTP fallback
  if (/^https?:\/\//i.test(baseUrl)) {
    const root = baseUrl.replace(/\/?backgrounds\/?$/, '').replace(/\/$/, '');
    const urls = [
      `${root}/banners/fonts/${filename}`,
      `${root}/assets/fonts/${filename}`,
    ];
    const cacheDir = path.join(os.tmpdir(), 'font_cache');
    const localPath = path.join(cacheDir, filename);
    try { await fs.mkdir(cacheDir, { recursive: true }); } catch {}
    for (const url of urls) {
      try { await downloadToFile(url, localPath, 'font'); return localPath; } catch {}
    }
  }
  // Local public fallback
  const localPublic = path.join(process.cwd(), 'public', 'fonts', filename);
  try { await fs.access(localPublic); return localPublic; } catch {}
  // System fallback to DejaVu Serif Bold (Debian-based)
  const systemDeja = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf';
  try { await fs.access(systemDeja); return systemDeja; } catch {}
  return null;
}

async function compositeOverlay(bgPath: string, overlayPath: string, outputPath: string, videoId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(bgPath)
      .input(overlayPath)
      .complexFilter([
        { filter: 'scale2ref', options: 'w=iw:h=ih', inputs: '[1][0]', outputs: ['ol', 'v0'] },
        { filter: 'overlay', options: 'x=0:y=0:format=auto', inputs: ['v0', 'ol'], outputs: 'vout' }
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
      .on('start', (cmd: any) => {
        console.log(`[${videoId}] ▶️ ffmpeg command: ${cmd}`);
      })
      .on('progress', async (p: any) => {
        try { await updateProgress(videoId, Math.min(95, 70 + Math.floor((p.percent || 0) / 3))); } catch {}
      })
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}

// New: composite background with timed overlay and concatenated title+story audio
async function compositeWithAudioAndTimedOverlay(
  params: { bgPath: string; overlayPath: string; outputPath: string; titleAudioPath: string; storyAudioPath: string; titleDuration: number },
  videoId: string
): Promise<void> {
  const { bgPath, overlayPath, outputPath, titleAudioPath, storyAudioPath, titleDuration } = params;
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(bgPath)
      .input(overlayPath)
      .input(titleAudioPath)
      .input(storyAudioPath)
      .complexFilter([
        // scale overlay to match video and fade it out at titleDuration
        { filter: 'scale2ref', options: 'w=iw:h=ih', inputs: '[1][0]', outputs: ['ol', 'v0'] },
        // split overlay stream to add fadeout
        { filter: 'format', options: 'rgba', inputs: 'ol', outputs: 'olrgba' },
        { filter: 'fade', options: `t=out:st=${titleDuration - 0.1}:d=0.1:alpha=1`, inputs: 'olrgba', outputs: 'olfade' },
        { filter: 'overlay', options: 'x=0:y=0:format=auto', inputs: ['v0', 'olfade'], outputs: 'vout' },
        // concat title and story audio
        { filter: 'anull', inputs: '2:a', outputs: 'a0' },
        { filter: 'anull', inputs: '3:a', outputs: 'a1' },
        { filter: 'concat', options: 'n=2:v=0:a=1', inputs: ['a0', 'a1'], outputs: 'aout' },
      ])
      .outputOptions([
        '-map', '[vout]',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      ])
      .on('start', (cmd: any) => {
        console.log(`[${videoId}] ▶️ ffmpeg (timed overlay) command: ${cmd}`);
      })
      .on('progress', async (p: any) => {
        try { await updateProgress(videoId, Math.min(95, 70 + Math.floor((p.percent || 0) / 3))); } catch {}
      })
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}