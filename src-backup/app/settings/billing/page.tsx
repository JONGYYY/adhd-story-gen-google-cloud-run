'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for trying out StoryGen AI',
    features: [
      '5 videos per month',
      'Basic AI story generation',
      'Standard quality voices',
      'Community support',
    ],
    action: 'Current Plan',
    disabled: true
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'month',
    description: 'Best for content creators',
    features: [
      'Unlimited videos',
      'Advanced AI story generation',
      'Premium quality voices',
      'Priority support',
      'Custom backgrounds',
      'Analytics dashboard',
    ],
    action: 'Upgrade to Pro',
    popular: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large teams and businesses',
    features: [
      'Everything in Pro',
      'Custom voice training',
      'API access',
      'Dedicated support',
      'Custom integrations',
      'Team management',
    ],
    action: 'Contact Sales',
    contactSales: true
  }
];

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState('Free');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleUpgrade = async (planName: string, priceId?: string) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    setLoading(true);
    try {
      if (planName === 'Enterprise') {
        // Redirect to contact sales page or open email client
        window.location.href = `mailto:sales@storygen.ai?subject=Enterprise Plan Inquiry&body=Hi, I'm interested in the Enterprise plan.%0D%0A%0D%0AEmail: ${user.email}`;
        return;
      }

      // Create a Stripe Checkout Session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.uid,
          userEmail: user.email,
        }),
      });

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
          <p className="text-muted-foreground">
            Manage your subscription and billing information.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative ${plan.popular ? 'border-primary' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground ml-1">/{plan.period}</span>
                  )}
                </div>
                
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <svg
                        className="mr-2 h-4 w-4 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={plan.disabled || loading}
                  onClick={() => handleUpgrade(plan.name, plan.priceId)}
                >
                  {loading ? 'Processing...' : plan.action}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>View your past payments and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-center py-8">
              No payment history available.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 