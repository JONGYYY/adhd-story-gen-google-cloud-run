import React from 'react';
import { Audio, Video, useCurrentFrame, useVideoConfig } from 'remotion';
import { BannerOverlay } from './BannerOverlay';
import { KaraokeCaptions } from './KaraokeCaptions';
import type { StoryCompositionProps } from '../../../../packages/shared/types';
import { framesToMs } from '../../../../packages/shared/anim';

export const StoryComposition: React.FC<StoryCompositionProps> = ({
  bannerPng,
  bgVideo,
  narrationWav,
  alignment,
  safeZone = { left: 120, right: 120, top: 320, bottom: 320 },
  fps,
  width,
  height
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  
  // Calculate total duration based on alignment
  const totalDurationMs = alignment.words.length > 0 
    ? Math.max(...alignment.words.map(w => w.endMs)) + 1500 // Add 1.5s padding
    : framesToMs(durationInFrames, fps);
  
  return (
    <div style={{ width, height, position: 'relative', backgroundColor: '#000000' }}>
      {/* Background Video - Full bleed */}
      {bgVideo && (
        <Video
          src={bgVideo}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1
          }}
          volume={0} // Background video should be silent
        />
      )}
      
      {/* Banner Overlay - Positioned at top */}
      {bannerPng && (
        <BannerOverlay
          src={bannerPng}
          style={{
            position: 'absolute',
            top: safeZone.top,
            left: 0,
            right: 0,
            zIndex: 2
          }}
        />
      )}
      
      {/* Karaoke Captions - Positioned at bottom with safe zone */}
      <KaraokeCaptions
        alignment={alignment}
        fps={fps}
        containerStyle={{
          position: 'absolute',
          bottom: safeZone.bottom,
          left: safeZone.left,
          right: safeZone.right,
          zIndex: 3
        }}
      />
      
      {/* Audio Track */}
      {narrationWav && (
        <Audio
          src={narrationWav}
          volume={1}
        />
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 999
        }}>
          <div>Frame: {frame}</div>
          <div>Time: {framesToMs(frame, fps).toFixed(0)}ms</div>
          <div>Words: {alignment.words.length}</div>
          <div>Duration: {totalDurationMs.toFixed(0)}ms</div>
        </div>
      )}
    </div>
  );
}; 