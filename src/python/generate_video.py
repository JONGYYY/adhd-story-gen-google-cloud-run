import sys
import json
import logging
import os
from moviepy.editor import *
import numpy as np
import whisper
import tempfile
import shutil
import cv2
from PIL import Image, ImageDraw
from pathlib import Path
import subprocess
import librosa
import soundfile as sf
from typing import List, Dict

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_word_timestamps(audio_path):
    """Get word-level timestamps using OpenAI Whisper."""
    try:
        # Load the whisper model
        model = whisper.load_model("base")
        
        # Transcribe with word timestamps
        result = model.transcribe(audio_path, word_timestamps=True)
        
        # Extract word-level timestamps
        words = []
        for segment in result["segments"]:
            if "words" in segment:
                for word in segment["words"]:
                    words.append({
                        "text": word["word"].strip(),
                        "start": word["start"],
                        "end": word["end"]
                    })
        
        return words
    except Exception as e:
        logger.error(f"Failed to get word timestamps: {e}")
        return []

def get_temp_dir():
    """Get the appropriate temporary directory."""
    if os.environ.get('VERCEL'):
        # Use /tmp on Vercel
        temp_dir = '/tmp'
        os.makedirs(temp_dir, exist_ok=True)
        return temp_dir
    else:
        # Use system temp directory locally
        return tempfile.gettempdir()

def validate_story_data(story_data):
    """Validate the story data structure."""
    try:
        # Check if story_data is a valid dictionary
        if not isinstance(story_data, dict):
            raise ValueError(f"Invalid story data type: {type(story_data)}, expected dict")

        # Check required fields
        required_fields = ['title', 'story', 'subreddit', 'author']
        for field in required_fields:
            if field not in story_data:
                raise ValueError(f"Missing required field: {field}")
            if not isinstance(story_data[field], str):
                raise ValueError(f"Invalid type for {field}: {type(story_data[field])}, expected string")
            if not story_data[field].strip():
                raise ValueError(f"Empty required field: {field}")
    
        # Ensure story text is not empty after processing
        story_text = story_data['story'].strip()
        if story_text.startswith('[BREAK]'):
            story_text = story_text[len('[BREAK]'):].strip()
        if '[BREAK]' in story_text:
            story_text = story_text.split('[BREAK]')[0].strip()
        if not story_text:
            raise ValueError("Story text is empty after processing [BREAK] tags")
    
        # Ensure title is not too long
        if len(story_data['title']) > 300:
            raise ValueError("Title is too long (max 300 characters)")

        # Ensure story has reasonable length
        if len(story_text) > 5000:
            raise ValueError("Story is too long (max 5000 characters)")

        return True
    except Exception as e:
        logger.error(f"Story data validation failed: {e}")
        logger.error(f"Story data: {json.dumps(story_data, indent=2)}")
        raise

def validate_files(*file_paths):
    """Validate that all required files exist and are accessible."""
    for file_path in file_paths:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        if not os.access(file_path, os.R_OK):
            raise PermissionError(f"Cannot read file: {file_path}")

def create_rounded_rectangle_mask(width, height, radius):
    """Create a rounded rectangle mask using OpenCV."""
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Draw filled rectangle with white (255)
    cv2.rectangle(mask, (radius, 0), (width-radius, height), 255, -1)
    cv2.rectangle(mask, (0, radius), (width, height-radius), 255, -1)
    
    # Draw filled circles at corners with white (255)
    cv2.circle(mask, (radius, radius), radius, 255, -1)
    cv2.circle(mask, (width-radius, radius), radius, 255, -1)
    cv2.circle(mask, (radius, height-radius), radius, 255, -1)
    cv2.circle(mask, (width-radius, height-radius), radius, 255, -1)
    
    # Convert to float32 and normalize to 0-1 range for proper masking
    mask = mask.astype(np.float32) / 255.0
    
    return mask

