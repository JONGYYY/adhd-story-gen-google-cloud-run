import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import Redis from 'ioredis';

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  // Use /tmp for Vercel, os.tmpdir() for local development
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

const STATUS_DIR = path.join(getTmpDir(), 'status');
const DAY_IN_MS = 24 * 60 * 60 * 1000;

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  if (!url) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    // Best-effort connect
    redisClient.connect().catch(() => {});
    return redisClient;
  } catch {
    return null;
  }
}

const REDIS_TTL_SECONDS = Math.floor(DAY_IN_MS / 1000);

async function writeStatusRedis(videoId: string, data: any): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(`status:${videoId}`, JSON.stringify(data), 'EX', REDIS_TTL_SECONDS);
}

async function readStatusRedis(videoId: string): Promise<any | null> {
  const r = getRedis();
  if (!r) return null;
  const v = await r.get(`status:${videoId}`);
  return v ? JSON.parse(v) : null;
}

// Create status directory if it doesn't exist
async function ensureStatusDir() {
  await fs.mkdir(STATUS_DIR, { recursive: true });
}

async function writeStatusAtomic(videoId: string, data: any): Promise<void> {
  // Prefer Redis if available
  const r = getRedis();
  if (r) {
    await writeStatusRedis(videoId, data);
    return;
  }
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  const tempFile = statusFile + '.tmp';
  const payload = JSON.stringify(data);
  await fs.writeFile(tempFile, payload);
  await fs.rename(tempFile, statusFile);
}

async function readStatusWithRetry(videoId: string, retries = 3, delayMs = 20): Promise<any> {
  // Try Redis first
  const fromRedis = await readStatusRedis(videoId).catch(() => null);
  if (fromRedis) return fromRedis;
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await fs.readFile(statusFile, 'utf-8');
      return JSON.parse(text);
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return { status: 'not_found' };
      }
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs));
        continue;
      }
      throw error;
    }
  }
  return { status: 'not_found' };
}

export async function createVideoStatus(videoId: string) {
  await writeStatusAtomic(videoId, {
    status: 'generating',
    progress: 0,
    createdAt: Date.now(),
  });
}

export async function setVideoGenerating(videoId: string) {
  await writeStatusAtomic(videoId, {
    status: 'generating',
    progress: 0,
    createdAt: Date.now(),
  });
}

export async function updateProgress(videoId: string, progress: number) {
  const status = await readStatusWithRetry(videoId);
  const current = typeof status.progress === 'number' ? status.progress : 0;
  const nextProgress = Math.max(current, Math.floor(progress));
  await writeStatusAtomic(videoId, {
    ...status,
    status: 'generating',
    progress: nextProgress,
    updatedAt: Date.now(),
  });
}

export async function setVideoReady(videoId: string, videoUrl: string) {
  await writeStatusAtomic(videoId, {
    status: 'ready',
    progress: 100,
    videoUrl,
    completedAt: Date.now(),
  });
}

export async function setVideoFailed(videoId: string, error: string) {
  await writeStatusAtomic(videoId, {
    status: 'failed',
    error,
    failedAt: Date.now(),
  });
}

export async function getVideoStatus(videoId: string) {
  return readStatusWithRetry(videoId);
}

// Clean up old status files (older than 24 hours)
export async function cleanupOldStatus(): Promise<void> {
  try {
    // If using Redis, rely on TTL expiry
    if (getRedis()) return;
    await ensureStatusDir();
    const files = await fs.readdir(STATUS_DIR);
    const now = Date.now();
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(STATUS_DIR, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > DAY_IN_MS) {
          await fs.unlink(filePath);
        }
      })
    );
  } catch (error) {
    console.error('Failed to cleanup old status files:', error);
  }
} 