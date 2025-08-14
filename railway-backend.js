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

// Simple video generation function (placeholder)
async function generateVideoSimple(options, videoId) {
  console.log(`Generating video for ID: ${videoId} with options:`, options); // Added log
  videoStatus.set(videoId, { status: 'processing', progress: 0, message: 'Video generation started.' });

  // Simulate progress
  await new Promise(resolve => setTimeout(resolve, 1000));
  videoStatus.set(videoId, { status: 'processing', progress: 25, message: 'Generating voice-over...' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  videoStatus.set(videoId, { status: 'processing', progress: 50, message: 'Compositing video...' });
  await new Promise(resolve => setTimeout(resolve, 1000));
  videoStatus.set(videoId, { status: 'processing', progress: 75, message: 'Finalizing...' });

  // Use a stable, small public MP4 so the URL is immediately accessible
  const externalSampleUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

  videoStatus.set(videoId, {
    status: 'completed',
    progress: 100,
    message: 'Video generation complete.',
    videoUrl: externalSampleUrl
  });

  console.log(`Video generation completed for ID: ${videoId}`); // Added log
}

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