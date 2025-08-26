import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getQueue } from '@/queue';

// Ensure Node runtime and dynamic route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeLogOptions(options: unknown): Record<string, unknown> {
	if (!options || typeof options !== 'object') return { type: typeof options };
	const o = options as Record<string, unknown>;
	const pick = (key: string) => (key in o ? o[key] : undefined);
	return {
		subreddit: pick('subreddit'),
		isCliffhanger: pick('isCliffhanger'),
		voice: (() => {
			const v = o['voice'] as any;
			return v && typeof v === 'object' ? { gender: v.gender, model: v.model, voiceId: v.voiceId } : undefined;
		})(),
		background: (() => {
			const b = o['background'] as any;
			return b && typeof b === 'object' ? { category: b.category, type: b.type } : undefined;
		})(),
		customStory: (() => {
			const cs = o['customStory'] as any;
			return cs && typeof cs === 'object' ? { has: true, titleLen: (cs.title || '').length, storyLen: (cs.story || '').length } : false;
		})(),
	};
}

async function startLocalGeneration(options: any, videoId: string) {
	try {
		const [{ createVideoStatus, setVideoReady, setVideoFailed, updateProgress, setVideoGenerating }, { generateVideo }, { generateStory }] = await Promise.all([
			import('@/lib/video-generator/status'),
			import('@/lib/video-generator'),
			import('@/lib/story-generator/openai'),
		]);

		await createVideoStatus(videoId);
		await setVideoGenerating(videoId);
		await updateProgress(videoId, 5);

		let story: any;
		if (options.customStory) {
			story = {
				title: options.customStory.title,
				story: options.customStory.story,
				subreddit: options.customStory.subreddit || 'r/stories',
				author: 'Anonymous',
			};
		} else {
			const subreddit = options.subreddit && options.subreddit.startsWith('r/') ? options.subreddit : `r/${options.subreddit || 'stories'}`;
			story = await generateStory({
				subreddit,
				isCliffhanger: options.isCliffhanger,
				narratorGender: options.voice?.gender,
			});
		}

		await updateProgress(videoId, 10);

		const generationOptions = { ...options, story };
		const outputPath = await generateVideo(generationOptions as any, videoId);
		await setVideoReady(videoId, outputPath);
	} catch (error) {
		try {
			const { setVideoFailed } = await import('@/lib/video-generator/status');
			await setVideoFailed(videoId, error instanceof Error ? error.message : 'Video generation failed');
		} catch {}
		console.error('Async local generation failed:', error);
	}
}

export async function POST(request: NextRequest) {
	console.log('=== POST /api/generate-video called ===');
	const videoId = uuidv4();
	console.log('Generated videoId:', videoId);

	let options: any;
	try {
		const bodyText = await request.text();
		console.log('Raw request body length:', bodyText.length);
		console.log('Raw request body preview:', bodyText.substring(0, 200));
		options = JSON.parse(bodyText || '{}');
		console.log('Successfully parsed JSON');
	} catch (e) {
		console.error('Failed to parse request body:', e);
		return NextResponse.json({ 
			success: false, 
			error: 'Invalid JSON body',
			details: e instanceof Error ? e.message : 'Unknown parse error'
		}, { status: 200 });
	}

	try {
		console.log('Received video generation request (safe):', safeLogOptions(options));
		const useQueue = !!process.env.REDIS_URL && process.env.USE_QUEUE === '1';
		if (useQueue) {
			const queue = getQueue();
			if (queue) {
				await queue.add('generate', { videoId, options, requestedAt: Date.now() }, { removeOnComplete: 100, removeOnFail: 100 });
				console.log('Enqueued job to Redis queue');
			} else {
				console.warn('USE_QUEUE=1 but queue unavailable; falling back to in-process generation');
				setTimeout(() => {
					startLocalGeneration(options, videoId).catch((err) => console.error('Background generation error:', err));
				}, 0);
			}
		} else {
			setTimeout(() => {
				startLocalGeneration(options, videoId).catch((err) => console.error('Background generation error:', err));
			}, 0);
			console.log('Started in-process background generation');
		}
		const response = { success: true, videoId, message: 'Video generation started' };
		console.log('Returning response:', response);
		return new NextResponse(JSON.stringify(response), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store',
				'Pragma': 'no-cache'
			}
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to start video generation';
		console.error('Error starting video generation:', error);
		return NextResponse.json({ success: false, error: errorMessage }, { status: 200 });
	}
} 