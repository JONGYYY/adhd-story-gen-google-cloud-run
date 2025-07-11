import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { count = 3 } = await request.json();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a creative writing assistant that generates engaging story ideas suitable for short-form video content. Each idea should be formatted as "Title: Brief story premise". The ideas should be diverse, engaging, and suitable for viral social media content.`,
        },
        {
          role: 'user',
          content: `Generate ${count} unique story ideas that would work well as short videos. Each idea should:
1. Have a catchy, clickable title
2. Include a brief but compelling story premise
3. Be suitable for 1-3 minute videos
4. Have potential for emotional engagement
5. Be relatable or intriguing to a broad audience

Format each idea as "Title: Story premise"`,
        },
      ],
      temperature: 0.9,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Split the response into individual ideas and clean them up
    const ideas = response
      .split('\n')
      .filter(line => line.trim() !== '' && line.includes(':'))
      .map(idea => idea.trim());

    return NextResponse.json({ ideas });
  } catch (error) {
    console.error('Error generating story ideas:', error);
    return NextResponse.json(
      { error: 'Failed to generate story ideas' },
      { status: 500 }
    );
  }
} 