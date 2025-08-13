import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { Alignment } from '../../../../packages/shared/types';
import { 
  bounceOvershoot, 
  isWordActive, 
  getActiveWordIndex, 
  msToFrames,
  calculateWordPositions 
} from '../../../../packages/shared/anim';

interface KaraokeCaptionsProps {
  alignment: Alignment;
  fps: number;
  containerStyle?: React.CSSProperties;
  fontSize?: number;
  fontFamily?: string;
  maxWidth?: number;
  lineHeight?: number;
}

export const KaraokeCaptions: React.FC<KaraokeCaptionsProps> = ({
  alignment,
  fps,
  containerStyle,
  fontSize = 48,
  fontFamily = 'Inter, Arial, sans-serif',
  maxWidth = 800,
  lineHeight = 1.3
}) => {
  const frame = useCurrentFrame();
  
  // Get active word index
  const activeWordIndex = getActiveWordIndex(frame, alignment.words, fps);
  
  // Calculate word positions for layout
  const words = alignment.words.map(w => w.word);
  const wordPositions = calculateWordPositions(words, maxWidth, fontSize, lineHeight);
  
  // Group words by line for better rendering
  const lines: Array<{ words: typeof alignment.words; positions: typeof wordPositions }> = [];
  let currentLine: typeof alignment.words = [];
  let currentPositions: typeof wordPositions = [];
  let currentLineIndex = -1;
  
  alignment.words.forEach((word, index) => {
    const position = wordPositions[index];
    
    if (position.lineIndex !== currentLineIndex) {
      if (currentLine.length > 0) {
        lines.push({ words: currentLine, positions: currentPositions });
      }
      currentLine = [word];
      currentPositions = [position];
      currentLineIndex = position.lineIndex;
    } else {
      currentLine.push(word);
      currentPositions.push(position);
    }
  });
  
  if (currentLine.length > 0) {
    lines.push({ words: currentLine, positions: currentPositions });
  }
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      textAlign: 'center',
      ...containerStyle
    }}>
      {lines.map((line, lineIndex) => (
        <div
          key={lineIndex}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'baseline',
            marginBottom: lineIndex < lines.length - 1 ? fontSize * 0.2 : 0,
            height: fontSize * lineHeight
          }}
        >
          {line.words.map((word, wordIndex) => {
            const globalWordIndex = alignment.words.findIndex(w => w === word);
            const isActive = activeWordIndex === globalWordIndex;
            const startFrame = msToFrames(word.startMs, fps);
            
            // Get bounce animation values
            const animation = bounceOvershoot(frame, startFrame, fps);
            
            return (
              <WordSpan
                key={`${lineIndex}-${wordIndex}`}
                word={word.word}
                isActive={isActive}
                animation={animation}
                fontSize={fontSize}
                fontFamily={fontFamily}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

interface WordSpanProps {
  word: string;
  isActive: boolean;
  animation: { translateY: number; scale: number; opacity: number };
  fontSize: number;
  fontFamily: string;
}

const WordSpan: React.FC<WordSpanProps> = ({
  word,
  isActive,
  animation,
  fontSize,
  fontFamily
}) => {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize,
        fontFamily,
        fontWeight: '800', // Extra bold for TikTok style
        color: '#ffffff',
        textShadow: `
          -2px -2px 0 #000000,
          2px -2px 0 #000000,
          -2px 2px 0 #000000,
          2px 2px 0 #000000,
          0 0 8px rgba(0, 0, 0, 0.8)
        `,
        marginRight: fontSize * 0.15, // Space between words
        transform: `translateY(${animation.translateY}px) scale(${animation.scale})`,
        opacity: animation.opacity,
        transition: 'none', // No CSS transitions - all animation via Remotion
        // Ensure crisp text rendering
        textRendering: 'optimizeLegibility',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        // Add subtle glow for active words
        ...(isActive && {
          filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.6))',
          color: '#ffffff'
        })
      }}
    >
      {word}
    </span>
  );
}; 