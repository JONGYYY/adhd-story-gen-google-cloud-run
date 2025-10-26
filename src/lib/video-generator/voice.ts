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
  const forcedName = ((globalThis as any)?.process?.env?.AZURE_VOICE_NAME || '').trim();
  const azureVoice = forcedName || (() => {
    const fallbackMale = 'en-US-GuyNeural';
    const fallbackFemale = 'en-US-JennyNeural';
    if (voice?.id) {
      const id = voice.id.toLowerCase();
      if (id === 'adam' || id === 'brian' || voice.gender === 'male') return fallbackMale;
      if (id === 'sarah' || id === 'laura' || id === 'rachel' || voice.gender === 'female') return fallbackFemale;
    }
    return voice.gender === 'female' ? fallbackFemale : fallbackMale;
  })();
  const escapeXml = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const ssml = `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xml:lang="en-US" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts">
  <voice name="${azureVoice}">
    <prosody rate="0%" pitch="0%">${escapeXml(text)}</prosody>
  </voice>
</speak>`;
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
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
  console.log(`Azure TTS received: ${buf.byteLength} bytes, content-type=${resp.headers.get('content-type')}, voice=${azureVoice}`);
  if (!buf || buf.byteLength < 1024) throw new Error(`Azure TTS returned too small payload: ${buf?.byteLength || 0} bytes`);
  return buf;
}

export async function generateSpeech({ text, voice }: TextToSpeechOptions): Promise<ArrayBuffer> {
  console.log("[TTS] Starting speech generation...");
  console.log("[TTS] Input:", { text: text?.slice(0, 40) + (text?.length > 40 ? "..." : ""), voice });

  const provider = ((globalThis as any)?.process?.env?.TTS_PROVIDER || "elevenlabs").toLowerCase();
  console.log(`[TTS] Selected provider: ${provider}`);

  if (provider === "azure") {
    console.log("[TTS] Using Azure flow");
    return generateSpeechAzure({ text, voice });
  }

  const voiceId = VOICE_IDS[(voice.id || "").toLowerCase()];
  console.log("[TTS] Mapped voiceId:", voiceId);

  if (!voiceId) {
    throw new Error(`Invalid voice ID: ${voice.id}`);
  }

  const xiKey = (globalThis as any)?.process?.env?.ELEVENLABS_API_KEY as string | undefined;
  if (!xiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const attemptOnce = async (attempt: number): Promise<ArrayBuffer> => {
    console.log(`[TTS] Attempt ${attempt}: starting stream request...`);
    const streamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_44100_128`;

    const response = await fetch(streamUrl, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": xiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    console.log(`[TTS] Stream response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const buf = await response.arrayBuffer();
      console.log(`[TTS] Stream buffer size: ${buf.byteLength} bytes`);
      if (buf.byteLength > 512) {
        console.log("[TTS] ✅ Valid streaming audio received");
        return buf;
      } else {
        console.warn("[TTS] ⚠️ Stream too small, fallback triggered");
      }
    } else {
      const errorText = await response.text().catch(() => "");
      console.warn(`[TTS] ⚠️ Stream failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    console.log("[TTS] Attempting non-stream fallback...");
    const nonStreamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
    const resp2 = await fetch(nonStreamUrl, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": xiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    console.log(`[TTS] Fallback response: ${resp2.status} ${resp2.statusText}`);

    if (!resp2.ok) {
      const errorText = await resp2.text().catch(() => "");
      throw new Error(`[TTS] ❌ Fallback failed: ${resp2.status} ${resp2.statusText} ${errorText}`);
    }

    const buf2 = await resp2.arrayBuffer();
    console.log(`[TTS] Fallback buffer size: ${buf2.byteLength} bytes`);

    if (buf2.byteLength <= 512) {
      throw new Error(`[TTS] ❌ Non-stream too small: ${buf2.byteLength} bytes`);
    }

    console.log("[TTS] ✅ Successfully received fallback audio");
    return buf2;
  };

  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[TTS] Attempt ${attempt}...`);
      const buf = await attemptOnce(attempt);
      console.log(`[TTS] ✅ Success on attempt ${attempt}`);
      return buf;
    } catch (err) {
      lastError = err;
      console.error(`[TTS] ❌ Attempt ${attempt} failed:`, err);
      const backoff = 400 * attempt;
      console.log(`[TTS] Retrying in ${backoff}ms...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  console.error("[TTS] ❌ All attempts failed:", lastError);
  throw lastError || new Error("TTS failed after retries");
}

export async function getAudioDuration(audioBuffer: ArrayBuffer): Promise<number> {
  try {
    const BYTES_PER_SECOND = 24000;
    const durationInSeconds = audioBuffer.byteLength / BYTES_PER_SECOND;
    return durationInSeconds + 0.5;
  } catch (error) {
    console.error('Error calculating audio duration:', error);
    throw error;
  }
} 
