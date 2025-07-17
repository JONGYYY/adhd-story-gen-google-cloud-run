import { SocialPlatform, SocialMediaCredentials } from './types';
import { generateRandomString } from '@/lib/utils';

const YOUTUBE_OAUTH_CONFIG = {
  clientId: process.env.YOUTUBE_CLIENT_ID!,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
  scope: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
  ].join(' ')
};

const TIKTOK_OAUTH_CONFIG = {
  clientKey: process.env.TIKTOK_CLIENT_KEY!,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
  scope: ['user.info.basic', 'user.info.profile'].join(',')
};

export function getOAuthUrl(platform: SocialPlatform): string {
  switch (platform) {
    case 'youtube':
      return `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${YOUTUBE_OAUTH_CONFIG.clientId}&` +
        `redirect_uri=${encodeURIComponent(YOUTUBE_OAUTH_CONFIG.redirectUri)}&` +
        `scope=${encodeURIComponent(YOUTUBE_OAUTH_CONFIG.scope)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent`;
    
    case 'tiktok':
      const csrfState = generateRandomString(32);
      const params = new URLSearchParams({
        client_key: TIKTOK_OAUTH_CONFIG.clientKey,
        redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
        scope: TIKTOK_OAUTH_CONFIG.scope,
        response_type: 'code',
        state: csrfState
      });

      // Add sandbox mode parameters
      params.append('app_id', TIKTOK_OAUTH_CONFIG.clientKey);
      params.append('app_source_domain', new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname);

      // Log the generated URL for debugging
      const url = `https://www.tiktok.com/auth/authorize?${params.toString()}`;
      console.log('Generated TikTok OAuth URL:', url);
      return url;
    
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function handleOAuthCallback(
  platform: SocialPlatform,
  code: string
): Promise<SocialMediaCredentials> {
  switch (platform) {
    case 'youtube':
      return handleYouTubeCallback(code);
    case 'tiktok':
      return handleTikTokCallback(code);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function handleYouTubeCallback(code: string): Promise<SocialMediaCredentials> {
  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: YOUTUBE_OAUTH_CONFIG.clientId,
      client_secret: YOUTUBE_OAUTH_CONFIG.clientSecret,
      redirect_uri: YOUTUBE_OAUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  const userData = await userResponse.json();
  const channel = userData.items[0];

  return {
    platform: 'youtube',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000),
    userId: channel.id,
    username: channel.snippet.title,
    profileId: channel.id
  };
}

async function handleTikTokCallback(code: string): Promise<SocialMediaCredentials> {
  console.log('Handling TikTok OAuth callback...');
  try {
    // Exchange code for tokens
    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
    console.log('Token endpoint:', tokenUrl);

    const params = new URLSearchParams({
      code,
      client_key: TIKTOK_OAUTH_CONFIG.clientKey,
      client_secret: TIKTOK_OAUTH_CONFIG.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri,
    });

    console.log('Token request params:', {
      client_key: `${TIKTOK_OAUTH_CONFIG.clientKey.substring(0, 8)}...`,
      client_secret: 'HIDDEN',
      code: `${code.substring(0, 8)}...`,
      redirect_uri: TIKTOK_OAUTH_CONFIG.redirectUri
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: params.toString()
    });

    const tokens = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Token error response:', tokens);
      throw new Error(`TikTok OAuth error: ${tokens.error?.message || tokens.message || 'Failed to get access token'}`);
    }

    if (!tokens.access_token) {
      console.error('No access token in response:', tokens);
      throw new Error('No access token received from TikTok');
    }

    console.log('Successfully obtained access token');

    // Get user info
    const userUrl = 'https://open.tiktokapis.com/v2/user/info/';
    console.log('User info endpoint:', userUrl);

    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    const userData = await userResponse.json();
    console.log('User info response status:', userResponse.status);

    if (!userResponse.ok) {
      console.error('User info error response:', userData);
      throw new Error(`TikTok API error: ${userData.error?.message || userData.message || 'Failed to get user info'}`);
    }

    if (!userData.data?.user) {
      console.error('Invalid user info response:', userData);
      throw new Error('Invalid user info response from TikTok');
    }

    console.log('Successfully obtained user info');
    return {
      platform: 'tiktok',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : Date.now() + 3600000,
      userId: userData.data.user.open_id,
      username: userData.data.user.display_name,
      profileId: userData.data.user.open_id
    };
  } catch (error) {
    console.error('Error in TikTok OAuth callback:', error);
    throw error;
  }
}