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

function bufferLooksSilentWav(buf: ArrayBuffer): boolean {
  try {
    const BufferCtor: any = (globalThis as any).Buffer;
    const b = BufferCtor.from(buf as any);
    if (b.length < 100) return true;
    if (b.slice(0, 4).toString('ascii') !== 'RIFF') return false;
    const data = b.subarray(44);
    const limit = Math.min(data.length, 10000);
    for (let i = 0; i < limit; i++) {
      if (data[i] !== 0) return false;
    }
    return true;
  } catch {
    return false;
  }
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
      const id = (voice.id as string).toLowerCase();
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
  const baseUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  // SSML WAV attempt
  const resp1 = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-44100hz-16bit-mono-pcm',
      'User-Agent': 'adhd-story-gen/1.0',
    },
    body: ssml,
  } as any);
  if (resp1.ok) {
    const buf1 = await resp1.arrayBuffer();
    console.log(`Azure TTS (SSML) bytes=${buf1.byteLength} ct=${resp1.headers.get('content-type')} voice=${azureVoice}`);
    if (buf1.byteLength > 4096 && !bufferLooksSilentWav(buf1)) {
      return buf1;
    }
    console.warn(`Azure TTS SSML returned tiny or silent WAV (${buf1.byteLength} bytes). Trying fallback...`);
  } else {
    const t = await resp1.text().catch(() => '');
    console.warn(`Azure TTS SSML failed: ${resp1.status} ${resp1.statusText} ${t}`);
  }

  // Plain MP3 attempt
  const resp2 = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'text/plain',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'Synthesis-VoiceName': azureVoice,
      'User-Agent': 'adhd-story-gen/1.0',
    },
    body: text,
  } as any);
  if (resp2.ok) {
    const buf2 = await resp2.arrayBuffer();
    console.log(`Azure TTS (plain/mp3) bytes=${buf2.byteLength} ct=${resp2.headers.get('content-type')} voice=${azureVoice}`);
    if (buf2.byteLength > 4096) return buf2;
    console.warn(`Azure TTS plain returned tiny payload (${buf2.byteLength} bytes). Trying alt WAV...`);
  } else {
    const t = await resp2.text().catch(() => '');
    console.warn(`Azure TTS plain failed: ${resp2.status} ${resp2.statusText} ${t}`);
  }

  // Alt WAV attempt
  const resp3 = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'text/plain',
      'X-Microsoft-OutputFormat': 'riff-24000hz-16bit-mono-pcm',
      'Synthesis-VoiceName': azureVoice,
      'User-Agent': 'adhd-story-gen/1.0',
    },
    body: text,
  } as any);
  if (resp3.ok) {
    const buf3 = await resp3.arrayBuffer();
    console.log(`Azure TTS (plain/wav24k) bytes=${buf3.byteLength} ct=${resp3.headers.get('content-type')} voice=${azureVoice}`);
    if (buf3.byteLength > 4096 && !bufferLooksSilentWav(buf3)) return buf3;
    console.warn(`Azure TTS alt WAV still tiny/silent (${buf3.byteLength} bytes).`);
  } else {
    const t = await resp3.text().catch(() => '');
    console.warn(`Azure TTS alt WAV failed: ${resp3.status} ${resp3.statusText} ${t}`);
  }

  throw new Error('Azure TTS returned no usable audio after fallbacks');
}

export async function generateSpeech({ text, voice }: TextToSpeechOptions): Promise<ArrayBuffer> {
  console.log("[TTS] Starting speech generation...");
  console.log("[TTS] Input:", { text: text?.slice(0, 40) + (text?.length > 40 ? "..." : ""), voice });

  // [MOD] Normalize provider env and default
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

// [MOD] This legacy helper is not used by the Remotion path; keep for compatibility with old code.
//       Do NOT rely on byte-size math for duration where ffprobe is available.
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
