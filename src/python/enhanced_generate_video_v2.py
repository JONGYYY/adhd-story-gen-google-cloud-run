#!/usr/bin/env python3
"""
Enhanced video generator v2 with centered captions, title banner timing, and title+story audio.
"""

import sys
import json
import logging
import os
import shutil
from typing import Optional, Tuple, Dict, Any
from moviepy.editor import *
import numpy as np
from PIL import Image, ImageDraw, ImageFont

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('enhanced_v2')

VERSION = 'v2-2025-08-19'

class EnhancedV2:
    def __init__(self, job_id: str):
        self.job_id = job_id

    def create_grid_background(self, duration: float, w: int = 1080, h: int = 1920) -> VideoClip:
        # Black base
        base = ColorClip(size=(w, h), color=(0, 0, 0)).set_duration(duration)
        # Draw grid using numpy per frame
        cell = 200
        thickness = 2
        def make_frame(t):
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            # draw white grid lines
            for x in range(0, w, cell):
                frame[:, max(0, x - thickness//2):min(w, x + thickness//2 + 1), :] = 255
            for y in range(0, h, cell):
                frame[max(0, y - thickness//2):min(h, y + thickness//2 + 1), :, :] = 255
            # fade slight alpha
            frame = (frame * 0.2).astype(np.uint8)
            return frame
        grid = VideoClip(make_frame=make_frame).set_duration(duration)
        return CompositeVideoClip([base, grid]).set_duration(duration)

    def create_word_clip(self, word: str, duration: float, video_size: tuple, style: dict):
        font_size = style.get('fontSize', 75)
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Arial.ttf",
        ]
        font = None
        for p in font_paths:
            if os.path.exists(p):
                try:
                    if p.endswith('.ttc'):
                        font = ImageFont.truetype(p, font_size, index=1)
                    else:
                        font = ImageFont.truetype(p, font_size)
                    break
                except Exception:
                    continue
        if font is None:
            font = ImageFont.load_default()
        bbox = font.getbbox(word)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        pad = style.get('strokeWidth', 4) * 2 + 10
        img_w = text_w + pad * 2
        img_h = text_h + pad * 2
        img = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        stroke = style.get('stroke', '#000000')
        sw = style.get('strokeWidth', 4)
        for dx in range(-sw, sw + 1):
            for dy in range(-sw, sw + 1):
                if dx or dy:
                    draw.text((pad + dx, pad + dy), word, font=font, fill=stroke)
        fill = style.get('fill', '#FFFFFF')
        draw.text((pad, pad), word, font=font, fill=fill)
        rgba = np.array(img)
        rgb = rgba[:, :, :3]
        a = (rgba[:, :, 3].astype(np.float32) / 255.0)
        base = ImageClip(rgb).set_duration(max(0.0001, duration))
        base = base.set_mask(ImageClip(a, ismask=True).set_duration(max(0.0001, duration)))
        # subtle bounce
        bounce_d = 0.2
        def scaler(t):
            p = max(0.0, min(1.0, t / bounce_d))
            return 1.0 + 0.08 * (1.0 - p)
        clip = base.resize(scaler)
        vw, vh = video_size
        x = (vw - img_w) // 2
        y = (vh - img_h) // 2
        return clip.set_position((x, y))

    def generate(self, title_audio: Optional[str], story_audio: str, bg: str, banner_png: str, out_mp4: str, align_json: str):
        logger.info(f"Starting EnhancedV2 {VERSION}")
        target_w, target_h = 1080, 1920
        title_d = 0.0
        if title_audio and os.path.exists(title_audio):
            try:
                logger.info(f"Title audio path: {title_audio} size={os.path.getsize(title_audio)} bytes")
                tclip = AudioFileClip(title_audio)
                title_d = float(tclip.duration or 0.0)
                logger.info(f"Title duration: {title_d:.2f}s")
            except Exception as e:
                logger.warning(f"Failed to load title audio: {e}")
                tclip = None
        else:
            tclip = None
        logger.info(f"Story audio path: {story_audio} size={os.path.getsize(story_audio)} bytes")
        sclip = AudioFileClip(story_audio)
        story_d = float(sclip.duration or 0.0)
        logger.info(f"Story duration: {story_d:.2f}s")
        total_d = max(0.1, title_d + story_d)

        # Build background
        if bg == 'PLACEHOLDER' or not os.path.exists(bg):
            logger.info("Synthesizing grid background internally")
            bgclip = self.create_grid_background(duration=total_d, w=target_w, h=target_h)
        else:
            logger.info(f"Background path: {bg} size={os.path.getsize(bg)}")
            bgclip = VideoFileClip(bg).resize(height=target_h)
            logger.info(f"Background duration: {bgclip.duration:.2f}s, size={bgclip.w}x{bgclip.h}")
            try:
                f0 = bgclip.get_frame(0)
                logger.info(f"Background first frame shape: {f0.shape}")
            except Exception as e:
                logger.warning(f"Failed to read first background frame: {e}")
            if bgclip.w < target_w:
                bgclip = bgclip.resize(width=target_w)
            bgclip = bgclip.crop(x1=(bgclip.w - target_w)//2, width=target_w)
            if (bgclip.duration or 0) < total_d:
                reps = int(np.ceil(total_d / max(0.1, bgclip.duration)))
                bgclip = concatenate_videoclips([bgclip] * reps)
            bgclip = bgclip.subclip(0, total_d)

        banner_clip = None
        if os.path.exists(banner_png):
            from PIL import Image as PILImage
            bimg = PILImage.open(banner_png)
            if bimg.mode != 'RGBA':
                bimg = bimg.convert('RGBA')
            arr = np.array(bimg)
            brgb = arr[:, :, :3]
            balpha = arr[:, :, 3].astype(np.float32) / 255.0
            banner_clip = ImageClip(brgb, duration=max(title_d, 0.0001))
            banner_clip = banner_clip.set_mask(ImageClip(balpha, ismask=True).set_duration(max(title_d, 0.0001)))
            bw = int(target_w * 0.9)
            bh = int(bw * bimg.height / bimg.width)
            max_h = int(target_h * 0.3)
            if bh > max_h:
                bh = max_h
                bw = int(bh * bimg.width / bimg.height)
            banner_clip = banner_clip.resize((bw, bh)).set_position(('center', (target_h - bh)//2))
        style = { 'fontSize': 75, 'fill': '#FFFFFF', 'stroke': '#000', 'strokeWidth': 4 }
        captions = []
        if os.path.exists(align_json):
            data = json.loads(open(align_json, 'r').read())
            for w in data:
                d = float((w['end'] - w['start']) or 0.0)
                clip = self.create_word_clip(w['word'], d, (target_w, target_h), style)
                clip = clip.set_start(title_d + float(w['start']))
                captions.append(clip)
        layers = [bgclip]
        if banner_clip: layers.append(banner_clip)
        layers.extend(captions)
        final = CompositeVideoClip(layers, size=(target_w, target_h))
        if tclip and title_d > 0.0:
            audio = concatenate_audioclips([tclip, sclip])
        else:
            audio = sclip
        final = final.set_audio(audio)
        logger.info(f"Writing final video to: {out_mp4} total_d={total_d:.2f}s layers={len(layers)}")
        final.write_videofile(
            out_mp4,
            fps=30,
            codec='libx264',
            audio_codec='aac',
            preset='medium',
            ffmpeg_params=['-pix_fmt','yuv420p','-movflags','+faststart','-crf','23'],
            temp_audiofile='temp-audio.m4a',
            remove_temp=True,
            threads=4,
            verbose=True,
            logger='bar'
        )
        # Post-write sanity check
        try:
            out_size = os.path.getsize(out_mp4)
            logger.info(f"Output size: {out_size} bytes")
            if out_size < 1024 * 200:
                logger.warning("Output MP4 is unusually small; check encoder and inputs")
        except Exception as e:
            logger.warning(f"Failed to stat output: {e}")
        if tclip: tclip.close()
        sclip.close()
        if banner_clip: banner_clip.close()
        for c in captions: c.close()
        final.close()
        logger.info('EnhancedV2 finished successfully')

if __name__ == '__main__':
    # Expect 9 args
    if len(sys.argv) != 9:
        print("Usage: enhanced_generate_video_v2.py <job_id> <title_audio_or_none> <story_audio_path> <background_path> <banner_path> <output_path> <story_data_json> <alignment_path>")
        sys.exit(1)
    job_id = sys.argv[1]
    title_arg = sys.argv[2]
    story = sys.argv[3]
    bg = sys.argv[4]
    banner = sys.argv[5]
    outp = sys.argv[6]
    # sys.argv[7] story json unused in v2
    align = sys.argv[8]
    gen = EnhancedV2(job_id)
    gen.generate(None if title_arg == 'NONE' else title_arg, story, bg, banner, outp, align) 