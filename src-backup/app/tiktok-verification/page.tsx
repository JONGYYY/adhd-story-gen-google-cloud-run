import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TikTok Verification',
  other: {
    'tiktok-developers-site-verification': '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj'
  }
};

export default function TikTokVerificationPage() {
  return (
    <div>
      <h1>TikTok Domain Verification</h1>
      <p>Verification code: 5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj</p>
    </div>
  );
} 