import { createCanvas, loadImage, registerFont, Canvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { BannerInput } from '../shared/types';

// Register fonts (you'll need to provide font files)
const FONTS = {
  INTER_REGULAR: 'Inter-Regular.ttf',
  INTER_BOLD: 'Inter-Bold.ttf',
  INTER_SEMIBOLD: 'Inter-SemiBold.ttf'
};

export class BannerGenerator {
  private fontsRegistered = false;
  
  constructor(private fontDir?: string) {
    this.registerFonts();
  }
  
  private registerFonts() {
    if (this.fontsRegistered) return;
    
    try {
      const fontDir = this.fontDir || join(process.cwd(), 'assets', 'fonts');
      
      // Try to register fonts if available
      Object.entries(FONTS).forEach(([name, filename]) => {
        try {
          const fontPath = join(fontDir, filename);
          registerFont(fontPath, { family: name });
          console.log(`✅ Registered font: ${name}`);
        } catch (error) {
          console.warn(`⚠️ Could not register font ${name}: ${error.message}`);
        }
      });
      
      this.fontsRegistered = true;
    } catch (error) {
      console.warn('⚠️ Font registration failed, using system fonts');
    }
  }
  
  /**
   * Generate a Reddit-style banner PNG
   */
  async generateBannerPNG(input: BannerInput): Promise<string> {
    const {
      title,
      authorName,
      avatarUrl,
      subreddit = 'r/stories',
      width = 1080,
      height = 400
    } = input;
    
    console.log(`🎨 Generating banner: ${width}x${height} for "${title}"`);
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Clear with transparent background
    ctx.clearRect(0, 0, width, height);
    
    // Draw background with gradient
    await this.drawBackground(ctx, width, height);
    
    // Load and draw avatar
    const avatarSize = 60;
    const avatarX = 40;
    const avatarY = 30;
    
    try {
      const avatar = await loadImage(avatarUrl);
      await this.drawAvatar(ctx, avatar, avatarX, avatarY, avatarSize);
    } catch (error) {
      console.warn(`⚠️ Could not load avatar from ${avatarUrl}, using default`);
      await this.drawDefaultAvatar(ctx, avatarX, avatarY, avatarSize);
    }
    
    // Draw author name
    const authorX = avatarX + avatarSize + 15;
    const authorY = avatarY + 20;
    this.drawAuthorName(ctx, authorName, authorX, authorY);
    
    // Draw subreddit
    const subredditY = authorY + 25;
    this.drawSubreddit(ctx, subreddit, authorX, subredditY);
    
    // Draw title with auto-fit
    const titleArea = {
      x: 40,
      y: avatarY + avatarSize + 30,
      width: width - 80,
      height: height - (avatarY + avatarSize + 60)
    };
    
    await this.drawAutoFitTitle(ctx, title, titleArea);
    
    // Add subtle shadow and border effects
    await this.addEffects(ctx, width, height);
    
    // Save to file
    const outputPath = join(tmpdir(), `banner_${Date.now()}.png`);
    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
    
    console.log(`✅ Banner saved: ${outputPath}`);
    return outputPath;
  }
  
  /**
   * Draw gradient background
   */
  private async drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Reddit-style dark gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a1b');
    gradient.addColorStop(1, '#0d1117');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add subtle noise texture
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        1,
        1
      );
    }
    ctx.globalAlpha = 1;
  }
  
  /**
   * Draw circular avatar with border
   */
  private async drawAvatar(
    ctx: CanvasRenderingContext2D,
    avatar: any,
    x: number,
    y: number,
    size: number
  ) {
    ctx.save();
    
    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.clip();
    
    // Draw avatar
    ctx.drawImage(avatar, x, y, size, size);
    
    ctx.restore();
    
    // Draw border
    ctx.strokeStyle = '#ff4500'; // Reddit orange
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  /**
   * Draw default avatar when image fails to load
   */
  private async drawDefaultAvatar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) {
    // Draw circle background
    ctx.fillStyle = '#ff4500';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw reddit alien silhouette or initials
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size * 0.4}px INTER_BOLD, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', x + size/2, y + size/2);
  }
  
  /**
   * Draw author name
   */
  private drawAuthorName(
    ctx: CanvasRenderingContext2D,
    authorName: string,
    x: number,
    y: number
  ) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px INTER_SEMIBOLD, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`u/${authorName}`, x, y);
  }
  
  /**
   * Draw subreddit
   */
  private drawSubreddit(
    ctx: CanvasRenderingContext2D,
    subreddit: string,
    x: number,
    y: number
  ) {
    ctx.fillStyle = '#818384';
    ctx.font = '14px INTER_REGULAR, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(subreddit, x, y);
  }
  
  /**
   * Draw title with auto-fit using binary search
   */
  private async drawAutoFitTitle(
    ctx: CanvasRenderingContext2D,
    title: string,
    area: { x: number; y: number; width: number; height: number }
  ) {
    const maxFontSize = 48;
    const minFontSize = 16;
    const lineHeight = 1.3;
    
    // Binary search for optimal font size
    let bestFontSize = minFontSize;
    let bestLines: string[] = [];
    
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
      ctx.font = `${fontSize}px INTER_BOLD, Arial, sans-serif`;
      
      const lines = this.wrapText(ctx, title, area.width);
      const totalHeight = lines.length * fontSize * lineHeight;
      
      if (totalHeight <= area.height) {
        bestFontSize = fontSize;
        bestLines = lines;
        break;
      }
    }
    
    // Draw the title
    ctx.fillStyle = '#ffffff';
    ctx.font = `${bestFontSize}px INTER_BOLD, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    bestLines.forEach((line, index) => {
      const lineY = area.y + (index * bestFontSize * lineHeight);
      ctx.fillText(line, area.x, lineY);
    });
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  
  /**
   * Wrap text to fit within specified width
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  /**
   * Add subtle effects like shadows and borders
   */
  private async addEffects(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Add subtle inner shadow
    const gradient = ctx.createLinearGradient(0, 0, 0, 20);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 20);
    
    // Add bottom highlight
    const bottomGradient = ctx.createLinearGradient(0, height - 20, 0, height);
    bottomGradient.addColorStop(0, 'transparent');
    bottomGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, height - 20, width, 20);
  }
}

/**
 * Factory function to create banner generator
 */
export function createBannerGenerator(fontDir?: string): BannerGenerator {
  return new BannerGenerator(fontDir);
}

/**
 * Main function to generate banner PNG
 */
export async function generateBannerPNG(input: BannerInput): Promise<string> {
  const generator = createBannerGenerator();
  return generator.generateBannerPNG(input);
} 