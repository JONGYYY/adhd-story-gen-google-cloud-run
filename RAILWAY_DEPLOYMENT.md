# Railway Deployment Guide

## Overview

This guide will help you deploy the ADHD Story Generator's video processing backend to Railway. The current architecture uses:

- **Vercel**: Frontend Next.js app (already deployed)
- **Railway**: Backend video processing service (what we're deploying)

## Prerequisites

1. [Railway Account](https://railway.app) (free tier available)
2. GitHub repository access
3. Environment variables ready (see `.env.railway` template)

## Deployment Steps

### 1. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `adhd-story-gen` repository
5. Railway will automatically detect the Node.js project

### 2. Configure Build Settings

Railway should automatically use the `nixpacks.toml` configuration, but verify:

1. In your Railway project dashboard, go to "Settings" → "Build"
2. Ensure these settings:
   - **Build Command**: `npm ci && pip install -r requirements.txt && npm run build`
   - **Start Command**: `npm run start:railway`
   - **Root Directory**: `/` (root of your repo)

### 3. Set Environment Variables

1. Go to "Variables" tab in Railway dashboard
2. Add all variables from `.env.railway` template:

**Critical Variables:**
```bash
NODE_ENV=production
PORT=3000
RAILWAY_ENVIRONMENT=production

# Firebase (required for data storage)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_key\n-----END PRIVATE KEY-----\n"

# OpenAI (required for story generation)
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs (required for voice generation)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### 4. Deploy and Test

1. Railway will automatically deploy after you set the variables
2. Wait for deployment to complete (usually 3-5 minutes)
3. Your Railway URL will be: `https://your-project-name.up.railway.app`

### 5. Update Frontend Configuration

Update the Railway API URL in your Vercel frontend:

1. In `src/app/api/generate-video/route.ts`, update line 12:
   ```typescript
   const RAILWAY_API_URL = 'https://your-actual-railway-url.up.railway.app';
   ```

2. In `src/app/api/video-status/[videoId]/route.ts`, update line 4:
   ```typescript
   const RAILWAY_API_URL = 'https://your-actual-railway-url.up.railway.app';
   ```

3. Redeploy your Vercel frontend

## Testing the Deployment

### 1. Health Check
```bash
curl https://your-railway-url.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "environment": "production",
  "service": "railway-video-backend"
}
```

### 2. Video Generation Test
```bash
curl -X POST https://your-railway-url.up.railway.app/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "customStory": {
      "title": "Test Story",
      "story": "This is a test story for video generation.",
      "subreddit": "r/test"
    },
    "voice": {"id": "adam", "gender": "male"},
    "background": {"category": "minecraft"}
  }'
```

## Architecture Flow

1. **User visits**: `https://adhd-story-gen.vercel.app` (Vercel frontend)
2. **User generates video**: Frontend sends request to Vercel API
3. **Vercel detects environment**: `process.env.VERCEL` is true
4. **Vercel proxies to Railway**: Calls `https://your-railway-url.up.railway.app/generate-video`
5. **Railway processes video**: Heavy video generation happens on Railway
6. **Status updates**: Frontend polls Railway for video status

## File Structure on Railway

```
/app/
├── railway-backend.js          # Express server entry point
├── src/                        # Next.js source code
│   ├── lib/video-generator/    # Video generation logic
│   ├── python/                 # Python video scripts
│   └── utils/                  # Utility functions
├── public/                     # Static assets & generated videos
├── requirements.txt            # Python dependencies
├── package.json               # Node.js dependencies
└── nixpacks.toml              # Railway build configuration
```

## Monitoring and Logs

1. **Railway Logs**: Go to your project → "Deployments" → Click latest deployment → "View Logs"
2. **Health Monitoring**: Railway automatically monitors `/api/health` endpoint
3. **Metrics**: Railway provides CPU, memory, and network usage metrics

## Troubleshooting

### Common Issues

1. **Build Fails - Python Dependencies**
   ```bash
   # Check nixpacks.toml has correct Python packages
   nixPkgs = ["nodejs-18_x", "python3", "python3Packages.pip", "ffmpeg"]
   ```

2. **FFmpeg Not Found**
   - Railway includes FFmpeg via nixpacks configuration
   - Verify `ffmpeg` is in the `nixPkgs` array

3. **Environment Variables**
   - Double-check all variables are set in Railway dashboard
   - Firebase private key must be properly escaped

4. **Memory Issues**
   - Railway free tier has 512MB RAM limit
   - Consider upgrading to Pro plan for video processing

### Performance Optimization

1. **Railway Pro Plan**: $5/month for better performance
2. **Video Processing**: 
   - Uses efficient FFmpeg-based generation
   - Processes videos in ~30-60 seconds
   - Automatic cleanup of temporary files

## Cost Estimation

- **Railway Free Tier**: $0/month (limited resources)
- **Railway Pro Plan**: $5/month (recommended for video processing)
- **Usage-based**: Additional costs for high CPU usage during video generation

## Security Notes

1. **Environment Variables**: Never commit sensitive keys to git
2. **CORS**: Railway backend allows requests from your Vercel domain
3. **Rate Limiting**: Consider adding rate limiting for production use
4. **File Cleanup**: Temporary video files are automatically cleaned up

## Next Steps

After successful deployment:

1. ✅ Test video generation end-to-end
2. ✅ Monitor Railway logs for any issues
3. ✅ Set up proper error monitoring (optional)
4. ✅ Consider upgrading to Railway Pro for better performance
5. ✅ Implement video file storage (S3/Railway volumes)

## Support

- **Railway Documentation**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Project Issues**: Create issues in your GitHub repository 