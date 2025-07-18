// Configuration for the application
export const APP_CONFIG = {
  // Update this when switching domains
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media',
  
  // OAuth configurations
  TIKTOK: {
    CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY || '',
    CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET || '',
    REDIRECT_URI: `${process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media'}/api/auth/tiktok/callback`,
    VERIFICATION_CODE: 'lCB1D6ic1nHrxoB34K6qSEXbBo1wFThs'
  },
  
  // Firebase configuration
  FIREBASE: {
    PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID || '',
    CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
    PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY || ''
  }
};

// Domain-specific configurations
export const DOMAIN_CONFIG = {
  OLD_DOMAIN: 'adhd-story-gen.vercel.app',
  NEW_DOMAIN: 'taleo.media',
  PRODUCTION_URL: 'https://taleo.media'
}; 