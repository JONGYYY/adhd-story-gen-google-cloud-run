#!/usr/bin/env python3
"""
Test script to examine the banner images and verify they're being loaded correctly.
"""

import os
from PIL import Image
import sys

def examine_banner_images():
    """Examine the banner images to understand their structure."""
    
    # Get project root
    script_dir = os.path.dirname(__file__)
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    top_path = os.path.join(project_root, 'public', 'banners', 'redditbannertop.png')
    bottom_path = os.path.join(project_root, 'public', 'banners', 'redditbannerbottom.png')
    
    print("=== BANNER IMAGE ANALYSIS ===")
    print(f"Project root: {project_root}")
    print(f"Top banner path: {top_path}")
    print(f"Bottom banner path: {bottom_path}")
    print()
    
    # Check if files exist
    if not os.path.exists(top_path):
        print(f"❌ TOP BANNER NOT FOUND: {top_path}")
        return
    if not os.path.exists(bottom_path):
        print(f"❌ BOTTOM BANNER NOT FOUND: {bottom_path}")
        return
    
    print("✅ Both banner files found!")
    print()
    
    # Load and analyze images
    try:
        top_img = Image.open(top_path)
        bottom_img = Image.open(bottom_path)
        
        print("=== TOP BANNER ===")
        print(f"Size: {top_img.size}")
        print(f"Mode: {top_img.mode}")
        print(f"Format: {top_img.format}")
        
        print()
        print("=== BOTTOM BANNER ===")
        print(f"Size: {bottom_img.size}")
        print(f"Mode: {bottom_img.mode}")
        print(f"Format: {bottom_img.format}")
        
        # Create a test composite to see what they look like together
        print()
        print("=== CREATING TEST COMPOSITE ===")
        
        # Scale to consistent width for testing
        test_width = 800
        
        # Scale top image
        top_aspect = top_img.height / top_img.width
        top_height = int(test_width * top_aspect)
        top_scaled = top_img.resize((test_width, top_height), Image.Resampling.LANCZOS)
        
        # Scale bottom image
        bottom_aspect = bottom_img.height / bottom_img.width
        bottom_height = int(test_width * bottom_aspect)
        bottom_scaled = bottom_img.resize((test_width, bottom_height), Image.Resampling.LANCZOS)
        
        # Create composite with space for text
        text_space = 100
        total_height = top_height + text_space + bottom_height
        
        composite = Image.new('RGB', (test_width, total_height), (255, 255, 255))
        
        # Paste images
        composite.paste(top_scaled, (0, 0))
        composite.paste(bottom_scaled, (0, top_height + text_space))
        
        # Save test composite
        output_path = '/tmp/banner_test_composite.png'
        composite.save(output_path)
        
        print(f"✅ Test composite created: {output_path}")
        print(f"Composite size: {composite.size}")
        print(f"Top section: 0 to {top_height}")
        print(f"Text section: {top_height} to {top_height + text_space}")
        print(f"Bottom section: {top_height + text_space} to {total_height}")
        
        # Also create a simple combined version like our script does
        print()
        print("=== CREATING SCRIPT-STYLE BANNER ===")
        
        from create_banner_from_images import create_banner_with_images
        script_output = '/tmp/script_style_banner.png'
        create_banner_with_images(
            "TEST BANNER ANALYSIS",
            "r/test", 
            "TestUser",
            script_output,
            1080
        )
        
        print(f"✅ Script-style banner created: {script_output}")
        
    except Exception as e:
        print(f"❌ Error analyzing images: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    examine_banner_images() 