import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      story,
      background_category,
      voice_style,
      playback_speed,
      text_style,
      background_music
    } = body;

    // Validate required parameters
    if (!story || !background_category || !voice_style) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // TODO: Integrate with video generation service
    // This is a mock response
    const video = {
      id: Math.random().toString(36).substr(2, 9),
      status: 'processing',
      estimated_duration: '45s',
      settings: {
        story_id: story.id,
        background_category,
        voice_style,
        playback_speed: playback_speed || 1,
        text_style: text_style || {
          font: 'Roboto',
          size: 'medium',
          position: 'center'
        },
        background_music: background_music || {
          track: 'none',
          volume: 0.5
        }
      },
      progress: {
        current_step: 'initializing',
        percent_complete: 0,
        steps: [
          {
            name: 'story_processing',
            status: 'pending',
            description: 'Processing story text'
          },
          {
            name: 'voice_generation',
            status: 'pending',
            description: 'Generating AI voice-over'
          },
          {
            name: 'background_selection',
            status: 'pending',
            description: 'Selecting background footage'
          },
          {
            name: 'video_composition',
            status: 'pending',
            description: 'Compositing final video'
          }
        ]
      },
      preview: {
        thumbnail_url: null,
        preview_url: null
      },
      metadata: {
        created_at: new Date().toISOString(),
        estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        size: '1080x1920',
        format: 'mp4'
      }
    };

    return NextResponse.json(video);
  } catch (error) {
    console.error('Error generating video:', error);
    return NextResponse.json(
      { error: 'Failed to generate video' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get('id');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // TODO: Integrate with video generation service
    // This is a mock response showing progress
    const video = {
      id: videoId,
      status: 'processing',
      progress: {
        current_step: 'voice_generation',
        percent_complete: 45,
        steps: [
          {
            name: 'story_processing',
            status: 'completed',
            description: 'Processing story text'
          },
          {
            name: 'voice_generation',
            status: 'in_progress',
            description: 'Generating AI voice-over'
          },
          {
            name: 'background_selection',
            status: 'pending',
            description: 'Selecting background footage'
          },
          {
            name: 'video_composition',
            status: 'pending',
            description: 'Compositing final video'
          }
        ]
      },
      preview: {
        thumbnail_url: 'https://example.com/thumbnails/video123.jpg',
        preview_url: null
      }
    };

    return NextResponse.json(video);
  } catch (error) {
    console.error('Error fetching video status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video status' },
      { status: 500 }
    );
  }
} 