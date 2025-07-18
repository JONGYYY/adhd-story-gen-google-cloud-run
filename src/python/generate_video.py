import sys
import json
import logging
import os
from moviepy.editor import *
import numpy as np
from whisper_timestamps import get_word_timestamps
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
        if len(story_data['title']) > 300:  # Arbitrary limit to prevent extremely long titles
            raise ValueError("Title is too long (max 300 characters)")

        # Ensure story has reasonable length
        if len(story_text) > 5000:  # Arbitrary limit to prevent extremely long stories
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

def load_reddit_logo(size):
    """Load and process the Reddit logo image."""
    temp_dir = get_temp_dir()
    
    # Define the SVG data for the Reddit logo
    svg_data = '''
    <svg width="{size}" height="{size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#FF4500"/>
        <path d="M50 25 C40 25 30 35 30 45 C30 55 40 65 50 65 C60 65 70 55 70 45 C70 35 60 25 50 25" fill="white"/>
        <circle cx="35" cy="45" r="5" fill="#FF4500"/>
        <circle cx="65" cy="45" r="5" fill="#FF4500"/>
        <path d="M35 55 Q50 65 65 55" stroke="white" stroke-width="3" fill="none"/>
    </svg>
    '''.format(size=size)
    
    # Save SVG to a temporary file
    temp_svg = os.path.join(temp_dir, f'reddit_logo_{size}.svg')
    temp_png = os.path.join(temp_dir, f'reddit_logo_{size}.png')
    
    with open(temp_svg, 'w') as f:
        f.write(svg_data)
    
    # Convert SVG to PNG using ImageMagick
    os.system(f'convert {temp_svg} {temp_png}')
    
    # Load the PNG
    img = Image.open(temp_png)
    
    # Clean up temporary files
    try:
        os.remove(temp_svg)
        os.remove(temp_png)
    except:
        pass  # Ignore cleanup errors
    
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
        profile_size = int(banner_height * 0.3)  # 30% of banner height (reduced from 40%)
        profile_margin = 15
        profile_img = ImageClip(create_profile_image(profile_size))
        profile_img = profile_img.set_position((profile_margin, profile_margin))  # Position at top left
        
        # Create username next to profile image with same style as title
        username_text = "@anonymous"
        username_clip = TextClip(
            username_text,
            fontsize=title_fontsize,  # Same size as title
            color='black',
            font='Arial-Bold',  # Same font as title
            size=(banner_width - profile_size - 60, None),
            method='caption',
            align='west'
        ).set_position((profile_size + profile_margin * 2, profile_margin + (profile_size - title_fontsize) / 2))  # Center vertically with profile
        
        # Create main text (title) - now under profile and username
        text_clip = TextClip(
            text,
            fontsize=title_fontsize,
            color='black',
            font='Arial-Bold',
            size=(banner_width - profile_margin * 2, None),
            method='caption',
            align='west'
        ).set_position((profile_margin, profile_margin + profile_size + 10))  # Position under profile image
        
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
            fontsize=80,  # Keeping the large size
            color='white',
            font='Arial-Black',  # Using Arial Black for maximum thickness
            stroke_color='black',
            stroke_width=5,  # Reduced from 8 to 5 for a more subtle outline
            method='caption',
            align='center',
            size=(1080, None)
        )
    
        # Calculate position to center both horizontally and vertically
        def get_position(t):
            # Returns position tuple (x, y) that centers the caption
            return ('center', 'center')
        
        # Position at the center of the frame
        caption = caption.set_position(get_position)
        
        return caption
    except Exception as e:
        logger.error(f"Failed to create caption: {e}")
        raise

def normalize_audio(audio_clip):
    """Normalize audio to ensure consistent volume levels."""
    try:
        # Get the audio array and ensure it's a numpy array
        audio_array = audio_clip.to_soundarray()
        if len(audio_array.shape) > 1:
            # Convert stereo to mono by averaging channels
            audio_array = np.mean(audio_array, axis=1)
        
        # Calculate RMS value
        rms = np.sqrt(np.mean(np.square(audio_array)))
        if rms > 0:
            # Normalize to -3dB (approximately 0.707 amplitude)
            target_level = 0.707
            gain = target_level / rms
            return audio_clip.volumex(gain)
        return audio_clip
    except Exception as e:
        logger.warning(f"Failed to normalize audio: {e}")
        return audio_clip

