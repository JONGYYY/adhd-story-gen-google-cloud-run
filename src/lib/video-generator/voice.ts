import { VoiceOption } from './types';
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="node" />

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

async function generateSpeechAzure({ text, voice }: TextToSpeechOptions): Promise<ArrayBuffer> {
  const key = ((globalThis as any)?.process?.env?.AZURE_TTS_KEY || '').trim();
  const region = ((globalThis as any)?.process?.env?.AZURE_TTS_REGION || '').trim();
  if (!key || !region) throw new Error('Missing AZURE_TTS_KEY or AZURE_TTS_REGION');
  // Simple mapping of our ids/gender to Azure neural voices
  const azureVoice = (() => {
    const fallbackMale = 'en-US-GuyNeural';
    const fallbackFemale = 'en-US-JennyNeural';
    if (voice?.id) {
      const id = voice.id.toLowerCase();
      if (id === 'adam' || id === 'brian' || voice.gender === 'male') return fallbackMale;
      if (id === 'sarah' || id === 'laura' || id === 'rachel' || voice.gender === 'female') return fallbackFemale;
    }
    return voice.gender === 'female' ? fallbackFemale : fallbackMale;
  })();
  const ssml = `<?xml version="1.0" encoding="UTF-8"?>
  <speak version="1.0" xml:lang="en-US">
    <voice name="${azureVoice}">
      ${text.replace(/&/g,'&amp;')}
    </voice>
  </speak>`;
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      // WAV PCM for reliability in ffmpeg/Remotion pipelines
      'X-Microsoft-OutputFormat': 'riff-44100hz-16bit-mono-pcm',
      'User-Agent': 'adhd-story-gen/1.0',
    },
    body: ssml,
  } as any);
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Azure TTS failed: ${resp.status} ${resp.statusText} ${t}`);
  }
  const buf = await resp.arrayBuffer();
  if (!buf || buf.byteLength < 1024) throw new Error(`Azure TTS returned too small payload: ${buf?.byteLength || 0} bytes`);
  console.log(`Azure TTS received: ${buf.byteLength} bytes, voice=${azureVoice}`);
  return buf;
}

export async function generateSpeech({ text, voice }: TextToSpeechOptions): Promise<ArrayBuffer> {
  const provider = ((globalThis as any)?.process?.env?.TTS_PROVIDER || 'elevenlabs').toLowerCase();
  if (provider === 'azure') {
    return generateSpeechAzure({ text, voice });
  }

  const voiceId = VOICE_IDS[voice.id];
  if (!voiceId) {
    throw new Error(`Invalid voice ID: ${voice.id}`);
  }

  console.log(`Generating speech for voice ${voice.id} (${voiceId})`);
  const xiKey = (globalThis as any)?.process?.env?.ELEVENLABS_API_KEY as string | undefined;
  if (!xiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }
  
  try {
    const attemptOnce = async (): Promise<ArrayBuffer> => {
      // First attempt: streaming endpoint (low-latency) with explicit output format
      const streamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_44100_128`;
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': xiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.85,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (response.ok) {
        const buf = await response.arrayBuffer();
        console.log(`Streaming TTS response: ${buf.byteLength} bytes, content-type: ${response.headers.get('content-type')}`);
        if (buf.byteLength > 2048) {
          console.log('Successfully received streaming audio');
          return buf;
        }
        console.warn(`Streaming audio too small (${buf.byteLength} bytes). Falling back to non-stream endpoint.`);
      } else {
        const errorText = await response.text().catch(()=> '');
        console.warn(`Streaming TTS failed: ${response.status} ${response.statusText} ${errorText}. Falling back.`);
      }

      // Fallback: non-streaming endpoint (more reliable, slightly higher latency)
      const nonStreamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
      const resp2 = await fetch(nonStreamUrl, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': xiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.85,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });
      if (!resp2.ok) {
        const errorText = await resp2.text().catch(()=> '');
        throw new Error(`Failed to generate speech (fallback): ${resp2.status} ${resp2.statusText} ${errorText}`);
      }
      const buf2 = await resp2.arrayBuffer();
      console.log(`Non-stream audio received: ${buf2.byteLength} bytes, content-type: ${resp2.headers.get('content-type')}`);
      if (buf2.byteLength <= 2048) {
        throw new Error(`Non-stream audio too small: ${buf2.byteLength} bytes`);
      }
      return buf2;
    };

    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const buf = await attemptOnce();
        return buf;
      } catch (err) {
        lastError = err;
        const backoff = 400 * attempt;
        console.warn(`TTS attempt ${attempt} failed: ${(err as any)?.message || err}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw lastError || new Error('TTS failed after retries');
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