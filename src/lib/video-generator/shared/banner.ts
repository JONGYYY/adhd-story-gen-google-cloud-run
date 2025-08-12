import path from 'path';
import fs from 'fs/promises';

export type BannerAssets = {
  topPath: string;
  bottomPath: string;
  safeZonePadding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
};

export async function getBannerAssets(): Promise<BannerAssets> {
  const projectRoot = process.cwd();
  const topPath = path.join(projectRoot, 'public', 'banners', 'redditbannertop.png');
  const bottomPath = path.join(projectRoot, 'public', 'banners', 'redditbannerbottom.png');

  // Verify assets exist
  try {
    await fs.access(topPath);
    await fs.access(bottomPath);
  } catch (error) {
    throw new Error(`Banner assets not found. Expected files at:\n${topPath}\n${bottomPath}`);
  }

  // Define safe-zone padding (pixels from edges where text should not be placed)
  // These values ensure text doesn't overlap with banner design elements
  const safeZonePadding = {
    top: 60,      // Space for Reddit icon and username area
    bottom: 40,   // Space for vote/comment icons
    left: 40,     // Left margin
    right: 40     // Right margin
  };

  return {
    topPath,
    bottomPath,
    safeZonePadding
  };
}

export function calculateTitleBounds(
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  safeZonePadding: BannerAssets['safeZonePadding']
) {
  // Calculate the available space for title text in the banner
  // Assumes banner takes up roughly the middle portion of the video
  
  const bannerStartY = Math.floor(videoHeight * 0.25); // Banner starts at 25% of video height
  const bannerHeight = Math.floor(videoHeight * 0.3);  // Banner is 30% of video height
  
  const titleArea = {
    x: safeZonePadding.left,
    y: bannerStartY + safeZonePadding.top,
    width: videoWidth - safeZonePadding.left - safeZonePadding.right,
    height: bannerHeight - safeZonePadding.top - safeZonePadding.bottom
  };

  return titleArea;
}

export function calculateUsernamePosition(
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  safeZonePadding: BannerAssets['safeZonePadding']
) {
  // Position username to the right of where the Reddit icon typically appears
  const bannerStartY = Math.floor(videoHeight * 0.25);
  
  return {
    x: 150, // To the right of Reddit icon area
    y: bannerStartY + 30 // Top area of banner
  };
}

export function calculateSubredditPosition(
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  safeZonePadding: BannerAssets['safeZonePadding']
) {
  // Position subreddit info at bottom of banner area
  const bannerStartY = Math.floor(videoHeight * 0.25);
  const bannerHeight = Math.floor(videoHeight * 0.3);
  
  return {
    x: videoWidth / 2, // Centered horizontally
    y: bannerStartY + bannerHeight - safeZonePadding.bottom - 20 // Near bottom of banner
  };
}

export async function validateBannerAssets(): Promise<boolean> {
  try {
    await getBannerAssets();
    return true;
  } catch (error) {
    console.error('Banner asset validation failed:', error);
    return false;
  }
}

export function getBannerDimensions(videoWidth: number = 1080, videoHeight: number = 1920) {
  // Calculate banner dimensions based on video size
  // These should match the dimensions used in the actual banner creation
  
  return {
    width: videoWidth,
    height: Math.floor(videoHeight * 0.3), // 30% of video height
    startY: Math.floor(videoHeight * 0.25), // Start at 25% of video height
    endY: Math.floor(videoHeight * 0.55)    // End at 55% of video height
  };
} 