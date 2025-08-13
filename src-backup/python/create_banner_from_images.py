#!/usr/bin/env python3
"""
Create a banner by combining top and bottom banner images with text overlaid on top.
"""

import sys
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_rounded_corners(img, radius):
    """Add rounded corners to an image."""
    # Create a mask with rounded corners
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), img.size], radius=radius, fill=255)
    
    # Apply the mask to the image
    img.putalpha(mask)
    return img

def add_selective_rounded_corners(img, radius, corners):
    """Add rounded corners to specific corners only.
    corners: tuple of (top_left, top_right, bottom_left, bottom_right) booleans
    """
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    
    width, height = img.size
    
    # Draw the main rectangle
    draw.rectangle([(0, 0), (width, height)], fill=255)
    
    # Remove corners that should NOT be rounded by drawing black rectangles
    top_left, top_right, bottom_left, bottom_right = corners
    
    if not top_left:
        # Make top-left corner square by drawing over the rounded part
        draw.rectangle([(0, 0), (radius, radius)], fill=255)
    else:
        # Draw rounded top-left corner
        draw.rectangle([(0, 0), (radius, radius)], fill=0)
        draw.pieslice([(0, 0), (radius*2, radius*2)], 180, 270, fill=255)
    
    if not top_right:
        # Make top-right corner square
        draw.rectangle([(width-radius, 0), (width, radius)], fill=255)
    else:
        # Draw rounded top-right corner
        draw.rectangle([(width-radius, 0), (width, radius)], fill=0)
        draw.pieslice([(width-radius*2, 0), (width, radius*2)], 270, 360, fill=255)
    
    if not bottom_left:
        # Make bottom-left corner square
        draw.rectangle([(0, height-radius), (radius, height)], fill=255)
    else:
        # Draw rounded bottom-left corner
        draw.rectangle([(0, height-radius), (radius, height)], fill=0)
        draw.pieslice([(0, height-radius*2), (radius*2, height)], 90, 180, fill=255)
    
    if not bottom_right:
        # Make bottom-right corner square
        draw.rectangle([(width-radius, height-radius), (width, height)], fill=255)
    else:
        # Draw rounded bottom-right corner
        draw.rectangle([(width-radius, height-radius), (width, height)], fill=0)
        draw.pieslice([(width-radius*2, height-radius*2), (width, height)], 0, 90, fill=255)
    
    # Apply the mask to the image
    img.putalpha(mask)
    return img

def add_selective_rounded_corners_solid_bg(img, radius, corners, bg_color=(0, 0, 0, 0)):
    """Add rounded corners to specific corners only, with solid background instead of transparency.
    corners: tuple of (top_left, top_right, bottom_left, bottom_right) booleans
    bg_color: background color for corners (default transparent)
    """
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Create a new image with the background color
    result = Image.new('RGBA', img.size, bg_color)
    
    # Create a mask for the rounded rectangle
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    
    width, height = img.size
    
    # Start with a full rectangle
    draw.rectangle([(0, 0), (width, height)], fill=255)
    
    # Cut out corners that should be rounded
    top_left, top_right, bottom_left, bottom_right = corners
    
    if top_left:
        # Cut out top-left corner and draw rounded corner
        draw.rectangle([(0, 0), (radius, radius)], fill=0)
        draw.pieslice([(0, 0), (radius*2, radius*2)], 180, 270, fill=255)
    
    if top_right:
        # Cut out top-right corner and draw rounded corner
        draw.rectangle([(width-radius, 0), (width, radius)], fill=0)
        draw.pieslice([(width-radius*2, 0), (width, radius*2)], 270, 360, fill=255)
    
    if bottom_left:
        # Cut out bottom-left corner and draw rounded corner
        draw.rectangle([(0, height-radius), (radius, height)], fill=0)
        draw.pieslice([(0, height-radius*2), (radius*2, height)], 90, 180, fill=255)
    
    if bottom_right:
        # Cut out bottom-right corner and draw rounded corner
        draw.rectangle([(width-radius, height-radius), (width, height)], fill=0)
        draw.pieslice([(width-radius*2, height-radius*2), (width, height)], 0, 90, fill=255)
    
    # Apply the original image with the mask
    result.paste(img, (0, 0))
    result.putalpha(mask)
    
    return result

