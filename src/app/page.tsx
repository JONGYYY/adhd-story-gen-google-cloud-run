'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function LandingPage() {
  const [videoCount] = useState(1234); // This would be fetched from an API in production
  const [showDemo, setShowDemo] = useState(false);
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-20"
          >
            <source src="/demo-background.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Create Viral Content with{' '}
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                AI
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-8">
              Generate engaging stories and videos automatically. Save time and grow your audience faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href={user ? "/create" : "/auth/signup"}>Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => setShowDemo(true)}>
                Watch Demo
              </Button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              No credit card required • Free plan available
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Create Viral Content
            </h2>
            <p className="text-xl text-gray-400">
              Powerful features to help you create, schedule, and manage your content
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🤖 AI Story Generation
              </h3>
              <p className="text-gray-400">
                Generate unique, engaging stories using our advanced AI. Perfect for any niche or topic.
              </p>
            </div>
            <div className="card p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🎥 Automated Video Creation
              </h3>
              <p className="text-gray-400">
                Turn stories into professional videos with AI narration, music, and visuals.
              </p>
            </div>
            <div className="card p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📊 Analytics & Insights
              </h3>
              <p className="text-gray-400">
                Track performance and optimize your content strategy with detailed analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-b from-gray-800/50 to-transparent">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">{videoCount.toLocaleString()}</div>
              <div className="text-gray-400">Videos Generated</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">10M+</div>
              <div className="text-gray-400">Views Generated</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-gray-400">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              AI That Writes, Designs, and Posts for You
            </h2>
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="card p-6 hover:border-primary/50 transition-colors">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  🔁 Use Trending Stories
                </h3>
                <p className="text-gray-400 mb-4">
                  Source viral content from r/AITA, r/TrueOffMyChest, and more. Our AI picks the most engaging stories.
                </p>
                <Button variant="secondary" className="w-full" asChild>
                  <Link href={user ? "/create" : "/auth/signup"}>Try Reddit Mode</Link>
                </Button>
              </div>
              <div className="card p-6 hover:border-primary/50 transition-colors">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  ✨ Generate New Stories
                </h3>
                <p className="text-gray-400 mb-4">
                  Create unique, viral-worthy stories from scratch using our advanced AI.
                </p>
                <Button variant="secondary" className="w-full" asChild>
                  <Link href={user ? "/create" : "/auth/signup"}>Try AI Mode</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-gray-800/50 to-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Create Viral Content?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join thousands of creators who are growing their audience with StoryGen AI.
            </p>
            <Button size="lg" asChild>
              <Link href={user ? "/create" : "/auth/signup"}>Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <h3 className="font-bold text-xl mb-4">StoryGen AI</h3>
                <p className="text-gray-400 text-sm">Made by creators, for creators.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><Link href="/features" className="text-gray-400 hover:text-white">Features</Link></li>
                  <li><Link href="/pricing" className="text-gray-400 hover:text-white">Pricing</Link></li>
                  <li><Link href="/roadmap" className="text-gray-400 hover:text-white">Roadmap</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><Link href="/about" className="text-gray-400 hover:text-white">About</Link></li>
                  <li><Link href="/blog" className="text-gray-400 hover:text-white">Blog</Link></li>
                  <li><Link href="/careers" className="text-gray-400 hover:text-white">Careers</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><Link href="/privacy" className="text-gray-400 hover:text-white">Privacy</Link></li>
                  <li><Link href="/terms" className="text-gray-400 hover:text-white">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-gray-900/80 p-4 backdrop-blur-sm border-t border-gray-800 lg:hidden">
        <div className="container mx-auto">
          <Button className="w-full" size="lg" asChild>
            <Link href={user ? "/create" : "/auth/signup"}>Get Started Free</Link>
          </Button>
        </div>
      </div>

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full relative">
            <button
              onClick={() => setShowDemo(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="aspect-video rounded-lg overflow-hidden">
              <video
                controls
                className="w-full h-full"
              >
                <source src="/demo.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const faqs = [
  {
    question: "Will I get flagged for reuse?",
    answer: "No - our AI generates unique content and variations to avoid duplicate content flags."
  },
  {
    question: "How original are the stories?",
    answer: "100% original when using AI generation, or properly attributed when sourcing from Reddit with our built-in compliance tools."
  },
  {
    question: "Can I customize voices and fonts?",
    answer: "Yes! Choose from 30+ AI voices and customize all visual elements including fonts, colors, and animations."
  },
  {
    question: "Does this work for brands?",
    answer: "Absolutely! Many brands use our platform to create engaging short-form content that resonates with their audience."
  },
  {
    question: "Is it hard to use?",
    answer: "Not at all! Our intuitive interface lets you generate videos in just a few clicks. No technical skills required."
  }
];
