export interface BannerOptions {
  title: string;
  author?: string;
  subreddit?: string;
  theme?: string;
  style?: string;
  width?: number;
  height?: number;
  upvotes?: number;
  comments?: number;
  awards?: string[];
}

export async function generateBanner(options: BannerOptions): Promise<Buffer> {
  const {
    title,
    author = 'Anonymous',
    subreddit = 'AITA',
    theme = 'dark',
    style = 'modern',
    width = 1200,
    height = 630,
    upvotes = 99,
    comments = 99,
    awards = ['Helpful', 'Wholesome']
  } = options;

  try {
    // Create a simple white banner placeholder
    // The actual banner is created in the Python script using MoviePy
    const simplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    console.log('Generated banner placeholder for:', title);
    return simplePng;
  } catch (error) {
    console.error('Error generating banner:', error);
    
    // Return a simple fallback PNG
    const fallbackPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    
    return fallbackPng;
  }
} 