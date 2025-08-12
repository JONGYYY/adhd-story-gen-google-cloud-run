import { 
  IVideoEngine, 
  GenerateVideoInput, 
  GenerateResult, 
  EngineType 
} from './engines/types';
import { MoviePyEngine } from './engines/moviepy';
import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { validateBannerAssets } from './shared/banner';

// Engine registry
const engines = {
  moviepy: MoviePyEngine,
  // remotion: RemotionEngine,  // TODO: Implement
  // aftereffects: AfterEffectsEngine  // TODO: Implement
};

export class HybridVideoGenerator {
  private engine: IVideoEngine | null = null;
  
  constructor() {
    // Initialize based on environment
    this.initializeEngine();
  }

  private async initializeEngine(): Promise<void> {
    const preferredEngine = this.getPreferredEngine();
    console.log(`🎛️ Preferred engine: ${preferredEngine}`);
    
    // Try engines in fallback order
    const fallbackOrder: EngineType[] = this.getFallbackOrder(preferredEngine);
    
    for (const engineType of fallbackOrder) {
      if (engineType in engines) {
        try {
          const EngineClass = engines[engineType as keyof typeof engines];
          const engine = new EngineClass();
          
          if (await engine.isAvailable()) {
            this.engine = engine;
            console.log(`✅ Using ${engine.name()} engine`);
            return;
          } else {
            console.log(`❌ ${engineType} engine not available`);
          }
        } catch (error) {
          console.error(`❌ Failed to initialize ${engineType} engine:`, error);
        }
      }
    }
    
    throw new Error('No video engines are available');
  }

  private getPreferredEngine(): EngineType {
    const envEngine = process.env.VIDEO_ENGINE as EngineType;
    
    // Validate environment setting
    if (envEngine && ['moviepy', 'remotion', 'aftereffects'].includes(envEngine)) {
      return envEngine;
    }
    
    // Default fallback
    return 'moviepy';
  }

  private getFallbackOrder(preferred: EngineType): EngineType[] {
    // Define fallback chains
    const fallbackChains: Record<EngineType, EngineType[]> = {
      moviepy: ['moviepy'],
      remotion: ['remotion', 'moviepy'],
      aftereffects: ['aftereffects', 'remotion', 'moviepy']
    };
    
    return fallbackChains[preferred] || ['moviepy'];
  }

  async generateVideo(
    options: any, // Legacy options format
    videoId: string
  ): Promise<string> {
    try {
      console.log('🎬 Starting hybrid video generation...');
      await updateProgress(videoId, 0);

      // Ensure engine is initialized
      if (!this.engine) {
        await this.initializeEngine();
      }

      if (!this.engine) {
        throw new Error('No video engine available');
      }

      // Validate banner assets
      const bannerAssetsValid = await validateBannerAssets();
      if (!bannerAssetsValid) {
        console.warn('⚠️ Banner assets validation failed, proceeding with fallback');
      }

      // Convert legacy options to new format
      const input = this.convertLegacyOptions(options);
      
      console.log(`🎬 Generating video with ${this.engine.name()} engine`);
      const result = await this.engine.generate(videoId, input);
      
      // Set video ready with the result URL
      await setVideoReady(videoId, result.url);
      
      console.log('✅ Hybrid video generation completed');
      return result.url;

    } catch (error) {
      console.error('❌ Error in hybrid video generation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await setVideoFailed(videoId, errorMessage);
      throw error;
    }
  }

  private convertLegacyOptions(options: any): GenerateVideoInput {
    // Convert the old format to the new standardized format
    return {
      customStory: {
        title: options.story?.title || 'Untitled',
        story: options.story?.story || '',
        subreddit: options.story?.subreddit || 'r/stories',
        author: options.story?.author || 'Anonymous'
      },
      voice: {
        provider: this.getTTSProvider(),
        voiceId: options.voice?.id || 'adam',
        rate: 1.0
      },
      background: {
        category: options.background?.category || 'minecraft',
        switchSeconds: 5,
        loop: true
      },
      uiOverlay: {
        showBanner: options.uiOverlay?.showBanner !== false,
        showCaptions: options.uiOverlay?.showCaptions !== false
      },
      captionStyle: {
        fontSize: 75,
        fontFamily: 'Arial-Bold',
        bouncePx: 8,
        strokePx: 4,
        fill: '#FFFFFF',
        stroke: '#000000'
      }
    };
  }

  private getTTSProvider(): "elevenlabs" | "edge" | "none" {
    const provider = process.env.TTS_PROVIDER as "elevenlabs" | "edge" | "none";
    return provider || 'edge';
  }

  async getEngineInfo(): Promise<{ name: string; available: boolean }[]> {
    const info = [];
    
    for (const [name, EngineClass] of Object.entries(engines)) {
      try {
        const engine = new EngineClass();
        const available = await engine.isAvailable();
        info.push({ name, available });
      } catch (error) {
        info.push({ name, available: false });
      }
    }
    
    return info;
  }

  getCurrentEngine(): string | null {
    return this.engine?.name() || null;
  }
}

// Legacy export for compatibility
export async function generateVideo(
  options: any,
  videoId: string
): Promise<string> {
  const generator = new HybridVideoGenerator();
  return generator.generateVideo(options, videoId);
} 