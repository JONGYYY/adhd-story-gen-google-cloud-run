const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

  // Simulate video generation
  await new Promise(resolve => setTimeout(resolve, 10000)); // Simulate 10 seconds of work

  videoStatus.set(videoId, { status: 'completed', progress: 100, message: 'Video generation complete.', videoUrl: `/videos/${videoId}.mp4` });
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