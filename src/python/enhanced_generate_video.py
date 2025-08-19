#!/usr/bin/env python3
"""
Enhanced video generator with improved caption rendering and performance.
Designed to work with the new pluggable engine architecture.
"""

import sys
import json
import logging
import os
import tempfile
import shutil
from moviepy.editor import *
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EnhancedVideoGenerator:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.temp_files = []
        self.temp_dirs = []
        
    def cleanup(self):
        """Clean up temporary files and directories"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {temp_file}: {e}")
        
        for temp_dir in self.temp_dirs:
            try:
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp dir {temp_dir}: {e}")

    def report_progress(self, percent: int, stage: str = ""):
        """Report progress to the parent process"""
        print(f"PROGRESS {percent} {stage}", flush=True)

    def create_kinetic_caption(self, word_data: dict, video_size: tuple, style: dict = None) -> ImageClip:
        """Create a kinetic caption for a single word with bouncing animation"""
        if style is None:
            style = {
                'fontSize': 75,
                'fontFamily': 'Arial-Bold',
                'fill': '#FFFFFF',
                'stroke': '#000000',
                'strokeWidth': 4,
                'bouncePx': 8
            }
        
        word = word_data['word']
        duration = word_data['end'] - word_data['start']
        
        # Create text image with PIL for better quality
        font_size = style.get('fontSize', 75)
        font_family = style.get('fontFamily', 'Arial-Bold')
        
        # Try to load a good font
        font = None
        font_paths = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/Windows/Fonts/arialbd.ttf"
        ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    if font_path.endswith('.ttc'):
                        font = ImageFont.truetype(font_path, font_size, index=1)
                    else:
                        font = ImageFont.truetype(font_path, font_size)
                    break
                except Exception as e:
                    logger.warning(f"Failed to load font {font_path}: {e}")
        
        if font is None:
            font = ImageFont.load_default()
            logger.warning("Using default font")
        
        # Calculate text size
        bbox = font.getbbox(word)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Create image with padding for stroke
        padding = style.get('strokeWidth', 4) * 2 + 10
        img_width = text_width + padding * 2
        img_height = text_height + padding * 2
        
        # Create RGBA image
        img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw stroke (outline)
        stroke_width = style.get('strokeWidth', 4)
        stroke_color = style.get('stroke', '#000000')
        if stroke_width > 0:
            for adj_x in range(-stroke_width, stroke_width + 1):
                for adj_y in range(-stroke_width, stroke_width + 1):
                    if adj_x != 0 or adj_y != 0:
                        draw.text((padding + adj_x, padding + adj_y), word, 
                                font=font, fill=stroke_color)
        
        # Draw main text
        fill_color = style.get('fill', '#FFFFFF')
        draw.text((padding, padding), word, font=font, fill=fill_color)
        
        # Convert to numpy arrays: RGB + alpha mask
        rgba_array = np.array(img)
        rgb_array = rgba_array[:, :, :3]
        alpha_mask = rgba_array[:, :, 3].astype(np.float32) / 255.0
        
        # Create ImageClip with mask and apply simple bounce scale
        base_clip = ImageClip(rgb_array).set_duration(duration)
        base_clip = base_clip.set_mask(ImageClip(alpha_mask, ismask=True).set_duration(duration))
        
        bounce_duration = 0.2
        def scale_at_time(t):
            p = max(0.0, min(1.0, t / bounce_duration))
            return 1.0 + 0.08 * (1.0 - p)
        animated_clip = base_clip.resize(scale_at_time)
        
        # Position at vertical center of video
        video_width, video_height = video_size
        caption_x = (video_width - img_width) // 2
        caption_y = (video_height - img_height) // 2
        
        return animated_clip.set_position((caption_x, caption_y))

    def create_word_captions(self, alignment_data: list, video_size: tuple, style: dict = None) -> list:
        """Create caption clips for all words with proper timing"""
        logger.info(f"Creating captions for {len(alignment_data)} words")
        
        caption_clips = []
        
        for word_data in alignment_data:
            try:
                # Create caption for this word
                caption_clip = self.create_kinetic_caption(word_data, video_size, style)
                
                # Set timing
                caption_clip = caption_clip.set_start(word_data['start']).set_duration(
                    word_data['end'] - word_data['start']
                )
                
                caption_clips.append(caption_clip)
                
            except Exception as e:
                logger.error(f"Failed to create caption for word '{word_data.get('word', 'unknown')}': {e}")
                continue
        
        logger.info(f"Successfully created {len(caption_clips)} caption clips")
        return caption_clips

    def generate_video(self, audio_path: str, background_path: str, banner_path: str, 
                      output_path: str, story_data: dict, alignment_path: str):
        """Generate the final video with all components"""
        try:
            logger.info("Starting enhanced video generation...")
            self.report_progress(10, "Loading assets")
            
            # Load audio
            audio_clip = AudioFileClip(audio_path)
            total_duration = audio_clip.duration
            logger.info(f"Audio duration: {total_duration:.2f}s")
            
            # Load and prepare background
            background_clip = VideoFileClip(background_path)
            
            # Target dimensions
            target_width, target_height = 1080, 1920
            
            # Resize background to fill screen
            background_clip = background_clip.resize(height=target_height)
            if background_clip.w < target_width:
                background_clip = background_clip.resize(width=target_width)
            
            # Center crop to exact dimensions
            background_clip = background_clip.crop(
                x1=(background_clip.w - target_width) // 2,
                width=target_width
            )
            
            # Loop background to match audio duration
            if background_clip.duration < total_duration:
                n_loops = int(np.ceil(total_duration / background_clip.duration))
                background_clip = concatenate_videoclips([background_clip] * n_loops)
            
            background_clip = background_clip.subclip(0, total_duration)
            self.report_progress(30, "Background prepared")
            
            # Load banner
            banner_clip = None
            if os.path.exists(banner_path):
                logger.info(f"Loading custom banner: {banner_path}")
                # Load banner with transparency handling
                from PIL import Image as PILImage
                banner_img = PILImage.open(banner_path)
                logger.info(f"Banner loaded - size: {banner_img.size}, mode: {banner_img.mode}")
                
                # Ensure the image has transparency
                if banner_img.mode != 'RGBA':
                    banner_img = banner_img.convert('RGBA')
                    logger.info("Converted banner to RGBA for transparency")
                
                # Split into RGB + mask to avoid 4-channel broadcasting
                banner_rgba = np.array(banner_img)
                banner_rgb = banner_rgba[:, :, :3]
                banner_alpha = banner_rgba[:, :, 3].astype(np.float32) / 255.0
                
                # Limit banner to the opening seconds only
                banner_duration = min(3.0, max(1.5, total_duration * 0.35))
                banner_clip = ImageClip(banner_rgb, duration=banner_duration)
                banner_clip = banner_clip.set_mask(ImageClip(banner_alpha, ismask=True).set_duration(banner_duration))
                
                # Scale banner appropriately
                banner_width = int(target_width * 0.9)  # 90% of video width
                banner_height = int(banner_width * banner_img.height / banner_img.width)
                
                # Ensure banner doesn't exceed reasonable height
                max_banner_height = int(target_height * 0.3)
                if banner_height > max_banner_height:
                    banner_height = max_banner_height
                    banner_width = int(banner_height * banner_img.width / banner_img.height)
                
                banner_clip = banner_clip.resize((banner_width, banner_height))
                
                # Center the banner vertically
                banner_y = (target_height - banner_height) // 2
                banner_clip = banner_clip.set_position(('center', banner_y))
                
                logger.info(f"Banner configured: {banner_width}x{banner_height} at y={banner_y}")
            
            self.report_progress(50, "Banner prepared")
            
            # Load word alignment and create captions
            caption_clips = []
            if os.path.exists(alignment_path):
                logger.info(f"Loading word alignment: {alignment_path}")
                with open(alignment_path, 'r') as f:
                    alignment_data = json.load(f)
                
                # Create caption style
                caption_style = {
                    'fontSize': 75,
                    'fontFamily': 'Arial-Bold',
                    'fill': '#FFFFFF',
                    'stroke': '#000000',
                    'strokeWidth': 4,
                    'bouncePx': 8
                }
                
                caption_clips = self.create_word_captions(
                    alignment_data, 
                    (target_width, target_height), 
                    caption_style
                )
                
                logger.info(f"Created {len(caption_clips)} caption clips")
            
            self.report_progress(70, "Captions prepared")
            
            # Compose final video
            logger.info("Compositing final video...")
            video_clips = [background_clip]
            
            if banner_clip:
                video_clips.append(banner_clip)
            
            video_clips.extend(caption_clips)
            
            final_video = CompositeVideoClip(video_clips, size=(target_width, target_height))
            final_video = final_video.set_audio(audio_clip)
            
            self.report_progress(80, "Compositing")
            
            # Write final video with optimized settings
            logger.info(f"Writing final video to: {output_path}")
            final_video.write_videofile(
                output_path,
                fps=30,
                codec='libx264',
                audio_codec='aac',
                audio_bitrate='192k',
                bitrate='6000k',  # 6 Mbps for clean text
                preset='medium',  # Balance of quality and speed
                ffmpeg_params=[
                    '-pix_fmt', 'yuv420p',  # Ensure compatibility
                    '-movflags', '+faststart',  # Web optimization
                    '-profile:v', 'high',
                    '-level', '4.1'
                ],
                temp_audiofile='temp-audio.m4a',
                remove_temp=True,
                threads=4,
                verbose=False,
                logger=None  # Suppress MoviePy logs
            )
            
            self.report_progress(100, "Complete")
            
            # Cleanup
            background_clip.close()
            audio_clip.close()
            if banner_clip:
                banner_clip.close()
            for clip in caption_clips:
                clip.close()
            final_video.close()
            
            logger.info("✅ Enhanced video generation completed successfully")
            
        except Exception as e:
            logger.error(f"❌ Enhanced video generation failed: {e}")
            raise

def main():
    if len(sys.argv) != 8:
        print("Usage: enhanced_generate_video.py <job_id> <audio_path> <background_path> <banner_path> <output_path> <story_data_json> <alignment_path>")
        sys.exit(1)
    
    job_id = sys.argv[1]
    audio_path = sys.argv[2]
    background_path = sys.argv[3]
    banner_path = sys.argv[4]
    output_path = sys.argv[5]
    story_data_json = sys.argv[6]
    alignment_path = sys.argv[7]
    
    try:
        story_data = json.loads(story_data_json)
        
        generator = EnhancedVideoGenerator(job_id)
        generator.generate_video(
            audio_path=audio_path,
            background_path=background_path,
            banner_path=banner_path,
            output_path=output_path,
            story_data=story_data,
            alignment_path=alignment_path
        )
        
        generator.cleanup()
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 