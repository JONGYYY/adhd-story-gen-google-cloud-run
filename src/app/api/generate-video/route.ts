import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateVideo } from '@/lib/video-generator';
import { VideoOptions, SubredditStory, VideoGenerationOptions } from '@/lib/video-generator/types';
import { generateStory } from '@/lib/story-generator/openai';
import { createVideoStatus, setVideoReady, setVideoFailed, updateProgress, setVideoGenerating } from '@/lib/video-generator/status';

// Prevent static generation but use Node.js runtime for video generation
export const dynamic = 'force-dynamic';

// Feature flag retained but we prefer local async generation in single service setup
const FORCE_RAILWAY = process.env.FORCE_RAILWAY === 'true';

function safeLogOptions(options: unknown): Record<string, unknown> {
	if (!options || typeof options !== 'object') return { type: typeof options };
	const o = options as Record<string, unknown>;
	const pick = (key: string) => (key in o ? o[key] : undefined);
	return {
		// top-level fields we care about; avoid deep structures
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

async function startLocalGeneration(options: VideoOptions, videoId: string) {
	try {
		await createVideoStatus(videoId);
		await setVideoGenerating(videoId);
		await updateProgress(videoId, 5);

		// Prepare story (generate if not provided)
		let story: SubredditStory;
		if (options.customStory) {
			story = {
				title: options.customStory.title,
				story: options.customStory.story,
				subreddit: options.customStory.subreddit || 'r/stories',
				author: 'Anonymous',
			};
		} else {
			const subreddit = options.subreddit.startsWith('r/') ? options.subreddit : `r/${options.subreddit}`;
			const storyParams = {
				subreddit,
				isCliffhanger: options.isCliffhanger,
				narratorGender: options.voice.gender,
			};
			story = await generateStory(storyParams);
		}

		await updateProgress(videoId, 10);

		const generationOptions: VideoGenerationOptions = {
			...options,
			story,
		};

		const outputPath = await generateVideo(generationOptions, videoId);
		await setVideoReady(videoId, outputPath);
	} catch (error) {
		console.error('Async local generation failed:', error);
		await setVideoFailed(videoId, error instanceof Error ? error.message : 'Video generation failed');
	}
}

export async function POST(request: NextRequest) {
	const videoId = uuidv4();

	let options: VideoOptions;
	try {
		options = await request.json();
	} catch (e) {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	try {
		console.log('Received video generation request (safe):', safeLogOptions(options));

		// Kick off generation in the background and return immediately
		setTimeout(() => {
			startLocalGeneration(options, videoId).catch((err) => console.error('Background generation error:', err));
		}, 0);

		return NextResponse.json({ success: true, videoId, message: 'Video generation started' });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to start video generation';
		console.error('Error starting video generation:', error);
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
} 