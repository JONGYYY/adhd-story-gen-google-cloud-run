import puppeteer from 'puppeteer';
import { join } from 'path';
import { readFileSync } from 'fs';

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
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Load HTML template
    const templatePath = join(process.cwd(), 'src/lib/banner-generator/template.html');
    const template = readFileSync(templatePath, 'utf-8');

    // Replace placeholders with actual content
    const html = template
      .replace('{{title}}', title)
      .replace('{{author}}', author)
      .replace('{{subreddit}}', subreddit)
      .replace('{{theme}}', theme)
      .replace('{{style}}', style)
      .replace('{{upvotes}}', upvotes.toString())
      .replace('{{comments}}', comments.toString())
      .replace('{{awards}}', awards.map(award => `
        <div class="award">
          <img src="data:image/svg+xml,${encodeURIComponent(`
            <svg width="16" height="16" viewBox="0 0 16 16" fill="gold">
              <path d="M8 0l2.5 5 5.5.8-4 3.9.9 5.3L8 12.5 3.1 15l.9-5.3-4-3.9 5.5-.8L8 0z"/>
            </svg>
          `)}"/>
          ${award}
        </div>
      `).join(''));

    await page.setContent(html);

    // Wait for any animations or fonts to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'binary'
    });

    await browser.close();

    return screenshot as Buffer;
  } catch (error) {
    console.error('Error generating banner:', error);
    throw error;
  }
} 