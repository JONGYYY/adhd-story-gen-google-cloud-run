import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type Platform = 'tiktok' | 'youtube_shorts';

export async function POST(request: NextRequest) {
  try {
    const { videoId, platforms } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      );
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid platforms array' },
        { status: 400 }
      );
    }

    // Validate platforms
    const validPlatforms: Platform[] = ['tiktok', 'youtube_shorts'];
    const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p as Platform));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Invalid platforms: ${invalidPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // TODO: Implement actual social media posting logic
    console.log(`Posting video ${videoId} to platforms:`, platforms);

    return NextResponse.json({
      success: true,
      message: 'Video queued for posting',
      platforms,
    });
  } catch (error) {
    console.error('Error posting to social media:', error);
    return NextResponse.json(
      { error: 'Failed to post to social media' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const postId = request.nextUrl.searchParams.get('id');
    const platform = request.nextUrl.searchParams.get('platform');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    // TODO: Integrate with social media APIs
    // This is a mock response with analytics
    const post = {
      id: postId,
      status: 'published',
      platforms: [
        {
          name: 'tiktok',
          status: 'published',
          post_url: 'https://tiktok.com/@user/video/123',
          analytics: {
            views: 125000,
            likes: 12500,
            comments: 450,
            shares: 1200,
            watch_time_avg: 0.76,
            completion_rate: 0.68
          }
        },
        {
          name: 'youtube_shorts',
          status: 'published',
          post_url: 'https://youtube.com/shorts/abc',
          analytics: {
            views: 75000,
            likes: 8500,
            comments: 320,
            shares: 800,
            watch_time_avg: 0.82,
            completion_rate: 0.71
          }
        }
      ],
      aggregate_analytics: {
        total_views: 200000,
        total_engagement: 23770,
        engagement_rate: 0.119,
        avg_watch_time: 0.79
      },
      performance_insights: [
        {
          type: 'peak_viewing_time',
          message: 'Your content performs best between 7-9 PM EST'
        },
        {
          type: 'audience_retention',
          message: 'Strong viewer retention in first 15 seconds'
        },
        {
          type: 'engagement_driver',
          message: 'Comments are driving most of your engagement'
        }
      ]
    };

    // Filter by platform if specified
    if (platform) {
      const platformData = post.platforms.find(p => p.name === platform);
      if (!platformData) {
        return NextResponse.json(
          { error: 'Invalid platform' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        id: post.id,
        platform: platformData,
        insights: post.performance_insights
      });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Error fetching post analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
} 