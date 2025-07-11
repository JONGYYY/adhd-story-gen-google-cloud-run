import { VideoStatus } from './types';
import { promises as fs } from 'fs';
import path from 'path';

const STATUS_DIR = path.join(process.cwd(), 'tmp', 'status');

// Ensure status directory exists
async function ensureStatusDir() {
  await fs.mkdir(STATUS_DIR, { recursive: true });
}

// Get status file path
function getStatusPath(videoId: string): string {
  return path.join(STATUS_DIR, `${videoId}.json`);
}

export async function createVideoStatus(videoId: string): Promise<void> {
  await ensureStatusDir();
  const status: VideoStatus = {
    status: 'generating',
    progress: 0,
  };
  await fs.writeFile(
    getStatusPath(videoId),
    JSON.stringify(status, null, 2)
  );
}

export async function updateVideoStatus(
  videoId: string,
  update: Partial<VideoStatus>
): Promise<void> {
  try {
    const currentStatus = await getVideoStatus(videoId);
    const newStatus = { ...currentStatus, ...update };
    await fs.writeFile(
      getStatusPath(videoId),
      JSON.stringify(newStatus, null, 2)
    );
  } catch (error) {
    console.error(`Failed to update status for video ${videoId}:`, error);
  }
}

export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  try {
    const statusPath = getStatusPath(videoId);
    const statusJson = await fs.readFile(statusPath, 'utf-8');
    return JSON.parse(statusJson);
  } catch (error) {
    throw new Error('Video status not found');
  }
}

export async function setVideoReady(videoId: string, videoUrl: string): Promise<void> {
  const currentStatus = await getVideoStatus(videoId);
  await updateVideoStatus(videoId, {
    ...currentStatus,
    status: 'ready',
    progress: 100,
    videoUrl,
  });
}

export async function setVideoFailed(videoId: string, error: string): Promise<void> {
  const currentStatus = await getVideoStatus(videoId);
  await updateVideoStatus(videoId, {
    ...currentStatus,
    status: 'failed',
    error,
  });
}

// Helper function to update progress
export async function updateProgress(videoId: string, progress: number): Promise<void> {
  await updateVideoStatus(videoId, { progress });
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