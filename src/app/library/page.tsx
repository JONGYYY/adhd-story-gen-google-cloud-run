'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { SocialPlatform } from '@/lib/social-media/types';
import { getSocialMediaCredentials } from '@/lib/social-media/schema';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface PlatformStatus {
  platform: SocialPlatform;
  isConnected: boolean;
  username: string;
}

export default function Library() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'all'>('all');
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const platforms: SocialPlatform[] = ['youtube', 'tiktok', 'instagram'];

  useEffect(() => {
    async function loadPlatformStatuses() {
      if (!user) return;

      const statuses = await Promise.all(
        platforms.map(async (platform) => {
          const creds = await getSocialMediaCredentials(user.uid, platform);
          return {
            platform,
            isConnected: !!creds,
            username: creds?.username || ''
          };
        })
      );

      setPlatformStatuses(statuses);
      setIsLoading(false);
    }

    loadPlatformStatuses();
  }, [user]);

  const content = [
    {
      id: 1,
      title: 'AITA for not attending my sister\'s wedding?',
      thumbnail: '/thumbnails/video1.jpg',
      views: 125000,
      likes: 12500,
      platform: 'tiktok' as SocialPlatform,
      status: 'published',
      date: '2024-03-15',
    },
    {
      id: 2,
      title: 'The Mysterious Package That Arrived at 3 AM',
      thumbnail: '/thumbnails/video2.jpg',
      views: 75000,
      likes: 8200,
      platform: 'youtube' as SocialPlatform,
      status: 'published',
      date: '2024-03-16',
    },
    {
      id: 3,
      title: 'My Roommate\'s Strange Behavior',
      thumbnail: '/thumbnails/video3.jpg',
      views: 250000,
      likes: 28000,
      platform: 'instagram' as SocialPlatform,
      status: 'published',
      date: '2024-03-14',
    },
  ];

  const filteredContent = content.filter(
    (item) => selectedPlatform === 'all' || item.platform === selectedPlatform
  );

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Content Library</h1>
            <Button asChild>
              <Link href="/create">Create New Video</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Platform Filters and View Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedPlatform('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedPlatform === 'all'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              All Platforms
            </button>
            {platforms.map((platform) => {
              const status = platformStatuses.find(s => s.platform === platform);
              return (
                <button
                  key={platform}
                  onClick={() => setSelectedPlatform(platform)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedPlatform === platform
                      ? 'bg-primary/20 text-primary'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <span className="capitalize">{platform}</span>
                  {status?.isConnected && (
                    <span className="ml-2 text-xs text-gray-400">
                      (@{status.username})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Platform Connection Status */}
        <div className="mb-8 space-y-4">
          {platformStatuses
            .filter(status => selectedPlatform === 'all' || status.platform === selectedPlatform)
            .map(status => (
              <div
                key={status.platform}
                className={`p-4 rounded-lg ${
                  status.isConnected ? 'bg-green-500/10' : 'bg-yellow-500/10'
                }`}
              >
                {status.isConnected ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium capitalize">
                        {status.platform} Connected
                      </h3>
                      <p className="text-sm text-gray-400">
                        Connected as @{status.username}
                      </p>
                    </div>
                    <Link
                      href="/settings/social-media"
                      className="text-sm text-primary hover:text-primary/90"
                    >
                      Manage Connection →
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium capitalize">
                        {status.platform} Not Connected
                      </h3>
                      <p className="text-sm text-gray-400">
                        Connect your account to see your {status.platform} videos
                      </p>
                    </div>
                    <Link
                      href="/settings/social-media"
                      className="text-sm text-primary hover:text-primary/90"
                    >
                      Connect Account →
                    </Link>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Content Grid/List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading your content...</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredContent.map((item) => (
              <div
                key={item.id}
                className={`bg-gray-800 rounded-lg overflow-hidden ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                <div className={`${viewMode === 'list' ? 'w-48 flex-shrink-0' : ''}`}>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-32 object-cover"
                  />
                </div>
                <div className="p-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.platform === 'youtube' ? 'bg-red-500/20 text-red-400' :
                      item.platform === 'tiktok' ? 'bg-pink-500/20 text-pink-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {item.platform}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.status === 'published' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-white font-medium mb-2 line-clamp-2">{item.title}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span>{item.views.toLocaleString()} views</span>
                      <span>{item.likes.toLocaleString()} likes</span>
                    </div>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
} 