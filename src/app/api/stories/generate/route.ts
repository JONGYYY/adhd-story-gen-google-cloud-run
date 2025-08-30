import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateStructuredStory, splitStoryIntoBeats } from '@/lib/story-generator';
import { generateTTSAndAlignment } from '@/lib/video-generator/shared/audio';
import { v4 as uuidv4 } from 'uuid';

interface StoryRequest {
  subreddit: string; // e.g., r/aita
  isCliffhanger?: boolean;
  narratorGender?: 'male' | 'female';
  voice?: { provider?: 'elevenlabs' | 'edge'; voiceId?: string; gender?: 'male' | 'female' };
}

export async function POST(request: NextRequest) {
  try {
    const { subreddit, isCliffhanger = false, narratorGender = 'male', voice } = (await request.json()) as StoryRequest;
    if (!subreddit) {
      return NextResponse.json({ error: 'Missing subreddit' }, { status: 400 });
    }

    // 1) Generate story using prompt templates
    const story = await generateStructuredStory({ subreddit, isCliffhanger, narratorGender });

    // 2) Split into beats using [BREAK] or paragraphs
    const { beats } = splitStoryIntoBeats(story.content);

    // 3) Generate TTS for story (full), obtain duration and alignment path
    const jobId = uuidv4();
    const tts = await generateTTSAndAlignment(story.content, {
      provider: (voice?.provider || 'elevenlabs') as any,
      voiceId: voice?.voiceId || 'adam',
    } as any, jobId);

    return NextResponse.json({
      title: story.title,
      content: story.content,
      metadata: story.metadata,
      beats,
      audio: { duration: tts.duration },
    });
  } catch (error: any) {
    console.error('Error generating story:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate story' }, { status: 500 });
  }
}