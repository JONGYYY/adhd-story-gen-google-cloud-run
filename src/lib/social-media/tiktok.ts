import { generateRandomString } from '@/lib/utils';

const TIKTOK_OAUTH_CONFIG = {
  clientKey: process.env.TIKTOK_CLIENT_KEY!,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
  scopes: ['user.info.basic', 'user.info.profile']
};

export class TikTokAPI {
  constructor() {
    // Validate required environment variables
    if (!process.env.TIKTOK_CLIENT_KEY) {
      throw new Error('TIKTOK_CLIENT_KEY is not set');
    }
    if (!process.env.TIKTOK_CLIENT_SECRET) {
      throw new Error('TIKTOK_CLIENT_SECRET is not set');
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error('NEXT_PUBLIC_APP_URL is not set');
    }
  }

  getAuthUrl(): string {
    console.log('Generating TikTok OAuth URL...');
    const csrfState = generateRandomString(32);
    
    // Store state in memory or database for validation
    // TODO: Implement state storage/validation
    
    const params = new URLSearchParams({
      client_key: TIKTOK_OAUTH_CONFIG.clientKey,
      redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
      scope: TIKTOK_OAUTH_CONFIG.scopes.join(','),
      response_type: 'code',
      state: csrfState
    });

    // Add sandbox mode parameters
    params.append('app_id', process.env.TIKTOK_CLIENT_KEY!);
    params.append('app_source_domain', new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname);

    const url = `https://www.tiktok.com/auth/authorize?${params.toString()}`;
    console.log('Generated OAuth URL:', url);
    return url;
  }

  async getAccessToken(code: string) {
    console.log('Getting access token from code...');
    try {
      const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
      console.log('Token endpoint:', tokenUrl);

      const params = new URLSearchParams({
        client_key: TIKTOK_OAUTH_CONFIG.clientKey,
        client_secret: TIKTOK_OAUTH_CONFIG.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
      });

      console.log('Token request params:', {
        client_key: `${TIKTOK_OAUTH_CONFIG.clientKey.substring(0, 8)}...`,
        client_secret: 'HIDDEN',
        code: `${code.substring(0, 8)}...`,
        redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: params.toString(),
      });

      const data = await response.json();
      console.log('Token response status:', response.status);
      
      if (!response.ok) {
        console.error('Token error response:', data);
        throw new Error(`TikTok OAuth error: ${data.error?.message || data.message || 'Failed to get access token'}`);
      }

      if (!data.access_token) {
        console.error('No access token in response:', data);
        throw new Error('No access token received from TikTok');
      }

      console.log('Successfully obtained access token');
      return data;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken: string) {
    console.log('Getting user info...');
    try {
      const userUrl = 'https://open.tiktokapis.com/v2/user/info/';
      console.log('User info endpoint:', userUrl);

      const response = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      console.log('User info response status:', response.status);

      if (!response.ok) {
        console.error('User info error response:', data);
        throw new Error(`TikTok API error: ${data.error?.message || data.message || 'Failed to get user info'}`);
      }

      if (!data.data?.user) {
        console.error('Invalid user info response:', data);
        throw new Error('Invalid user info response from TikTok');
      }

      console.log('Successfully obtained user info');
      return {
        open_id: data.data.user.open_id,
        username: data.data.user.display_name,
        display_name: data.data.user.display_name,
        avatar_url: data.data.user.avatar_url
      };
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  }

  async uploadVideo(accessToken: string, videoData: {
    title: string;
    video_file: Buffer;
    privacy_level?: 'PUBLIC' | 'SELF_ONLY' | 'MUTUAL_FOLLOW';
  }) {
    try {
      // 1. Initialize upload
      const initResponse = await fetch('https://open.tiktokapis.com/v2/video/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: videoData.title,
            privacy_level: videoData.privacy_level || 'SELF_ONLY',
          },
        }),
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize video upload');
      }

      const { upload_url, video_id } = await initResponse.json();

      // 2. Upload video
      const uploadResponse = await fetch(upload_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
        },
        body: videoData.video_file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video');
      }

      // 3. Publish video
      const publishResponse = await fetch('https://open.tiktokapis.com/v2/video/publish/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id,
        }),
      });

      if (!publishResponse.ok) {
        throw new Error('Failed to publish video');
      }

      return publishResponse.json();
    } catch (error) {
      console.error('TikTok video upload error:', error);
      throw error;
    }
  }
} 