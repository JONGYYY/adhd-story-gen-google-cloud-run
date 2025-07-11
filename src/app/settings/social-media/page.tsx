'use client';

import { getOAuthUrl } from '@/lib/social-media/oauth';
import { getSocialMediaCredentials } from '@/lib/social-media/schema';
import { SocialPlatform } from '@/lib/social-media/types';
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';

interface ConnectedPlatform {
  platform: SocialPlatform;
  username: string;
  connected: boolean;
}

export default function SocialMediaSettings() {
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([
    { platform: 'youtube', username: '', connected: false },
    { platform: 'tiktok', username: '', connected: false },
    { platform: 'instagram', username: '', connected: false }
  ]);

  useEffect(() => {
    // Load connected platforms
    async function loadPlatforms() {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const updatedPlatforms = await Promise.all(
        platforms.map(async (p) => {
          const creds = await getSocialMediaCredentials(currentUser.uid, p.platform);
          return {
            ...p,
            username: creds?.username || '',
            connected: !!creds
          };
        })
      );

      setPlatforms(updatedPlatforms);
    }

    loadPlatforms();
  }, []);

  const handleConnect = (platform: SocialPlatform) => {
    const url = getOAuthUrl(platform);
    window.location.href = url;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-white">Social Media Connections</h1>
      
      <div className="grid gap-6">
        {platforms.map((platform) => (
          <div 
            key={platform.platform}
            className="bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between border border-gray-700"
          >
            <div>
              <h2 className="text-xl font-semibold capitalize text-white">{platform.platform}</h2>
              {platform.connected && (
                <p className="text-gray-400">Connected as @{platform.username}</p>
              )}
            </div>
            
            <button
              onClick={() => handleConnect(platform.platform)}
              className={`px-4 py-2 rounded-lg ${
                platform.connected
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-primary text-black font-medium hover:bg-primary/90'
              }`}
            >
              {platform.connected ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="font-semibold mb-2 text-white">Note:</h3>
        <p className="text-gray-400">
          Connecting your social media accounts allows us to automatically post your
          generated videos to your channels. You can disconnect or reconnect accounts
          at any time.
        </p>
      </div>
    </div>
  );
} 