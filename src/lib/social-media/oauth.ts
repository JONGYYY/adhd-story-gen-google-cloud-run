import { SocialPlatform, SocialMediaCredentials } from './types';

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
  scope: ['video.upload', 'video.list', 'user.info.basic'].join(',')
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
      return `https://www.tiktok.com/auth/authorize/` +
        `?client_key=${TIKTOK_OAUTH_CONFIG.clientKey}&` +
        `redirect_uri=${encodeURIComponent(TIKTOK_OAUTH_CONFIG.redirectUri)}&` +
        `scope=${encodeURIComponent(TIKTOK_OAUTH_CONFIG.scope)}&` +
        `response_type=code`;
    
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
  // Exchange code for tokens
  const tokenResponse = await fetch('https://open-api.tiktok.com/oauth/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_key: TIKTOK_OAUTH_CONFIG.clientKey,
      client_secret: TIKTOK_OAUTH_CONFIG.clientSecret,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch('https://open-api.tiktok.com/user/info/', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  const userData = await userResponse.json();

  return {
    platform: 'tiktok',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000),
    userId: userData.user.id,
    username: userData.user.username,
    profileId: userData.user.open_id
  };
} 