import { NextResponse } from 'next/server';

// Railway API configuration
const RAILWAY_API_URL = 'https://web-production-5e5d1.up.railway.app';

async function getRailwayVideoStatus(videoId: string) {
  console.log(`Checking Railway video status for ID: ${videoId}`);
  
  const response = await fetch(`${RAILWAY_API_URL}/video-status/${videoId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Video status not found');
    }
    const errorText = await response.text();
    throw new Error(`Railway API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Railway video status:', JSON.stringify(result, null, 2));
  
  return {
    status: result.status,
    progress: result.progress || 0,
    error: result.error,
    videoUrl: result.videoUrl ? `${RAILWAY_API_URL}${result.videoUrl}` : null,
  };
}

export async function GET(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const railwayStatus = await getRailwayVideoStatus(params.videoId);
    return NextResponse.json(railwayStatus);
  } catch (error) {
    console.error('Failed to get video status:', error);
    return NextResponse.json(
      { error: 'Video status not found' },
      { status: 404 }
    );
  }
} 