'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';

type VideoStatus = {
  status: 'generating' | 'ready' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
};

export default function VideoPage() {
  const params = useParams();
  const videoId = params.videoId as string;
  const [videoStatus, setVideoStatus] = useState<VideoStatus>({ status: 'generating' });
  const [videoError, setVideoError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const checkStatusTimeoutRef = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Helper function to determine if the URL is an HTML file
  const isHtmlFile = (url: string) => {
    return url.includes('.html') || url.includes('video_') && url.includes('.html');
  };

  // Helper function to get the audio file URL from an HTML video URL
  const getAudioUrl = (htmlUrl: string) => {
    // Convert video_123.html to audio_123.mp3
    const videoId = htmlUrl.match(/video_([^.]+)\.html/)?.[1];
    return videoId ? `/api/videos/audio_${videoId}.mp3` : null;
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/video-status/${videoId}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch video status');
        }
        const data = await response.json();
        setVideoStatus(data);

        // If still generating, check again in 2 seconds
        if (data.status === 'generating') {
          checkStatusTimeoutRef.current = setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Status check error:', error);
        setVideoStatus({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to check video status',
        });
      }
    };

    checkStatus();

    // Cleanup timeout on unmount
    return () => {
      if (checkStatusTimeoutRef.current) {
        clearTimeout(checkStatusTimeoutRef.current);
      }
    };
  }, [videoId]);

  const handleVideoError = async (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video playback error:', e);
    
    // If we haven't retried too many times, try reloading the video
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      if (videoRef.current) {
        try {
          // Force reload the video source
          videoRef.current.load();
          await videoRef.current.play();
          setVideoError(null);
          return;
        } catch (err) {
          console.error('Retry failed:', err);
        }
      }
    }
    
    setVideoError('Failed to load video. Please try refreshing the page.');
  };

  const handleRetry = () => {
    setVideoError(null);
    setRetryCount(0);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleDownload = async () => {
    if (!videoStatus.videoUrl) return;

    try {
      let downloadUrl = videoStatus.videoUrl;
      let filename = `video_${videoId}.mp4`;

      // If it's an HTML file, download the audio file instead
      if (isHtmlFile(videoStatus.videoUrl)) {
        const audioUrl = getAudioUrl(videoStatus.videoUrl);
        if (audioUrl) {
          downloadUrl = audioUrl;
          filename = `audio_${videoId}.mp3`;
        }
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to download file');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      setVideoError('Failed to download file. Please try again.');
    }
  };

  const handleTikTokUpload = async () => {
    if (!videoStatus.videoUrl) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      let uploadUrl = videoStatus.videoUrl;
      
      // If it's an HTML file, we need to get the audio file for upload
      if (isHtmlFile(videoStatus.videoUrl)) {
        const audioUrl = getAudioUrl(videoStatus.videoUrl);
        if (audioUrl) {
          uploadUrl = audioUrl;
        } else {
          throw new Error('Could not find audio file for upload');
        }
      }

      // Get the file
      const fileResponse = await fetch(uploadUrl);
      if (!fileResponse.ok) throw new Error('Failed to fetch file');
      const fileBlob = await fileResponse.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('video', fileBlob, `story_${videoId}.mp3`);
      formData.append('title', `Story Audio #${videoId}`);
      formData.append('privacy_level', 'SELF_ONLY'); // Start with private for safety
      
      // Upload to TikTok
      const uploadResponse = await fetch('/api/social-media/tiktok/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(error || 'Failed to upload to TikTok');
      }
      
      const result = await uploadResponse.json();
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      // Show success message
      alert('Audio uploaded to TikTok successfully! Check your TikTok drafts.');
      
    } catch (error) {
      console.error('TikTok upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload to TikTok');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <PageContainer>
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Your Video</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            {videoStatus.status === 'generating' && (
              <div className="text-center py-8">
                <div className="mb-4">
                  <div className="animate-spin text-4xl inline-block">⚙️</div>
                </div>
                <h2 className="text-xl font-semibold mb-2">Generating Your Video</h2>
                <p className="text-gray-400 mb-4">This may take a few minutes...</p>
                {videoStatus.progress !== undefined && (
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${videoStatus.progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {videoStatus.status === 'ready' && videoStatus.videoUrl && (
              <div className="text-center py-8">
                <div className="mb-4 text-4xl">🎉</div>
                <h2 className="text-xl font-semibold mb-4">Your Story is Ready!</h2>
                
                <div className="mb-6">
                  {videoError ? (
                    <div className="text-center">
                      <div className="text-red-400 mb-4">{videoError}</div>
                      <Button onClick={handleRetry} variant="outline" className="mb-4">
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full">
                      {isHtmlFile(videoStatus.videoUrl) ? (
                        // Display HTML content in iframe
                        <iframe
                          src={videoStatus.videoUrl}
                          className="w-full h-96 rounded-lg border border-gray-600"
                          title="Story Player"
                          allow="autoplay"
                        />
                      ) : (
                        // Display video content
                        <video
                          ref={videoRef}
                          className="w-full rounded-lg"
                          controls
                          src={videoStatus.videoUrl}
                          onError={handleVideoError}
                        />
                      )}
                    </div>
                  )}
                </div>

                {uploadError && (
                  <div className="text-red-400 mb-4">
                    {uploadError}
                  </div>
                )}

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={handleDownload}
                    className="px-6"
                    disabled={!!videoError}
                  >
                    {isHtmlFile(videoStatus.videoUrl || '') ? 'Download Audio' : 'Download Video'}
                  </Button>
                  <Button
                    onClick={handleTikTokUpload}
                    className="px-6"
                    disabled={!!videoError || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <span className="animate-spin mr-2">⚙️</span>
                        Uploading to TikTok...
                      </>
                    ) : (
                      'Upload to TikTok'
                    )}
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/create'}
                    variant="outline"
                    className="px-6"
                  >
                    Create Another
                  </Button>
                </div>
              </div>
            )}

            {videoStatus.status === 'failed' && (
              <div className="text-center py-8">
                <div className="mb-4 text-4xl">❌</div>
                <h2 className="text-xl font-semibold mb-2">Video Generation Failed</h2>
                <p className="text-red-400 mb-4">{videoStatus.error || 'An error occurred'}</p>
                <Button
                  onClick={() => window.location.href = '/create'}
                  variant="outline"
                  className="px-6"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 