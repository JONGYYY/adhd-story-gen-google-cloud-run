// @ts-nocheck
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
import { generateSpeech } from './voice';

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

async function transcodeToWav(srcPath: string, dstPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    ffmpeg()
      .input(srcPath)
      .audioChannels(2)
      .audioFrequency(44100)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('error', reject)
      .on('end', () => resolve(dstPath))
      .save(dstPath);
  });
}

async function normalizeAndBoostWav(srcPath: string, dstPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    ffmpeg()
      .input(srcPath)
      .outputOptions([
        '-af', 'dynaudnorm=f=250:g=31:m=5,volume=20dB',
        '-ar', '44100',
        '-ac', '2',
      ])
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('error', reject)
      .on('end', () => resolve(dstPath))
      .save(dstPath);
  });
}

async function isWavSilent(filePath: string, sampleBytes = 22050 * 2 * 2): Promise<boolean> {
  try {
    const buf = await fs.readFile(filePath);
    // Skip 44-byte WAV header
    const start = 44;
    const end = Math.min(buf.length, start + sampleBytes);
    for (let i = start; i < end; i++) {
      if (buf[i] !== 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function remuxToM4A(srcPath: string, dstPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    ffmpeg()
      .input(srcPath)
      .outputOptions(['-c:a', 'aac', '-b:a', '192k'])
      .on('error', reject)
      .on('end', () => resolve(dstPath))
      .save(dstPath);
  });
}

async function logAudioProbe(tag: string, audioPath: string): Promise<void> {
  await new Promise<void>((resolve) => {
    ffmpeg(audioPath).ffprobe((err, data) => {
      if (err) {
        console.log(`[probe:${tag}] error: ${err.message}`);
        return resolve();
      }
      try {
        const streams = (data?.streams || []).map((s: any) => ({
          index: s?.index,
          codec: s?.codec_name,
          type: s?.codec_type,
          channels: s?.channels,
          sample_rate: s?.sample_rate,
        }));
        console.log(`[probe:${tag}] format=${data?.format?.format_name} duration=${data?.format?.duration} streams=${JSON.stringify(streams)}`);
      } catch {}
      resolve();
    });
  });
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

    // TTS for title + story using ElevenLabs util with timeout and silent fallback to avoid hangs
    const makeSilentWav = (seconds: number): Buffer => {
      const sampleRate = 22050; const channels = 1; const bits = 16;
      const bytesPerSample = bits/8; const blockAlign = channels*bytesPerSample;
      const byteRate = sampleRate*blockAlign; const dataSize = Math.floor(seconds*sampleRate)*blockAlign;
      const fileSize = 36+dataSize; const buf = Buffer.alloc(44+dataSize);
      let o=0; buf.write('RIFF',o); o+=4; buf.writeUInt32LE(fileSize,o); o+=4; buf.write('WAVE',o); o+=4;
      buf.write('fmt ',o); o+=4; buf.writeUInt32LE(16,o); o+=4; buf.writeUInt16LE(1,o); o+=2; buf.writeUInt16LE(channels,o); o+=2;
      buf.writeUInt32LE(sampleRate,o); o+=4; buf.writeUInt32LE(byteRate,o); o+=4; buf.writeUInt16LE(blockAlign,o); o+=2; buf.writeUInt16LE(bits,o); o+=2;
      buf.write('data',o); o+=4; buf.writeUInt32LE(dataSize,o); o+=4; buf.fill(0,o);
      return buf;
    };
    const withTimeout = async (p: Promise<ArrayBuffer>, ms: number) => {
      return await Promise.race([
        p,
        new Promise<ArrayBuffer>((_res, rej) => setTimeout(() => rej(new Error('tts-timeout')), ms))
      ]);
    };
    const voice = (options as any)?.voice || { id: 'adam', gender: 'male' };
    let titleAudioPath = path.join(os.tmpdir(), `${videoId}_title.wav`);
    let storyAudioPath = path.join(os.tmpdir(), `${videoId}_story.wav`);
    let titleDuration = Math.max(1.2, Math.min(6, title.length * 0.06));
    try {
      const titleBuf = await withTimeout(generateSpeech({ text: title, voice }), 20000) as ArrayBuffer;
      const storyBuf = await withTimeout(generateSpeech({ text: fullStory || title, voice }), 30000) as ArrayBuffer;
      const titleMp3 = path.join(os.tmpdir(), `${videoId}_title.mp3`);
      const storyMp3 = path.join(os.tmpdir(), `${videoId}_story.mp3`);
      await fs.writeFile(titleMp3, Buffer.from(titleBuf));
      await fs.writeFile(storyMp3, Buffer.from(storyBuf));
      // Force transcode to WAV (44.1kHz stereo) to ensure reliable decoding across players
      const titleWav = path.join(os.tmpdir(), `${videoId}_title.wav`);
      const storyWav = path.join(os.tmpdir(), `${videoId}_story.wav`);
      await transcodeToWav(titleMp3, titleWav);
      // Normalize and aggressively boost story to ensure audibility even if very quiet
      const storyWavBoosted = path.join(os.tmpdir(), `${videoId}_story_boosted.wav`);
      await transcodeToWav(storyMp3, storyWav);
      await normalizeAndBoostWav(storyWav, storyWavBoosted);
      if (await isWavSilent(storyWavBoosted)) {
        const tonePath = path.join(os.tmpdir(), `${videoId}_story_tone.wav`);
        await new Promise<void>((resolve, reject) => {
          ffmpeg()
            .input(`sine=frequency=880:sample_rate=44100:duration=${Math.max(2, Math.min(30, (fullStory || title).split(/\s+/).length * 0.35))}`)
            .inputOptions(['-f', 'lavfi'])
            .outputOptions(['-f', 'wav', '-ac', '2', '-ar', '44100', '-filter:a', 'volume=0.7'])
            .on('error', reject)
            .on('end', () => resolve())
            .save(tonePath);
        });
        console.warn(`[${videoId}] ⚠️ Story audio appears silent after normalization; using tone fallback.`);
        storyAudioPath = tonePath;
      }
      titleAudioPath = titleWav;
      storyAudioPath = storyWavBoosted;
      await logAudioProbe('title', titleAudioPath);
      await logAudioProbe('story', storyAudioPath);
      // If probe shows no audio stream for MP3, remux to AAC (m4a)
      try {
        const storyDur = await getAudioDurationSeconds(storyAudioPath);
        if (!Number.isFinite(storyDur) || storyDur <= 0.01) {
          const m4a = path.join(os.tmpdir(), `${videoId}_story.m4a`);
          await remuxToM4A(storyAudioPath, m4a);
          storyAudioPath = m4a;
          await logAudioProbe('story-remux', storyAudioPath);
        }
      } catch {}
    } catch (e) {
      console.warn(`[${videoId}] ⚠️ TTS failed or timed out, using silent WAV fallback:`, (e as any)?.message || e);
      const silentTitle = makeSilentWav(titleDuration);
      const estStory = Math.max(3, Math.min(22, (fullStory || title).split(/\s+/).length * 0.35));
      const silentStory = makeSilentWav(estStory);
      await fs.writeFile(titleAudioPath, silentTitle);
      await fs.writeFile(storyAudioPath, silentStory);
    }
    // If audio duration is still 0, synthesize an audible tone to validate mux and ensure sound
    const ensureAudible = async (pathOut: string, seconds: number) => {
      try {
        const dur = await getAudioDurationSeconds(pathOut);
        if (dur > 0.2) return;
      } catch {}
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(`sine=frequency=880:sample_rate=22050:duration=${Math.max(0.5, seconds)}`)
          .inputOptions(['-f', 'lavfi'])
          .outputOptions(['-f', 'wav', '-ac', '1', '-ar', '22050'])
          .on('error', reject)
          .on('end', () => resolve())
          .save(pathOut);
      });
    };
    // Do not overwrite TTS audio; rely on debug tone mix in composite for audibility
    // Measure actual durations and sizes
    let measuredTitle = 0; let measuredStory = 0;
    try { measuredTitle = await getAudioDurationSeconds(titleAudioPath); } catch {}
    try { measuredStory = await getAudioDurationSeconds(storyAudioPath); } catch {}
    // If WAV seems empty, try measuring and using the original MP3 as fallback
    if (measuredStory < 0.2) {
      const mp3Fallback = path.join(os.tmpdir(), `${videoId}_story.mp3`);
      try {
        const dmp3 = await getAudioDurationSeconds(mp3Fallback);
        if (dmp3 > measuredStory) {
          console.warn(`[${videoId}] ⚠️ WAV story duration ${measuredStory.toFixed(2)}s appears empty; falling back to MP3 (${dmp3.toFixed(2)}s)`);
          storyAudioPath = mp3Fallback;
          measuredStory = dmp3;
        }
      } catch {}
    }
    // If still effectively silent, synthesize a quiet-but-audible tone as last-resort fallback
    if (measuredStory < 0.2) {
      const estStory = Math.max(3, Math.min(22, (fullStory || title).split(/\s+/).length * 0.35));
      const tonePath = path.join(os.tmpdir(), `${videoId}_story_fallback.wav`);
      await ensureAudible(tonePath, estStory);
      try { measuredStory = await getAudioDurationSeconds(tonePath); } catch {}
      storyAudioPath = tonePath;
      console.warn(`[${videoId}] ⚠️ Story audio missing; using generated tone fallback (${measuredStory.toFixed(2)}s)`);
    }
    // Log final audio paths and durations
    console.log(`[${videoId}] 🔉 Using audio: title=${titleAudioPath}, story=${storyAudioPath}, durations: title=${measuredTitle.toFixed(2)}s, story=${measuredStory.toFixed(2)}s`);
    try {
      const stT = await fs.stat(titleAudioPath); const stS = await fs.stat(storyAudioPath);
      console.log(`[${videoId}] 🔊 Audio sizes: title=${stT.size} bytes, story=${stS.size} bytes; durations: title=${measuredTitle.toFixed(2)}s, story=${measuredStory.toFixed(2)}s`);
    } catch {}
    if (measuredTitle > 0) titleDuration = measuredTitle;
    const totalDuration = Math.max(2, titleDuration + (measuredStory > 0 ? measuredStory : 0) + 1);
    try { await updateProgress(videoId, 45); } catch {}

    // Create overlay with banners + white title box
    const overlayPath = path.join(os.tmpdir(), `overlay_${videoId}.png`);
    console.log(`[${videoId}] 🖼️ Creating banner overlay...`);
    const srcExt = path.extname(storyAudioPath) || 'unknown';
    const debugText = `dur(title)=${(measuredTitle||0).toFixed(2)}s dur(story)=${(measuredStory||0).toFixed(2)}s src=${srcExt}`;
    await createBannerOverlay({
      videoWidth,
      videoHeight,
      title,
      author,
      topBannerPath,
      bottomBannerPath,
      outputPath: overlayPath,
      debugText,
    });
    await updateProgress(videoId, 60);

    // Build center one-word captions (remove [BREAK]) starting right after the title finishes
    const subsPath = path.join(os.tmpdir(), `captions_${videoId}.ass`);
    const captionText = (fullStory || title).replace(/\[BREAK\]/g, ' ');
    await buildCenterWordAss(captionText, storyAudioPath, subsPath, Math.max(0, titleDuration + 0.10));

    // Composite with audio, overlay only during title audio, then remove for captions area
    const finalPath = path.join(os.tmpdir(), `output_${videoId}.mp4`);
    console.log(`[${videoId}] 🎬 Starting ffmpeg composite...`);
    await updateProgress(videoId, 70);
    await compositeWithAudioAndTimedOverlay({
      bgPath: bgLocalPath,
      overlayPath,
      outputPath: finalPath,
      titleAudioPath: titleAudioPath,
      storyAudioPath: storyAudioPath,
      titleDuration: Math.max(0.1, titleDuration),
      totalDuration,
      subsPath,
      measuredStory,
    }, videoId);
    // Probe final mux to confirm audio stream presence
    try { await logAudioProbe('final-video', finalPath); } catch {}
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
  if ((process.env.SKIP_REMOTE_BANNERS || '0') === '1') {
    const localPublic = path.join(process.cwd(), 'public', 'assets', filename);
    try { await fs.access(localPublic); return localPublic; } catch {}
    return null;
  }
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
  debugText?: string;
};

