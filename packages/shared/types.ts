export type WordStamp = { 
  word: string; 
  startMs: number; 
  endMs: number; 
  confidence?: number 
};

export type Alignment = { 
  words: WordStamp[]; 
  sampleRate: number; 
};

export type RenderRequest = {
  id: string;
  script: string;
  voiceId: string; // ElevenLabs voice
  avatarUrl: string;
  authorName: string;
  title: string;
  subreddit?: string;
  bgClips: string[]; // URLs to background MP4s
  fps?: number; // default 30
  width?: number; // default 1080
  height?: number; // default 1920
};

export type RenderResult = {
  id: string;
  status: 'queued'|'rendering'|'done'|'error';
  outputUrl?: string;
  errorMessage?: string;
};

export type SafeZone = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// Animation helpers
export type BounceConfig = {
  overshootPx: number;
  dampingMs: number;
  durationMs: number;
};

export type StoryCompositionProps = {
  bannerPng: string;        // file URL
  bgVideo: string;          // file URL
  narrationWav: string;     // file URL
  alignment: Alignment;
  safeZone?: SafeZone;
  fps: number; 
  width: number; 
  height: number;
};

// Banner generation types
export type BannerInput = {
  title: string;
  authorName: string;
  avatarUrl: string;
  subreddit?: string;
  width?: number;
  height?: number;
};

// Background processing types
export type BackgroundOptions = {
  width: number;
  height: number;
  fps: number;
  switchEverySec: number;
};

// Job queue types
export type VideoJob = {
  id: string;
  request: RenderRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  result?: RenderResult;
  error?: string;
};

// Config types
export type AppConfig = {
  elevenlabsApiKey: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  s3BucketAssets: string;
  s3BucketIntermediates: string;
  s3BucketOutputs: string;
  sqsQueueUrl: string;
  redisUrl?: string;
  remotionLambdaFunctionArn: string;
  remotionLambdaRegion: string;
}; 