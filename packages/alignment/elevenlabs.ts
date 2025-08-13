import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Alignment } from '../shared/types';

/**
 * Minimal ElevenLabs TTS helper using REST API to avoid SDK typings during Vercel build.
 */
export class ElevenLabsTTS {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesizeWithTimestamps(
    script: string,
    voiceId: string,
    outputPath?: string
  ): Promise<{ audioPath: string; alignment?: Alignment }> {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const body = {
      text: script,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: true
      },
      // Choose mp3 for broad compatibility; downstream can convert if needed
      output_format: 'mp3_44100_128'
    } as const;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`ElevenLabs API error ${res.status}: ${txt || res.statusText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);

    const audioPath = outputPath || join(tmpdir(), `tts_${Date.now()}.mp3`);
    writeFileSync(audioPath, audioBuffer);

    return { audioPath, alignment: undefined };
  }

  async getVoices() {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': this.apiKey }
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Failed to get voices ${res.status}: ${txt || res.statusText}`);
    }
    const data = await res.json();
    return (data.voices || []).map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description
    }));
  }
}

export function createElevenLabsTTS(apiKey: string): ElevenLabsTTS {
  return new ElevenLabsTTS(apiKey);
}

export const VOICE_IDS = {
  ADAM: '21m00Tcm4TlvDq8ikWAM',
  BELLA: 'EXAVITQu4vr4xnSDxMaL',
  ANTONI: 'ErXwobaYiN019PkySvjV',
  ELLI: 'MF3mGyEYCl7XYWbV9V6O',
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',
  ARNOLD: 'VR6AewLTigWG4xSOukaG',
  DOMI: 'AZnzlk1XvdvUeBnXmlld',
  RACHEL: '21m00Tcm4TlvDq8ikWAM'
} as const;

export type VoiceId = keyof typeof VOICE_IDS; 