async function createBannerOverlay(params: OverlayParams): Promise<void> {
  const { videoWidth, videoHeight, title, author, topBannerPath, bottomBannerPath, outputPath, debugText } = params;
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
  // Increase both title and author size by 2x from current
  const baseFontSize = Math.floor(cardWidth * (0.112 * 2 / 6 * 2));
  const maxFontPx = Math.floor(cardWidth * (0.130 * 2 / 6 * 2));

  // Register Inter fonts if available and prefer them; fallback to Arial
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
  const targetFill = 0.72; // balanced large text without overflow
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

  // No post-fit upscale; keep original sizing for stable appearance

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
  let y = boxY + boxPaddingY + 5;
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
    // Make author the same size as title
    const authorPx = Math.max(18, Math.floor(fontSize));
    ctx.font = `600 ${authorPx}px ${authorFontFamily}`;
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

  // Optional debug: draw tiny text with measured durations near bottom-left
  if (debugText) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.font = `bold ${Math.max(14, Math.floor(videoWidth * 0.018))}px ${titleFontFamily}`;
    ctx.fillText(debugText, sidePadding, Math.min(videoHeight - 20, boxY + boxHeight + 40));
  }

  // Save overlay image
  const png = (canvas as any).toBuffer('image/png');
  await fs.writeFile(outputPath, png);
}

