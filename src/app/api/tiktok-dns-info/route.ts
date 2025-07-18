import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'TikTok DNS Verification Information',
    dnsVerification: {
      type: 'TXT',
      name: '@' || 'adhd-story-gen.vercel.app',
      value: 'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj',
      instructions: [
        '1. Go to Vercel project settings',
        '2. Go to Domains tab',
        '3. Add a TXT record with the above value',
        '4. Wait for DNS propagation (5-10 minutes)',
        '5. Try TikTok verification again'
      ]
    },
    fileVerification: {
      url: 'https://adhd-story-gen.vercel.app/tiktok-developers-site-verification.txt',
      alternativeUrl: 'https://adhd-story-gen.vercel.app/api/tiktok-developers-site-verification',
      content: '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj'
    }
  });
} 