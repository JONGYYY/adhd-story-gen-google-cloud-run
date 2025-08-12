#!/usr/bin/env python3
"""
Efficient Video Generator
Inspired by FullyAutomatedRedditVideoMakerBot
Generates Reddit story videos with dyslexic-style one-word captions
"""

import sys
import json
import logging
import os
import tempfile
import shutil
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import librosa
import soundfile as sf

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EfficientVideoGenerator:
    def __init__(self, video_id: str):
        self.video_id = video_id
        self.temp_files = []
        self.temp_dirs = []
        
    def cleanup(self):
        """Clean up temporary files and directories"""
        for file_path in self.temp_files:
            try:
                os.remove(file_path)
            except:
                pass
                
        for dir_path in self.temp_dirs:
            try:
                shutil.rmtree(dir_path, ignore_errors=True)
            except:
                pass

    def get_word_timestamps_simple(self, audio_path: str, text: str) -> List[Dict]:
        """
        Get word timestamps using a simple approach (similar to FullyAutomatedRedditVideoMakerBot)
        For production, you'd want to use Whisper or similar
        """
        try:
            # Get audio duration
            duration, sr = librosa.load(audio_path, sr=None)
            total_duration = len(duration) / sr
            
            # Split text into words
            words = text.split()
            if not words:
                return []
                
            # Calculate average word duration
            avg_word_duration = total_duration / len(words)
            
            word_timestamps = []
            for i, word in enumerate(words):
                start_time = i * avg_word_duration
                end_time = (i + 1) * avg_word_duration
                
                # Add some variation to make it more natural
                variation = avg_word_duration * 0.1
                start_time += np.random.uniform(-variation, variation)
                end_time += np.random.uniform(-variation, variation)
                
                # Ensure no negative times or overlaps
                start_time = max(0, start_time)
                if i > 0:
                    start_time = max(start_time, word_timestamps[i-1]['end'])
                end_time = max(start_time + 0.1, end_time)
                
                # Check for emphasis (all caps, punctuation)
                is_emphasis = (word.isupper() or 
                              any(p in word for p in ['!', '?', '.']) or
                              len(word) <= 3)  # Short words get emphasis
                
                word_timestamps.append({
                    'text': word.strip('.,!?'),
                    'start': start_time,
                    'end': end_time,
                    'emphasis': is_emphasis
                })
                
            return word_timestamps
            
        except Exception as e:
            logger.error(f"Failed to get word timestamps: {e}")
            return []

    def create_dyslexic_captions_ffmpeg(self, word_timestamps: List[Dict], 
                                       opening_duration: float) -> str:
        """
        Create dyslexic-style captions using FFmpeg drawtext
        Inspired by FullyAutomatedRedditVideoMakerBot approach
        """
        filter_parts = []
        
        for i, word in enumerate(word_timestamps):
            start_time = opening_duration + word['start']
            end_time = opening_duration + word['end']
            duration = end_time - start_time
            
            # Animation parameters
            fade_in_duration = min(0.2, duration * 0.3)
            fade_out_duration = min(0.2, duration * 0.3)
            
            # Font size based on emphasis
            font_size = 90 if word['emphasis'] else 75
            
            # Create bouncing effect with scale animation
            scale_expr = "1.0+0.1*sin(2*PI*t/0.5)" if word['emphasis'] else "1.0+0.05*sin(2*PI*t/0.8)"
            
            # Clean text for FFmpeg
            clean_text = word['text'].replace("'", "\\'").replace('"', '\\"')
            
            # Dyslexic-style caption with bouncing animation
            drawtext_filter = f"""drawtext=
                text='{clean_text.upper()}':
                fontsize={font_size}:
                fontcolor=white:
                x=(w-text_w)/2:
                y=h-350:
                enable='between(t,{start_time:.3f},{end_time:.3f})':
                alpha='if(between(t,{start_time:.3f},{start_time + fade_in_duration:.3f}),(t-{start_time:.3f})/{fade_in_duration:.3f},if(between(t,{end_time - fade_out_duration:.3f},{end_time:.3f}),1-(t-{end_time - fade_out_duration:.3f})/{fade_out_duration:.3f},1))':
                box=1:
                boxcolor=black@0.8:
                boxborderw=12:
                shadowx=4:
                shadowy=4:
                shadowcolor=black@0.9""".replace('\n', '').replace(' ', '')
            
            filter_parts.append(drawtext_filter)
        
        return ','.join(filter_parts)

    def generate_video_ffmpeg(self, background_path: str, banner_path: str,
                             opening_audio: str, story_audio: str,
                             output_path: str, opening_duration: float,
                             story_duration: float, word_timestamps: List[Dict]):
        """
        Generate video using efficient FFmpeg approach
        """
        try:
            # Build FFmpeg command
            cmd = [
                'ffmpeg', '-y',
                '-i', background_path,  # Background video
                '-i', banner_path,      # Banner image
                '-i', opening_audio,    # Opening audio
                '-i', story_audio,      # Story audio
            ]
            
            # Create filter complex
            filter_complex = f"""
                [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,
                eq=brightness=0.1:contrast=1.2:saturation=1.1[bg];
                [1:v]scale=800:-1[banner_scaled];
                [bg][banner_scaled]overlay=40:40:enable='between(t,0,{opening_duration})'[with_banner];
            """
            
            # Add dyslexic captions
            if word_timestamps:
                captions_filter = self.create_dyslexic_captions_ffmpeg(word_timestamps, opening_duration)
                filter_complex += f"[with_banner]{captions_filter}[with_captions];"
                video_output = "[with_captions]"
            else:
                video_output = "[with_banner]"
            
            # Audio mixing
            filter_complex += f"""
                [2:a]volume=1.0,afade=t=in:st=0:d=0.1,afade=t=out:st={opening_duration-0.1}:d=0.1[opening_audio];
                [3:a]volume=1.0,afade=t=in:st=0:d=0.1,afade=t=out:st={story_duration-0.1}:d=0.1[story_audio];
                [opening_audio][story_audio]concat=n=2:v=0:a=1[final_audio]
            """
            
            cmd.extend([
                '-filter_complex', filter_complex.strip(),
                '-map', video_output,
                '-map', '[final_audio]',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'fast',  # Fast encoding
                '-crf', '25',       # Good quality
                '-profile:v', 'high',
                '-level', '4.1',
                '-pix_fmt', 'yuv420p',
                '-r', '30',
                '-b:a', '128k',
                '-ar', '44100',
                output_path
            ])
            
            logger.info(f"Running FFmpeg command: {' '.join(cmd[:10])}...")
            
            # Run FFmpeg
            process = subprocess.run(cmd, capture_output=True, text=True)
            
            if process.returncode != 0:
                logger.error(f"FFmpeg failed with return code {process.returncode}")
                logger.error(f"FFmpeg stderr: {process.stderr}")
                raise RuntimeError(f"FFmpeg failed: {process.stderr}")
            
            logger.info("FFmpeg video generation completed successfully")
            
        except Exception as e:
            logger.error(f"Error in FFmpeg video generation: {e}")
            raise

    def create_reddit_banner_simple(self, title: str, author: str, 
                                   output_path: str, width: int = 800, height: int = 200):
        """
        Create a simple Reddit-style banner
        """
        try:
            # Create image
            img = Image.new('RGB', (width, height), 'white')
            draw = ImageDraw.Draw(img)
            
            # Try to load a font, fallback to default
            try:
                font_large = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 24)
                font_small = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 16)
            except:
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # Draw Reddit-style layout
            # Orange circle for profile
            draw.ellipse([20, 20, 60, 60], fill='#FF4500')
            
            # Username
            draw.text((80, 25), f"u/{author}", fill='black', font=font_small)
            
            # Title (wrapped)
            title_lines = []
            words = title.split()
            current_line = ""
            
            for word in words:
                test_line = current_line + (" " if current_line else "") + word
                if len(test_line) > 50:  # Rough character limit
                    if current_line:
                        title_lines.append(current_line)
                    current_line = word
                else:
                    current_line = test_line
            
            if current_line:
                title_lines.append(current_line)
            
            # Draw title lines
            y_offset = 55
            for line in title_lines[:3]:  # Max 3 lines
                draw.text((20, y_offset), line, fill='black', font=font_large)
                y_offset += 30
            
            # Save banner
            img.save(output_path, 'PNG')
            logger.info(f"Banner created: {output_path}")
            
        except Exception as e:
            logger.error(f"Failed to create banner: {e}")
            # Create a simple colored rectangle as fallback
            img = Image.new('RGB', (width, height), '#FF4500')
            img.save(output_path, 'PNG')

    def generate(self, opening_audio_path: str, story_audio_path: str,
                background_path: str, output_path: str, story_data: Dict):
        """
        Main generation function
        """
        try:
            logger.info("Starting efficient video generation...")
            
            # Create temp directory
            temp_dir = tempfile.mkdtemp(prefix=f'efficient_video_{self.video_id}_')
            self.temp_dirs.append(temp_dir)
            
            # Get audio durations
            opening_duration = librosa.get_duration(filename=opening_audio_path)
            story_duration = librosa.get_duration(filename=story_audio_path)
            
            logger.info(f"Audio durations - Opening: {opening_duration:.2f}s, Story: {story_duration:.2f}s")
            
            # Create banner
            banner_path = os.path.join(temp_dir, 'banner.png')
            self.create_reddit_banner_simple(
                title=story_data.get('title', 'Reddit Story'),
                author=story_data.get('author', 'Anonymous'),
                output_path=banner_path
            )
            self.temp_files.append(banner_path)
            
            # Get word timestamps for story
            story_text = story_data.get('story', '')
            if '[BREAK]' in story_text:
                story_text = story_text.split('[BREAK]')[0].strip()
            
            word_timestamps = self.get_word_timestamps_simple(story_audio_path, story_text)
            logger.info(f"Generated {len(word_timestamps)} word timestamps")
            
            # Generate video using FFmpeg
            self.generate_video_ffmpeg(
                background_path=background_path,
                banner_path=banner_path,
                opening_audio=opening_audio_path,
                story_audio=story_audio_path,
                output_path=output_path,
                opening_duration=opening_duration,
                story_duration=story_duration,
                word_timestamps=word_timestamps
            )
            
            logger.info("Efficient video generation completed successfully")
            
        except Exception as e:
            logger.error(f"Error in efficient video generation: {e}")
            raise
        finally:
            self.cleanup()

def main():
    try:
        if len(sys.argv) != 8:
            raise ValueError(f"Expected 7 arguments, got {len(sys.argv)-1}")
        
        video_id = sys.argv[1]
        opening_audio = sys.argv[2]
        story_audio = sys.argv[3]
        background = sys.argv[4]
        banner = sys.argv[5]  # Not used in this implementation
        output = sys.argv[6]
        story_data_json = sys.argv[7]
        
        # Parse story data
        story_data = json.loads(story_data_json)
        
        # Create generator
        generator = EfficientVideoGenerator(video_id)
        
        # Generate video
        generator.generate(
            opening_audio_path=opening_audio,
            story_audio_path=story_audio,
            background_path=background,
            output_path=output,
            story_data=story_data
        )
        
        logger.info("Video generation completed successfully")
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 