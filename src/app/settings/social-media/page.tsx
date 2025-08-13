'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams } from 'next/navigation';
import { SocialPlatform } from '@/lib/social-media/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface ConnectedPlatform {
  platform: SocialPlatform;
  username: string;
  connected: boolean;
}

export default function SocialMediaSettings() {
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([
    { platform: 'youtube', username: '', connected: false },
    { platform: 'tiktok', username: '', connected: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Handle URL parameters for error/success messages
  useEffect(() => {
    const errorMsg = searchParams.get('error');
    const successMsg = searchParams.get('success');
    
    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
    }
    if (successMsg) {
      setSuccess(decodeURIComponent(successMsg));
    }
  }, [searchParams]);

  useEffect(() => {
    // Load connected platforms
    async function loadPlatforms() {
      if (!user) return;

      try {
        const updatedPlatforms = await Promise.all(
          platforms.map(async (p) => {
            try {
              const response = await fetch(`/api/social-media/credentials?platform=${p.platform}`);
              if (!response.ok) {
                throw new Error(`Failed to fetch ${p.platform} credentials`);
              }
              
              const data = await response.json();
              return {
                ...p,
                username: data.username || '',
                connected: data.connected
              };
            } catch (error) {
              console.error(`Error fetching ${p.platform} credentials:`, error);
              return {
                ...p,
                username: '',
                connected: false
              };
            }
          })
        );

        setPlatforms(updatedPlatforms);
      } catch (error) {
        console.error('Error loading platforms:', error);
        setError('Failed to load connected platforms');
      }
    }

    loadPlatforms();
  }, [user]);

  const handleConnect = async (platform: SocialPlatform) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${platform}`);
      if (!response.ok) {
        throw new Error(`Failed to initiate ${platform} connection`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (!data.url) {
        throw new Error(`No OAuth URL received from ${platform}`);
      }

      // Log the URL for debugging
      console.log(`Redirecting to ${platform} OAuth URL:`, data.url);
      
      // Redirect to the OAuth URL
      window.location.href = data.url;
    } catch (error) {
      console.error(`Error connecting to ${platform}:`, error);
      setError(error instanceof Error ? error.message : `Failed to connect to ${platform}`);
      setLoading(false);
    }
  };

  const handleDisconnect = async (platform: SocialPlatform) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/social-media/credentials?platform=${platform}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect ${platform}`);
      }

      // Update platforms state
      setPlatforms(platforms.map(p => 
        p.platform === platform ? { ...p, connected: false, username: '' } : p
      ));

      setSuccess(`Successfully disconnected ${platform}`);
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error);
      setError(error instanceof Error ? error.message : `Failed to disconnect ${platform}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Social Media Connections</CardTitle>
          <CardDescription>
            Connect your social media accounts to automatically post your content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {platforms.map((platform) => (
              <div key={platform.platform} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium capitalize">{platform.platform}</h3>
                  {platform.connected && (
                    <p className="text-sm text-muted-foreground">
                      Connected as {platform.username}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => platform.connected ? handleDisconnect(platform.platform) : handleConnect(platform.platform)}
                  disabled={loading}
                  variant={platform.connected ? "destructive" : "default"}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {platform.connected ? 'Disconnecting...' : 'Connecting...'}
                    </>
                  ) : (
                    platform.connected ? 'Disconnect' : 'Connect'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 