const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

console.log('Railway backend script started.'); // Added log

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`Attempting to start server on port: ${PORT}`); // Added log

// In-memory video status storage (for simplicity)
const videoStatus = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Ensure videos directory exists
async function ensureVideosDir() {
  const videosDir = path.join(__dirname, 'public', 'videos');
  await fsp.mkdir(videosDir, { recursive: true });
  return videosDir;
}

// Pick a sample background mp4 to copy
async function resolveSampleMp4(preferredCategory) {
  const backgroundsRoot = path.join(__dirname, 'public', 'backgrounds');
  // Prefer smaller samples first to reduce copy time
  const orderedBySizeGuess = [
    'subway',
    'asmr',
    'cooking',
    'workers',
    preferredCategory,
    'minecraft'
  ].filter(Boolean);

  // De-duplicate while preserving order
  const seen = new Set();
  const candidates = orderedBySizeGuess.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c); return true;
  });

  for (const cat of candidates) {
    const candidate = path.join(backgroundsRoot, cat, '1.mp4');
    if (fs.existsSync(candidate)) return candidate;
  }

  // Fallback: scan backgrounds for any 1.mp4
  try {
    const dirs = await fsp.readdir(backgroundsRoot);
    for (const dir of dirs) {
      const candidate = path.join(backgroundsRoot, dir, '1.mp4');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (e) {
    console.error('Failed to scan backgrounds directory:', e);
  }
  return null;
}

// Simple helper: build a demo video by overlaying text on a sample clip
async function buildDemoVideo({ title, story }, videoId) {
  const videosDir = await ensureVideosDir();
  const outPath = path.join(videosDir, `${videoId}.mp4`);
  const sample = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
  // Download sample to tmp and then compose
  const tmpDir = path.join(__dirname, 'tmp');
  await fsp.mkdir(tmpDir, { recursive: true });
  const samplePath = path.join(tmpDir, 'sample.mp4');

  // naive fetch
  const res = await fetch(sample);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(samplePath, buf);

  const overlayTitle = (title || 'Demo Title').replace(/:/g, '\\\:');
  const overlayStory = (story || 'Demo story line [BREAK] more').replace(/:/g, '\\\:');

  const { spawn } = require('child_process');
  const drawText = `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${overlayTitle}':x=(w-text_w)/2:y=H*0.1:fontsize=36:fontcolor=white:box=1:boxcolor=0x00000088,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${overlayStory}':x=(w-text_w)/2:y=H*0.8:fontsize=24:fontcolor=white:box=1:boxcolor=0x00000088`;
  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-i', samplePath, '-vf', drawText, '-c:a', 'copy', outPath]);
    ff.stderr.on('data', (d) => process.stderr.write(d));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });

  return `/videos/${videoId}.mp4`;
}

// Simple video generation function (placeholder)
async function generateVideoSimple(options, videoId) {
  console.log(`Generating video for ID: ${videoId} with options:`, options); // Added log
  videoStatus.set(videoId, { status: 'processing', progress: 0, message: 'Video generation started.' });

  // Simulate progress
  await new Promise(resolve => setTimeout(resolve, 500));
  videoStatus.set(videoId, { status: 'processing', progress: 25, message: 'Generating voice-over...' });
  await new Promise(resolve => setTimeout(resolve, 500));
  videoStatus.set(videoId, { status: 'processing', progress: 50, message: 'Compositing video...' });
  await new Promise(resolve => setTimeout(resolve, 500));
  videoStatus.set(videoId, { status: 'processing', progress: 75, message: 'Finalizing...' });

  try {
    const videoUrl = await buildDemoVideo({
      title: options?.customStory?.title,
      story: options?.customStory?.story,
    }, videoId);

    videoStatus.set(videoId, {
      status: 'completed',
      progress: 100,
      message: 'Video generation complete.',
      videoUrl
    });
    console.log(`Video generation completed for ID: ${videoId}`);
  } catch (err) {
    console.error('Demo ffmpeg build failed:', err);
    videoStatus.set(videoId, { status: 'failed', error: 'Video build failed' });
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check requested.'); // Added log
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'railway-video-backend'
  });
});

// Video generation endpoint
app.post('/generate-video', async (req, res) => {
  try {
    console.log('Received video generation request.'); // Added log
    const { customStory, voice, background, isCliffhanger } = req.body;
    const videoId = uuidv4();

    // Start video generation in the background
    generateVideoSimple({ customStory, voice, background, isCliffhanger }, videoId);

    res.status(202).json({
      success: true,
      message: 'Video generation started.',
      videoId: videoId,
      statusUrl: `/video-status/${videoId}`
    });
  } catch (error) {
    console.error('Video generation error:', error); // Added log
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start video generation'
    });
  }
});

// Video status endpoint
app.get('/video-status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log(`Video status requested for ID: ${videoId}`); // Added log
    const status = videoStatus.get(videoId);

    if (!status) {
      return res.status(404).json({ success: false, error: 'Video ID not found.' });
    }

    res.json(status);
  } catch (error) {
    console.error('Video status error:', error); // Added log
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get video status'
    });
  }
});

// Serve generated videos
app.get('/videos/:filename', (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(__dirname, 'public', 'videos', filename);
  
  if (fs.existsSync(videoPath)) {
    res.sendFile(videoPath);
  } else {
    res.status(404).json({ error: 'Video not found' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Railway backend server running on port ${PORT}`); // Added log
});

module.exports = app; 