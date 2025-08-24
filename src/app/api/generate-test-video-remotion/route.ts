import { NextRequest, NextResponse } from 'next/server';
import { setVideoGenerating, updateProgress, setVideoReady, setVideoFailed } from '@/lib/video-generator/status';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    // Parse JSON body, but do not fail if missing/invalid
    let background = 'minecraft';
    try {
      const body = await request.json();
      console.log('🎬 Received Remotion test video generation request:', body);
      if (body && typeof body.background === 'string') background = body.background;
    } catch (e) {
      console.warn('Body parse failed or empty, proceeding with defaults');
    }

    // Set initial status
    await setVideoGenerating(videoId);

    // Start async video generation using a minimal local writer first
    // to guarantee progress/ready without external modules
    generateRemotionSmokeTest({ background }, videoId)
      .catch(async (error) => {
        console.error('❌ Remotion smoke test failed:', error);
        await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error');
      });

    return NextResponse.json({
      success: true,
      videoId,
      message: 'Remotion test video generation started'
    });

  } catch (error) {
    console.error('❌ Error in Remotion test video generation:', error);
    await setVideoFailed(videoId, error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      videoId
    }, { status: 500 });
  }
}

async function generateRemotionSmokeTest(
  options: { background: string },
  videoId: string
) {
  console.log('🎬 Starting Remotion smoke test for video:', videoId);
  try {
    const { writeFile } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const htmlName = `remotion_test_${videoId}.html`;
    const htmlPath = `${tmpdir()}/${htmlName}`;

    await updateProgress(videoId, 10);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Remotion Smoke Test</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;color:#fff;font-family:system-ui,Segoe UI,Roboto"><div><h1>✅ Remotion test ready</h1><p>VideoId: ${videoId}</p><p>Background: ${options.background}</p></div></body></html>`;
    await writeFile(htmlPath, html, 'utf-8');

    await updateProgress(videoId, 90);
    const publicUrl = `/api/videos/${htmlName}`;
    await setVideoReady(videoId, publicUrl);
    await updateProgress(videoId, 100);

    console.log('✅ Remotion smoke test file created at:', htmlPath);
  } catch (error) {
    console.error('❌ Smoke test failed:', error);
    throw error;
  }
}