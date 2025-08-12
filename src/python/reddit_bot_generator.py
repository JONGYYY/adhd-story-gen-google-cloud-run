#!/usr/bin/env python3
"""
Reddit Bot Video Generator - FullyAutomatedRedditVideoMakerBot Style
Based on https://github.com/raga70/FullyAutomatedRedditVideoMakerBot
Features:
- Dyslexic-style one-word captions (attention-grabbing, CapCut-style)
- Efficient FFmpeg processing with optimized settings
- Professional Reddit banners
- Simple word timing approach
- Fast, high-quality video generation
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

class FullyAutomatedRedditVideoMakerBot:
    """
    Video generator implementing the FullyAutomatedRedditVideoMakerBot approach
    Key features:
    1. Dyslexic-style one-word captions (like CapCut subtitles)
    2. Efficient FFmpeg processing
    3. Professional Reddit-style banners
    4. Simple word timing without complex ASR
    5. Optimized for viral content creation
    """
    
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

    def create_professional_reddit_banner(self, title: str, subreddit: str, output_path: str, 
                                        author: str = "Anonymous", width: int = 1080, height: int = 400):
        """
        Create a professional Reddit-style banner like FullyAutomatedRedditVideoMakerBot
        Features:
        - Reddit dark theme colors
        - Proper upvote arrow
        - Professional typography
        - Realistic Reddit layout
        """
        try:
            logger.info(f"Creating professional Reddit banner: {output_path}")
            
            # Reddit color scheme
            REDDIT_DARK_BG = '#0b1426'  # Dark blue background
            REDDIT_CARD_BG = '#1a1a1b'  # Card background
            REDDIT_ORANGE = '#ff4500'   # Reddit orange
            REDDIT_TEXT = '#d7dadc'     # Light text
            REDDIT_GRAY = '#818384'     # Gray text
            
            # Create image with Reddit-style background
            img = Image.new('RGB', (width, height), REDDIT_DARK_BG)
            draw = ImageDraw.Draw(img)
            
            # Create card background
            card_margin = 20
            card_rect = [card_margin, card_margin, width - card_margin, height - card_margin]
            draw.rounded_rectangle(card_rect, radius=12, fill=REDDIT_CARD_BG)
            
            # Try to load fonts with fallbacks
            font_large = None
            font_medium = None
            font_small = None
            
            font_paths = [
                '/System/Library/Fonts/Helvetica.ttc',  # macOS
                '/System/Library/Fonts/Arial.ttf',      # macOS fallback
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',  # Linux
                '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',  # Linux
                '/Windows/Fonts/arial.ttf'  # Windows
            ]
            
            for font_path in font_paths:
                try:
                    if os.path.exists(font_path):
                        font_large = ImageFont.truetype(font_path, 42)
                        font_medium = ImageFont.truetype(font_path, 28)
                        font_small = ImageFont.truetype(font_path, 20)
                        logger.info(f"Using font: {font_path}")
                        break
                except Exception as e:
                    logger.warning(f"Failed to load font {font_path}: {e}")
                    continue
            
            # Fallback to default font
            if not font_large:
                logger.info("Using default font")
                font_large = ImageFont.load_default()
                font_medium = ImageFont.load_default()
                font_small = ImageFont.load_default()
            
            # Draw upvote arrow (professional Reddit style)
            arrow_x = 60
            arrow_y = 80
            arrow_size = 24
            
            # Upvote arrow shape
            arrow_points = [
                (arrow_x, arrow_y + arrow_size),      # Bottom left
                (arrow_x + arrow_size//2, arrow_y),   # Top
                (arrow_x + arrow_size, arrow_y + arrow_size), # Bottom right
                (arrow_x + arrow_size*0.7, arrow_y + arrow_size), # Inner right
                (arrow_x + arrow_size//2, arrow_y + arrow_size*0.4), # Inner top
                (arrow_x + arrow_size*0.3, arrow_y + arrow_size)  # Inner left
            ]
            draw.polygon(arrow_points, fill=REDDIT_ORANGE)
            
            # Vote count
            vote_count = f"{np.random.randint(500, 5000)}"
            draw.text((arrow_x + 2, arrow_y + arrow_size + 10), vote_count, 
                     fill=REDDIT_GRAY, font=font_small, anchor="mm")
            
            # Subreddit name
            subreddit_x = 120
            subreddit_y = 60
            draw.text((subreddit_x, subreddit_y), subreddit, fill=REDDIT_TEXT, font=font_medium)
            
            # Posted by
            posted_by_y = subreddit_y + 35
            draw.text((subreddit_x, posted_by_y), f"Posted by u/{author}", 
                     fill=REDDIT_GRAY, font=font_small)
            
            # Title with word wrapping (professional approach)
            title_y = posted_by_y + 40
            title_lines = self.wrap_text_professional(title, font_large, width - subreddit_x - 40)
            
            for i, line in enumerate(title_lines[:3]):  # Max 3 lines
                line_y = title_y + (i * 50)
                draw.text((subreddit_x, line_y), line, fill=REDDIT_TEXT, font=font_large)
            
            # Add engagement indicators (comments, awards)
            engagement_y = height - 80
            
            # Comments icon (simple)
            comments_x = subreddit_x
            draw.text((comments_x, engagement_y), f"💬 {np.random.randint(50, 500)} comments", 
                     fill=REDDIT_GRAY, font=font_small)
            
            # Awards
            awards_x = comments_x + 200
            award_emojis = ['🥇', '🥈', '🏆']
            for i, emoji in enumerate(award_emojis):
                if np.random.random() > 0.5:  # Random awards
                    draw.text((awards_x + i * 30, engagement_y), emoji, font=font_small)
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save banner
            img.save(output_path, 'PNG', quality=95)
            logger.info(f"Professional Reddit banner saved successfully: {output_path}")
            
            # Verify file was created
            if not os.path.exists(output_path):
                raise RuntimeError(f"Banner file was not created: {output_path}")
                
        except Exception as e:
            logger.error(f"Failed to create professional banner: {e}")
            self._create_fallback_banner(title, subreddit, output_path, width, height)

    def _create_fallback_banner(self, title: str, subreddit: str, output_path: str, width: int, height: int):
        """Create a simple fallback banner if the professional one fails"""
        try:
            logger.info("Creating simple fallback banner...")
            img = Image.new('RGB', (width, height), '#FF4500')  # Reddit orange
            draw = ImageDraw.Draw(img)
            
            # Simple layout
            font = ImageFont.load_default()
            
            # Title (wrapped)
            wrapped_title = title[:60] + "..." if len(title) > 60 else title
            
            # Calculate text position
            bbox = draw.textbbox((0, 0), wrapped_title, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (width - text_width) // 2
            y = (height - text_height) // 2
            
            # Draw text with outline
            for adj in range(-2, 3):
                for adj2 in range(-2, 3):
                    if adj != 0 or adj2 != 0:
                        draw.text((x + adj, y + adj2), wrapped_title, fill='black', font=font)
            
            draw.text((x, y), wrapped_title, fill='white', font=font)
            
            # Add subreddit
            draw.text((20, 20), subreddit, fill='white', font=font)
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            img.save(output_path, 'PNG')
            logger.info(f"Fallback banner created: {output_path}")
            
        except Exception as fallback_error:
            logger.error(f"Even fallback banner creation failed: {fallback_error}")
            raise RuntimeError(f"Complete banner creation failure: {fallback_error}")

    def wrap_text_professional(self, text: str, font, max_width: int) -> List[str]:
        """Professional text wrapping for Reddit titles"""
        words = text.split()
        lines = []
        current_line = ""
        
        for word in words:
            test_line = current_line + (" " if current_line else "") + word
            bbox = font.getbbox(test_line)
            if bbox[2] - bbox[0] <= max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        return lines

    def get_dyslexic_word_timestamps(self, audio_path: str, text: str) -> List[Dict]:
        """
        Generate word timestamps for dyslexic-style captions
        FullyAutomatedRedditVideoMakerBot approach:
        - Simple timing based on word characteristics
        - No complex ASR needed
        - Optimized for viral content attention span
        """
        try:
            # Get audio duration
            duration, sr = librosa.load(audio_path, sr=None)
            total_duration = len(duration) / sr
            
            # Split text into words
            words = text.split()
            if not words:
                return []
                
            # Calculate word durations (FullyAutomatedRedditVideoMakerBot style)
            word_timestamps = []
            cumulative_time = 0
            
            # Base speaking rate optimized for viral content
            base_wps = 2.2  # words per second (optimized for engagement)
            
            for i, word in enumerate(words):
                # Adjust duration based on word characteristics (key feature)
                base_duration = 1.0 / base_wps
                
                # Longer words get more time (attention retention)
                length_factor = max(0.8, len(word) / 5.0)
                
                # Punctuation adds dramatic pause (viral content technique)
                punct_factor = 1.0
                if any(p in word for p in ['.', '!', '?']):
                    punct_factor = 1.8  # Longer pause for drama
                elif any(p in word for p in [',', ';', ':']):
                    punct_factor = 1.3
                elif word.isupper():
                    punct_factor = 1.4  # Emphasis for caps
                
                # Calculate final duration
                word_duration = base_duration * length_factor * punct_factor
                word_duration = max(word_duration, 0.4)  # Minimum for readability
                word_duration = min(word_duration, 2.0)  # Maximum to maintain pace
                
                start_time = cumulative_time
                end_time = cumulative_time + word_duration
                
                # Determine if word should have emphasis (key dyslexic feature)
                is_emphasis = (
                    word.isupper() or 
                    any(p in word for p in ['!', '?']) or
                    len(word) <= 3 or  # Short words get emphasis
                    word.lower() in ['wow', 'omg', 'wtf', 'lol', 'damn', 'shit', 'fuck', 'amazing', 'crazy', 'insane']
                )
                
                word_timestamps.append({
                    'text': word.strip('.,!?;:'),
                    'start': start_time,
                    'end': end_time,
                    'emphasis': is_emphasis,
                    'length': len(word)
                })
                
                cumulative_time = end_time
                
            # Scale all timestamps to fit actual duration
            if cumulative_time > 0 and cumulative_time != total_duration:
                scale_factor = total_duration / cumulative_time
                for word in word_timestamps:
                    word['start'] *= scale_factor
                    word['end'] *= scale_factor
                
            logger.info(f"Generated {len(word_timestamps)} dyslexic-style word timestamps")
            return word_timestamps
            
        except Exception as e:
            logger.error(f"Failed to get word timestamps: {e}")
            return []

    def create_dyslexic_captions_ffmpeg(self, word_timestamps: List[Dict], 
                                      opening_duration: float) -> str:
        """
        Create dyslexic-style captions using FFmpeg (FullyAutomatedRedditVideoMakerBot approach)
        Features:
        - One word at a time (dyslexic-friendly)
        - Large, bold text
        - Bouncing/scaling animations
        - High contrast colors
        - Professional drop shadows
        """
        if not word_timestamps:
            return ""
            
        filter_parts = []
        
        for i, word in enumerate(word_timestamps):
            start_time = opening_duration + word['start']
            end_time = opening_duration + word['end']
            duration = end_time - start_time
            
            # Animation timing (key feature for engagement)
            fade_in_duration = min(0.2, duration * 0.25)
            fade_out_duration = min(0.2, duration * 0.25)
            
            # Font size based on emphasis and word length (dyslexic optimization)
            if word['emphasis']:
                font_size = 120  # Extra large for emphasis
            elif word['length'] <= 4:
                font_size = 100  # Large for short words
            else:
                font_size = 85   # Standard size
            
            # Clean text for FFmpeg (important for stability)
            clean_text = word['text'].replace("'", "\\'").replace('"', '\\"').replace(':', '\\:').replace('%', '\\%')
            
            # Dyslexic-style caption with professional styling
            # Key features: large text, high contrast, drop shadow, fade animations
            drawtext_filter = (
                f"drawtext=text='{clean_text.upper()}'"
                f":fontsize={font_size}"
                f":fontcolor=white"
                f":x=(w-text_w)/2"
                f":y=h-350"  # Position for mobile viewing
                f":enable='between(t,{start_time:.3f},{end_time:.3f})'"
                f":alpha='if(between(t,{start_time:.3f},{start_time + fade_in_duration:.3f}),(t-{start_time:.3f})/{fade_in_duration:.3f},if(between(t,{end_time - fade_out_duration:.3f},{end_time:.3f}),1-(t-{end_time - fade_out_duration:.3f})/{fade_out_duration:.3f},1))'"
                f":box=1:boxcolor=black@0.8:boxborderw=12"
                f":shadowx=4:shadowy=4:shadowcolor=black@0.9"
            )
            
            filter_parts.append(drawtext_filter)
        
        return ','.join(filter_parts)

    def generate_video_ffmpeg_efficient(self, background_path: str, banner_path: str,
                                      opening_audio: str, story_audio: str,
                                      output_path: str, opening_duration: float,
                                      story_duration: float, word_timestamps: List[Dict]):
        """
        Generate video using efficient FFmpeg approach (FullyAutomatedRedditVideoMakerBot style)
        Optimizations:
        - Fast preset for quick generation
        - Optimized quality settings
        - Efficient filter complex
        - Mobile-optimized output
        """
        try:
            logger.info("Starting efficient FFmpeg video generation...")
            
            # Verify input files exist
            for file_path in [background_path, banner_path, opening_audio, story_audio]:
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"Input file not found: {file_path}")
            
            # Build efficient FFmpeg command
            cmd = [
                'ffmpeg', '-y',  # Overwrite output
                '-i', background_path,  # Background video
                '-i', banner_path,      # Banner image
                '-i', opening_audio,    # Opening audio
                '-i', story_audio,      # Story audio
            ]
            
            # Create efficient filter complex (FullyAutomatedRedditVideoMakerBot style)
            filter_complex = (
                # Scale and crop background to 9:16 mobile format
                f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
                f"eq=brightness=0.1:contrast=1.15:saturation=1.05[bg];"
                
                # Scale banner and overlay during opening
                f"[1:v]scale=1000:-1[banner_scaled];"
                f"[bg][banner_scaled]overlay=40:120:enable='between(t,0,{opening_duration})'[with_banner]"
            )
            
            # Add dyslexic captions (key feature)
            if word_timestamps:
                captions_filter = self.create_dyslexic_captions_ffmpeg(word_timestamps, opening_duration)
                if captions_filter:
                    filter_complex += f";[with_banner]{captions_filter}[with_captions]"
                    video_output = "[with_captions]"
                else:
                    video_output = "[with_banner]"
            else:
                video_output = "[with_banner]"
            
            # Audio mixing with professional fades
            filter_complex += (
                f";[2:a]volume=1.0,afade=t=in:st=0:d=0.1,afade=t=out:st={opening_duration-0.1}:d=0.1[opening_audio];"
                f"[3:a]volume=1.0,afade=t=in:st=0:d=0.1,afade=t=out:st={story_duration-0.1}:d=0.1[story_audio];"
                f"[opening_audio][story_audio]concat=n=2:v=0:a=1[final_audio]"
            )
            
            # Add FFmpeg parameters (optimized for efficiency and quality)
            cmd.extend([
                '-filter_complex', filter_complex,
                '-map', video_output,
                '-map', '[final_audio]',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'fast',      # Fast encoding (key optimization)
                '-crf', '23',           # High quality (viral content standard)
                '-profile:v', 'high',
                '-level', '4.1',
                '-pix_fmt', 'yuv420p',  # Compatibility
                '-r', '30',             # 30 FPS (efficient)
                '-b:a', '128k',         # Good audio quality
                '-ar', '44100',
                '-movflags', '+faststart',  # Web optimization
                '-t', str(opening_duration + story_duration + 1),  # Set duration
                output_path
            ])
            
            logger.info(f"Running FFmpeg with {len(word_timestamps)} dyslexic captions...")
            logger.info(f"Audio durations: Opening={opening_duration:.1f}s, Story={story_duration:.1f}s")
            
            # Execute FFmpeg
            process = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if process.returncode != 0:
                logger.error(f"FFmpeg failed with return code {process.returncode}")
                logger.error(f"FFmpeg stderr: {process.stderr}")
                logger.error(f"FFmpeg stdout: {process.stdout}")
                raise RuntimeError(f"FFmpeg failed: {process.stderr}")
            
            # Verify output file was created
            if not os.path.exists(output_path):
                raise RuntimeError(f"Output file was not created: {output_path}")
                
            file_size = os.path.getsize(output_path)
            logger.info(f"Efficient FFmpeg generation completed successfully!")
            logger.info(f"Output file: {output_path} ({file_size} bytes)")
            
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg process timed out")
            raise RuntimeError("Video generation timed out")
        except Exception as e:
            logger.error(f"Error in efficient FFmpeg generation: {e}")
            raise

    def generate(self, opening_audio_path: str, story_audio_path: str,
                background_path: str, output_path: str, story_data: Dict):
        """
        Main generation function implementing FullyAutomatedRedditVideoMakerBot approach
        """
        try:
            logger.info("Starting FullyAutomatedRedditVideoMakerBot-style generation...")
            
            # Create temp directory
            temp_dir = tempfile.mkdtemp(prefix=f'reddit_bot_{self.video_id}_')
            self.temp_dirs.append(temp_dir)
            
            # Get audio durations
            opening_duration = librosa.get_duration(filename=opening_audio_path)
            story_duration = librosa.get_duration(filename=story_audio_path)
            
            logger.info(f"Audio durations - Opening: {opening_duration:.2f}s, Story: {story_duration:.2f}s")
            
            # Create professional Reddit banner (key feature)
            banner_path = os.path.join(temp_dir, 'professional_reddit_banner.png')
            self.create_professional_reddit_banner(
                title=story_data.get('title', 'Reddit Story'),
                subreddit=story_data.get('subreddit', 'r/stories'),
                output_path=banner_path,
                author=story_data.get('author', 'Anonymous')
            )
            self.temp_files.append(banner_path)
            
            # Verify banner was created
            if not os.path.exists(banner_path):
                logger.error(f"Banner file was not created: {banner_path}")
                raise RuntimeError(f"Failed to create banner file: {banner_path}")
            
            logger.info(f"Professional banner created: {banner_path} ({os.path.getsize(banner_path)} bytes)")
            
            # Get dyslexic word timestamps for story (key feature)
            story_text = story_data.get('story', '')
            if '[BREAK]' in story_text:
                story_text = story_text.split('[BREAK]')[0].strip()
            
            word_timestamps = self.get_dyslexic_word_timestamps(story_audio_path, story_text)
            logger.info(f"Generated {len(word_timestamps)} dyslexic-style word timestamps")
            
            # Generate video using efficient FFmpeg (core feature)
            self.generate_video_ffmpeg_efficient(
                background_path=background_path,
                banner_path=banner_path,
                opening_audio=opening_audio_path,
                story_audio=story_audio_path,
                output_path=output_path,
                opening_duration=opening_duration,
                story_duration=story_duration,
                word_timestamps=word_timestamps
            )
            
            logger.info("FullyAutomatedRedditVideoMakerBot generation completed successfully!")
            
        except Exception as e:
            logger.error(f"Error in FullyAutomatedRedditVideoMakerBot generation: {e}")
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
        banner = sys.argv[5]  # Not used in this FullyAutomatedRedditVideoMakerBot implementation
        output = sys.argv[6]
        story_data_json = sys.argv[7]
        
        # Parse story data
        story_data = json.loads(story_data_json)
        
        # Create FullyAutomatedRedditVideoMakerBot generator
        generator = FullyAutomatedRedditVideoMakerBot(video_id)
        
        # Generate video using FullyAutomatedRedditVideoMakerBot approach
        generator.generate(
            opening_audio_path=opening_audio,
            story_audio_path=story_audio,
            background_path=background,
            output_path=output,
            story_data=story_data
        )
        
        logger.info("FullyAutomatedRedditVideoMakerBot generation completed successfully!")
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 