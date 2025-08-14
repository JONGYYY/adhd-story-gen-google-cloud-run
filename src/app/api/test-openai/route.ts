import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('Testing OpenAI API...');
    
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'OPENAI_API_KEY not set'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('Making OpenAI request...');
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, this is a test!" and nothing else.',
        },
      ],
      max_tokens: 50,
    });

    const duration = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content;

    console.log('OpenAI response received in', duration, 'ms:', response);

    return new Response(JSON.stringify({
      success: true,
      response: response,
      duration: duration,
      model: completion.model,
      usage: completion.usage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 