async function resolveFontAsset(filename: string): Promise<string | null> {
  if ((process.env.SKIP_REMOTE_BANNERS || '0') === '1') {
    const localPublic = path.join(process.cwd(), 'public', 'fonts', filename);
    try { await fs.access(localPublic); return localPublic; } catch {}
  }
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
      .input(storyAudioPath)
      .complexFilter([
        { filter: 'scale2ref', options: 'w=iw:h=ih', inputs: '[1][0]', outputs: ['ol', 'v0'] },
        { filter: 'format', options: 'rgba', inputs: 'ol', outputs: 'olrgba' },
        { filter: 'fade', options: `t=out:st=${titleDuration - 0.1}:d=0.1:alpha=1`, inputs: 'olrgba', outputs: 'olfade' },
        { filter: 'overlay', options: 'x=0:y=0:format=auto', inputs: ['v0', 'olfade'], outputs: 'vout' },
        { filter: 'anull', inputs: '2:a', outputs: 'a0' },
        { filter: 'anull', inputs: '3:a', outputs: 'a1' },
        { filter: 'concat', options: 'n=2:v=0:a=1', inputs: ['a0', 'a1'], outputs: 'aout' }
      ])
      .outputOptions([
        '-map', '[vout]',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-ac', '2',
        '-ar', '44100',
        '-b:a', '192k',
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

// ffprobe duration helper
async function getAudioDurationSeconds(audioPath: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    ffmpeg(audioPath).ffprobe((err, data) => {
      if (err) return reject(err);
      const d = Number(data?.format?.duration || 0);
      resolve(d > 0 ? d : 0);
    });
  });
}

// Build center one-word ASS subtitles aligned to audio length, with optional start offset
async function buildCenterWordAss(text: string, audioPath: string, outAssPath: string, startOffsetSec = 0): Promise<void> {
  const words = text.split(/\s+/).filter(Boolean);
  let total = 0;
  try { total = await getAudioDurationSeconds(audioPath); } catch { total = Math.max(3, words.length * 0.35); }
  const per = Math.max(0.18, total / Math.max(1, words.length));

  // alignment=2 => center; MarginV positions vertically. Use ~960/2 to center baseline closely.
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,88,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,2,10,10,960,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const toTime = (s: number) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60); const cs = Math.floor((s % 1) * 100);
    return `${String(h).padStart(1,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };
  let t = Math.max(0, startOffsetSec); let lines = '';
  for (const w of words) {
    const start = toTime(t);
    const end = toTime(t + per);
    lines += `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\bord4} ${w}\n`;
    t += per;
  }
  await fs.writeFile(outAssPath, header + lines);
}

// New: composite background with timed overlay and concatenated title+story audio
async function compositeWithAudioAndTimedOverlay(
  params: { bgPath: string; overlayPath: string; outputPath: string; titleAudioPath: string; storyAudioPath: string; titleDuration: number; totalDuration: number; subsPath: string; measuredStory: number },
  videoId: string
): Promise<void> {
  const { bgPath, overlayPath, outputPath, titleAudioPath, storyAudioPath, titleDuration, totalDuration, subsPath, measuredStory } = params;
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
        // hard-disable overlay as soon as captions start to guarantee no overlap
        { filter: 'overlay', options: `x=0:y=0:format=auto:enable='lt(t,${Math.max(0.1, titleDuration)})'`, inputs: ['v0', 'olrgba'], outputs: 'vtmp' },
        // burn subtitles (centered one-word) starting just after title
        { filter: 'ass', options: `filename=${subsPath}:original_size=1080x1920`, inputs: 'vtmp', outputs: 'vout' },
      ])
      .outputOptions([
        '-map', '[vout]',
        // Map audio from the 4th input (storyAudioPath) directly
        '-map', '3:a',
        // Ensure audible output
        '-af', 'volume=2.5',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        `-t`, `${Math.max(1, totalDuration)}`,
        '-shortest',
        '-loglevel', 'debug'
      ])
      .on('start', (cmd: any) => {
        console.log(`[${videoId}] ▶️ ffmpeg (timed overlay) command: ${cmd}`);
        console.log(`[${videoId}] ▶️ mapping: video=[vout] audio=3:a`);
      })
      .on('stderr', (line: any) => {
        if (typeof line === 'string') {
          if (line.includes('Stream') || line.includes('audio') || line.includes('Error') || line.includes('Matched')) {
            console.log(`[${videoId}] ffmpeg: ${line}`);
          }
        }
      })
      .on('progress', async (p: any) => {
        try { await updateProgress(videoId, Math.min(95, 70 + Math.floor((p.percent || 0) / 3))); } catch {}
      })
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath);
  });
}