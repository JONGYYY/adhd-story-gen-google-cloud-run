import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/social-media/oauth';
import { saveSocialMediaCredentials } from '@/lib/social-media/schema';
import { SocialPlatform } from '@/lib/social-media/types';
import { auth } from '@/lib/firebase';

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform as SocialPlatform;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!code) {
      return new Response(JSON.stringify({ error: 'No authorization code provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle OAuth callback and get credentials
    const credentials = await handleOAuthCallback(platform, code);

    // Save credentials to database
    await saveSocialMediaCredentials(currentUser.uid, credentials);

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/settings/social-media?platform=${platform}&status=success`
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process OAuth callback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 