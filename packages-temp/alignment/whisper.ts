import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Alignment, WordStamp } from '../shared/types';

export class WhisperAligner {
  private whisperPath: string;
  
  constructor(whisperPath: string = 'whisperx') {
    this.whisperPath = whisperPath;
  }
  
  /**
   * Perform forced alignment using WhisperX
   */
  async forceAlign(script: string, wavPath: string): Promise<Alignment> {
    try {
      console.log(`🎯 Starting forced alignment for: ${wavPath}`);
      
      // Create temporary files
      const tempDir = join(tmpdir(), `alignment_${Date.now()}`);
      const scriptPath = join(tempDir, 'script.txt');
      const outputPath = join(tempDir, 'alignment.json');
      
      // Ensure temp directory exists
      await this.ensureDir(tempDir);
      
      // Write script to file
      writeFileSync(scriptPath, script, 'utf-8');
      
      // Run WhisperX alignment
      const result = await this.runWhisperX(wavPath, scriptPath, outputPath);
      
      if (!existsSync(outputPath)) {
        throw new Error('WhisperX alignment output not found');
      }
      
      // Parse alignment results
      const alignmentData = JSON.parse(readFileSync(outputPath, 'utf-8'));
      const alignment = this.parseWhisperXOutput(alignmentData);
      
      console.log(`✅ Forced alignment completed: ${alignment.words.length} words`);
      return alignment;
      
    } catch (error) {
      console.error('❌ Forced alignment failed:', error);
      
      // Fallback to estimated alignment
      console.log('🔄 Falling back to estimated alignment...');
      return this.createEstimatedAlignment(script);
    }
  }
  
  /**
   * Run WhisperX command line tool
   */
  private async runWhisperX(
    audioPath: string, 
    scriptPath: string, 
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        audioPath,
        '--model', 'base',
        '--align',
        '--language', 'en',
        '--transcript', scriptPath,
        '--output_dir', join(outputPath, '..'),
        '--output_format', 'json'
      ];
      
      console.log(`Running: ${this.whisperPath} ${args.join(' ')}`);
      
      const process = spawn(this.whisperPath, args);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`WhisperX failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to start WhisperX: ${error.message}`));
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        process.kill();
        reject(new Error('WhisperX alignment timed out'));
      }, 5 * 60 * 1000);
    });
  }
  
  /**
   * Parse WhisperX JSON output into our Alignment format
   */
  private parseWhisperXOutput(whisperData: any): Alignment {
    const words: WordStamp[] = [];
    
    if (whisperData.segments) {
      for (const segment of whisperData.segments) {
        if (segment.words) {
          for (const word of segment.words) {
            words.push({
              word: word.word.trim(),
              startMs: Math.round(word.start * 1000),
              endMs: Math.round(word.end * 1000),
              confidence: word.score || 0.9
            });
          }
        }
      }
    }
    
    return {
      words,
      sampleRate: 16000 // WhisperX typically uses 16kHz
    };
  }
  
  /**
   * Create estimated alignment when forced alignment fails
   */
  private createEstimatedAlignment(script: string): Alignment {
    const words = script.split(/\s+/).filter(word => word.length > 0);
    const avgWordsPerSecond = 2.5; // Typical speaking rate
    const wordDurationMs = 1000 / avgWordsPerSecond;
    
    const alignedWords: WordStamp[] = words.map((word, index) => ({
      word: word.replace(/[.,!?;:]$/, ''), // Remove trailing punctuation
      startMs: Math.round(index * wordDurationMs),
      endMs: Math.round((index + 1) * wordDurationMs),
      confidence: 0.5 // Lower confidence for estimated alignment
    }));
    
    return {
      words: alignedWords,
      sampleRate: 16000
    };
  }
  
  /**
   * Ensure directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    const { mkdir } = await import('fs/promises');
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      // Directory might already exist
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Check if WhisperX is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.whisperPath, ['--help']);
      
      process.on('close', (code) => {
        resolve(code === 0);
      });
      
      process.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 5000);
    });
  }
}

/**
 * Factory function to create WhisperX aligner
 */
export function createWhisperAligner(whisperPath?: string): WhisperAligner {
  return new WhisperAligner(whisperPath);
}

/**
 * Main alignment function that combines TTS and forced alignment
 */
export async function synthesizeWithTimestamps(
  script: string, 
  voiceId: string,
  elevenLabsApiKey: string
): Promise<{ audioPath: string; alignment: Alignment }> {
  // Import here to avoid circular dependencies
  const { createElevenLabsTTS } = await import('./elevenlabs');
  
  // Step 1: Generate speech with ElevenLabs
  const tts = createElevenLabsTTS(elevenLabsApiKey);
  const { audioPath } = await tts.synthesizeWithTimestamps(script, voiceId);
  
  // Step 2: Perform forced alignment
  const aligner = createWhisperAligner();
  const alignment = await aligner.forceAlign(script, audioPath);
  
  return {
    audioPath,
    alignment
  };
} 