'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export default function BatchCreate() {
  const [selectedSources, setSelectedSources] = useState<Set<'ai' | 'reddit'>>(new Set());
  const [selectedSubreddits, setSelectedSubreddits] = useState<Set<string>>(new Set());
  const [selectedBackgrounds, setSelectedBackgrounds] = useState<Set<string>>(new Set());
  const [selectedVoices, setSelectedVoices] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'manual' | 'autopilot'>('manual');
  const [numVideos, setNumVideos] = useState(5);

  const subreddits = [
    { name: 'r/AITA', description: 'Am I The Asshole - Moral dilemmas and conflicts' },
    { name: 'r/TrueOffMyChest', description: 'Personal confessions and experiences' },
    { name: 'r/relationships', description: 'Relationship advice and stories' },
    { name: 'r/confession', description: 'Anonymous confessions' },
    { name: 'r/nosleep', description: 'Horror stories and supernatural experiences' },
    { name: 'r/ShortScaryStories', description: 'Brief horror tales' },
    { name: 'r/TalesFromYourServer', description: 'Restaurant service stories' },
    { name: 'r/TalesFromTechSupport', description: 'IT and tech support stories' },
    { name: 'r/TIFU', description: 'Today I Fucked Up - Personal mistakes' },
    { name: 'r/ProRevenge', description: 'Professional revenge stories' },
  ];

  const backgrounds = [
    {
      id: 'minecraft',
      name: 'Minecraft Parkour',
      thumbnail: '/backgrounds/minecraft.jpg',
      category: 'Gaming',
    },
    {
      id: 'subway',
      name: 'Subway Surfers',
      thumbnail: '/backgrounds/subway.jpg',
      category: 'Gaming',
    },
    {
      id: 'cooking',
      name: 'Cooking',
      thumbnail: '/backgrounds/cooking.jpg',
      category: 'Lifestyle',
    },
    {
      id: 'asmr',
      name: 'ASMR',
      thumbnail: '/backgrounds/asmr.jpg',
      category: 'Relaxation',
    },
    {
      id: 'workers',
      name: 'Workers',
      thumbnail: '/backgrounds/workers.jpg',
      category: 'Lifestyle',
    },
    {
      id: 'random',
      name: 'Random',
      thumbnail: '/backgrounds/random.jpg',
      category: 'Various',
      description: 'Excludes Minecraft & Subway Surfers',
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

  const toggleSource = (source: 'ai' | 'reddit') => {
    const newSources = new Set(selectedSources);
    if (newSources.has(source)) {
      newSources.delete(source);
    } else {
      newSources.add(source);
    }
    setSelectedSources(newSources);
  };

  const toggleSubreddit = (subreddit: string) => {
    const newSubreddits = new Set(selectedSubreddits);
    if (newSubreddits.has(subreddit)) {
      newSubreddits.delete(subreddit);
    } else {
      newSubreddits.add(subreddit);
    }
    setSelectedSubreddits(newSubreddits);
  };

  const toggleBackground = (background: string) => {
    const newBackgrounds = new Set(selectedBackgrounds);
    if (newBackgrounds.has(background)) {
      newBackgrounds.delete(background);
    } else {
      newBackgrounds.add(background);
    }
    setSelectedBackgrounds(newBackgrounds);
  };

  const toggleVoice = (voice: string) => {
    const newVoices = new Set(selectedVoices);
    if (newVoices.has(voice)) {
      newVoices.delete(voice);
    } else {
      newVoices.add(voice);
    }
    setSelectedVoices(newVoices);
  };

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Batch Create Videos</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Creation Mode */}
          <div>
            <h2 className="text-lg font-medium mb-4 text-white">Creation Mode</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('manual')}
                className={`p-6 rounded-lg border-2 transition-all ${
                  mode === 'manual'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-4">🎯</div>
                <h3 className="text-lg font-medium mb-2 text-white">Manual</h3>
                <p className="text-gray-400 text-sm">
                  Create a specific number of videos at once
                </p>
              </button>

              <button
                onClick={() => setMode('autopilot')}
                className={`p-6 rounded-lg border-2 transition-all ${
                  mode === 'autopilot'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-4">🤖</div>
                <h3 className="text-lg font-medium mb-2 text-white">Autopilot</h3>
                <p className="text-gray-400 text-sm">
                  Automatically create 1-3 videos per day
                </p>
              </button>
            </div>
          </div>

          {/* Number of Videos (only for manual mode) */}
          {mode === 'manual' && (
            <div>
              <h2 className="text-lg font-medium mb-4 text-white">Number of Videos to Generate</h2>
              <input
                type="range"
                min="1"
                max="20"
                value={numVideos}
                onChange={(e) => setNumVideos(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-400 mt-2">
                <span>1</span>
                <span>{numVideos} videos</span>
                <span>20</span>
              </div>
            </div>
          )}

          {/* Story Sources */}
          <div>
            <h2 className="text-lg font-medium mb-4 text-white">Story Sources</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => toggleSource('ai')}
                className={`p-4 rounded-lg border transition-all ${
                  selectedSources.has('ai')
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">🤖</div>
                <div className="font-medium text-white">AI Generation</div>
              </button>
              <button
                onClick={() => toggleSource('reddit')}
                className={`p-4 rounded-lg border transition-all ${
                  selectedSources.has('reddit')
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">📱</div>
                <div className="font-medium text-white">Reddit Stories</div>
              </button>
            </div>
          </div>

          {/* Subreddits (for both AI and Reddit) */}
          {(selectedSources.has('reddit') || selectedSources.has('ai')) && (
            <div>
              <h2 className="text-lg font-medium mb-4 text-white">Select Subreddits</h2>
              <div className="grid grid-cols-2 gap-4">
                {subreddits.map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => toggleSubreddit(sub.name)}
                    className={`p-4 rounded-lg border transition-all ${
                      selectedSubreddits.has(sub.name)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <h3 className="font-medium text-white mb-1">{sub.name}</h3>
                    <p className="text-sm text-gray-400">{sub.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Backgrounds */}
          <div>
            <h2 className="text-lg font-medium mb-4 text-white">Select Backgrounds</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => toggleBackground(bg.id)}
                  className={`relative rounded-lg overflow-hidden aspect-video ${
                    selectedBackgrounds.has(bg.id)
                      ? 'ring-2 ring-primary'
                      : 'hover:ring-2 hover:ring-gray-500'
                  }`}
                >
                  <img
                    src={bg.thumbnail}
                    alt={bg.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-2">
                    <span className="text-sm font-medium text-white">{bg.name}</span>
                    <span className="text-xs text-gray-400">{bg.category}</span>
                    {bg.description && (
                      <span className="text-xs text-gray-400 mt-1">{bg.description}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Voices */}
          <div>
            <h2 className="text-lg font-medium mb-4 text-white">Select Voices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className={`p-4 rounded-lg border transition-all ${
                    selectedVoices.has(voice.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white">{voice.name}</h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle preview
                      }}
                      className="text-primary hover:text-primary/80"
                    >
                      ▶️ Preview
                    </button>
                  </div>
                  <p className="text-sm text-gray-400">{voice.description}</p>
                  <button
                    onClick={() => toggleVoice(voice.id)}
                    className="mt-2 w-full py-1 px-3 rounded text-sm font-medium transition-colors text-center
                      ${selectedVoices.has(voice.id)
                        ? 'bg-primary/20 text-primary'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }"
                  >
                    {selectedVoices.has(voice.id) ? 'Selected' : 'Select Voice'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div>
            <h2 className="text-lg font-medium mb-4 text-white">Additional Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Caption Style
                </label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
                  <option>Modern</option>
                  <option>Classic</option>
                  <option>Minimal</option>
                  <option>Bold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Video Length
                </label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
                  <option>1 min+ (Cliffhanger)</option>
                  <option>Full Story Length</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Playback Speed
                </label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
                  <option>1.0x (Normal)</option>
                  <option>1.1x</option>
                  <option>1.2x</option>
                  <option>1.3x</option>
                  <option>1.4x</option>
                  <option>1.5x</option>
                  <option>1.6x</option>
                  <option>1.7x</option>
                  <option>1.8x</option>
                  <option>1.9x</option>
                  <option>2.0x</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button className="w-full py-6 text-lg">
            {mode === 'autopilot' 
              ? 'Start Autopilot (1-3 videos per day)'
              : `Generate ${numVideos} Videos`}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
} 