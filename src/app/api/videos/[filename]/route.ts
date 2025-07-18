import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { createReadStream, statSync } from 'fs';
import path from 'path';
import os from 'os';

// Helper function to get the appropriate tmp directory
function getTmpDir(): string {
  // Use /tmp for Vercel, os.tmpdir() for local development
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const tmpDir = getTmpDir();
    const videoPath = path.join(tmpDir, filename);

    console.log('Looking for video at:', videoPath);

    // Check if file exists
    try {
      await fs.access(videoPath);
    } catch {
      console.log('Video not found at:', videoPath);
      return new NextResponse('Video not found', { status: 404 });
    }

    // Get file stats
    const stat = statSync(videoPath);
    const fileSize = stat.size;
    const range = request.headers.get('range');

    console.log('Serving video:', filename, 'Size:', fileSize);

    if (range) {
      // Handle range request
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(videoPath, { start, end });
      const streamResponse = new NextResponse(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': 'video/mp4',
        },
      });

      return streamResponse;
    } else {
      // Handle non-range request
      const stream = createReadStream(videoPath);
      const streamResponse = new NextResponse(stream as any, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        },
      });

      return streamResponse;
    }
  } catch (error) {
    console.error('Error serving video:', error);
    return new NextResponse('Error serving video', { status: 500 });
  }
} 