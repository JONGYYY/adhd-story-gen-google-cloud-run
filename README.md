# StoryGen AI

Generate high-retention, short-form story videos using AI-generated content or trending Reddit stories.

## Supported Subreddits

StoryGen AI integrates with the following subreddits for story content:

| Subreddit | Primary Category | Description |
|-----------|-----------------|-------------|
| r/AITA (AmItheAsshole) | Drama | Relationship conflicts, moral dilemmas, and social situations |
| r/TrueOffMyChest | Confession | Personal revelations, life experiences, and emotional stories |
| r/nosleep | Supernatural | Horror stories, paranormal experiences, and supernatural events |
| r/ShortScaryStories | Supernatural | Concise horror tales and creepy encounters |
| r/revengestories | Revenge | Tales of justice served and getting even |

Each subreddit has a dedicated AI assistant trained on its specific style and content patterns.

## Reddit Integration Setup

To enable Reddit story fetching, you'll need to set up the following:

1. Create a Reddit Application:
   - Go to https://www.reddit.com/prefs/apps
   - Click "Create App" or "Create Another App"
   - Fill in the details:
     - Name: StoryGen AI
     - App type: Script
     - Description: AI-powered story video generation
     - About URL: Your website URL
     - Redirect URI: http://localhost:3000/api/auth/callback/reddit

2. Create a `.env.local` file in the project root with the following variables:
   ```
   # Reddit API Credentials
   REDDIT_CLIENT_ID=your_client_id_here
   REDDIT_CLIENT_SECRET=your_client_secret_here
   REDDIT_REFRESH_TOKEN=your_refresh_token_here

   # OpenAI Assistant IDs
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_AITA_ASSISTANT_ID=your_aita_assistant_id
   OPENAI_CONFESSION_ASSISTANT_ID=your_confession_assistant_id
   OPENAI_HORROR_ASSISTANT_ID=your_horror_assistant_id
   OPENAI_SHORT_HORROR_ASSISTANT_ID=your_short_horror_assistant_id
   OPENAI_REVENGE_ASSISTANT_ID=your_revenge_assistant_id
   ```

3. To obtain a refresh token:
   - Use the Reddit OAuth flow
   - Request scope: read,history
   - Store the refresh token securely

## Story Categories

Stories are automatically categorized into the following types:

- Drama: Relationship conflicts, family issues
- Mystery: Unexplained events, investigations
- Confession: Personal revelations, admissions
- Revenge: Getting even, karma stories
- Supernatural: Horror, paranormal experiences

## API Usage

Fetch Reddit stories:
```typescript
GET /api/stories/reddit
```

Query parameters:
- `subreddit`: (optional) Specific subreddit to fetch from
- `timeframe`: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'
- `limit`: Number of stories to return (default: 10)

Example response:
```json
{
  "stories": [
    {
      "id": "abc123",
      "title": "Story Title",
      "subreddit": "AmItheAsshole",
      "url": "https://reddit.com/r/AmItheAsshole/abc123",
      "score": 15243,
      "num_comments": 1432,
      "created_utc": "2024-03-20T12:00:00Z",
      "content": "Story content...",
      "category": "drama",
      "engagement_prediction": 0.92,
      "content_rating": "family_friendly",
      "metadata": {
        "author": "username",
        "awards": 5,
        "word_count": 500
      }
    }
  ],
  "metadata": {
    "total": 1,
    "timeframe": "day",
    "subreddit": "AmItheAsshole"
  }
}
```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Visit http://localhost:3000

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
