export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
// import Snoowrap from 'snoowrap';

export async function GET(request: NextRequest) {
  try {
    // Temporarily disabled Reddit integration due to dependency issues
    return NextResponse.json({
      success: false,
      error: 'Reddit integration temporarily disabled'
    }, { status: 503 });

    /* 
    const r = new Snoowrap({
      userAgent: process.env.REDDIT_USER_AGENT || 'StoryScrapper/1.0',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      refreshToken: process.env.REDDIT_REFRESH_TOKEN!
    });

    const subreddit = r.getSubreddit('AmItheAsshole');
    const posts = await subreddit.getHot({ limit: 10 });
    
    const stories = posts.map(post => ({
      id: post.id,
      title: post.title,
      content: post.selftext,
      score: post.score,
      url: post.url,
      created: post.created_utc
    }));

    return NextResponse.json({ success: true, stories });
    */
  } catch (error) {
    console.error('Reddit API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Reddit stories'
    }, { status: 500 });
  }
} 