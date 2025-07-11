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
    this.oauth2Client = new OAuth2Client(
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
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client
      });

      const fileSize = fs.statSync(videoData.filePath).size;

      const res = await youtube.videos.insert({
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
} 