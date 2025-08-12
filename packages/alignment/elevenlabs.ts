import { ElevenLabsApi } from 'elevenlabs';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Alignment, WordStamp } from '../shared/types';

export class ElevenLabsTTS {
  private client: ElevenLabsApi;
  
  constructor(apiKey: string) {
    this.client = new ElevenLabsApi({
      apiKey
    });
  }
  
  /**
   * Synthesize speech with timestamps using ElevenLabs
   */
  async synthesizeWithTimestamps(
    script: string, 
    voiceId: string,
    outputPath?: string
  ): Promise<{ audioPath: string; alignment?: Alignment }> {
    try {
      console.log(`🎙️ Synthesizing speech with ElevenLabs voice: ${voiceId}`);
      
      // Try to get speech with timestamps if available
      const response = await this.client.textToSpeech.convert({
        voice_id: voiceId,
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        },
        output_format: 'mp3_44100_128' // High quality for better alignment
      });
      
      // Generate output path if not provided
      const audioPath = outputPath || join(tmpdir(), `tts_${Date.now()}.wav`);
      
      // Convert response to buffer and save
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(audioPath, audioBuffer);
      
      console.log(`✅ Audio saved to: ${audioPath}`);
      
      // Note: ElevenLabs doesn't provide word timestamps directly yet
      // We'll need to use forced alignment as fallback
      return {
        audioPath,
        alignment: undefined // Will be filled by forced alignment
      };
      
    } catch (error) {
      console.error('❌ ElevenLabs synthesis failed:', error);
      throw new Error(`ElevenLabs synthesis failed: ${error.message}`);
    }
  }
  
  /**
   * Get available voices from ElevenLabs
   */
  async getVoices() {
    try {
      const voices = await this.client.voices.getAll();
      return voices.voices.map(voice => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description
      }));
    } catch (error) {
      console.error('❌ Failed to get voices:', error);
      throw new Error(`Failed to get voices: ${error.message}`);
    }
  }
  
  /**
   * Clone a voice (if using premium features)
   */
  async cloneVoice(name: string, audioFiles: string[]) {
    try {
      // This would implement voice cloning if needed
      throw new Error('Voice cloning not implemented yet');
    } catch (error) {
      console.error('❌ Voice cloning failed:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create ElevenLabs TTS instance
 */
export function createElevenLabsTTS(apiKey: string): ElevenLabsTTS {
  return new ElevenLabsTTS(apiKey);
}

/**
 * Default voice IDs for common use cases
 */
export const VOICE_IDS = {
  ADAM: '21m00Tcm4TlvDq8ikWAM', // Deep male voice
  BELLA: 'EXAVITQu4vr4xnSDxMaL', // Young female voice
  ANTONI: 'ErXwobaYiN019PkySvjV', // Well-rounded male voice
  ELLI: 'MF3mGyEYCl7XYWbV9V6O', // Emotional female voice
  JOSH: 'TxGEqnHWrfWFTfGW9XjX', // Deep, mature male voice
  ARNOLD: 'VR6AewLTigWG4xSOukaG', // Crisp, authoritative male voice
  DOMI: 'AZnzlk1XvdvUeBnXmlld', // Strong, confident female voice
  RACHEL: '21m00Tcm4TlvDq8ikWAM' // Calm, pleasant female voice
} as const;

export type VoiceId = keyof typeof VOICE_IDS; 