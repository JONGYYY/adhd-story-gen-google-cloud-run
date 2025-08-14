import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Railway API configuration
const RAW_RAILWAY_API_URL = (process.env.RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://web-production-5e5d1.up.railway.app').trim();
const RAILWAY_API_URL = RAW_RAILWAY_API_URL.replace(/\/$/, '');

export async function POST(request: NextRequest) {
  try {
    console.log('Testing Railway API call...');
    
    const testPayload = {
      customStory: {
        title: "Test Story",
        story: "This is a test. [BREAK] It should work.",
        subreddit: "r/test",
        author: "Anonymous"
      },
      voice: { id: "adam", gender: "male" },
      background: { category: "minecraft", speedMultiplier: 1 },
      isCliffhanger: true
    };

    console.log('Calling Railway API at:', RAILWAY_API_URL);
    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch(`${RAILWAY_API_URL}/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('Railway response status:', response.status);
    console.log('Railway response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Railway error:', errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `Railway error: ${response.status} - ${errorText}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log('Railway success response:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify({
      success: true,
      railwayResponse: result,
      railwayUrl: RAILWAY_API_URL
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test generate error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 