def create_banner_with_images(title, subreddit, author, output_path, width=1080):
    """
    Create a banner by combining top and bottom banner images with a white rectangle in between.
    
    Args:
        title: The title text to display
        subreddit: The subreddit name (not used per user request)
        author: The author name
        output_path: Where to save the final banner
        width: Target width for the banner
    """
    try:
        # Paths to the banner images
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        top_image_path = os.path.join(project_root, 'public', 'banners', 'redditbannertop.png')
        bottom_image_path = os.path.join(project_root, 'public', 'banners', 'redditbannerbottom.png')
        
        logger.info(f"Looking for banner images:")
        logger.info(f"  Top: {top_image_path}")
        logger.info(f"  Bottom: {bottom_image_path}")
        
        # Check if banner images exist
        if not os.path.exists(top_image_path):
            raise FileNotFoundError(f"Top banner image not found: {top_image_path}")
        if not os.path.exists(bottom_image_path):
            raise FileNotFoundError(f"Bottom banner image not found: {bottom_image_path}")
        
        # Load the banner images
        top_img = Image.open(top_image_path).convert('RGBA')
        bottom_img = Image.open(bottom_image_path).convert('RGBA')
        
        logger.info(f"Loaded banner images:")
        logger.info(f"  Top size: {top_img.size}")
        logger.info(f"  Bottom size: {bottom_img.size}")
        
        # Scale images to match target width
        aspect_ratio_top = top_img.height / top_img.width
        aspect_ratio_bottom = bottom_img.height / bottom_img.width
        
        top_height = int(width * aspect_ratio_top)
        bottom_height = int(width * aspect_ratio_bottom)
        
        top_img = top_img.resize((width, top_height), Image.Resampling.LANCZOS)
        bottom_img = bottom_img.resize((width, bottom_height), Image.Resampling.LANCZOS)
        
        # Add selective rounded corners - only outer corners
        corner_radius = 25
        # Top image: only top-left and top-right corners rounded
        top_img = add_selective_rounded_corners(top_img, corner_radius, (True, True, False, False))
        # Bottom image: only bottom-left and bottom-right corners rounded  
        bottom_img = add_selective_rounded_corners(bottom_img, corner_radius, (False, False, True, True))
        
        # Create middle section for the white rectangle
        middle_height = 120
        total_height = top_height + middle_height + bottom_height
        
        # Create the base canvas with transparency
        canvas = Image.new('RGBA', (width, total_height), (0, 0, 0, 0))
        
        # Paste the banner images first (maintaining their transparency)
        canvas.paste(top_img, (0, 0), top_img)
        canvas.paste(bottom_img, (0, top_height + middle_height), bottom_img)
        
        # Create ONLY the white rectangle in the middle section (NO rounded corners)
        white_rect = Image.new('RGBA', (width, middle_height), (255, 255, 255, 255))
        # DO NOT add rounded corners to the white rectangle
        # Paste the white rectangle only in the middle section
        canvas.paste(white_rect, (0, top_height), white_rect)
        
        # Create drawing context for text overlays
        draw = ImageDraw.Draw(canvas)
        
        # Load fonts
        try:
            font_paths = [
                "/System/Library/Fonts/Helvetica.ttc",
                "/System/Library/Fonts/Arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/Windows/Fonts/arialbd.ttf"
            ]
            
            title_font = None
            username_font = None
            
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        if font_path.endswith('.ttc'):
                            title_font = ImageFont.truetype(font_path, 67, index=1)  # Bold for title - BIGGER
                            username_font = ImageFont.truetype(font_path, 60, index=1)  # Same font style as title - BIGGER
                        else:
                            title_font = ImageFont.truetype(font_path, 67)  # BIGGER
                            username_font = ImageFont.truetype(font_path, 60)  # Same font style as title - BIGGER
                        logger.info(f"Using font: {font_path}")
                        break
                    except Exception as font_error:
                        logger.warning(f"Failed to load font {font_path}: {font_error}")
                        continue
            
            if title_font is None:
                title_font = ImageFont.load_default()
                username_font = ImageFont.load_default()
                logger.warning("Using default fonts")
                
        except Exception as e:
            logger.warning(f"Failed to load fonts: {e}")
            title_font = ImageFont.load_default()
            username_font = ImageFont.load_default()
        
        # Position username using RATIOS to scale with banner images
        # Exact position: x=220, y=105 (converted to ratios for scaling)
        username_text = f"u/{author}"
        username_x_ratio = 388 / 1858  # X ratio for exact x=220 position
        username_y_ratio = 130 / 376   # Y ratio for exact y=105 position
        
        # Calculate actual position based on scaled top image dimensions
        username_x = int(width * username_x_ratio)
        username_y = int(top_height * username_y_ratio)
        
        # Draw username in BLACK only (same style as title) - NO white text with outline
        draw.text((username_x, username_y), username_text, fill=(0, 0, 0, 255), font=username_font)
        
        # Title in the white rectangle area - LEFT-ALIGNED (normal white rectangle position)
        title_margin = 40  # Left margin for the title
        title_y = top_height + 20  # Position in the normal white middle section
        
        # Handle text wrapping for long titles
        def wrap_text(text, font, max_width):
            words = text.split(' ')
            lines = []
            current_line = []
            
            for word in words:
                test_line = ' '.join(current_line + [word])
                bbox = draw.textbbox((0, 0), test_line, font=font)
                text_width = bbox[2] - bbox[0]
                
                if text_width <= max_width:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(' '.join(current_line))
                        current_line = [word]
                    else:
                        lines.append(word)
            
            if current_line:
                lines.append(' '.join(current_line))
            
            return lines
        
        # Wrap title text
        max_title_width = width - (title_margin * 2)  # Leave margins on both sides
        title_lines = wrap_text(title, title_font, max_title_width)
        
        # Draw each line of the title, LEFT-ALIGNED
        line_height = 55  # Increased for bigger font
        for i, line in enumerate(title_lines):
            current_title_y = title_y + (i * line_height)
            # Left-align the text instead of centering
            draw.text((title_margin, current_title_y), line, fill=(0, 0, 0, 255), font=title_font)
        
        # Save the banner with transparency preserved
        canvas.save(output_path, 'PNG')
        logger.info(f"Banner created successfully: {output_path}")
        logger.info(f"Banner size: {canvas.size}")
        logger.info(f"Features: Transparent PNG, White rectangle only in middle, Left-aligned title (48pt), No subreddit text, Username BLACK text (48pt) at exact position (220/1858, 105/376)")
        
        return output_path
        
    except Exception as e:
        logger.error(f"Failed to create banner: {e}")
        raise

if __name__ == "__main__":
    if len(sys.argv) != 6:
        print("Usage: python create_banner_from_images.py <title> <subreddit> <author> <output_path> <width>")
        sys.exit(1)
    
    title = sys.argv[1]
    subreddit = sys.argv[2]
    author = sys.argv[3]
    output_path = sys.argv[4]
    width = int(sys.argv[5])
    
    create_banner_with_images(title, subreddit, author, output_path, width) 