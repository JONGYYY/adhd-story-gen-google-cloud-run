import { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { postVideo } from '@/lib/social-media/post';
import { PostVideoParams } from '@/lib/social-media/types';

export async function POST(request: NextRequest) {
  try {
    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = decodedClaims.uid;

    // Get request body
    const body = await request.json() as PostVideoParams;
    
    // Validate request
    if (!body.platform || !body.videoPath || !body.title) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Post video
    const result = await postVideo(userId, body);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to post video:', error);
    return new Response(JSON.stringify({ error: 'Failed to post video' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 