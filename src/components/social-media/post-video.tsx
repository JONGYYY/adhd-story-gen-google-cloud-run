import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SocialPlatform } from '@/lib/social-media/types';

interface PostVideoProps {
  videoId: string;
  videoUrl: string;
  title: string;
  description?: string;
}

export function PostVideo({ videoId, videoUrl, title, description }: PostVideoProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const platforms: { id: SocialPlatform; label: string }[] = [
    { id: 'youtube', label: 'YouTube' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'instagram', label: 'Instagram' }
  ];

  const handlePlatformToggle = (platform: SocialPlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePost = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    setIsPosting(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert video URL to File object
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const file = new File([blob], `video_${videoId}.mp4`, { type: 'video/mp4' });

      // Post to each selected platform
      for (const platform of selectedPlatforms) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('platform', platform);
        formData.append('title', title);
        if (description) {
          formData.append('description', description);
        }

        const postResponse = await fetch('/api/social-media/post', {
          method: 'POST',
          body: formData
        });

        if (!postResponse.ok) {
          throw new Error(`Failed to post to ${platform}`);
        }
      }

      setSuccess('Successfully posted to selected platforms!');
    } catch (error) {
      console.error('Failed to post video:', error);
      setError(error instanceof Error ? error.message : 'Failed to post video');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Share on Social Media</h3>
      
      <div className="flex flex-wrap gap-3 mb-4">
        {platforms.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handlePlatformToggle(id)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedPlatforms.includes(id)
                ? 'bg-primary text-black'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="text-green-400 mb-4">
          {success}
        </div>
      )}

      <Button
        onClick={handlePost}
        disabled={isPosting || selectedPlatforms.length === 0}
        className="w-full"
      >
        {isPosting ? 'Posting...' : 'Post to Selected Platforms'}
      </Button>
    </div>
  );
} 