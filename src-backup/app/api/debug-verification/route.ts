import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const verificationCode = '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
  const baseUrl = 'https://adhd-story-gen.vercel.app';
  
  // Test all verification URLs
  const verificationUrls = [
    `${baseUrl}/tiktok-developers-site-verification.txt`,
    `${baseUrl}/api/tiktok-developers-site-verification`,
    `${baseUrl}/tiktok-developers-site-verification.html`,
    `${baseUrl}/${verificationCode}.txt`,
    `${baseUrl}/.well-known/tiktok-verification.txt`,
    `${baseUrl}/api/.well-known/tiktok-verification`,
    `${baseUrl}/api/tiktok-verify`,
    `${baseUrl}/tiktok-verification`
  ];
  
  // Test each URL
  const results = [];
  for (const url of verificationUrls) {
    try {
      const response = await fetch(url);
      const content = await response.text();
      results.push({
        url,
        status: response.status,
        content: content.trim().substring(0, 100),
        working: response.status === 200 && content.includes(verificationCode)
      });
    } catch (error) {
      results.push({
        url,
        status: 'ERROR',
        content: error instanceof Error ? error.message : 'Unknown error',
        working: false
      });
    }
  }
  
  return NextResponse.json({
    success: true,
    verificationCode,
    message: 'TikTok Verification Debug Results',
    results,
    instructions: [
      'Try each working URL in the TikTok Developer Console',
      'Use the URL that returns status 200 and contains the verification code',
      'If none work, try DNS verification instead'
    ],
    dnsVerification: {
      type: 'TXT',
      name: '@',
      value: `tiktok-developers-site-verification=${verificationCode}`
    }
  });
} 