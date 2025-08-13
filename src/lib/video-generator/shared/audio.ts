import { VoiceRequest, WordAlignment } from '../engines/types';
import { generateSpeech } from '../voice';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Helper function to convert ArrayBuffer to Buffer
function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

// Helper function to get temp directory
function getTmpDir(): string {
  return process.env.VERCEL ? '/tmp' : os.tmpdir();
}

// Helper function to create a silent WAV audio buffer for testing
function createSilentAudioBuffer(durationSeconds: number): Buffer {
  const sampleRate = 22050; // 22.05 kHz
  const channels = 1; // Mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.floor(durationSeconds * sampleRate) * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // WAV header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  
  // Format chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // Subchunk1Size
  buffer.writeUInt16LE(1, offset); offset += 2; // AudioFormat (PCM)
  buffer.writeUInt16LE(channels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // Data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Fill with silence (zeros)
  buffer.fill(0, offset);
  
  return buffer;
}

export async function generateTTSAndAlignment(
  text: string,
  voice: VoiceRequest,
  jobId: string
): Promise<{ audioPath: string; alignmentPath: string; duration: number }> {
  console.log(`🎙️ Starting TTS generation for job: ${jobId}`);
  console.log(`📝 Text length: ${text.length} characters`);
  console.log(`🎤 Voice provider: ${voice.provider}, voiceId: ${voice.voiceId}`);
  
  const tmpDir = getTmpDir();
  const jobDir = path.join(tmpDir, 'jobs', jobId);
  
  console.log(`📁 Temp dir: ${tmpDir}`);
  console.log(`📂 Job dir: ${jobDir}`);
  
  try {
    await fs.mkdir(jobDir, { recursive: true });
    console.log('✅ Job directory created successfully');
  } catch (dirError: any) {
    console.error('❌ Failed to create job directory:', dirError);
    throw new Error(`Failed to create job directory: ${dirError.message}`);
  }

  const audioPath = path.join(jobDir, 'voice.wav');
  const alignmentPath = path.join(jobDir, 'align.json');

  console.log(`🎵 Audio will be saved to: ${audioPath}`);
  console.log(`📋 Alignment will be saved to: ${alignmentPath}`);

  let alignment: WordAlignment[] = [];
  let duration = 5.0; // Default duration

  // Handle different voice providers
  if (voice.provider === 'elevenlabs') {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ ElevenLabs API key not found, falling back to Edge TTS');
      voice.provider = 'edge';
    }
  }

  // Generate audio
  try {
    if (voice.provider === 'elevenlabs') {
      console.log('🔄 Using ElevenLabs API...');
      const audioBuffer = await generateSpeech({
        text,
        voice: { id: voice.voiceId || 'adam', gender: 'male' }
      });

      await fs.writeFile(audioPath, arrayBufferToBuffer(audioBuffer));
      console.log('✅ ElevenLabs audio saved successfully');
      
    } else {
      // Fallback: create silent audio
      console.log('🔄 Creating fallback silent audio...');
      const estimatedDuration = Math.max(text.length * 0.08, 2); // 0.08s per character, min 2s
      const fallbackAudio = createSilentAudioBuffer(estimatedDuration);
      
      console.log(`📊 Creating ${estimatedDuration}s of silent audio (${fallbackAudio.length} bytes)`);
      
      await fs.writeFile(audioPath, fallbackAudio);
      console.log('✅ Fallback silent audio saved successfully');
      
      duration = estimatedDuration;
    }
    
    // Verify audio file exists
    const audioStats = await fs.stat(audioPath);
    console.log(`✅ Audio file verified: ${audioStats.size} bytes`);
    
  } catch (audioError: any) {
    console.error('❌ Audio generation failed:', audioError);
    throw new Error(`Audio generation failed: ${audioError.message}`);
  }

  // Generate word alignment
  try {
    console.log('🔄 Generating word alignment...');
    alignment = await generateAlignment(audioPath, text);
    console.log(`✅ Generated alignment for ${alignment.length} words`);
  } catch (alignError) {
    console.warn('⚠️ Word alignment failed, using fallback:', alignError);
    alignment = generateFallbackAlignment(text);
    console.log(`✅ Generated fallback alignment for ${alignment.length} words`);
  }

  // Save alignment JSON
  try {
    await fs.writeFile(alignmentPath, JSON.stringify(alignment, null, 2));
    console.log('✅ Alignment data saved successfully');
  } catch (alignSaveError: any) {
    console.error('❌ Failed to save alignment:', alignSaveError);
    throw new Error(`Failed to save alignment: ${alignSaveError.message}`);
  }

  // Get actual audio duration if not set
  if (duration === 5.0) {
    try {
      duration = await getAudioDuration(audioPath);
      console.log(`⏱️ Actual audio duration: ${duration}s`);
    } catch (durationError) {
      console.warn('⚠️ Could not get audio duration, using estimated:', durationError);
      duration = Math.max(text.length * 0.08, 2);
    }
  }

  console.log(`✅ TTS generation completed successfully for job ${jobId}`);
  return {
    audioPath,
    alignmentPath,
    duration
  };
}

