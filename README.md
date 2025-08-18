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

## Deploying on DigitalOcean

### Option A: App Platform (build from repository)
1) Push this repo to GitHub (already done: `adhd-story-gen-google-cloud-run`).
2) In DigitalOcean: Apps → Create App → Connect GitHub → select the repo and branch (`gcr-migration`).
3) Autodetect Dockerfile. Set Environment Variables:
   - Required now: `OPENAI_API_KEY`
   - Optional: `NEXT_PUBLIC_APP_URL` (App Platform URL), Firebase, Reddit, TikTok, YouTube as needed
4) Expose HTTP on `${PORT}` (App Platform injects `PORT`). The Dockerfile already uses `${PORT:-8080}`.
5) Set resources: 2 vCPUs / 2–4 GB RAM recommended for video rendering.
6) Deploy. After deploy, set `NEXT_PUBLIC_APP_URL` to the app’s URL and redeploy.

### Option B: Container Registry + App Platform
1) Build and push image to DigitalOcean Container Registry:
```bash
doctl auth init  # if not already authenticated
REGISTRY=registry.digitalocean.com/your-reg
APP_IMAGE="$REGISTRY/adhd-story-gen:web"

doctl registry create your-reg || true
# Login docker to DOCR
DO_TOKEN=$(doctl auth token)
echo $DO_TOKEN | docker login -u doctl --password-stdin registry.digitalocean.com

docker build -t "$APP_IMAGE" .
docker push "$APP_IMAGE"
```
2) Create an App from the image in the DO dashboard or with `doctl apps create` using a spec.

### doctl app spec
Create `do-app.yaml` and apply:
```yaml
name: adhd-story-gen
region: nyc
services:
  - name: web
    image:
      registry_type: DOCR
      repository: adhd-story-gen
      tag: web
      registry: your-reg
    http_port: 8080
    instance_count: 1
    instance_size_slug: basic-xxl
    envs:
      - key: NODE_ENV
        value: production
      - key: NEXT_TELEMETRY_DISABLED
        value: "1"
      - key: OPENAI_API_KEY
        scope: RUN_AND_BUILD_TIME
        value: "YOUR_OPENAI_KEY"
      - key: NEXT_PUBLIC_APP_URL
        value: "https://placeholder"
```
Apply:
```bash
doctl apps create --spec do-app.yaml
```

Notes:
- Dockerfile includes ffmpeg and Python venv for MoviePy/Whisper; CPU rendering only.
- Videos are streamed from tmp via `/api/videos/:filename`. Consider Spaces for storage later.
- Set `NEXT_PUBLIC_APP_URL` to the final app URL after first deploy.
