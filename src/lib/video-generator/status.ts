import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  // Use /tmp for Vercel, os.tmpdir() for local development
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

const STATUS_DIR = path.join(getTmpDir(), 'status');

// Create status directory if it doesn't exist
async function ensureStatusDir() {
  await fs.mkdir(STATUS_DIR, { recursive: true });
}

export async function createVideoStatus(videoId: string) {
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  await fs.writeFile(statusFile, JSON.stringify({
    status: 'generating',
    progress: 0,
    createdAt: Date.now()
  }));
}

export async function setVideoGenerating(videoId: string) {
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  await fs.writeFile(statusFile, JSON.stringify({
    status: 'generating',
    progress: 0,
    createdAt: Date.now()
  }));
}

export async function updateProgress(videoId: string, progress: number) {
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  const status = await getVideoStatus(videoId);
  await fs.writeFile(statusFile, JSON.stringify({
    ...status,
    progress
  }));
}

export async function setVideoReady(videoId: string, videoUrl: string) {
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  await fs.writeFile(statusFile, JSON.stringify({
    status: 'ready',
    progress: 100,
    videoUrl,
    completedAt: Date.now()
  }));
}

export async function setVideoFailed(videoId: string, error: string) {
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  await fs.writeFile(statusFile, JSON.stringify({
    status: 'failed',
    error,
    failedAt: Date.now()
  }));
}

export async function getVideoStatus(videoId: string) {
  await ensureStatusDir();
  const statusFile = path.join(STATUS_DIR, `${videoId}.json`);
  try {
    const data = await fs.readFile(statusFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { status: 'not_found' };
    }
    throw error;
  }
}

// Clean up old status files (older than 24 hours)
export async function cleanupOldStatus(): Promise<void> {
  try {
    await ensureStatusDir();
    const files = await fs.readdir(STATUS_DIR);
    const now = Date.now();
    const DAY_IN_MS = 24 * 60 * 60 * 1000;

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