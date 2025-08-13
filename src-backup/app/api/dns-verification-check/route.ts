import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const domain = 'adhd-story-gen.vercel.app';
    const expectedTxtRecord = 'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
    
    // Test DNS resolution
    let dnsResults = null;
    try {
      // Try to resolve TXT records (this might not work in Vercel edge runtime)
      const dns = await import('dns').catch(() => null);
      if (dns) {
        dnsResults = 'DNS module available - can check TXT records';
      } else {
        dnsResults = 'DNS module not available in edge runtime';
      }
    } catch (error) {
      dnsResults = `DNS check error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return NextResponse.json({
      success: true,
      message: 'DNS Verification Setup Guide',
      domain,
      expectedTxtRecord,
      dnsResults,
      instructions: {
        method1: {
          title: 'Add TXT Record in Vercel',
          steps: [
            '1. Go to https://vercel.com/dashboard',
            '2. Select your adhd-story-gen project',
            '3. Go to Settings → Domains',
            '4. Add TXT record:',
            '   - Type: TXT',
            '   - Name: @ (or leave blank)',
            `   - Value: ${expectedTxtRecord}`,
            '5. Save and wait 5-10 minutes for DNS propagation'
          ]
        },
        method2: {
          title: 'Alternative - Use Meta Tag (if DNS fails)',
          steps: [
            '1. Add meta tag to your site head',
            '2. We can implement this in your Next.js app',
            '3. TikTok will check the meta tag instead of DNS'
          ]
        },
        method3: {
          title: 'Contact Vercel Support',
          steps: [
            '1. If DNS management is not available',
            '2. Contact Vercel support to add the TXT record',
            '3. Or switch to a custom domain'
          ]
        }
      },
      verificationUrls: [
        'https://adhd-story-gen.vercel.app/tiktokhMSPsJuobxNxJR1v7TF8VLrQmTrREC4v.txt',
        'https://adhd-story-gen.vercel.app/tiktok-developers-site-verification.txt',
        'https://adhd-story-gen.vercel.app/5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj.txt'
      ],
      nextSteps: [
        'Try DNS verification first',
        'If DNS fails, we can implement meta tag verification',
        'If all else fails, we can buy a custom domain and set up DNS there'
      ]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 