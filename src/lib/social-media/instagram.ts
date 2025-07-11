const INSTAGRAM_OAUTH_CONFIG = {
  appId: process.env.INSTAGRAM_APP_ID!,
  appSecret: process.env.INSTAGRAM_APP_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
  scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights']
};

export class InstagramAPI {
  constructor() {}

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: INSTAGRAM_OAUTH_CONFIG.appId,
      redirect_uri: INSTAGRAM_OAUTH_CONFIG.redirectUri,
      scope: INSTAGRAM_OAUTH_CONFIG.scopes.join(','),
      response_type: 'code',
    });

    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async getAccessToken(code: string) {
    try {
      const response = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: INSTAGRAM_OAUTH_CONFIG.appId,
          client_secret: INSTAGRAM_OAUTH_CONFIG.appSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: INSTAGRAM_OAUTH_CONFIG.redirectUri,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram OAuth error: ${error.message || 'Failed to get access token'}`);
      }

      const shortLivedToken = await response.json();

      // Exchange for long-lived token
      const longLivedTokenResponse = await fetch(
        `https://graph.instagram.com/access_token?` +
        `grant_type=ig_exchange_token&` +
        `client_secret=${INSTAGRAM_OAUTH_CONFIG.appSecret}&` +
        `access_token=${shortLivedToken.access_token}`
      );

      if (!longLivedTokenResponse.ok) {
        throw new Error('Failed to get long-lived token');
      }

      return longLivedTokenResponse.json();
    } catch (error) {
      console.error('Instagram OAuth error:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken: string) {
    try {
      const response = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.message || 'Failed to get user info'}`);
      }

      return response.json();
    } catch (error) {
      console.error('Instagram API error:', error);
      throw error;
    }
  }

  async uploadVideo(accessToken: string, videoData: {
    title: string;
    description: string;
    videoUrl: string; // Must be a publicly accessible URL
    coverUrl: string; // Must be a publicly accessible URL
  }) {
    try {
      // 1. Create container
      const containerResponse = await fetch(
        `https://graph.instagram.com/me/media?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_type: 'REELS',
            video_url: videoData.videoUrl,
            caption: `${videoData.title}\n\n${videoData.description}`,
            cover_url: videoData.coverUrl,
            share_to_feed: 'true',
          }),
        }
      );

      if (!containerResponse.ok) {
        const error = await containerResponse.json();
        throw new Error(`Failed to create media container: ${error.message}`);
      }

      const { id: containerID } = await containerResponse.json();

      // 2. Poll for status
      let status;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const statusResponse = await fetch(
          `https://graph.instagram.com/${containerID}?fields=status_code,status&access_token=${accessToken}`
        );

        if (!statusResponse.ok) {
          throw new Error('Failed to check media status');
        }

        status = await statusResponse.json();

        if (status.status_code === 'FINISHED') {
          break;
        } else if (status.status_code === 'ERROR') {
          throw new Error(`Upload failed: ${status.status}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Upload timed out');
      }

      return { id: containerID, status: status.status_code };
    } catch (error) {
      console.error('Instagram video upload error:', error);
      throw error;
    }
  }
} 