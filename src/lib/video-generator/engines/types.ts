export type BackgroundRequest = {
  category: "minecraft" | "cooking" | "subway" | "random";
  switchSeconds?: number; // default 5
  loop?: boolean;        // default true
};

export type VoiceRequest = {
  provider: "elevenlabs" | "edge" | "none";
  voiceId?: string;
  rate?: number;         // 0.9..1.1 optional
};

export type UiOverlay = { 
  showBanner: boolean; 
  showCaptions: boolean; 
};

export type CaptionStyle = {
  fontFamily?: string;    // default Inter or rounded alternative
  fontSize?: number;      // base size; auto-scales
  bouncePx?: number;      // default 8
  strokePx?: number;      // default 4
  fill?: string;          // default "#FFFFFF"
  stroke?: string;        // default "#000000"
};

export type GenerateVideoInput = {
  customStory: {
    title: string;
    story: string;
    subreddit: string;
    author: string;
  };
  voice: VoiceRequest;
  background: BackgroundRequest;
  uiOverlay: UiOverlay;
  captionStyle?: CaptionStyle;
};

export type GenerateResult = { 
  videoId: string; 
  url: string; 
};

export type WordAlignment = {
  word: string;
  start: number;
  end: number;
};

export type BgSpec = { 
  clips: string[]; 
  switchSeconds: number; 
};

export type JobConfig = {
  jobId: string;
  input: GenerateVideoInput;
  alignmentPath: string;
  ttsPath: string;
  bgSpec: BgSpec;
  bannerAssets: {
    topPath: string;
    bottomPath: string;
    safeZonePadding: { top: number; bottom: number; left: number; right: number; };
  };
};

export interface IVideoEngine {
  name(): "moviepy" | "remotion" | "aftereffects";
  generate(jobId: string, input: GenerateVideoInput): Promise<GenerateResult>;
  isAvailable(): Promise<boolean>;
}

export type EngineType = "moviepy" | "remotion" | "aftereffects";

export interface ProgressCallback {
  (jobId: string, stage: string, percent: number): void;
} 