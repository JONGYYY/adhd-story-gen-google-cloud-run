// This is a server component
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/theme-provider';
import { Navigation } from '@/components/Navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { ClientOnlyWithSuspense } from '@/components/client-only';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export const metadata: Metadata = {
  title: 'StoryGen AI - Generate Viral Stories with AI',
  description: 'Transform trending Reddit stories or generate original content into engaging short-form videos. Perfect for content creators looking to scale their production.',
  keywords: ['AI story generation', 'viral content', 'short-form videos', 'content creation', 'Reddit stories'],
  authors: [{ name: 'StoryGen AI Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://storygen.ai',
    title: 'StoryGen AI - Generate Viral Stories with AI',
    description: 'Transform trending Reddit stories or generate original content into engaging short-form videos.',
    siteName: 'StoryGen AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StoryGen AI - Generate Viral Stories with AI',
    description: 'Transform trending Reddit stories or generate original content into engaging short-form videos.',
    creator: '@storygen_ai',
  },
  other: {
    'tiktok-developers-site-verification': '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="tiktok-developers-site-verification" content="5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj" />
      </head>
      <body className={GeistSans.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClientOnlyWithSuspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <AuthProvider>
              <div className="relative min-h-screen flex flex-col">
                <Navigation />
                <main className="flex-1">{children}</main>
                <footer className="w-full border-t py-6 md:py-0">
                  <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                      © {new Date().getFullYear()} StoryGen AI. All rights reserved.
                    </p>
                    <nav className="flex items-center gap-4 text-sm">
                      <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                        Privacy
                      </a>
                      <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                        Terms
                      </a>
                      <a href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                        Contact
                      </a>
                    </nav>
                  </div>
                </footer>
              </div>
            </AuthProvider>
          </ClientOnlyWithSuspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
