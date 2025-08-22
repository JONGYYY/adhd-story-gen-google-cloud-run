import { Worker, Job } from 'bullmq';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { generateVideo } from '@/lib/video-generator';
import { EnqueueVideoPayload } from './types';
import { isR2Configured, uploadFileToR2 } from '@/lib/storage/r2';
import path from 'path';

async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`Job timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function uploadIfConfigured(localPath: string, videoId: string): Promise<string> {
	if (isR2Configured()) {
		const key = `videos/${videoId}.mp4`;
		const url = await uploadFileToR2(localPath, key, 'video/mp4');
		return url;
	}
	// Fallback: serve from API
	return `/api/videos/${path.basename(localPath)}`;
}

export function startWorker(): Worker | null {
	const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
	if (!redisUrl) {
		console.log('Queue worker not started: no REDIS_URL');
		return null;
	}

	const worker = new Worker<EnqueueVideoPayload>('video-generation', async (job: Job<EnqueueVideoPayload>) => {
		const { videoId, options } = job.data;
		try {
			await setVideoGenerating(videoId);
			await updateProgress(videoId, 5);
			const outputPath = await withTimeout(
				generateVideo({ ...options }, videoId),
				parseInt(process.env.JOB_TIMEOUT_MS || '180000', 10),
				() => { try { setVideoFailed(videoId, 'Timed out after 180s'); } catch {} }
			);
			await updateProgress(videoId, 95);
			const finalUrl = await uploadIfConfigured(outputPath, videoId);
			await setVideoReady(videoId, finalUrl);
			return { success: true, videoId, videoUrl: finalUrl };
		} catch (e: any) {
			await setVideoFailed(videoId, e?.message || 'Video generation failed');
			throw e;
		}
	}, {
		connection: { url: redisUrl },
		concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1', 10)
	});

	worker.on('completed', (job) => {
		console.log(`[worker] Job completed: ${job.id}`);
	});
	worker.on('failed', (job, err) => {
		console.error(`[worker] Job failed: ${job?.id}`, err);
	});

	console.log('Queue worker started');
	return worker;
} 