def create_profile_image(size):
    """Create a circular profile image with Reddit logo."""
    # Create a circular mask
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    
    # Load and resize the Reddit logo
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'reddit-logo.png')
    try:
        img = Image.open(logo_path)
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    except Exception as e:
        logger.warning(f"Failed to load Reddit logo: {e}. Using fallback.")
        # Create orange background as fallback
        img = Image.new('RGB', (size, size), (255, 69, 0))  # Reddit orange
        draw = ImageDraw.Draw(img)
        
        # Draw the head (white circle)
        head_size = int(size * 0.7)
        head_pos = ((size - head_size) // 2, (size - head_size) // 2)
        draw.ellipse(
            (head_pos[0], head_pos[1], head_pos[0] + head_size, head_pos[1] + head_size),
            fill='white'
        )
    
    # Apply circular mask
    img.putalpha(mask)
    
    return np.array(img)

def create_reddit_banner(text, username="RoseyReddit", size=(1080, 1920)):
    """Create a Reddit-style banner with text."""
    try:
        # Calculate banner dimensions
        banner_width = int(size[0] * 0.65)  # 65% of screen width
        banner_height = int(banner_width * 0.25)  # 25% of width
        
        # Define font sizes upfront
        title_fontsize = 36
        
        # Create white frame for contrast (slightly larger)
        frame_width = banner_width + 4
        frame_height = banner_height + 4
        frame = ColorClip(
            size=(frame_width, frame_height),
            color=[255, 255, 255]  # White frame
        )
        
        # Create white banner background
        banner_bg = ColorClip(
            size=(banner_width, banner_height),
            color=[255, 255, 255]  # Pure white
        )
        
        # Create rounded rectangle masks
        frame_mask = create_rounded_rectangle_mask(frame_width, frame_height, radius=32)
        bg_mask = create_rounded_rectangle_mask(banner_width, banner_height, radius=30)
        
        # Apply masks
        frame = frame.set_mask(ImageClip(frame_mask, ismask=True))
        banner_bg = banner_bg.set_mask(ImageClip(bg_mask, ismask=True))
        
        # Create profile image (smaller and in top left)
        profile_size = int(banner_height * 0.3)
        profile_margin = 15
        profile_img = ImageClip(create_profile_image(profile_size))
        profile_img = profile_img.set_position((profile_margin, profile_margin))
        
        # Create username next to profile image with same style as title
        username_text = "@anonymous"
        username_clip = TextClip(
            username_text,
            fontsize=title_fontsize,
            color='black',
            font='Arial-Bold',
            size=(banner_width - profile_size - 60, None),
            method='caption',
            align='west'
        ).set_position((profile_size + profile_margin * 2, profile_margin + (profile_size - title_fontsize) / 2))
        
        # Create main text (title) - now under profile and username
        text_clip = TextClip(
            text,
            fontsize=title_fontsize,
            color='black',
            font='Arial-Bold',
            size=(banner_width - profile_margin * 2, None),
            method='caption',
            align='west'
        ).set_position((profile_margin, profile_margin + profile_size + 10))
        
        # Create social metrics at the bottom
        metrics_y = banner_height - 25
        likes = TextClip(
            "♡ 99+",
            fontsize=18,
            color='#666666',
            font='Arial',
            method='label'
        ).set_position((profile_margin, metrics_y))
        
        comments = TextClip(
            "💬 99+",
            fontsize=18,
            color='#666666',
            font='Arial',
            method='label'
        ).set_position((profile_margin + 65, metrics_y))
        
        # First create the banner with white background and content
        banner_content = CompositeVideoClip(
            [
                banner_bg,
                profile_img,
                username_clip,
                text_clip,
                likes,
                comments
            ],
            size=(banner_width, banner_height)
        )
        
        # Then create the final banner with white frame
        banner = CompositeVideoClip(
            [
                frame,
                banner_content.set_position((2, 2))
            ],
            size=(frame_width, frame_height)
        )
        
        # Center the banner on the video
        banner = banner.set_position(('center', 'center'))
        
        return banner
    except Exception as e:
        logger.error(f"Failed to create Reddit banner: {e}")
        raise

def create_caption(text):
    """Create a caption with proper styling."""
    try:
        # Transform text to uppercase
        text = text.upper()
        
        # Create text clip with proper styling
        caption = TextClip(
            text,
            fontsize=80,
            color='white',
            font='Arial-Black',
            stroke_color='black',
            stroke_width=5,
            method='caption',
            align='center',
            size=(1080, None)
        )
    
        # Position at the center of the frame
        def get_position(t):
            return ('center', 'center')
        
        caption = caption.set_position(get_position)
        return caption
    except Exception as e:
        logger.error(f"Failed to create caption: {e}")
        raise

def normalize_audio(audio_clip):
    """Normalize audio to ensure consistent volume levels."""
    try:
        audio_array = audio_clip.to_soundarray()
        if len(audio_array.shape) > 1:
            audio_array = np.mean(audio_array, axis=1)
        rms = np.sqrt(np.mean(np.square(audio_array)))
        if rms > 0:
            target_level = 0.707
            gain = target_level / rms
            return audio_clip.volumex(gain)
        return audio_clip
    except Exception as e:
        logger.warning(f"Failed to normalize audio: {e}")
        return audio_clip

def process_words_into_phrases(words):
    """Process words into single-word phrases for ADHD-style quick cuts."""
    if not words:
        raise ValueError("No words provided for processing")
        
    segments = []
    for i, word in enumerate(words):
        word_text = word["text"].strip()
        duration = word["end"] - word["start"]
        start_time = word["start"]
        if i < len(words) - 1:
            next_word_start = words[i + 1]["start"]
            end_time = min(start_time + duration, next_word_start)
        else:
            end_time = start_time + duration
        segments.append({"text": word_text, "startTime": start_time, "endTime": end_time})
    return segments

def convert_audio_to_wav(audio_path):
    try:
        temp_dir = get_temp_dir()
        wav_path = os.path.join(temp_dir, 'temp.wav')
        audio = AudioFileClip(audio_path)
        audio.write_audiofile(wav_path, fps=16000, nbytes=2, codec='pcm_s16le')
        audio.close()
        return wav_path, wav_path
    except Exception as e:
        logger.error(f"Failed to convert audio to WAV: {e}")
        raise

def main(video_id, opening_audio_path, story_audio_path, background_path, banner_path, output_path, story_json):
    temp_dirs = []
    temp_files = []
    try:
        logger.info("Starting video generation...")
        temp_dir = get_temp_dir()
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Using temp directory: {temp_dir}")
        story_data = json.loads(story_json)
        validate_story_data(story_data)
        validate_files(opening_audio_path, story_audio_path, background_path, banner_path)
        opening_audio = AudioFileClip(opening_audio_path)
        story_audio = AudioFileClip(story_audio_path)
        opening_audio = normalize_audio(opening_audio)
        story_audio = normalize_audio(story_audio)
        background = VideoFileClip(background_path)
        target_width = 1080
        target_height = 1920
        background = background.resize(height=target_height)
        background = background.crop(x1=(background.w - target_width) // 2, width=target_width)
        opening_background = background.subclip(0, opening_audio.duration)
        if os.path.exists(banner_path):
            logger.info(f"✅ USING CUSTOM BANNER: {banner_path}")
            from PIL import Image as PILImage
            banner_img = PILImage.open(banner_path)
            reddit_banner = ImageClip(banner_path, duration=opening_audio.duration)
            banner_width = int(target_width * 0.9)
            banner_height = int(banner_width * banner_img.height / banner_img.width)
            max_banner_height = int(target_height * 0.3)
            if banner_height > max_banner_height:
                banner_height = max_banner_height
                banner_width = int(banner_height * banner_img.width / banner_img.height)
            reddit_banner = reddit_banner.resize((banner_width, banner_height))
            reddit_banner = reddit_banner.set_position('center')
        else:
            logger.warning(f"❌ CUSTOM BANNER NOT FOUND: {banner_path}")
            reddit_banner = ImageClip(np.zeros((100, 100, 3), dtype=np.uint8), duration=opening_audio.duration)
        opening_segment = CompositeVideoClip(
            [opening_background, reddit_banner],
            size=(target_width, target_height)
        ).set_audio(opening_audio)
        story_wav_path, temp_wav_file = convert_audio_to_wav(story_audio_path)
        temp_files.append(temp_wav_file)
        try:
            words = get_word_timestamps(story_wav_path)
            if not words:
                raise ValueError("No words detected in the audio")
            segments = process_words_into_phrases(words)
            story_start = opening_audio.duration
            story_clips = [background.subclip(story_start, story_start + story_audio.duration)]
            for segment in segments:
                caption = TextClip(
                    segment["text"].upper(), fontsize=80, color='white', font='Arial-Black',
                    stroke_color='black', stroke_width=5, method='caption', align='center', size=(1080, None)
                )
                caption = caption.set_start(segment["startTime"]).set_end(segment["endTime"]).set_position(('center','center'))
                story_clips.append(caption)
            story_segment = CompositeVideoClip(
                story_clips,
                size=(target_width, target_height)
            ).set_audio(story_audio)
            final_video = concatenate_videoclips(
                [opening_segment, story_segment],
                method="compose"
            )
            final_video.write_videofile(
                output_path,
                fps=30,
                codec='libx264',
                audio_codec='aac',
                audio_bitrate='192k',
                bitrate='8000k',
                temp_audiofile='temp-audio.m4a',
                remove_temp=True,
                threads=4,
                preset='medium'
            )
        except Exception as e:
            logger.error(f"Failed to process audio: {str(e)}")
            story_segment = background.subclip(opening_audio.duration, opening_audio.duration + story_audio.duration).set_audio(story_audio)
            final_video = concatenate_videoclips([opening_segment, story_segment], method="compose")
            final_video.write_videofile(
                output_path,
                fps=30,
                codec='libx264',
                audio_codec='aac',
                audio_bitrate='192k',
                bitrate='8000k',
                temp_audiofile='temp-audio.m4a',
                remove_temp=True,
                threads=4,
                preset='medium'
            )
        background.close(); opening_audio.close(); story_audio.close()
        for temp_dir in temp_dirs:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except:
                pass
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
            except:
                pass
        logger.info("Video generation completed successfully")
    except Exception as e:
        logger.error(f"Error generating video: {str(e)}")
        for temp_dir in temp_dirs:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except:
                pass
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
            except:
                pass
        raise

if __name__ == "__main__":
    try:
        if len(sys.argv) != 8:
            raise ValueError(f"Expected 7 arguments, got {len(sys.argv)-1}")
        video_id = sys.argv[1]
        opening_audio = sys.argv[2]
        story_audio = sys.argv[3]
        background = sys.argv[4]
        banner = sys.argv[5]
        output = sys.argv[6]
        story_data = sys.argv[7]
        main(video_id, opening_audio, story_audio, background, banner, output, story_data)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1) 