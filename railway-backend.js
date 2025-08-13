const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
    const videoId = require('uuid').v4();
    
    // Import the video generation function
    const { generateVideo } = require('./src/lib/video-generator/hybrid-generator');
    
    // Start video generation (this should be async/background process)
    const generationOptions = {
      story: customStory,
      voice,
      background,
      isCliffhanger: isCliffhanger || false,
      uiOverlay: { showBanner: true }
    };
    
    // Start generation in background
    generateVideo(generationOptions, videoId)
      .then(outputPath => {
        console.log(`Video generation completed for ${videoId}: ${outputPath}`);
      })
      .catch(error => {
        console.error(`Video generation failed for ${videoId}:`, error);
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
    
    // Import status functions
    const { getVideoStatus } = require('./src/lib/video-generator/status');
    
    const status = await getVideoStatus(videoId);
    
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