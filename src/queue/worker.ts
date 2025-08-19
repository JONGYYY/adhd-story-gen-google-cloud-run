import { Worker, Job } from 'bullmq';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { generateVideo } from '@/lib/video-generator';
import { EnqueueVideoPayload } from './types';
import { isR2Configured, uploadFileToR2 } from '@/lib/storage/r2';
import path from 'path';

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
			const outputPath = await generateVideo({ ...options }, videoId);
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