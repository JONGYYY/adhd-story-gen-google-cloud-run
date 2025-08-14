import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';

const YOUTUBE_OAUTH_CONFIG = {
  clientId: process.env.YOUTUBE_CLIENT_ID!,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
  scopes: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]
};

export class YouTubeAPI {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      YOUTUBE_OAUTH_CONFIG.clientId,
      YOUTUBE_OAUTH_CONFIG.clientSecret,
      YOUTUBE_OAUTH_CONFIG.redirectUri
    );
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: YOUTUBE_OAUTH_CONFIG.scopes,
      prompt: 'consent'
    });
  }

  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async uploadVideo(accessToken: string, videoData: {
    title: string;
    description: string;
    filePath: string;
    privacyStatus?: 'private' | 'unlisted' | 'public';
  }) {
    try {
      // Set the credentials on the OAuth2 client
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      // Create YouTube client with the authenticated OAuth2 client
      const youtube = google.youtube('v3');

      const fileSize = fs.statSync(videoData.filePath).size;

      const res = await youtube.videos.insert({
        auth: this.oauth2Client,
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: videoData.title,
            description: videoData.description,
          },
          status: {
            privacyStatus: videoData.privacyStatus || 'private'
          }
        },
        media: {
          body: fs.createReadStream(videoData.filePath)
        }
      }, {
        onUploadProgress: (evt) => {
          const progress = (evt.bytesRead / fileSize) * 100;
          console.log(`Upload progress: ${Math.round(progress)}%`);
        }
      });

      return res.data;
    } catch (error) {
      console.error('Error uploading video to YouTube:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken: string) {
    const youtube = google.youtube('v3');
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const res = await youtube.channels.list({
      auth: this.oauth2Client,
      part: ['snippet'],
      mine: true,
    });
    if (!res.data.items || res.data.items.length === 0) {
      throw new Error('No YouTube channel found for this user');
    }
    const channel = res.data.items[0];
    return {
      id: channel.id,
      username: channel.snippet?.title || '',
    };
  }
} 