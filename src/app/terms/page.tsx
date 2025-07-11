import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';

export default function Terms() {
  return (
    <PageContainer>
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-gray-300">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using StoryGen AI, you agree to be bound by these Terms of Service and all applicable laws and regulations.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            StoryGen AI provides an AI-powered platform for creating and managing social media content, specifically focused on story-based video content generation.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            To use certain features of the Service, you must register for an account. You agree to:
          </p>
          <ul>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly update any changes to your information</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>

          <h2>4. Content Guidelines</h2>
          <p>
            You agree not to use the Service to generate or distribute:
          </p>
          <ul>
            <li>Content that violates any applicable laws or regulations</li>
            <li>Content that infringes on intellectual property rights</li>
            <li>Content that is harmful, abusive, or promotes hate speech</li>
            <li>Content that is sexually explicit or pornographic</li>
            <li>Content that is deceptive or fraudulent</li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            You retain ownership of any content you create using the Service. However, you grant StoryGen AI a worldwide, non-exclusive license to use, store, and distribute your content for the purpose of providing and improving the Service.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            StoryGen AI provides the Service "as is" without any warranties. We are not liable for any damages arising from your use of the Service.
          </p>

          <h2>7. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the Service.
          </p>

          <h2>8. Termination</h2>
          <p>
            We may terminate or suspend your account at any time for violations of these terms or for any other reason at our discretion.
          </p>

          <h2>9. Contact Information</h2>
          <p>
            For questions about these Terms, please contact us at:
            <br />
            <a href="mailto:support@storygen.ai" className="text-primary hover:text-primary-dark">
              support@storygen.ai
            </a>
          </p>

          <div className="mt-8 border-t border-gray-700 pt-8">
            <p className="text-gray-400">
              By using StoryGen AI, you acknowledge that you have read and understand these terms and agree to be bound by them.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 