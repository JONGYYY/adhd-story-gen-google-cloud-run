# ADHD Story Generator

A Next.js application that generates and manages ADHD-related stories and videos for social media platforms.

## Deployment

### Current Architecture
- **Frontend**: Deployed on Vercel at https://adhd-story-gen.vercel.app
- **Backend**: Video processing deployed on Railway (see `RAILWAY_DEPLOYMENT.md`)

### Hybrid Deployment Strategy
This project uses a hybrid deployment approach:
- **Vercel**: Hosts the Next.js frontend and lightweight API routes
- **Railway**: Handles compute-intensive video generation with FFmpeg and Python

## Features

- Story generation using AI
- Video creation with voice-over
- Social media integration (YouTube, TikTok)
- User authentication
- Subscription management

## Tech Stack

- Next.js
- TypeScript
- Firebase
- OpenAI
- ElevenLabs
- Stripe for payments
- Social Media APIs

## Local Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables (copy .env.example to .env)
4. Run the development server:
```bash
npm run dev
```

## Railway Deployment

For deploying the video processing backend to Railway, see the detailed guide in `RAILWAY_DEPLOYMENT.md`.

Quick start:
1. Create Railway project from this GitHub repo
2. Set environment variables from `env.railway.template`
3. Deploy using `npm run start:railway`

## Environment Variables

See the project documentation and `env.railway.template` for required environment variables.
