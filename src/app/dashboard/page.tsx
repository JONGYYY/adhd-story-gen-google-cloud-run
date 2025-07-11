'use client';

import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { PlatformVideos } from '@/components/dashboard/platform-videos';
import { SocialPlatform } from '@/lib/social-media/types';

export default function Dashboard() {
  const stats = [
    { name: 'Total Views', value: '450K', change: '+12.3%', trend: 'up' },
    { name: 'Engagement Rate', value: '8.7%', change: '+2.1%', trend: 'up' },
    { name: 'Videos Created', value: '24', change: '+4', trend: 'up' },
    { name: 'Avg. Watch Time', value: '73%', change: '-1.2%', trend: 'down' },
  ];

  const trendingStories = [
    {
      id: 1,
      title: 'Found a Hidden Room Behind My Closet',
      source: 'r/nosleep • Trending with 15.2K upvotes',
      engagement: '92%'
    },
    {
      id: 2,
      title: "AITA for Exposing My Sister's Wedding Lie?",
      source: 'r/AmITheAsshole • Hot with 8.7K upvotes',
      engagement: '88%'
    },
    {
      id: 3,
      title: "The Package That Wasn't Meant for Me",
      source: 'AI Generated • 92% engagement prediction',
      engagement: '85%'
    },
    {
      id: 4,
      title: "My Roommate's Mysterious Night Job",
      source: 'r/TrueOffMyChest • Rising with 3.2K upvotes',
      engagement: '82%'
    }
  ];

  const platforms: SocialPlatform[] = ['youtube', 'tiktok', 'instagram'];

  return (
    <PageContainer>
      {/* Dashboard Header */}
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <Link
              href="/create"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Create New Video
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">{stat.name}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  stat.trend === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {stat.change}
                  <svg
                    className={`ml-1 h-3 w-3 ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={stat.trend === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                    />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Platform Videos */}
        <div className="space-y-8">
          {platforms.map((platform) => (
            <PlatformVideos key={platform} platform={platform} />
          ))}
        </div>

        {/* Trending Stories */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Trending Stories</h2>
            <Link
              href="/stories"
              className="text-sm text-primary hover:text-primary/90"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trendingStories.map((story) => (
              <div
                key={story.id}
                className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/75 transition-colors"
              >
                <h3 className="text-white font-medium mb-2">{story.title}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{story.source}</span>
                  <span className="text-green-400">{story.engagement} engagement</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 