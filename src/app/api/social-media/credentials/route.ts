import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { SocialPlatform } from '@/lib/social-media/types';

// Prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = decodedClaims.uid;
    const platform = request.nextUrl.searchParams.get('platform') as SocialPlatform;

    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 });
    }

    // Get credentials using server-side function
    const credentials = await getSocialMediaCredentialsServer(userId, platform);

    if (!credentials) {
      return NextResponse.json({ connected: false });
    }

    // Return safe credential data (without sensitive tokens)
    return NextResponse.json({
      connected: true,
      username: credentials.username,
      platform: credentials.platform,
      profileId: credentials.profileId
    });
  } catch (error) {
    console.error('Failed to get social media credentials:', error);
    return NextResponse.json({ error: 'Failed to get credentials' }, { status: 500 });
  }
} 