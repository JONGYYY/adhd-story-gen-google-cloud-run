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

    // Get form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const platform = formData.get('platform') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : undefined;
    
    // Validate request
    if (!platform || !videoFile || !title) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Construct params
    const params: PostVideoParams = {
      platform: platform as any, // Type assertion since we validate supported platforms in postVideo
      videoFile,
      title,
      description,
      tags
    };

    // Post video
    const result = await postVideo(currentUser.uid, params);

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