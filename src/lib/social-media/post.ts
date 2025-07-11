import { PostVideoParams, PostVideoResult, SocialMediaCredentials } from './types';
import { getSocialMediaCredentials } from './schema';
import FormData from 'form-data';
import fs from 'fs';

export async function postVideo(userId: string, params: PostVideoParams): Promise<PostVideoResult> {
  try {
    // Get credentials
    const credentials = await getSocialMediaCredentials(userId, params.platform);
    if (!credentials) {
      return {
        success: false,
        error: `No ${params.platform} credentials found. Please connect your account first.`
      };
    }

    switch (params.platform) {
      case 'youtube':
        return await postToYouTube(credentials, params);
      case 'tiktok':
        return await postToTikTok(credentials, params);
      case 'instagram':
        return await postToInstagram(credentials, params);
      default:
        throw new Error(`Unsupported platform: ${params.platform}`);
    }
  } catch (error) {
    console.error(`Failed to post video to ${params.platform}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function postToYouTube(
  credentials: SocialMediaCredentials,
  params: PostVideoParams
): Promise<PostVideoResult> {
  // First, initiate the upload
  const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/*',
      'X-Upload-Content-Length': fs.statSync(params.videoPath).size.toString()
    },
    body: JSON.stringify({
      snippet: {
        title: params.title,
        description: params.description || '',
        tags: params.tags || []
      },
      status: {
        privacyStatus: 'public'
      }
    })
  });

  if (!initResponse.ok || !initResponse.headers.get('location')) {
    throw new Error('Failed to initiate YouTube upload');
  }

  // Get the upload URL
  const uploadUrl = initResponse.headers.get('location')!;

  // Upload the video file
  const form = new FormData();
  form.append('video', fs.createReadStream(params.videoPath), {
    filename: 'video.mp4',
    contentType: 'video/mp4'
  });
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: form,
    headers: form.getHeaders()
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload video to YouTube');
  }

  const videoData = await uploadResponse.json();
  return {
    success: true,
    postId: videoData.id,
    url: `https://youtube.com/watch?v=${videoData.id}`
  };
}

async function postToTikTok(
  credentials: SocialMediaCredentials,
  params: PostVideoParams
): Promise<PostVideoResult> {
  // First, initiate the upload
  const initResponse = await fetch('https://open-api.tiktok.com/share/video/upload/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`
    }
  });

  const { data } = await initResponse.json();
  if (!data?.upload_url) {
    throw new Error('Failed to get TikTok upload URL');
  }

  // Prepare the video upload
  const form = new FormData();
  form.append('video', fs.createReadStream(params.videoPath), {
    filename: 'video.mp4',
    contentType: 'video/mp4'
  });
  
  // Upload the video
  const uploadResponse = await fetch(data.upload_url, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload video to TikTok');
  }

  const result = await uploadResponse.json();
  return {
    success: true,
    postId: result.video_id,
    url: `https://www.tiktok.com/@${credentials.username}/video/${result.video_id}`
  };
}

async function postToInstagram(
  credentials: SocialMediaCredentials,
  params: PostVideoParams
): Promise<PostVideoResult> {
  // First, create a container
  const containerResponse = await fetch(`https://graph.instagram.com/v12.0/${credentials.userId}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`
    },
    body: new URLSearchParams({
      media_type: 'REELS',
      video_url: params.videoPath,
      caption: `${params.title}\n\n${params.description || ''}`
    })
  });

  const containerData = await containerResponse.json();
  if (!containerData.id) {
    throw new Error('Failed to create Instagram container');
  }

  // Publish the container
  const publishResponse = await fetch(`https://graph.instagram.com/v12.0/${credentials.userId}/media_publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`
    },
    body: new URLSearchParams({
      creation_id: containerData.id
    })
  });

  const publishData = await publishResponse.json();
  return {
    success: true,
    postId: publishData.id,
    url: `https://www.instagram.com/p/${publishData.id}`
  };
} 