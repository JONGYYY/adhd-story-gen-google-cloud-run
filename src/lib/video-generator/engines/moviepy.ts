import { IVideoEngine, GenerateVideoInput, GenerateResult, JobConfig } from './types';
import { generateTTSAndAlignment } from '../shared/audio';
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

			// Generate story audio (simplified - just use story for now)
			await updateProgress(jobId, 10);
			console.log('🎙️ Generating story audio...');
			console.log(`📝 Story text: "${input.customStory.story.substring(0, 100)}..."`);
			
			try {
				const storyResult = await generateTTSAndAlignment(
					input.customStory.story,
					input.voice,
					jobId
				);
				console.log(`✅ TTS generated successfully:`);
				console.log(`   Audio path: ${storyResult.audioPath}`);
				console.log(`   Alignment path: ${storyResult.alignmentPath}`);
				console.log(`   Duration: ${storyResult.duration}s`);

				await updateProgress(jobId, 30);

				// Get banner assets
				const bannerAssets = await getBannerAssets();
				console.log(`🎨 Banner assets loaded: ${bannerAssets.topPath}, ${bannerAssets.bottomPath}`);

				// Create job configuration
				const jobConfig: JobConfig = {
					jobId,
					input,
					alignmentPath: path.join(jobDir, 'story_align.json'),
					ttsPath: path.join(jobDir, 'story_audio.wav'),
					bgSpec: {
						clips: [path.join(process.cwd(), 'public', 'backgrounds', input.background.category, '1.mp4')],
						switchSeconds: input.background.switchSeconds || 5
					},
					bannerAssets
				};

				// Ensure background exists or create a simple placeholder loop via ffmpeg
				try {
					await fs.access(jobConfig.bgSpec.clips[0]);
					console.log('🎞️ Background clip found:', jobConfig.bgSpec.clips[0]);
				} catch {
					console.warn('⚠️ Background clip missing. Generating placeholder background...');
					const placeholderPath = path.join(jobDir, 'bg_placeholder.mp4');
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
					jobConfig.bgSpec.clips[0] = placeholderPath;
				}

				// Copy story files to expected locations
				console.log(`📋 Copying files:`);
				console.log(`   From: ${storyResult.audioPath} -> ${jobConfig.ttsPath}`);
				console.log(`   From: ${storyResult.alignmentPath} -> ${jobConfig.alignmentPath}`);
				
				// Check if source files exist before copying
				const audioExists = await fs.access(storyResult.audioPath).then(() => true).catch(() => false);
				const alignExists = await fs.access(storyResult.alignmentPath).then(() => true).catch(() => false);
				
				console.log(`   Audio file exists: ${audioExists}`);
				console.log(`   Alignment file exists: ${alignExists}`);
				
				if (!audioExists) {
					throw new Error(`Audio file not found: ${storyResult.audioPath}`);
				}
				if (!alignExists) {
					throw new Error(`Alignment file not found: ${storyResult.alignmentPath}`);
				}
				
				await fs.copyFile(storyResult.audioPath, jobConfig.ttsPath);
				await fs.copyFile(storyResult.alignmentPath, jobConfig.alignmentPath);
				console.log(`✅ Files copied successfully`);
				
				await updateProgress(jobId, 40);

				// Create banner using existing Python script
				const bannerPath = await this.createBanner(jobConfig);
				await updateProgress(jobId, 50);

				// Generate final video
				const outputPath = await this.generateVideo(jobConfig, bannerPath);
				await updateProgress(jobId, 90);

				// Move to public directory
				const finalPath = await this.moveToPublic(outputPath, jobId);
				await updateProgress(jobId, 100);

				console.log('✅ MoviePy video generation completed');
				return {
					videoId: jobId,
					url: `/api/videos/output_${jobId}.mp4`
				};
			} catch (ttsError) {
				console.error('❌ TTS generation failed:', ttsError);
				throw new Error(`TTS generation failed: ${ttsError instanceof Error ? ttsError.message : 'Unknown TTS error'}`);
			}

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

	private async generateVideo(jobConfig: JobConfig, bannerPath: string): Promise<string> {
		const outputPath = path.join(path.dirname(jobConfig.ttsPath), `output_${jobConfig.jobId}.mp4`);
		const videoScriptPath = path.join(process.cwd(), 'src', 'python', 'enhanced_generate_video.py');
		
		// Create enhanced Python script arguments
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
				jobConfig.ttsPath,    // Combined audio
				jobConfig.bgSpec.clips[0], // Background video
				bannerPath,           // Custom banner
				outputPath,           // Output path
				JSON.stringify(storyData),
				jobConfig.alignmentPath // Word alignment
			]);

			let stdout = '';
			let stderr = '';

			pythonProcess.stdout.on('data', (data) => {
				stdout += data.toString();
				console.log(`Video Python stdout: ${data}`);
				
				// Parse progress if available
				const progressMatch = data.toString().match(/PROGRESS (\d+)/);
				if (progressMatch) {
					const progress = parseInt(progressMatch[1]);
					updateProgress(jobConfig.jobId, 50 + (progress * 0.4)); // Scale to 50-90%
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
			// If rename fails, copy and delete
			console.log('⚠️ Rename failed, trying copy:', error);
			await fs.copyFile(tempPath, finalPath);
			await fs.unlink(tempPath).catch(() => {}); // Ignore cleanup errors
			console.log('✅ Video file moved successfully via copy');
		}
		
		// Verify the file exists at the final location
		const finalExists = await fs.access(finalPath).then(() => true).catch(() => false);
		if (!finalExists) {
			throw new Error(`Failed to move video file to final location: ${finalPath}`);
		}
		
		console.log(`✅ Video file verified at final location: ${finalPath}`);
		return finalPath;
	}
} 