export type SocialPlatform = 'youtube' | 'tiktok';

export interface SocialMediaCredentials {
  platform: SocialPlatform;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userId: string;
  username: string;
  profileId?: string; // Channel ID for YouTube, etc.
}

export interface PostVideoParams {
  platform: SocialPlatform;
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
}

export interface PostVideoResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
} 