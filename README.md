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

## Deploying on Google Cloud Run

1. Build and push the container (Artifact Registry recommended):

```bash
PROJECT_ID="your-gcp-project"
REGION="us-central1"
REPO="adhd-story-gen"
IMAGE="gcr.io/$PROJECT_ID/$REPO/web"

# Enable required services
#gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# Create repo if needed
#gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="ADHD Story Gen"

# Build and push
cd /Users/jonathanshan/adhd-story-gen-gcr
gcloud builds submit --tag "$IMAGE"
```

2. Deploy to Cloud Run:

```bash
gcloud run deploy adhd-story-gen \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --port=8080 \
  --max-instances=3 \
  --set-env-vars=NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1,FORCE_RAILWAY=false \
  --set-env-vars=OPENAI_API_KEY=secret,ELEVENLABS_API_KEY=secret \
  --set-env-vars=NEXT_PUBLIC_APP_URL=https://YOUR_CLOUD_RUN_URL \
  --set-env-vars=NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
  --set-env-vars=FIREBASE_ADMIN_PROJECT_ID=...,FIREBASE_ADMIN_CLIENT_EMAIL=...,FIREBASE_ADMIN_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n' \
  --set-env-vars=REDDIT_CLIENT_ID=...,REDDIT_CLIENT_SECRET=...,REDDIT_REFRESH_TOKEN=...
```

3. Optional: custom domain mapping for the Cloud Run service.

Notes:
- The container includes ffmpeg and a Python venv with MoviePy/Whisper. Heavy GPU isn’t used; CPU rendering is slower.
- Set `FORCE_RAILWAY=true` if you still want to delegate video generation to Railway temporarily.
- Videos are stored in the instance’s tmp and streamed via `/api/videos/:filename`. Consider integrating GCS for durable storage later.
