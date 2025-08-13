import { NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const VOICE_IDS = {
  brian: "ThT5KcBeYPX3keUQqHPh",  // Deep, authoritative male
  adam: "pNInz6obpgDQGcFmaJgB",   // Friendly, casual male
  antoni: "ErXwobaYiN019PkySvjV", // Energetic male
  sarah: "EXAVITQu4vr4xnSDxMaL",  // Professional female
  laura: "pFZP5JQG7iQjIQuC4Bku",  // Warm female
  rachel: "21m00Tcm4TlvDq8ikWAM", // Dynamic female
};

const PREVIEW_TEXTS = {
  brian: "I specialize in serious stories and dramatic revelations.",
  adam: "Hey there! I'm perfect for telling relatable, everyday stories.",
  antoni: "Let me share this amazing story with you - you won't believe what happens next!",
  sarah: "Welcome, I'll guide you through this compelling narrative.",
  laura: "I understand how you feel. Let me share something personal with you.",
  rachel: "Get ready for an incredible story that will keep you on the edge of your seat.",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voiceAlias = searchParams.get('voiceId');

  if (!voiceAlias || !PREVIEW_TEXTS[voiceAlias as keyof typeof PREVIEW_TEXTS]) {
    return new NextResponse('Invalid voice ID', { status: 400 });
  }

  const voiceId = VOICE_IDS[voiceAlias as keyof typeof VOICE_IDS];
  
  if (!voiceId) {
    return new NextResponse('Voice ID mapping not found', { status: 400 });
  }

  if (!ELEVENLABS_API_KEY) {
    return new NextResponse('ElevenLabs API key not configured', { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: PREVIEW_TEXTS[voiceAlias as keyof typeof PREVIEW_TEXTS],
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to generate voice preview:', error);
    return new NextResponse(
      `Failed to generate voice preview: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      { status: 500 }
    );
  }
} 