def enhance_audio(y, sr):
    """Enhance audio quality with some basic processing."""
    try:
        import librosa.effects as effects
        
        # Normalize audio
        y = effects.normalize(y)
        
        # Apply dynamic range compression
        y = effects.preemphasis(y)
        
        return y
    except Exception as e:
        logger.warning(f"Failed to enhance audio: {e}")
        return y

def process_audio_with_speed(audio_path, speed, output_path):
    """Process audio file with the given speed multiplier."""
    try:
        temp_dir = get_temp_dir()
        temp_wav = os.path.join(temp_dir, f'temp_{os.path.basename(audio_path)}.wav')
        
        # Convert to WAV if needed
        if not audio_path.lower().endswith('.wav'):
            y, sr = librosa.load(audio_path)
            sf.write(temp_wav, y, sr)
        else:
            shutil.copy2(audio_path, temp_wav)
        
        # Process the audio
        y, sr = librosa.load(temp_wav)
        
        # Speed up the audio
        if speed != 1.0:
            y_fast = librosa.effects.time_stretch(y, rate=speed)
        else:
            y_fast = y
        
        # Save the processed audio
        sf.write(output_path, y_fast, sr)
        
        # Cleanup
        try:
            os.remove(temp_wav)
        except:
            pass  # Ignore cleanup errors
        
        return output_path
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        raise

def convert_audio_to_wav(audio_path):
    """Convert audio to WAV format for Whisper processing."""
    try:
        temp_dir = get_temp_dir()
        wav_path = os.path.join(temp_dir, 'temp.wav')
        
        # Load and export as WAV
        audio = AudioFileClip(audio_path)
        audio.write_audiofile(wav_path, fps=16000, nbytes=2, codec='pcm_s16le')
        audio.close()
        
        return wav_path, temp_dir
    except Exception as e:
        logger.error(f"Failed to convert audio to WAV: {e}")
        raise

def process_words_into_phrases(words):
    """Process words into single-word phrases for ADHD-style quick cuts."""
    if not words:
        raise ValueError("No words provided for processing")
        
    segments = []
    
    for i, word in enumerate(words):
        word_text = word["text"].strip()
    
        # Get timing
        duration = word["end"] - word["start"]
        start_time = word["start"]
        
        # If there's a next word, adjust end time to not overlap
        if i < len(words) - 1:
            next_word_start = words[i + 1]["start"]
            # Ensure no overlap with next word
            end_time = min(start_time + duration, next_word_start)
        else:
            end_time = start_time + duration
        
        segments.append({
            "text": word_text,
            "startTime": start_time,
            "endTime": end_time
        })
    
    return segments

async def create_video(story_data, background_options, voice_options):
    """Create a video with the given story, background, and voice options."""
    try:
        # Create temporary directory for intermediate files
        tmp_dir = os.path.join(os.getcwd(), 'tmp')
        os.makedirs(tmp_dir, exist_ok=True)

        # Generate audio with TTS
        audio_path = os.path.join(tmp_dir, 'audio.mp3')
        generate_audio(story_data["story"], voice_options, audio_path)

        # Get audio duration
        audio_duration = get_audio_duration(audio_path)
        
        # Process text into timed segments
        words = get_word_timings(story_data["story"], audio_duration)
        segments = process_words_into_phrases(words)
        
        # Generate subtitles file
        subtitles_path = os.path.join(tmp_dir, 'subtitles.ass')
        await generateAssFile(segments, subtitles_path)
        
        # Select and process background clips
        background_clips = await selectBackgroundClips(background_options, audio_duration)
        processed_clips = []
        
        for clip in background_clips:
            processed_path = await processBackgroundClip(clip)
            processed_clips.append(processed_path)
        
        # Combine everything into final video
        output_path = os.path.join(tmp_dir, 'output.mp4')
        
        # Create the final video with FFmpeg
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-i', processed_clips[0],  # First background clip
        ]
        
        # Add remaining background clips
        for i in range(1, len(processed_clips)):
            ffmpeg_cmd.extend(['-i', processed_clips[i]])
        
        # Add audio
        ffmpeg_cmd.extend([
            '-i', audio_path,
            '-vf', f'subtitles={subtitles_path}',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '22',
            '-c:a', 'aac',
            '-strict', 'experimental',
            output_path
        ])
        
        # Execute FFmpeg command
        subprocess.run(ffmpeg_cmd, check=True)
    
        return output_path
        
    except Exception as e:
        print(f"Error in create_video: {str(e)}")
        raise e

