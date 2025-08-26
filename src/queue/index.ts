import { Queue } from 'bullmq';

let queue: Queue | null = null;

export function getQueue(): Queue | null {
	const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
	if (!redisUrl) return null;
	if (queue) return queue;
	queue = new Queue('video-generation', {
		connection: { url: redisUrl }
	});
	return queue;
} 