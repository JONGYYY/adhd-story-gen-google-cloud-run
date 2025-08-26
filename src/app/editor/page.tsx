'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';

export default function Editor() {
  const [activeTab, setActiveTab] = useState('story');
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);

  const backgrounds = [
    {
      id: 'minecraft',
      name: 'Minecraft',
      thumbnail: '/banners/redditbannertop.png',
      category: 'Gaming',
    },
    {
      id: 'subway',
      name: 'Subway Surfers',
      thumbnail: '/banners/redditbannerbottom.png',
      category: 'Gaming',
    },
    {
      id: 'cooking',
      name: 'Cooking',
      thumbnail: '/globe.svg',
      category: 'Lifestyle',
    },
    {
      id: 'parkour',
      name: 'Parkour',
      thumbnail: '/file.svg',
      category: 'Sports',
    },
  ];

  const voices = [
    {
      id: 'casual_male',
      name: 'Casual Male',
      preview: '/voices/casual_male.mp3',
      description: 'Natural, conversational male voice',
    },
    {
      id: 'casual_female',
      name: 'Casual Female',
      preview: '/voices/casual_female.mp3',
      description: 'Natural, conversational female voice',
    },
    {
      id: 'dramatic',
      name: 'Dramatic',
      preview: '/voices/dramatic.mp3',
      description: 'Intense, emotional storytelling voice',
    },
    {
      id: 'robotic',
      name: 'AI Robot',
      preview: '/voices/robotic.mp3',
      description: 'Synthetic, futuristic AI voice',
    },
  ];

  return (
    <div className="h-screen flex">
      {/* Left Sidebar - Story & Settings */}
      <div className="w-80 border-r border-dark-700 bg-dark-900 p-4 overflow-y-auto">
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex rounded-lg bg-dark-800 p-1">
            <button
              onClick={() => setActiveTab('story')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'story'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Story
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'settings'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Settings
            </button>
          </div>

          {/* Story Tab Content */}
          {activeTab === 'story' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Story Text
                </label>
                <textarea
                  rows={10}
                  className="input w-full"
                  placeholder="Enter your story text..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Text Style
                </label>
                <select className="input w-full">
                  <option>Default</option>
                  <option>Casual</option>
                  <option>Dramatic</option>
                  <option>Humorous</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Font Style
                </label>
                <select className="input w-full">
                  <option>Sans Serif</option>
                  <option>Serif</option>
                  <option>Monospace</option>
                  <option>Handwritten</option>
                </select>
              </div>
            </div>
          )}

          {/* Settings Tab Content */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Background Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Background
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBackground(bg.id)}
                      className={`relative aspect-video rounded-lg overflow-hidden group ${
                        selectedBackground === bg.id
                          ? 'ring-2 ring-primary'
                          : 'hover:ring-2 hover:ring-primary/50'
                      }`}
                    >
                      <img
                        src={bg.thumbnail}
                        alt={bg.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-medium text-white">
                          {bg.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Voice
                </label>
                <div className="space-y-2">
                  {voices.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedVoice === voice.id
                          ? 'bg-primary/20 text-primary-400'
                          : 'hover:bg-dark-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{voice.name}</h3>
                          <p className="text-sm text-gray-400">
                            {voice.description}
                          </p>
                        </div>
                        <div className="text-primary-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Preview */}
      <div className="flex-1 bg-dark-950 p-8">
        <div className="max-w-lg mx-auto">
          {/* Preview Window */}
          <div className="aspect-[9/16] bg-dark-800 rounded-lg overflow-hidden">
            {/* Video preview will go here */}
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Video Preview
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button className="btn-secondary">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                </svg>
                Preview
              </button>
              <button className="text-gray-400 hover:text-white">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-400 hover:text-white">
                Save as Draft
              </button>
              <button className="btn-primary">Generate Video</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 