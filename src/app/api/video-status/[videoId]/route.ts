import { NextResponse } from 'next/server';
import { getVideoStatus } from '@/lib/video-generator/status';

// Railway API configuration
const RAILWAY_API_URL = 'https://adhd-story-gen-production.up.railway.app';

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
  
  // Transform Railway response to match our expected format
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
    // First, try to get local status
    const localStatus = await getVideoStatus(params.videoId);
    
    // If local status is not_found, try Railway API
    if (localStatus.status === 'not_found') {
      console.log('Local status not found, checking Railway API...');
      
      try {
        const railwayStatus = await getRailwayVideoStatus(params.videoId);
        return NextResponse.json(railwayStatus);
      } catch (railwayError) {
        console.error('Railway API error:', railwayError);
        // If Railway also fails, return not found
        return NextResponse.json(
          { error: 'Video status not found' },
          { status: 404 }
        );
      }
    } else {
      // Return local status if found
      console.log('Found local video status:', JSON.stringify(localStatus, null, 2));
      return NextResponse.json(localStatus);
    }
  } catch (error) {
    console.error('Failed to get video status:', error);
    return NextResponse.json(
      { error: 'Failed to get video status' },
      { status: 500 }
    );
  }
} 