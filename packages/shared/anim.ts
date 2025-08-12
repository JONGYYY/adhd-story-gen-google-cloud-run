import { interpolate, spring } from 'remotion';
import type { BounceConfig } from './types';

/**
 * Converts milliseconds to frame number
 */
export function msToFrames(ms: number, fps: number): number {
  return Math.floor((ms / 1000) * fps);
}

/**
 * Converts frame number to milliseconds
 */
export function framesToMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

/**
 * CapCut-like bounce animation with overshoot and settle
 */
export function bounceOvershoot(
  frame: number, 
  startFrame: number, 
  fps: number,
  config: BounceConfig = {
    overshootPx: 6,
    dampingMs: 120,
    durationMs: 200
  }
): { translateY: number; scale: number; opacity: number } {
  const relativeFrame = frame - startFrame;
  const durationFrames = msToFrames(config.durationMs, fps);
  
  if (relativeFrame < 0) {
    // Before animation starts
    return { translateY: 0, scale: 1, opacity: 0.8 };
  }
  
  if (relativeFrame > durationFrames) {
    // After animation completes
    return { translateY: 0, scale: 1, opacity: 1 };
  }
  
  // Stage A: Enter with overshoot (first 60% of duration)
  const enterDuration = durationFrames * 0.6;
  
  if (relativeFrame <= enterDuration) {
    const progress = relativeFrame / enterDuration;
    
    // Spring animation for Y translation
    const springValue = spring({
      frame: relativeFrame,
      fps,
      config: {
        damping: 10,
        stiffness: 100,
        mass: 1
      }
    });
    
    const translateY = interpolate(
      springValue,
      [0, 1],
      [-config.overshootPx, 0],
      { extrapolateRight: 'clamp' }
    );
    
    // Scale overshoot: 1.0 -> 1.12 -> 1.0
    const scale = interpolate(
      progress,
      [0, 0.5, 1],
      [1.0, 1.12, 1.0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    
    const opacity = interpolate(
      progress,
      [0, 1],
      [0.8, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    
    return { translateY, scale, opacity };
  }
  
  // Stage B: Settle (remaining 40% of duration)
  const settleProgress = (relativeFrame - enterDuration) / (durationFrames - enterDuration);
  
  // Damped settling
  const settle = spring({
    frame: relativeFrame - enterDuration,
    fps,
    config: {
      damping: 15,
      stiffness: 200,
      mass: 1
    }
  });
  
  const translateY = interpolate(
    settle,
    [0, 1],
    [0, 0] // Already at 0, just settle any remaining oscillation
  );
  
  const scale = interpolate(
    settleProgress,
    [0, 1],
    [1.0, 1.0]
  );
  
  return { translateY, scale, opacity: 1 };
}

/**
 * Determines if a word should be active (visible/animated) at a given frame
 */
export function isWordActive(
  frame: number,
  wordStartMs: number,
  wordEndMs: number,
  fps: number
): boolean {
  const currentMs = framesToMs(frame, fps);
  return currentMs >= wordStartMs && currentMs <= wordEndMs;
}

/**
 * Gets the active word index for a given frame
 */
export function getActiveWordIndex(
  frame: number,
  words: Array<{ startMs: number; endMs: number }>,
  fps: number
): number | null {
  const currentMs = framesToMs(frame, fps);
  
  for (let i = 0; i < words.length; i++) {
    if (currentMs >= words[i].startMs && currentMs <= words[i].endMs) {
      return i;
    }
  }
  
  return null;
}

/**
 * Easing functions for custom animations
 */
export const easing = {
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

/**
 * Text layout helpers for word wrapping and positioning
 */
export function calculateWordPositions(
  words: string[],
  containerWidth: number,
  fontSize: number,
  lineHeight: number = 1.2
): Array<{ x: number; y: number; width: number; lineIndex: number }> {
  const positions: Array<{ x: number; y: number; width: number; lineIndex: number }> = [];
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentLineWidth = 0;
  
  // Simple word wrapping (this would be more sophisticated with actual text measurement)
  const avgCharWidth = fontSize * 0.6; // Rough estimate
  
  for (const word of words) {
    const wordWidth = word.length * avgCharWidth;
    
    if (currentLineWidth + wordWidth > containerWidth && currentLine.length > 0) {
      lines.push([...currentLine]);
      currentLine = [word];
      currentLineWidth = wordWidth;
    } else {
      currentLine.push(word);
      currentLineWidth += wordWidth + (avgCharWidth * 0.5); // Add space width
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  // Calculate positions
  let wordIndex = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineWidth = line.reduce((width, word) => width + (word.length * avgCharWidth) + (avgCharWidth * 0.5), 0);
    const startX = (containerWidth - lineWidth) / 2; // Center align
    
    let currentX = startX;
    for (const word of line) {
      const wordWidth = word.length * avgCharWidth;
      positions.push({
        x: currentX,
        y: lineIndex * fontSize * lineHeight,
        width: wordWidth,
        lineIndex
      });
      currentX += wordWidth + (avgCharWidth * 0.5);
      wordIndex++;
    }
  }
  
  return positions;
} 