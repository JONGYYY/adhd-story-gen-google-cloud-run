import { NextResponse } from 'next/server';
import { getVideoStatus } from '@/lib/video-generator/status';

export async function GET(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const status = await getVideoStatus(params.videoId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get video status:', error);
    if (error instanceof Error && error.message === 'Video status not found') {
      return NextResponse.json(
        { error: 'Video status not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to get video status' },
      { status: 500 }
    );
  }
} 