'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export default function RedditBotCreate() {
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('');
  const [customSubreddit, setCustomSubreddit] = useState<string>('');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<string>('adam');
  const [selectedBackground, setSelectedBackground] = useState<string>('minecraft');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const popularSubreddits = [
    { value: 'r/AITA', label: 'r/AITA - Am I The Asshole' },
    { value: 'r/relationships', label: 'r/relationships - Relationship Stories' },
    { value: 'r/TrueOffMyChest', label: 'r/TrueOffMyChest - Personal Stories' },
    { value: 'r/nosleep', label: 'r/nosleep - Horror Stories' },
    { value: 'r/pettyrevenge', label: 'r/pettyrevenge - Revenge Stories' },
    { value: 'r/MaliciousCompliance', label: 'r/MaliciousCompliance' },
    { value: 'r/test', label: 'r/test - Testing' },
    { value: 'custom', label: 'Custom Subreddit' }
  ];

  const voices = [
    { id: 'adam', name: 'Adam (Male)', description: 'Deep, clear voice' },
    { id: 'rachel', name: 'Rachel (Female)', description: 'Warm, friendly voice' },
    { id: 'domi', name: 'Domi (Male)', description: 'Professional voice' },
    { id: 'bella', name: 'Bella (Female)', description: 'Youthful voice' }
  ];

  const backgrounds = [
    { id: 'minecraft', name: 'Minecraft Gameplay', description: 'Popular gaming background' },
    { id: 'subway_surfers', name: 'Subway Surfers', description: 'Mobile game footage' },
    { id: 'satisfying', name: 'Satisfying Videos', description: 'Relaxing content' }
  ];

  const handleGenerate = async () => {
    if (!storyTitle.trim() || !storyContent.trim()) {
      setError('Please provide both title and story content');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      const subreddit = selectedSubreddit === 'custom' ? customSubreddit : selectedSubreddit;
      
      const response = await fetch('/api/generate-reddit-bot-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subreddit: subreddit || 'r/test',
          title: storyTitle,
          story: storyContent,
          voice: selectedVoice,
          background: selectedBackground
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Poll for progress
        const videoId = data.videoId;
        const pollProgress = async () => {
          try {
            const statusResponse = await fetch(`/api/video-status/${videoId}`);
            const statusData = await statusResponse.json();
            
            setProgress(statusData.progress || 0);
            
            if (statusData.status === 'completed' || statusData.status === 'ready') {
              setVideoUrl(statusData.videoUrl);
              setIsGenerating(false);
              setProgress(100);
            } else if (statusData.status === 'failed') {
              throw new Error(statusData.error || 'Video generation failed');
            } else {
              setTimeout(pollProgress, 2000);
            }
          } catch (error) {
            console.error('Error polling progress:', error);
            setError('Failed to check video status');
            setIsGenerating(false);
          }
        };
        
        setTimeout(pollProgress, 1000);
      } else {
        throw new Error(data.error || 'Failed to start video generation');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate video');
      setIsGenerating(false);
    }
  };

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-3xl font-bold text-white">Reddit Bot Video Generator</h1>
            <Badge variant="secondary">FullyAutomatedRedditVideoMakerBot Style</Badge>
          </div>
          <p className="text-gray-400 text-lg">
            Create professional Reddit story videos using the efficient FullyAutomatedRedditVideoMakerBot approach.
            This generator uses optimized Python scripts and FFmpeg for fast, high-quality video creation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subreddit Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Subreddit Settings</CardTitle>
                <CardDescription>Choose the subreddit style for your video</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subreddit">Subreddit</Label>
                  <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subreddit style" />
                    </SelectTrigger>
                    <SelectContent>
                      {popularSubreddits.map((sub) => (
                        <SelectItem key={sub.value} value={sub.value}>
                          {sub.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSubreddit === 'custom' && (
                  <div>
                    <Label htmlFor="custom-subreddit">Custom Subreddit</Label>
                    <Input
                      id="custom-subreddit"
                      placeholder="e.g., r/AskReddit"
                      value={customSubreddit}
                      onChange={(e) => setCustomSubreddit(e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Story Content */}
            <Card>
              <CardHeader>
                <CardTitle>Story Content</CardTitle>
                <CardDescription>Enter your Reddit story content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Story Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter a compelling title for your story"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="story">Story Content</Label>
                  <Textarea
                    id="story"
                    placeholder="Enter your story content here. Use [BREAK] to create cliffhangers..."
                    value={storyContent}
                    onChange={(e) => setStoryContent(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Tip: Use [BREAK] to create natural pauses or cliffhangers in your story
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Voice & Background */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Selection</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div>
                            <div className="font-medium">{voice.name}</div>
                            <div className="text-sm text-gray-500">{voice.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Background Video</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedBackground} onValueChange={setSelectedBackground}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {backgrounds.map((bg) => (
                        <SelectItem key={bg.id} value={bg.id}>
                          <div>
                            <div className="font-medium">{bg.name}</div>
                            <div className="text-sm text-gray-500">{bg.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Generation Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Video</CardTitle>
                <CardDescription>Create your Reddit story video</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !storyTitle.trim() || !storyContent.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? 'Generating...' : 'Generate Video'}
                </Button>

                {isGenerating && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-gray-500">
                      Using FullyAutomatedRedditVideoMakerBot approach for efficient generation...
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {videoUrl && (
                  <div className="space-y-3">
                    <div className="p-3 bg-green-900/20 border border-green-500 rounded text-green-400 text-sm">
                      ✅ Video generated successfully!
                    </div>
                    <Button asChild className="w-full">
                      <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                        View Video
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-gray-300">
                  <li>✅ Efficient Python-based generation</li>
                  <li>✅ Optimized FFmpeg processing</li>
                  <li>✅ Professional Reddit banners</li>
                  <li>✅ Dynamic caption timing</li>
                  <li>✅ Multiple voice options</li>
                  <li>✅ Gaming background videos</li>
                  <li>✅ Fast processing times</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 