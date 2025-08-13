const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory video status storage (for simplicity)
const videoStatus = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'railway-video-backend'
  });
});

// Simple video generation function
async function generateVideoSimple(options, videoId) {
  console.log(`Starting video generation for ${videoId}`);
  
  // Set initial status
  videoStatus.set(videoId, {
    status: 'processing',
    progress: 0,
    error: null,
    videoUrl: null,
    createdAt: new Date().toISOString()
  });

  try {
    // Update progress
    videoStatus.set(videoId, {
      ...videoStatus.get(videoId),
      status: 'processing',
      progress: 25
    });

    // Simulate video generation process
    console.log(`Generating video with story: ${options.customStory.title}`);
    
    // For now, simulate a processing delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update progress
    videoStatus.set(videoId, {
      ...videoStatus.get(videoId),
      progress: 50
    });

    // Simulate more processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update progress
    videoStatus.set(videoId, {
      ...videoStatus.get(videoId),
      progress: 75
    });

    // Simulate final processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mark as completed (for now, we'll just return a placeholder)
    const videoUrl = `/videos/${videoId}.mp4`;
    
    videoStatus.set(videoId, {
      ...videoStatus.get(videoId),
      status: 'ready',
      progress: 100,
      videoUrl: videoUrl
    });

    console.log(`Video generation completed for ${videoId}`);
    return videoUrl;

  } catch (error) {
    console.error(`Video generation failed for ${videoId}:`, error);
    
    videoStatus.set(videoId, {
      ...videoStatus.get(videoId),
      status: 'failed',
      error: error.message
    });
    
    throw error;
  }
}

// Video generation endpoint
app.post('/generate-video', async (req, res) => {
  try {
    console.log('Received video generation request:', JSON.stringify(req.body, null, 2));
    
    const { customStory, voice, background, isCliffhanger } = req.body;
    
    if (!customStory || !voice || !background) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: customStory, voice, background'
      });
    }

    // Generate unique video ID
    const videoId = uuidv4();
    
    // Start video generation in background (don't await)
    generateVideoSimple({
      customStory,
      voice,
      background,
      isCliffhanger: isCliffhanger || false
    }, videoId).catch(error => {
      console.error(`Background video generation failed for ${videoId}:`, error);
    });
    
    res.json({
      success: true,
      videoId,
      message: 'Video generation started'
    });
    
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Video status endpoint
app.get('/video-status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const status = videoStatus.get(videoId);
    
    if (!status) {
      return res.status(404).json({
        status: 'not_found',
        error: 'Video not found'
      });
    }
    
    res.json(status);
    
  } catch (error) {
    console.error('Video status error:', error);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Railway backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app; 