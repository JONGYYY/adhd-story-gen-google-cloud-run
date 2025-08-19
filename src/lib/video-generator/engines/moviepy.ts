import { IVideoEngine, GenerateVideoInput, GenerateResult, JobConfig } from './types';
import { generateTTSAndAlignment, generateTitleAndStoryAudio } from '../shared/audio';
import { getBannerAssets } from '../shared/banner';
import { updateProgress } from '../status';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Helper to resolve Python path, preferring venv but falling back to system python3
async function resolvePythonPath(): Promise<string> {
	if (process.env.PYTHON_PATH) {
		return process.env.PYTHON_PATH;
	}
	const venvPath = path.join(process.cwd(), 'venv', 'bin', 'python3');
	try {
		await fs.access(venvPath);
		return venvPath;
	} catch {
		return 'python3';
	}
}

async function downloadDefaultBackground(targetPath: string): Promise<boolean> {
	const url = process.env.DEFAULT_BACKGROUND_URL;
	if (!url) return false;
	try {
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const arr = await res.arrayBuffer();
		await fs.writeFile(targetPath, Buffer.from(arr));
		return true;
	} catch (e) {
		console.warn('Failed to download DEFAULT_BACKGROUND_URL:', e);
		return false;
	}
}

export class MoviePyEngine implements IVideoEngine {
	name(): "moviepy" {
		return "moviepy";
	}

	async isAvailable(): Promise<boolean> {
		try {
			// Check if Python virtual environment is available
			if (process.env.VERCEL) {
				console.log('MoviePy: Running on Vercel - Python not available');
				return false;
			}

			const pythonPath = await resolvePythonPath();
			
			return new Promise((resolve) => {
				const pythonProcess = spawn(pythonPath, ['-c', 'import whisper, moviepy; print("MoviePy available")']);
				
				pythonProcess.on('close', (code: number | null) => {
					const available = code === 0;
					console.log(`MoviePy availability check: ${available ? 'available' : 'not available'}`);
					resolve(available);
				});
				
				pythonProcess.on('error', (error: Error) => {
					console.log('MoviePy not available:', error.message);
					resolve(false);
				});
				
				// Timeout after 5 seconds
				setTimeout(() => {
					pythonProcess.kill();
					console.log('MoviePy check timed out');
					resolve(false);
				}, 5000);
			});
		} catch (error) {
			console.error('Error testing MoviePy availability:', error);
			return false;
		}
	}

	async generate(jobId: string, input: GenerateVideoInput): Promise<GenerateResult> {
		try {
			console.log('🎬 Starting MoviePy video generation...');
			await updateProgress(jobId, 0);

			// Create job directory
			const tmpDir = process.env.VERCEL ? '/tmp' : os.tmpdir();
			const jobDir = path.join(tmpDir, 'jobs', jobId);
			await fs.mkdir(jobDir, { recursive: true });
			console.log(`📁 Created job directory: ${jobDir}`);

			await updateProgress(jobId, 10);
			console.log('🎙️ Generating story audio...');
			console.log(`📝 Story text: "${input.customStory.story.substring(0, 100)}..."`);
			
			// Generate title and story audio separately
			const voiceRequest = { provider: input.voice.provider, voiceId: input.voice.voiceId } as any;
			const titleStory = await generateTitleAndStoryAudio(
				input.customStory.title,
				input.customStory.story,
				voiceRequest,
				`${jobId}`
			);

			console.log(`✅ TTS generated successfully:`);
			console.log(`   Title audio: ${titleStory.titleAudio.path}`);
			console.log(`   Story audio: ${titleStory.storyAudio.path}`);
			console.log(`   Story duration: ${titleStory.storyAudio.duration}s`);

			await updateProgress(jobId, 30);

			// Get banner assets
			const bannerAssets = await getBannerAssets();
			console.log(`🎨 Banner assets loaded: ${bannerAssets.topPath}, ${bannerAssets.bottomPath}`);

			// Create job configuration
			const jobConfig: JobConfig = {
				jobId,
				input,
				alignmentPath: path.join(jobDir, 'story_align.json'),
				ttsPath: path.join(jobDir, 'story_audio.wav'), // not used in enhanced now
				bgSpec: {
					clips: [path.join(process.cwd(), 'public', 'backgrounds', input.background.category, '1.mp4')],
					switchSeconds: input.background.switchSeconds || 5
				},
				bannerAssets
			};

			// Ensure background exists or create/download a simple placeholder
			const expectedBgPath = jobConfig.bgSpec.clips[0];
			console.log(`🔍 Checking for background at: ${expectedBgPath}`);
			
			try {
				const bgStats = await fs.stat(expectedBgPath);
				console.log(`🎞️ Background clip found: ${expectedBgPath} (${bgStats.size} bytes)`);
			} catch (bgError) {
				console.warn(`⚠️ Background clip missing at ${expectedBgPath}:`, bgError);
				console.warn('⚠️ Generating placeholder background...');
				const placeholderPath = path.join(jobDir, 'bg_placeholder.mp4');
				// Try download first
				const downloaded = await downloadDefaultBackground(placeholderPath);
				if (!downloaded) {
					console.log('📹 Creating grid placeholder background...');
					await new Promise<void>((resolve, reject) => {
						const ffmpeg = spawn('ffmpeg', [
							'-f','lavfi','-i','color=c=black:s=1080x1920:r=30',
							'-t','10',
							'-vf','drawgrid=width=200:height=200:color=white@0.2:thickness=2',
							'-c:v','libx264','-pix_fmt','yuv420p',
							placeholderPath
						]);
						ffmpeg.on('close',(code)=> code===0?resolve():reject(new Error(`ffmpeg exited ${code}`)));
						ffmpeg.on('error',(err)=>reject(err));
					});
				}
				jobConfig.bgSpec.clips[0] = placeholderPath;
				console.log(`✅ Using placeholder background: ${placeholderPath}`);
			}

			// Copy story alignment to expected location
			await fs.writeFile(jobConfig.alignmentPath, JSON.stringify(titleStory.storyAudio.alignment, null, 2)).catch(()=>{});
			console.log(`✅ Files copied successfully`);
			
			await updateProgress(jobId, 40);

			// Create banner using existing Python script
			const bannerPath = await this.createBanner(jobConfig);
			await updateProgress(jobId, 50);

			// Generate final video using enhanced script with title+story
			const outputPath = await this.generateVideo(jobConfig, bannerPath, titleStory.titleAudio.path, titleStory.storyAudio.path);
			await updateProgress(jobId, 90);

			// Move to public directory
			const finalPath = await this.moveToPublic(outputPath, jobId);
			await updateProgress(jobId, 100);

			console.log('✅ MoviePy video generation completed');
			return {
				videoId: jobId,
				url: `/api/videos/output_${jobId}.mp4`
			};
		} catch (error) {
			console.error('❌ MoviePy video generation failed:', error);
			throw error;
		}
	}

