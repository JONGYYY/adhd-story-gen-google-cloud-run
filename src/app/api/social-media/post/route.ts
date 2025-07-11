import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase';
import { postVideo } from '@/lib/social-media/post';
import { PostVideoParams } from '@/lib/social-media/types';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    const result = await postVideo(currentUser.uid, body);

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