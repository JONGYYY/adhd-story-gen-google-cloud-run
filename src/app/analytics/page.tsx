'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PageContainer } from '@/components/layout/page-container';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Chart options
const chartOptions = {
  responsive: true,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: 'Performance Overview',
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.7)',
      },
    },
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.7)',
      },
    },
  },
};

export default function Analytics() {
  const [dateRange, setDateRange] = useState<'7d' | '3w' | '3m'>('7d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    const now = new Date();
    let start = new Date();
    
    switch (dateRange) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '3w':
        start.setDate(now.getDate() - 21);
        break;
      case '3m':
        start.setMonth(now.getMonth() - 3);
        break;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, [dateRange]);

  useEffect(() => {
    if (startDate && endDate) {
      const data = generateChartData();
      setChartData(data);
    }
  }, [startDate, endDate]);

  // Generate sample data based on date range
  const generateChartData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const labels = Array.from({ length: days }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Views',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 50000 + 10000)),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Likes',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 5000 + 1000)),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  };

  const stats = [
    {
      name: 'Total Views',
      value: '2.4M',
      change: '+21.3%',
      trend: 'up',
      chart: [65, 59, 80, 81, 56, 55, 40],
    },
    {
      name: 'Watch Time',
      value: '82.5%',
      change: '+4.2%',
      trend: 'up',
      chart: [70, 75, 85, 80, 82, 83, 85],
    },
    {
      name: 'Engagement Rate',
      value: '12.3%',
      change: '-2.1%',
      trend: 'down',
      chart: [15, 14, 13, 12, 11, 12, 10],
    },
    {
      name: 'Followers Gained',
      value: '15.2K',
      change: '+8.7%',
      trend: 'up',
      chart: [800, 1200, 1500, 1800, 2000, 2200, 2500],
    },
  ];

  const topVideos = [
    {
      id: 1,
      title: 'The Wedding Dress Disaster',
      views: 524000,
      likes: 52400,
      comments: 1200,
      shares: 3500,
      platform: 'tiktok',
      thumbnail: '/thumbnails/video1.jpg',
    },
    {
      id: 2,
      title: 'My Neighbor\'s Secret Garden',
      views: 428000,
      likes: 42800,
      comments: 980,
      shares: 2800,
      platform: 'youtube',
      thumbnail: '/thumbnails/video2.jpg',
    },
    {
      id: 3,
      title: 'The Mysterious Package',
      views: 315000,
      likes: 31500,
      comments: 750,
      shares: 2100,
      platform: 'instagram',
      thumbnail: '/thumbnails/video3.jpg',
    },
  ];

  const insights = [
    {
      icon: '📈',
      title: 'Peak Performance Time',
      description: 'Your content performs best when posted between 7-9 PM EST. Consider scheduling future posts during this window.'
    },
    {
      icon: '🎯',
      title: 'Content Theme Success',
      description: 'Mystery and suspense stories are generating 2x more engagement than other categories.'
    },
    {
      icon: '⚡',
      title: 'Viral Potential',
      description: 'Videos with dramatic reveals in the first 3 seconds have 40% higher completion rates.'
    }
  ];

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-1">
              {['7d', '3w', '3m'].map((period) => (
                <button
                  key={period}
                  onClick={() => setDateRange(period as '7d' | '3w' | '3m')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    dateRange === period
                      ? 'bg-primary text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400">{stat.name}</h3>
                  <p className="text-2xl font-semibold text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    stat.trend === 'up'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <div className="h-12">
                {/* Placeholder for mini chart */}
                <div className="w-full h-full bg-gray-800/50 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Performance Graph */}
          <div className="lg:col-span-2 space-y-8">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Performance</h2>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowCustomRange(!showCustomRange)}
                      className="px-4 py-2 bg-gray-800 rounded-lg text-sm font-medium flex items-center"
                    >
                      {startDate} - {endDate}
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showCustomRange && (
                      <div className="absolute top-full mt-2 w-64 bg-gray-800 rounded-lg shadow-lg p-4 z-10">
                        <div className="space-y-2 mb-4">
                          <button
                            onClick={() => {
                              setDateRange('7d');
                              setShowCustomRange(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg ${
                              dateRange === '7d' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-700'
                            }`}
                          >
                            Last 7 Days
                          </button>
                          <button
                            onClick={() => {
                              setDateRange('3w');
                              setShowCustomRange(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg ${
                              dateRange === '3w' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-700'
                            }`}
                          >
                            Last 3 Weeks
                          </button>
                          <button
                            onClick={() => {
                              setDateRange('3m');
                              setShowCustomRange(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg ${
                              dateRange === '3m' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-700'
                            }`}
                          >
                            Last 3 Months
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-sm font-medium mb-1">Start Date</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full bg-gray-700 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">End Date</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full bg-gray-700 rounded-lg px-3 py-2"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="h-[400px]">
                {chartData && <Line options={chartOptions} data={chartData} />}
              </div>
            </div>

            {/* Top Performing Content */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Top Performing Videos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {topVideos.map((video) => (
                  <div key={video.id} className="group">
                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-800/50">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="mt-4">
                      <h3 className="font-medium text-white line-clamp-1">
                        {video.title}
                      </h3>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Views</p>
                          <p className="text-white font-medium">
                            {new Intl.NumberFormat('en-US', {
                              notation: 'compact',
                            }).format(video.views)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Engagement</p>
                          <p className="text-white font-medium">
                            {((video.likes + video.comments + video.shares) /
                              video.views *
                              100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights & Recommendations */}
          <div className="space-y-8">
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Key Insights</h2>
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{insight.icon}</span>
                      <span className="font-medium">{insight.title}</span>
                    </div>
                    <p className="text-sm text-gray-400">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Audience Demographics</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Age 18-24</span>
                    <span>45%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full">
                    <div className="h-2 w-[45%] bg-primary rounded-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Age 25-34</span>
                    <span>30%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full">
                    <div className="h-2 w-[30%] bg-primary rounded-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Age 35-44</span>
                    <span>15%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full">
                    <div className="h-2 w-[15%] bg-primary rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 