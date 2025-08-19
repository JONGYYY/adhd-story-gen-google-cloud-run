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

async function startLocalGeneration(options: VideoOptions, videoId: string) {
	try {
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

	try {
		const options: VideoOptions = await request.json();
		console.log('Received video generation request with options (async start):', JSON.stringify(options, null, 2));

		// Always create initial status
		await createVideoStatus(videoId);

		// Kick off generation in the background and return immediately
		startLocalGeneration(options, videoId).catch((e) => {
			console.error('Background generation error:', e);
		});

		return NextResponse.json({
			success: true,
			videoId,
			message: 'Video generation started',
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to start video generation';
		console.error('Error starting video generation:', error);
		await setVideoFailed(videoId, errorMessage);
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
} 