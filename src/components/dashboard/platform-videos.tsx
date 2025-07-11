import { SocialPlatform } from '@/lib/social-media/types';
import { getSocialMediaCredentials } from '@/lib/social-media/schema';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';

interface PlatformVideo {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  url: string;
  date: string;
}

interface PlatformVideosProps {
  platform: SocialPlatform;
}

export function PlatformVideos({ platform }: PlatformVideosProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState<PlatformVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPlatformData() {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Check if platform is connected
        const credentials = await getSocialMediaCredentials(currentUser.uid, platform);
        setIsConnected(!!credentials);
        if (credentials) {
          setUsername(credentials.username);
          // Here you would fetch videos from the platform's API
          // For now using placeholder data
          setVideos([
            {
              id: '1',
              title: 'Sample Video 1',
              thumbnail: '/thumbnails/video1.jpg',
              views: 1000,
              likes: 100,
              url: '#',
              date: new Date().toISOString(),
            },
            // Add more sample videos
          ]);
        }
      } catch (error) {
        console.error(`Error loading ${platform} data:`, error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPlatformData();
  }, [platform]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-700 rounded"></div>
            <div className="h-48 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center py-8">
          <h3 className="text-xl font-semibold text-white capitalize mb-4">
            {platform} Not Connected
          </h3>
          <p className="text-gray-400 mb-6">
            Connect your {platform} account to see your videos and analytics.
          </p>
          <Link
            href="/settings/social-media"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Connect {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white capitalize">
            {platform} Videos
          </h3>
          <p className="text-sm text-gray-400">Connected as @{username}</p>
        </div>
        <Link
          href={`/analytics/${platform}`}
          className="text-sm text-primary hover:text-primary/90"
        >
          View Analytics →
        </Link>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="group relative">
              <div className="aspect-video rounded-lg bg-gray-700 overflow-hidden">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-medium text-white line-clamp-2">
                  {video.title}
                </h4>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-400">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                      }).format(video.views)}{' '}
                      views
                    </span>
                    <span className="text-gray-400">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                      }).format(video.likes)}{' '}
                      likes
                    </span>
                  </div>
                  <span className="text-gray-400">
                    {new Date(video.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 