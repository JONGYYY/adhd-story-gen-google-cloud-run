import { generateRandomString } from '@/lib/utils';

const TIKTOK_OAUTH_CONFIG = {
  clientKey: process.env.TIKTOK_CLIENT_KEY!,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
  scopes: ['user.info.basic', 'user.info.profile']
};

export class TikTokAPI {
  constructor() {}

  getAuthUrl(): string {
    const csrfState = generateRandomString(32);
    const params = new URLSearchParams({
      client_key: TIKTOK_OAUTH_CONFIG.clientKey,
      redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
      scope: TIKTOK_OAUTH_CONFIG.scopes.join(','),
      response_type: 'code',
      state: csrfState
    });

    return `https://www.tiktok.com/auth/authorize/v2/?${params.toString()}`;
  }

  async getAccessToken(code: string) {
    try {
      const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: new URLSearchParams({
          client_key: TIKTOK_OAUTH_CONFIG.clientKey,
          client_secret: TIKTOK_OAUTH_CONFIG.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`TikTok OAuth error: ${error.message || 'Failed to get access token'}`);
      }

      return response.json();
    } catch (error) {
      console.error('TikTok OAuth error:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken: string) {
    try {
      const response = await fetch('https://open.tiktokapis.com/v2/user/info/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`TikTok API error: ${error.message || 'Failed to get user info'}`);
      }

      const userData = await response.json();
      
      if (userData.error) {
        throw new Error(`TikTok API error: ${userData.error.message || 'Failed to get user info'}`);
      }

      // Return the actual user data structure from TikTok API
      return {
        open_id: userData.data.user.open_id,
        username: userData.data.user.display_name,
        display_name: userData.data.user.display_name,
        avatar_url: userData.data.user.avatar_url
      };
    } catch (error) {
      console.error('TikTok API error:', error);
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