import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateVideo } from '@/lib/video-generator';
import { VideoOptions, SubredditStory, VideoGenerationOptions } from '@/lib/video-generator/types';
import { generateStory } from '@/lib/story-generator/openai';
import { createVideoStatus, setVideoReady, setVideoFailed, updateProgress, setVideoGenerating } from '@/lib/video-generator/status';

// Ensure Node runtime and dynamic route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Feature flag retained but we prefer local async generation in single service setup
const FORCE_RAILWAY = process.env.FORCE_RAILWAY === 'true';

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

async function startLocalGeneration(options: VideoOptions, videoId: string) {
	try {
		await createVideoStatus(videoId);
		await setVideoGenerating(videoId);
		await updateProgress(videoId, 5);

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
	console.log('=== POST /api/generate-video called ===');
	const videoId = uuidv4();
	console.log('Generated videoId:', videoId);

	let options: VideoOptions;
	try {
		const bodyText = await request.text();
		console.log('Raw request body length:', bodyText.length);
		console.log('Raw request body preview:', bodyText.substring(0, 200));
		
		options = JSON.parse(bodyText);
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

		// Kick off generation in the background and return immediately
		setTimeout(() => {
			startLocalGeneration(options, videoId).catch((err) => console.error('Background generation error:', err));
		}, 0);

		const response = { success: true, videoId, message: 'Video generation started' };
		console.log('Returning response:', response);
		return NextResponse.json(response);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to start video generation';
		console.error('Error starting video generation:', error);
		// Never return 500; surface error in body for friendlier UX
		return NextResponse.json({ success: false, error: errorMessage }, { status: 200 });
	}
} 