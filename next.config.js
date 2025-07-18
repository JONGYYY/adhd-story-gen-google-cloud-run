const webpack = require('webpack');

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