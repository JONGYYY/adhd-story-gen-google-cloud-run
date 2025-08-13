import React from 'react';
import { Img } from 'remotion';

interface BannerOverlayProps {
  src: string;
  style?: React.CSSProperties;
}

export const BannerOverlay: React.FC<BannerOverlayProps> = ({ src, style }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      ...style
    }}>
      <Img
        src={src}
        style={{
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'contain',
          // Add subtle shadow for depth
          filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
          // Ensure crisp rendering
          imageRendering: 'crisp-edges'
        }}
      />
    </div>
  );
}; 