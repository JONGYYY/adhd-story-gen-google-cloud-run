import os
import sys
import yt_dlp

# Dictionary of video URLs for each category
VIDEOS = {
    'minecraft': [
        'https://www.youtube.com/watch?v=n_Dv4JMiwK8',  # Minecraft Parkour
    ],
    'subway': [
        'https://www.youtube.com/watch?v=8_rTIAOohas',  # Subway Surfers
    ],
    'cooking': [
        'https://www.youtube.com/watch?v=ZJy1ajvMU1k',  # Cooking B-roll
    ],
    'asmr': [
        'https://www.youtube.com/watch?v=PtpEaE-c8Lw',  # ASMR Slime
    ],
    'workers': [
        'https://www.youtube.com/watch?v=_ysd-zHamjk',  # Satisfying Work
    ]
}

def download_video(url, output_path):
    ydl_opts = {
        'format': 'best[height<=1080]',
        'outtmpl': output_path,
        'quiet': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            ydl.download([url])
            return True
        except Exception as e:
            print(f"Error downloading {url}: {e}")
            return False

def main():
    base_dir = os.path.join('public', 'backgrounds')
    
    # Create base directory if it doesn't exist
    os.makedirs(base_dir, exist_ok=True)
    
    for category, urls in VIDEOS.items():
        # Create category directory
        category_dir = os.path.join(base_dir, category)
        os.makedirs(category_dir, exist_ok=True)
        
        # Download each video for the category
        for i, url in enumerate(urls):
            output_path = os.path.join(category_dir, f'{i+1}.mp4')
            if not os.path.exists(output_path):
                print(f"Downloading {category} video {i+1}...")
                if download_video(url, output_path):
                    print(f"Successfully downloaded {category} video {i+1}")
                else:
                    print(f"Failed to download {category} video {i+1}")
            else:
                print(f"Video already exists: {output_path}")

if __name__ == '__main__':
    main() 