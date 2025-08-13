import { NextResponse } from 'next/server';

// Railway API configuration
const RAILWAY_API_URL = 'https://web-production-5e5d1.up.railway.app';

async function generateRailwayVideo(requestBody: any) {
  console.log('Calling Railway API for video generation');
  
  const response = await fetch(`${RAILWAY_API_URL}/generate-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Railway API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Railway video generation response:', JSON.stringify(result, null, 2));
  
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received video generation request:', JSON.stringify(body, null, 2));
    
    const railwayResult = await generateRailwayVideo(body);
    
    return NextResponse.json(railwayResult);
  } catch (error) {
    console.error('Video generation failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Video generation service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 503 }
    );
  }
} 