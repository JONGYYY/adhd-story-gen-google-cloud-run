import React from 'react';
import { Composition } from 'remotion';
import { StoryComposition } from './compositions/StoryComposition';
import type { StoryCompositionProps } from '../../../packages/shared/types';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StoryVideo"
        component={StoryComposition}
        durationInFrames={3000} // 100 seconds at 30fps - will be dynamic
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          bannerPng: '',
          bgVideo: '',
          narrationWav: '',
          alignment: { words: [], sampleRate: 16000 },
          safeZone: { left: 120, right: 120, top: 320, bottom: 320 },
          fps: 30,
          width: 1080,
          height: 1920
        } as StoryCompositionProps}
      />
    </>
  );
}; 