def main(video_id, opening_audio_path, story_audio_path, background_path, banner_path, output_path, story_json):
    temp_dirs = []
    temp_files = []  # Track temporary files for cleanup
    try:
        logger.info("Starting video generation...")
        
        # Create temp directory
        temp_dir = get_temp_dir()
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Using temp directory: {temp_dir}")
        
        # Parse story data
        story_data = json.loads(story_json)
        
        # Validate inputs
        validate_story_data(story_data)
        validate_files(opening_audio_path, story_audio_path, background_path, banner_path)
        
        # Load audio clips
        opening_audio = AudioFileClip(opening_audio_path)
        story_audio = AudioFileClip(story_audio_path)
        
        # Normalize audio levels
        opening_audio = normalize_audio(opening_audio)
        story_audio = normalize_audio(story_audio)
        
        # Load and prepare background video
        background = VideoFileClip(background_path)
        
        # Resize to 9:16 aspect ratio
        target_width = 1080
        target_height = 1920
        background = background.resize(height=target_height)
        background = background.crop(x1=(background.w - target_width) // 2, width=target_width)
        
        # Create opening banner
        opening_banner = create_reddit_banner(
            story_data['title'],
            username=story_data['author']
        ).set_duration(opening_audio.duration)
        
        # Create opening segment
        opening_segment = CompositeVideoClip(
            [
                background.subclip(0, opening_audio.duration),
                opening_banner
            ],
            size=(target_width, target_height)
        ).set_audio(opening_audio)
        
        # Generate captions for story
        story_wav_path, temp_wav_dir = convert_audio_to_wav(story_audio_path)
        temp_dirs.append(temp_wav_dir)
        
        try:
            words = get_word_timestamps(story_wav_path)
            if not words:
                raise ValueError("No words detected in the audio")
            segments = process_words_into_phrases(words)
            
            # Create story segment with captions
            story_start = opening_audio.duration
            story_clips = [background.subclip(story_start, story_start + story_audio.duration)]
            
            for segment in segments:
                caption = create_caption(segment["text"])
                caption = caption.set_start(segment["startTime"]).set_end(segment["endTime"])
                story_clips.append(caption)
            
            story_segment = CompositeVideoClip(
                story_clips,
                size=(target_width, target_height)
            ).set_audio(story_audio)
            
            # Combine segments
            final_video = concatenate_videoclips(
                [opening_segment, story_segment],
                method="compose"
            )
            
            # Write final video with high quality settings
            final_video.write_videofile(
                output_path,
                fps=30,
                codec='libx264',
                audio_codec='aac',
                audio_bitrate='192k',  # High quality audio
                bitrate='8000k',  # High quality video
                temp_audiofile='temp-audio.m4a',
                remove_temp=True,
                threads=4,
                preset='medium'  # Better quality preset
            )
        except Exception as e:
            logger.error(f"Failed to process audio: {str(e)}")
            # If caption generation fails, create a video without captions
            story_segment = CompositeVideoClip(
                [background.subclip(opening_audio.duration, opening_audio.duration + story_audio.duration)],
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
        
        # Cleanup
        background.close()
        opening_audio.close()
        story_audio.close()
        
        # Clean up temporary files
        try:
            os.remove(temp_opening_audio)
            os.remove(temp_story_audio)
        except:
            pass  # Ignore cleanup errors
        
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
