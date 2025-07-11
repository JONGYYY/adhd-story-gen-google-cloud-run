export type SubredditStory = {
  title: string;
  story: string;
  subreddit: string;
  author: string;
  startingQuestion?: string;
};

export type VideoBackground = {
  category: 'minecraft' | 'subway' | 'cooking' | 'workers';
  speedMultiplier: number;
};

export type VoiceOption = {
  id: string;
  gender: 'male' | 'female';
};

export type CaptionStyle = {
  font: string;
  size: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowOffset: number;
  position: 'center' | 'top' | 'bottom';
};

export type UIOverlay = {
  showSubreddit: boolean;
  showRedditUI: boolean;
  showBanner: boolean;
};

export type VideoOptions = {
  subreddit: string;
  isCliffhanger: boolean;
  background: VideoBackground;
  voice: VoiceOption;
  playbackSpeed: number;
  captionStyle: CaptionStyle;
  uiOverlay: UIOverlay;
  customStory?: {
    title: string;
    story: string;
    subreddit?: string;
  };
};

export type VideoGenerationOptions = VideoOptions & {
  story: SubredditStory;
};

export type VideoSegment = {
  text: string;
  start: number;
  end: number;
  type: 'title' | 'story';
};

export type VideoMetadata = {
  id: string;
  title: string;
  story: string;
  subreddit: string;
  author: string;
  duration: number;
  segments: VideoSegment[];
  outputPath: string;
};

export type VideoStatus = {
  status: 'generating' | 'ready' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
  title?: string;
  description?: string;
}; 