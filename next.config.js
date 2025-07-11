const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'adhd-story-gen.vercel.app'],
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
      };
    }
    return config;
  },
}

module.exports = nextConfig; 