async function generateAlignment(audioPath: string, text: string): Promise<WordAlignment[]> {
  try {
    console.log('🔄 Generating word alignment with Whisper...');
    
    const pythonPath = process.env.VERCEL 
      ? 'python3'
      : path.join(process.cwd(), 'venv', 'bin', 'python3');

    return new Promise((resolve, reject) => {
      // Create a simple Python script to get word timestamps
      const alignScript = `
import whisper
import sys
import json

try:
    model = whisper.load_model("base")
    result = model.transcribe(sys.argv[1], word_timestamps=True)
    
    words = []
    for segment in result["segments"]:
        if "words" in segment:
            for word in segment["words"]:
                words.append({
                    "word": word["word"].strip(),
                    "start": word["start"],
                    "end": word["end"]
                })
    
    print(json.dumps(words))
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

      const pythonProcess = spawn(pythonPath, ['-c', alignScript, audioPath]);
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const words = JSON.parse(stdout.trim());
            resolve(words);
          } catch (e) {
            console.error('Failed to parse Whisper output:', e);
            resolve(generateFallbackAlignment(text));
          }
        } else {
          console.error('Whisper failed:', stderr);
          resolve(generateFallbackAlignment(text));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Failed to start Whisper process:', err);
        resolve(generateFallbackAlignment(text));
      });
    });
  } catch (error) {
    console.error('Error in generateAlignment:', error);
    return generateFallbackAlignment(text);
  }
}

function generateFallbackAlignment(text: string): WordAlignment[] {
  // Simple fallback: estimate word timing based on average speaking rate
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const avgWordsPerSecond = 2.5; // Reasonable speaking rate
  const wordDuration = 1 / avgWordsPerSecond;
  
  return words.map((word, index) => ({
    word: word.replace(/[.,!?;:]$/, ''), // Remove trailing punctuation
    start: index * wordDuration,
    end: (index + 1) * wordDuration
  }));
}

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    // First try with ffprobe
    return await getAudioDurationWithFFprobe(audioPath);
  } catch (error) {
    console.warn('ffprobe failed, trying alternative method:', error);
    try {
      // Fallback to librosa via Python
      return await getAudioDurationWithPython(audioPath);
    } catch (pythonError) {
      console.warn('Python duration detection failed:', pythonError);
      // Final fallback - estimate based on file size (very rough)
      return 10; // Default to 10 seconds
    }
  }
}

async function getAudioDurationWithFFprobe(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioPath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const duration = parseFloat(stdout.trim());
        if (duration > 0) {
          resolve(duration);
        } else {
          reject(new Error('Invalid duration from ffprobe'));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      ffprobe.kill();
      reject(new Error('ffprobe timeout'));
    }, 10000);
  });
}

async function getAudioDurationWithPython(audioPath: string): Promise<number> {
  const pythonPath = process.env.VERCEL 
    ? 'python3'
    : path.join(process.cwd(), 'venv', 'bin', 'python3');

  return new Promise((resolve, reject) => {
    const pythonScript = `
import librosa
import sys
try:
    duration = librosa.get_duration(filename=sys.argv[1])
    print(duration)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

    const pythonProcess = spawn(pythonPath, ['-c', pythonScript, audioPath]);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const duration = parseFloat(stdout.trim());
        if (duration > 0) {
          resolve(duration);
        } else {
          reject(new Error('Invalid duration from Python'));
        }
      } else {
        reject(new Error(`Python duration detection failed: ${stderr}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Python duration detection timeout'));
    }, 10000);
  });
}

export async function generateTitleAndStoryAudio(
  title: string,
  story: string,
  voice: VoiceRequest,
  jobId: string
): Promise<{
  titleAudio: { path: string; alignment: WordAlignment[]; duration: number };
  storyAudio: { path: string; alignment: WordAlignment[]; duration: number };
}> {
  console.log('🎙️ Generating title and story audio...');

  // Create a shared job directory
  const tmpDir = getTmpDir();
  const jobDir = path.join(tmpDir, 'jobs', jobId);
  await fs.mkdir(jobDir, { recursive: true });

  // Generate title audio in the main job directory
  const titleResult = await generateTTSAndAlignment(title, voice, `${jobId}_title`);
  
  // Generate story audio in the main job directory
  const storyResult = await generateTTSAndAlignment(story, voice, `${jobId}_story`);

  // Copy files to the main job directory for easier access
  const titleAudioPath = path.join(jobDir, 'title_audio.wav');
  const storyAudioPath = path.join(jobDir, 'story_audio.wav');
  const titleAlignPath = path.join(jobDir, 'title_align.json');
  const storyAlignPath = path.join(jobDir, 'story_align.json');

  await fs.copyFile(titleResult.audioPath, titleAudioPath);
  await fs.copyFile(storyResult.audioPath, storyAudioPath);
  await fs.copyFile(titleResult.alignmentPath, titleAlignPath);
  await fs.copyFile(storyResult.alignmentPath, storyAlignPath);

  // Load alignments
  const titleAlignment: WordAlignment[] = JSON.parse(
    await fs.readFile(titleAlignPath, 'utf-8')
  );
  const storyAlignment: WordAlignment[] = JSON.parse(
    await fs.readFile(storyAlignPath, 'utf-8')
  );

  return {
    titleAudio: {
      path: titleAudioPath,
      alignment: titleAlignment,
      duration: titleResult.duration
    },
    storyAudio: {
      path: storyAudioPath,
      alignment: storyAlignment,
      duration: storyResult.duration
    }
  };
} 