import snoowrap from 'snoowrap';
import { load } from 'cheerio';
import fetch from 'node-fetch';

// Story categories based on content
export enum StoryCategory {
  DRAMA = 'drama',
  MYSTERY = 'mystery',
  CONFESSION = 'confession',
  REVENGE = 'revenge',
  SUPERNATURAL = 'supernatural'
}

// Reddit API configuration
const reddit = new snoowrap({
  userAgent: 'StoryGen AI v1.0',
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  refreshToken: process.env.REDDIT_REFRESH_TOKEN
});

// Subreddit configurations with category mappings
export const SUBREDDIT_CONFIGS = {
  'AmItheAsshole': {
    defaultCategory: StoryCategory.DRAMA,
    keywords: {
      [StoryCategory.REVENGE]: ['revenge', 'got back', 'karma'],
      [StoryCategory.CONFESSION]: ['confession', 'admit', 'truth'],
    }
  },
  'TrueOffMyChest': {
    defaultCategory: StoryCategory.CONFESSION,
    keywords: {
      [StoryCategory.DRAMA]: ['drama', 'conflict', 'fight'],
      [StoryCategory.REVENGE]: ['revenge', 'payback', 'karma'],
    }
  },
  'nosleep': {
    defaultCategory: StoryCategory.SUPERNATURAL,
    keywords: {
      [StoryCategory.MYSTERY]: ['mystery', 'strange', 'unexplained'],
    }
  },
  'ShortScaryStories': {
    defaultCategory: StoryCategory.SUPERNATURAL,
    keywords: {
      [StoryCategory.MYSTERY]: ['mystery', 'detective', 'investigation'],
    }
  },
  'revengestories': {
    defaultCategory: StoryCategory.REVENGE,
    keywords: {
      [StoryCategory.DRAMA]: ['drama', 'relationship', 'family'],
    }
  }
} as const;

// Type for valid subreddit keys
type SubredditKey = keyof typeof SUBREDDIT_CONFIGS;

// Determine story category based on title and content
export function categorizeStory(title: string, content: string, subreddit: string): StoryCategory {
  const config = SUBREDDIT_CONFIGS[subreddit as SubredditKey];
  if (!config) return StoryCategory.DRAMA;

  const text = `${title} ${content}`.toLowerCase();
  
  // Check for keyword matches
  for (const [category, keywords] of Object.entries(config.keywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category as StoryCategory;
    }
  }

  return config.defaultCategory;
}

// Calculate engagement prediction based on various factors
export function calculateEngagementPrediction(
  upvotes: number,
  comments: number,
  awards: number,
  timePosted: Date
): number {
  const now = new Date();
  const hoursSincePosted = (now.getTime() - timePosted.getTime()) / (1000 * 60 * 60);
  
  // Normalize scores
  const normalizedUpvotes = Math.min(upvotes / 10000, 1);
  const normalizedComments = Math.min(comments / 1000, 1);
  const normalizedAwards = Math.min(awards / 10, 1);
  const timeDecay = Math.exp(-hoursSincePosted / 48); // 48-hour decay
  
  // Weight factors
  const weights = {
    upvotes: 0.4,
    comments: 0.3,
    awards: 0.2,
    time: 0.1
  };
  
  return (
    normalizedUpvotes * weights.upvotes +
    normalizedComments * weights.comments +
    normalizedAwards * weights.awards +
    timeDecay * weights.time
  );
}

// Fetch and process Reddit stories
export async function fetchRedditStories(
  subreddit?: string,
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'day',
  limit: number = 10
) {
  try {
    const subreddits = subreddit ? [subreddit] : Object.keys(SUBREDDIT_CONFIGS);
    const allStories = [];

    for (const sub of subreddits) {
      const posts = await reddit.getSubreddit(sub).getTop({time: timeframe, limit});
      
      for (const post of posts) {
        // Fetch full content
        const fullPost = await post.fetch();
        
        // Calculate engagement prediction
        const engagementPrediction = calculateEngagementPrediction(
          fullPost.ups,
          fullPost.num_comments,
          fullPost.all_awardings?.length || 0,
          new Date(fullPost.created_utc * 1000)
        );

        // Determine category
        const category = categorizeStory(
          fullPost.title,
          fullPost.selftext,
          sub
        );

        // Clean and format content
        const cleanContent = fullPost.selftext
          .replace(/\n\n+/g, '\n\n') // Remove excessive newlines
          .trim();

        allStories.push({
          id: fullPost.id,
          title: fullPost.title,
          subreddit: sub,
          url: `https://reddit.com${fullPost.permalink}`,
          score: fullPost.ups,
          num_comments: fullPost.num_comments,
          created_utc: new Date(fullPost.created_utc * 1000).toISOString(),
          content: cleanContent,
          category,
          engagement_prediction: engagementPrediction,
          content_rating: fullPost.over_18 ? 'mature' : 'family_friendly',
          metadata: {
            author: fullPost.author.name,
            awards: fullPost.all_awardings?.length || 0,
            word_count: cleanContent.split(/\s+/).length
          }
        });
      }
    }

    // Sort by engagement prediction and limit results
    return allStories
      .sort((a, b) => b.engagement_prediction - a.engagement_prediction)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching Reddit stories:', error);
    throw error;
  }
} 