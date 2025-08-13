import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateStory } from '@/utils/openai';
import { StoryCategory } from '@/utils/reddit';

type StoryLength = 'short' | 'medium' | 'long';
type TargetLength = Record<StoryLength, number>;

interface StoryRequest {
  prompt: string;
  length?: StoryLength;
  style?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, length = 'medium', style = 'casual' } = (await request.json()) as StoryRequest;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt' },
        { status: 400 }
      );
    }

    // TODO: Implement actual story generation with OpenAI
    // This is a mock response
    const story = {
      id: Math.random().toString(36).substr(2, 9),
      prompt,
      content: 'Generated story content would go here...',
      metadata: {
        length,
      style,
        wordCount: 500,
        readingTime: '2 min',
        generated: new Date().toISOString()
      }
    };

    // Calculate rough engagement prediction based on story characteristics
    const wordCount = story.content.split(/\s+/).length;
    const targetLength: TargetLength = {
      short: 400,
      medium: 650,
      long: 1000
    };

    // Simple engagement prediction based on length optimization
    const lengthScore = 1 - Math.abs(wordCount - targetLength[length]) / targetLength[length];
    const engagementPrediction = Math.min(0.95, Math.max(0.7, lengthScore));

    return NextResponse.json({
      ...story,
      predictions: {
        engagement: engagementPrediction,
        estimatedViews: Math.floor(engagementPrediction * 10000),
        viralPotential: engagementPrediction > 0.85 ? 'high' : 'medium'
      }
    });
  } catch (error) {
    console.error('Error generating story:', error);
    return NextResponse.json(
      { error: 'Failed to generate story' },
      { status: 500 }
    );
  }
} 