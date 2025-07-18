import { generateRandomString } from '@/lib/utils';
import { APP_CONFIG } from '@/lib/config';

interface TikTokOAuthConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
}

const TIKTOK_OAUTH_CONFIG: TikTokOAuthConfig = {
  clientKey: process.env.TIKTOK_CLIENT_KEY || '',
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  redirectUri: `${APP_CONFIG.APP_URL}/api/auth/tiktok/callback`,
  baseUrl: 'https://www.tiktok.com/auth/authorize',
};

// Add test mode for debugging
const TEST_MODE = process.env.TIKTOK_TEST_MODE === 'true';

console.log('TikTok OAuth Config:', {
  clientKey: TIKTOK_OAUTH_CONFIG.clientKey ? `${TIKTOK_OAUTH_CONFIG.clientKey.substring(0, 8)}...` : 'NOT_SET',
  clientSecret: TIKTOK_OAUTH_CONFIG.clientSecret ? 'SET' : 'NOT_SET',
  redirectUri: TIKTOK_OAUTH_CONFIG.redirectUri,
  baseUrl: TIKTOK_OAUTH_CONFIG.baseUrl,
  testMode: TEST_MODE
});

export class TikTokAPI {
  constructor() {
    // Validate required environment variables
    if (!process.env.TIKTOK_CLIENT_KEY) {
      throw new Error('TIKTOK_CLIENT_KEY is not set');
    }
    if (!process.env.TIKTOK_CLIENT_SECRET) {
      throw new Error('TIKTOK_CLIENT_SECRET is not set');
    }
    if (!APP_CONFIG.APP_URL) {
      throw new Error('APP_URL is not set');
    }
  }

  getAuthUrl(): string {
    const state = generateRandomString(32);
    
    // In test mode, redirect to our test endpoint
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Using test endpoint instead of TikTok OAuth');
      return `${APP_CONFIG.APP_URL}/api/force-tiktok-connect?state=${state}`;
    }

    const params = new URLSearchParams({
      client_key: TIKTOK_OAUTH_CONFIG.clientKey,
      redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
      scope: 'user.info.basic,user.info.profile,video.list,video.upload,video.publish',
      response_type: 'code',
      state,
      app_id: TIKTOK_OAUTH_CONFIG.clientKey,
      app_source_domain: new URL(TIKTOK_OAUTH_CONFIG.redirectUri).hostname,
    });

    const url = `${TIKTOK_OAUTH_CONFIG.baseUrl}?${params.toString()}`;
    console.log('Generated TikTok OAuth URL:', url);
    return url;
  }

  async getAccessToken(code: string) {
    console.log('Getting access token from code...');
    
    // In test mode, return mock tokens
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock access token');
      return {
        access_token: 'test_access_token_' + Date.now(),
        refresh_token: 'test_refresh_token_' + Date.now(),
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'user.info.basic,user.info.profile,video.list,video.upload,video.publish'
      };
    }
    
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
    
    // In test mode, return mock user info
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock user info');
      return {
        open_id: 'test_open_id_' + Date.now(),
        username: 'test_user_' + Date.now(),
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        bio_description: 'Test bio',
        profile_deep_link: 'https://tiktok.com/@testuser',
        is_verified: false,
        follower_count: 100,
        following_count: 50,
        likes_count: 1000,
        video_count: 25
      };
    }
    
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
      return data.data.user;
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
    console.log('Uploading video to TikTok...');
    
    // In test mode, return mock upload response
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock video upload response');
      return {
        video_id: 'test_video_id_' + Date.now(),
        status: 'success',
        message: 'Video uploaded successfully (test mode)',
        share_url: 'https://tiktok.com/@testuser/video/test123',
        privacy_level: videoData.privacy_level || 'SELF_ONLY'
      };
    }
    
    try {
      console.log('Initializing video upload...');
      
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

      const initData = await initResponse.json();
      console.log('Init response status:', initResponse.status);
      
      if (!initResponse.ok) {
        console.error('Init error response:', initData);
        throw new Error(`Failed to initialize video upload: ${initData.error?.message || initData.message || 'Unknown error'}`);
      }

      const { upload_url, video_id } = initData;
      console.log('Upload URL received, video ID:', video_id);

      // 2. Upload video
      console.log('Uploading video file...');
      const uploadResponse = await fetch(upload_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'video/mp4',
        },
        body: videoData.video_file,
      });

      console.log('Upload response status:', uploadResponse.status);
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        console.error('Upload error response:', uploadError);
        throw new Error(`Failed to upload video: ${uploadError}`);
      }

      // 3. Publish video
      console.log('Publishing video...');
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

      const publishData = await publishResponse.json();
      console.log('Publish response status:', publishResponse.status);
      
      if (!publishResponse.ok) {
        console.error('Publish error response:', publishData);
        throw new Error(`Failed to publish video: ${publishData.error?.message || publishData.message || 'Unknown error'}`);
      }

      console.log('Video uploaded and published successfully');
      return {
        ...publishData,
        video_id,
        status: 'success'
      };
    } catch (error) {
      console.error('TikTok video upload error:', error);
      throw error;
    }
  }
} 