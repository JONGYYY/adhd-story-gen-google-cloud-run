from http.server import BaseHTTPRequestHandler
import json
import os
import tempfile
import sys
import base64
import io

# Only import video libraries if needed
try:
    from moviepy.editor import *
    import numpy as np
    import whisper
    from PIL import Image, ImageDraw
    import cv2
    import librosa
    import soundfile as sf
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Video dependencies not available: {e}")
    DEPENDENCIES_AVAILABLE = False

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get content length
            content_length = int(self.headers['Content-Length'])
            
            # Read post data
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            if not DEPENDENCIES_AVAILABLE:
                error_response = {
                    "success": False,
                    "error": "Video generation dependencies not available",
                    "python_version": sys.version,
                    "dependencies_available": False
                }
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
                return
            
            # Test video generation
            response = self.generate_test_video(data)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            # Error response
            error_response = {
                "success": False,
                "error": str(e),
                "python_version": sys.version,
                "dependencies_available": DEPENDENCIES_AVAILABLE
            }
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def generate_test_video(self, data):
        """Generate a simple test video to verify MoviePy is working"""
        try:
            # Create a simple test video
            duration = 3  # 3 seconds
            
            # Create a simple colored clip
            clip = ColorClip(size=(1080, 1920), color=(255, 0, 0), duration=duration)
            
            # Add text
            text_clip = TextClip("Test Video", fontsize=50, color='white', font='Arial')
            text_clip = text_clip.set_position('center').set_duration(duration)
            
            # Composite the clips
            final_clip = CompositeVideoClip([clip, text_clip])
            
            # Create temporary file
            temp_dir = tempfile.mkdtemp()
            output_path = os.path.join(temp_dir, 'test_video.mp4')
            
            # Write video
            final_clip.write_videofile(
                output_path,
                fps=24,
                codec='libx264',
                audio_codec='aac',
                temp_audiofile='temp-audio.m4a',
                remove_temp=True
            )
            
            # Read video file and encode as base64
            with open(output_path, 'rb') as f:
                video_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Cleanup
            os.remove(output_path)
            os.rmdir(temp_dir)
            
            return {
                "success": True,
                "message": "Test video generated successfully",
                "python_version": sys.version,
                "dependencies_available": True,
                "video_data": video_data,
                "video_size": len(video_data)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Video generation failed: {str(e)}",
                "python_version": sys.version,
                "dependencies_available": DEPENDENCIES_AVAILABLE
            }
    
    def do_GET(self):
        try:
            # Test response
            response = {
                "success": True,
                "message": "Python function is working",
                "python_version": sys.version,
                "dependencies_available": DEPENDENCIES_AVAILABLE
            }
            
            if DEPENDENCIES_AVAILABLE:
                response["available_modules"] = [
                    "moviepy", "numpy", "whisper", "PIL", "cv2", "librosa", "soundfile"
                ]
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            # Error response
            error_response = {
                "success": False,
                "error": str(e),
                "python_version": sys.version,
                "dependencies_available": DEPENDENCIES_AVAILABLE
            }
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode('utf-8')) 