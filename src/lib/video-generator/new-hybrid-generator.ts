// [MOD] New Remotion-backed hybrid generator with explicit engine selection and fallbacks.

import { updateProgress, setVideoReady, setVideoFailed } from './status';
import { IVideoEngine, GenerateVideoInput, GenerateResult, EngineType } from './engines/types';
import { MoviePyEngine } from './engines/moviepy';
// [MOD] Import our Remotion entry
import { generateVideoWithRemotion } from './remotion-entry';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(execCb);

// [MOD] Minimal Remotion engine implementation adhering to your IVideoEngine shape
class RemotionEngine implements IVideoEngine {
  name(): EngineType {
    return 'remotion' as EngineType;
  }

  async isAvailable(): Promise<boolean> {
    // Check for ffmpeg + ffprobe presence
    try {
      const ff = await execAsync(`${process.env.FFMPEG_BINARY || 'ffmpeg'} -version`);
      const fp = await execAsync(`${process.env.FFPROBE_BINARY || 'ffprobe'} -version`);
      if (!ff.stdout && !ff.stderr) return false;
      if (!fp.stdout && !fp.stderr) return false;
      return true;
    } catch {
      return false;
    }
  }

  // [MOD] Generate via remotion-entry; return URL as per your API
  async generate(videoId: string, input: GenerateVideoInput): Promise<GenerateResult> {
    await updateProgress(videoId, 1);
    const options: any = {
      story: {
        title: input?.customStory?.title || 'Untitled',
        story: input?.customStory?.story || '',
        subreddit: input?.customStory?.subreddit || 'r/stories',
        author: input?.customStory?.author || 'Anonymous',
      },
      voice: {
        id: (input?.voice?.voiceId as any) || 'adam',
        gender: (input?.voice?.voiceId || '').toLowerCase() === 'sarah' ? 'female' : 'male',
      },
      background: { category: input?.background?.category || 'minecraft' },
      user: { username: input?.customStory?.author || 'Anonymous' },
    };

    // [MOD] Delegate to remotion-entry
    const url = await generateVideoWithRemotion(options, videoId);
    return { url };
  }
}

// Engine registry
const engines = {
  // [MOD] Enable remotion as a first-class engine
  remotion: RemotionEngine,
  moviepy: MoviePyEngine,
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

    // [MOD] Validate and default to remotion (more reliable on Railway with Docker)
    if (envEngine && ['moviepy', 'remotion', 'aftereffects'].includes(envEngine)) {
      return envEngine;
    }
    return 'remotion' as EngineType;
  }

  private getFallbackOrder(preferred: EngineType): EngineType[] {
    // [MOD] Prefer remotion -> moviepy fallback
    const fallbackChains: Record<EngineType, EngineType[]> = {
      moviepy: ['moviepy'],
      remotion: ['remotion', 'moviepy'],
      aftereffects: ['aftereffects', 'remotion', 'moviepy']
    };
    return fallbackChains[preferred] || ['remotion', 'moviepy'];
  }

  async generateVideo(
    options: any, // Legacy options format
    videoId: string
  ): Promise<string> {
    try {
      console.log('🎬 Starting hybrid video generation...');
      await updateProgress(videoId, 0);

      if (!this.engine) {
        await this.initializeEngine();
      }
      if (!this.engine) {
        throw new Error('No video engine available');
      }

      // [MOD] Convert legacy options to engine input
      const input = this.convertLegacyOptions(options);

      console.log(`🎬 Generating video with ${this.engine.name()} engine`);
      const result = await this.engine.generate(videoId, input);

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
    return {
      customStory: {
        title: options?.story?.title || 'Untitled',
        story: options?.story?.story || '',
        subreddit: options?.story?.subreddit || 'r/stories',
        author: options?.story?.author || 'Anonymous'
      },
      voice: {
        provider: (process.env.TTS_PROVIDER as any) || 'elevenlabs',
        voiceId: options?.voice?.id || 'adam',
        rate: 1.0
      },
      background: {
        category: options?.background?.category || 'minecraft',
        switchSeconds: 5,
        loop: true
      },
      uiOverlay: {
        showBanner: options?.uiOverlay?.showBanner !== false,
        showCaptions: options?.uiOverlay?.showCaptions !== false
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

  async getEngineInfo(): Promise<{ name: string; available: boolean }[]> {
    const info = [];
    for (const [name, EngineClass] of Object.entries(engines)) {
      try {
        const engine = new (EngineClass as any)();
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
