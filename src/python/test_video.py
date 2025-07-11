import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os

def create_test_frame(text, size=(1080, 1920), background_color=(255, 255, 255)):
    # Create background
    frame = np.full((size[1], size[0], 3), background_color, dtype=np.uint8)
    
    # Convert to PIL Image for text rendering
    img = Image.fromarray(frame)
    draw = ImageDraw.Draw(img)
    
    # Load default font
    font = ImageFont.load_default()
    
    # Calculate text position (center)
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    # Draw text
    draw.text((x, y), text, font=font, fill='black')
    
    # Convert back to OpenCV format
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def main():
    print("Creating test video...")
    
    # Create video writer
    output_path = 'test_output.mp4'
    fps = 30
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (1080, 1920))
    
    # Create 5 seconds of test frames
    for i in range(5 * fps):
        frame = create_test_frame(f"Frame {i}")
        out.write(frame)
    
    # Release resources
    out.release()
    print(f"Test video created at: {output_path}")

if __name__ == "__main__":
    main() 