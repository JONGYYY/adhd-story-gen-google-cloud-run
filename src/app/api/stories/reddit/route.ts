import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchRedditStories, SUBREDDIT_CONFIGS } from '@/utils/reddit';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subreddit = searchParams.get('subreddit');
    const timeframe = searchParams.get('timeframe') || 'day';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate subreddit
    if (subreddit && !Object.keys(SUBREDDIT_CONFIGS).includes(subreddit)) {
      return NextResponse.json(
        { error: 'Unsupported subreddit' },
        { status: 400 }
      );
    }

    // Validate timeframe
    const validTimeframes = ['hour', 'day', 'week', 'month', 'year', 'all'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: 'Invalid timeframe' },
        { status: 400 }
      );
    }

    // Fetch stories using our utility function
    const stories = await fetchRedditStories(
      subreddit || undefined,
      timeframe as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all',
      limit
    );

    return NextResponse.json({
      stories,
      metadata: {
        total: stories.length,
        timeframe,
        subreddit: subreddit || 'all'
      }
    });
  } catch (error) {
    console.error('Error fetching Reddit stories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stories' },
      { status: 500 }
    );
  }
} 