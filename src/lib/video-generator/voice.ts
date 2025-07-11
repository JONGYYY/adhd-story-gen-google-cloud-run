import { VoiceOption } from './types';

// Map voice IDs to ElevenLabs voice IDs
const VOICE_IDS: Record<VoiceOption['id'], string> = {
  brian: 'nPczCjzI2devNBz1zQrb',
  adam: 'pNInz6obpgDQGcFmaJgB',
  antoni: 'ErXwobaYiN019PkySvjV',
  sarah: 'EXAVITQu4vr4xnSDxMaL',
  laura: 'FGY2WhTYpPnrIDTdsKH5',
  rachel: '21m00Tcm4TlvDq8ikWAM',
};

interface TextToSpeechOptions {
  text: string;
  voice: VoiceOption;
}

export async function generateSpeech({ text, voice }: TextToSpeechOptions): Promise<ArrayBuffer> {
  const voiceId = VOICE_IDS[voice.id];
  if (!voiceId) {
    throw new Error(`Invalid voice ID: ${voice.id}`);
  }

  console.log(`Generating speech for voice ${voice.id} (${voiceId})`);
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',  // Use the latest model
        voice_settings: {
          stability: 0.75,  // Increased stability for more consistent voice
          similarity_boost: 0.85,  // Increased similarity for better voice matching
          style: 0.35,  // Add some style variation for more natural speech
          use_speaker_boost: true,  // Enable speaker boost for clearer audio
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate speech: ${response.statusText}. ${errorText}`);
    }

    console.log('Successfully received audio response');
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

export async function getAudioDuration(audioBuffer: ArrayBuffer): Promise<number> {
  try {
    // Convert bytes to seconds based on MP3 bitrate
    // Assuming 192kbps bitrate (192000 bits per second)
    // 192000 bits = 24000 bytes per second
    const BYTES_PER_SECOND = 24000;
    const durationInSeconds = audioBuffer.byteLength / BYTES_PER_SECOND;
    
    // Add a small buffer to ensure we don't cut off the audio
    return durationInSeconds + 0.5;
  } catch (error) {
    console.error('Error calculating audio duration:', error);
    throw error;
  }
} 