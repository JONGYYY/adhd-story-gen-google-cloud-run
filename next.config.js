const webpack = require('webpack');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'adhd-story-gen.vercel.app', 'taleo.media'],
    },
    outputFileTracingIncludes: {
      '/api/**/*': ['./src/python/**/*', './public/backgrounds/**/*'],
    },
  },
  webpack: (config, { isServer }) => {
    // Add explicit alias resolution with absolute paths for ALL @/lib imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/lib/firebase': path.resolve(__dirname, 'src/lib/firebase.ts'),
      '@/lib/firebase-admin': path.resolve(__dirname, 'src/lib/firebase-admin.ts'),
      '@/lib/config': path.resolve(__dirname, 'src/lib/config.ts'),
      '@/lib/utils': path.resolve(__dirname, 'src/lib/utils.ts'),
      '@/lib/social-media/oauth': path.resolve(__dirname, 'src/lib/social-media/oauth.ts'),
      '@/lib/social-media/schema': path.resolve(__dirname, 'src/lib/social-media/schema.ts'),
      '@/lib/social-media/types': path.resolve(__dirname, 'src/lib/social-media/types.ts'),
      '@/lib/social-media/tiktok': path.resolve(__dirname, 'src/lib/social-media/tiktok.ts'),
      '@/lib/social-media/youtube': path.resolve(__dirname, 'src/lib/social-media/youtube.ts'),
      '@/lib/social-media/post': path.resolve(__dirname, 'src/lib/social-media/post.ts'),
      '@/lib/video-generator': path.resolve(__dirname, 'src/lib/video-generator/index.ts'),
      '@/lib/video-generator/types': path.resolve(__dirname, 'src/lib/video-generator/types.ts'),
      '@/lib/video-generator/status': path.resolve(__dirname, 'src/lib/video-generator/status.ts'),
      '@/lib/video-generator/moviepy-generator': path.resolve(__dirname, 'src/lib/video-generator/moviepy-generator.ts'),
      '@/lib/video-generator/voice': path.resolve(__dirname, 'src/lib/video-generator/voice.ts'),
      '@/lib/story-generator/openai': path.resolve(__dirname, 'src/lib/story-generator/openai.ts'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/contexts': path.resolve(__dirname, 'src/contexts'),
      '@/app': path.resolve(__dirname, 'src/app'),
      // Fix UUID compatibility issue
      'uuid/v4': 'uuid',
    };

    // Ensure extensions are properly resolved
    config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.json', ...config.resolve.extensions];

    // Add module resolution fallbacks
    config.resolve.modules = [
      path.resolve(__dirname, 'src'),
      path.resolve(__dirname, 'node_modules'),
      ...config.resolve.modules
    ];

    if (!isServer) {
      // Ensure these packages are treated as external on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'firebase-admin': false,
        'firebase-admin/app': false,
        'firebase-admin/auth': false,
        'snoowrap': false,
        'cheerio': false,
        'fs': false,
        'path': false,
        'os': false,
      };
    }
    
    // Handle undici module parsing issue
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: {
        fullySpecified: false,
      },
    });
    
    return config;
  },
}

module.exports = nextConfig; 