	private async createBanner(jobConfig: JobConfig): Promise<string> {
		const bannerPath = path.join(path.dirname(jobConfig.ttsPath), 'banner.png');
		const bannerScriptPath = path.join(process.cwd(), 'src', 'python', 'create_banner_from_images.py');
		
		const pythonPath = await resolvePythonPath();

		await new Promise<void>((resolve, reject) => {
			const pythonProcess = spawn(pythonPath, [
				bannerScriptPath,
				jobConfig.input.customStory.title,
				jobConfig.input.customStory.subreddit || 'r/stories',
				jobConfig.input.customStory.author || 'Anonymous',
				bannerPath,
				"1080"
			]);

			let stderr = '';
			pythonProcess.stderr.on('data', (data) => {
				stderr += data.toString();
				console.log(`Banner Python stderr: ${data}`);
			});

			pythonProcess.on('close', (code) => {
				if (code === 0) {
					console.log('✅ Custom banner created successfully');
					resolve();
				} else {
					console.error('❌ Banner creation failed:', stderr);
					reject(new Error(`Banner creation failed with code ${code}`));
				}
			});

			pythonProcess.on('error', (err) => {
				reject(new Error(`Failed to start banner creation: ${err.message}`));
			});
		});

		return bannerPath;
	}

	private async generateVideo(jobConfig: JobConfig, bannerPath: string, titleAudioPath: string | null, storyAudioPath: string): Promise<string> {
		const outputPath = path.join(path.dirname(jobConfig.ttsPath), `output_${jobConfig.jobId}.mp4`);
		const videoScriptPath = path.join(process.cwd(), 'src', 'python', 'enhanced_generate_video.py');
		
		// Create story data for informational purposes
		const storyData = {
			title: jobConfig.input.customStory.title,
			story: jobConfig.input.customStory.story,
			subreddit: jobConfig.input.customStory.subreddit || 'r/stories',
			author: jobConfig.input.customStory.author || 'Anonymous'
		};

		const pythonPath = await resolvePythonPath();

		await new Promise<void>((resolve, reject) => {
			const pythonProcess = spawn(pythonPath, [
				videoScriptPath,
				jobConfig.jobId,
				titleAudioPath ? titleAudioPath : 'NONE',
				storyAudioPath,
				jobConfig.bgSpec.clips[0],
				bannerPath,
				outputPath,
				JSON.stringify(storyData),
				jobConfig.alignmentPath
			]);

			let stdout = '';
			let stderr = '';

			pythonProcess.stdout.on('data', (data) => {
				stdout += data.toString();
				console.log(`Video Python stdout: ${data}`);
				const progressMatch = data.toString().match(/PROGRESS (\d+)/);
				if (progressMatch) {
					const progress = parseInt(progressMatch[1]);
					updateProgress(jobConfig.jobId, 50 + (progress * 0.4));
				}
			});

			pythonProcess.stderr.on('data', (data) => {
				stderr += data.toString();
				console.log(`Video Python stderr: ${data}`);
			});

			pythonProcess.on('close', (code) => {
				if (code === 0) {
					console.log('✅ Video generation completed');
					resolve();
				} else {
					console.error('❌ Video generation failed:', stderr);
					reject(new Error(`Video generation failed with code ${code}`));
				}
			});

			pythonProcess.on('error', (err) => {
				reject(new Error(`Failed to start video generation: ${err.message}`));
			});
		});

		return outputPath;
	}

	private async moveToPublic(tempPath: string, jobId: string): Promise<string> {
		// The /api/videos endpoint looks for files in the temp directory
		const tmpDir = process.env.VERCEL ? '/tmp' : os.tmpdir();
		const finalPath = path.join(tmpDir, `output_${jobId}.mp4`);
		
		console.log(`📁 Moving video from ${tempPath} to ${finalPath}`);
		
		try {
			await fs.rename(tempPath, finalPath);
			console.log('✅ Video file moved successfully via rename');
		} catch (error) {
			console.log('⚠️ Rename failed, trying copy:', error);
			await fs.copyFile(tempPath, finalPath);
			await fs.unlink(tempPath).catch(() => {});
			console.log('✅ Video file moved successfully via copy');
		}
		
		const finalExists = await fs.access(finalPath).then(() => true).catch(() => false);
		if (!finalExists) {
			throw new Error(`Failed to move video file to final location: ${finalPath}`);
		}
		
		console.log(`✅ Video file verified at final location: ${finalPath}`);
		return finalPath;
	}
} 