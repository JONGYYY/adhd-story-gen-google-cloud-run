import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateVideo } from '@/lib/video-generator';
import { VideoOptions, SubredditStory, VideoGenerationOptions } from '@/lib/video-generator/types';
import { generateStory } from '@/lib/story-generator/openai';
import { createVideoStatus, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';

// Prevent static generation but use Node.js runtime for video generation
export const dynamic = 'force-dynamic';

// Railway API configuration
const RAILWAY_API_URL = 'https://adhd-story-gen-production.up.railway.app';

// Feature flag to force Railway usage even off Vercel
const FORCE_RAILWAY = process.env.FORCE_RAILWAY === 'true';

// Force deployment trigger - updated with simplified Railway backend
async function generateVideoOnRailway(options: VideoOptions, videoId: string, story: SubredditStory) {
	const railwayRequest = {
		subreddit: story.subreddit,
		isCliffhanger: options.isCliffhanger,
		voice: options.voice,
		background: options.background,
		customStory: {
			title: story.title,
			story: story.story,
			subreddit: story.subreddit,
			author: story.author
		}
	};

	console.log('Sending request to Railway API:', JSON.stringify(railwayRequest, null, 2));

	try {
		const response = await fetch(`${RAILWAY_API_URL}/generate-video`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(railwayRequest),
		});

		console.log('Railway API response status:', response.status, response.statusText);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Railway API error response:', errorText);
			throw new Error(`Railway API error: ${response.status} - ${errorText}`);
		}

		const result = await response.json();
		console.log('Railway API response:', JSON.stringify(result, null, 2));

		if (!result.success) {
			console.error('Railway API returned unsuccessful response:', result);
			throw new Error(result.error || 'Railway video generation failed');
		}

		if (!result.videoId) {
			console.error('Railway API response missing videoId:', result);
			throw new Error('Railway API response missing videoId');
		}

		console.log('Railway video generation started successfully with ID:', result.videoId);
		return result.videoId; // Railway returns its own video ID
	} catch (error) {
		console.error('Error calling Railway API:', error);
		// If Railway fails, fall back to local video ID and let the status API handle it
		console.log('Railway API failed, falling back to local video ID:', videoId);
		throw error;
	}
}

export async function POST(request: NextRequest) {
	const videoId = uuidv4();
	
	try {
		const options: VideoOptions = await request.json();
		console.log('Received video generation request with options:', JSON.stringify(options, null, 2));

		// Generate or use custom story
		let story: SubredditStory;
		if (options.customStory) {
			console.log('Using custom story:', JSON.stringify(options.customStory, null, 2));
			story = {
				title: options.customStory.title,
				story: options.customStory.story,
				subreddit: options.customStory.subreddit || 'r/stories',
				author: 'Anonymous',
			};
		} else {
			// Ensure subreddit has r/ prefix
			const subreddit = options.subreddit.startsWith('r/') ? options.subreddit : `r/${options.subreddit}`;
			console.log('Normalized subreddit:', subreddit);
			
			const storyParams = {
				subreddit,
				isCliffhanger: options.isCliffhanger,
				narratorGender: options.voice.gender,
			};
			console.log('Generating story with params:', JSON.stringify(storyParams, null, 2));
			story = await generateStory(storyParams);
		}

		// Log story data before validation
		console.log('Story data before validation:', JSON.stringify(story, null, 2));

		// Validate story data
		if (!story.title || !story.story) {
			console.error('Invalid story data:', JSON.stringify(story, null, 2));
			throw new Error('Story is missing required fields (title or story content)');
		}

		// Decide backend: prefer local unless FORCE_RAILWAY is true
		if (FORCE_RAILWAY) {
			console.log('FORCE_RAILWAY=true - using Railway API for video generation');
			try {
				const railwayVideoId = await generateVideoOnRailway(options, videoId, story);
				return NextResponse.json({
					success: true,
					videoId: railwayVideoId,
					videoUrl: `/video/${railwayVideoId}`,
					useRailway: true,
				});
			} catch (railwayError) {
				console.error('Railway API failed:', railwayError);
				return NextResponse.json(
					{ 
						success: false,
						error: `Video generation service unavailable: ${railwayError instanceof Error ? railwayError.message : 'Unknown error'}. Please try again.` 
					},
					{ status: 503 }
				);
			}
		}

		console.log('Using local video generation');
		
		// Initialize video status for local generation
		await createVideoStatus(videoId);

		// Start local video generation
		console.log('Starting local video generation with story:', JSON.stringify(story, null, 2));
		
		const generationOptions: VideoGenerationOptions = {
			...options,
			story,
		};
		
		const outputPath = await generateVideo(generationOptions, videoId);

		// Update status to ready
		await setVideoReady(videoId, outputPath);

		return NextResponse.json({
			success: true,
			videoId,
			videoUrl: outputPath,
			useRailway: false,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
		console.error('Error generating video:', error);
		
		// Only update local status if we attempted local generation
		if (!FORCE_RAILWAY) {
			await setVideoFailed(videoId, errorMessage);
		}
		
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 }
		);
	}
} 