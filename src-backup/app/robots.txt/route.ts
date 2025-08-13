import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const robotsContent = `User-agent: *
Allow: /

# TikTok Verification
# tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj

Sitemap: https://adhd-story-gen.vercel.app/sitemap.xml`;

  return new NextResponse(robotsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
} 