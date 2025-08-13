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

// Helper function to get content type based on file extension
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.mp4':
      return 'video/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.srt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const tmpDir = getTmpDir();
    const filePath = path.join(tmpDir, filename);

    console.log('Looking for file at:', filePath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.log('File not found at:', filePath);
      return new NextResponse('File not found', { status: 404 });
    }

    // Get file stats and content type
    const stat = statSync(filePath);
    const fileSize = stat.size;
    const contentType = getContentType(filename);
    const range = request.headers.get('range');

    console.log('Serving file:', filename, 'Size:', fileSize, 'Type:', contentType);

    // For HTML files, read and return content directly
    if (contentType.includes('text/html')) {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(htmlContent, 'utf-8').toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // For video and audio files, handle range requests for streaming
    if (range && (contentType.includes('video/') || contentType.includes('audio/'))) {
      // Handle range request
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });
      const streamResponse = new NextResponse(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      });

      return streamResponse;
    } else {
      // Handle non-range request
      const stream = createReadStream(filePath);
      const streamResponse = new NextResponse(stream as any, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        },
      });

      return streamResponse;
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Error serving file', { status: 500 });
  }
} 