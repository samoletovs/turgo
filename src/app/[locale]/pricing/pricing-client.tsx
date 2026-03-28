'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

interface PricingCheckoutButtonProps {
  planId: string;
  planName: string;
  isPro: boolean;
}

export function PricingCheckoutButton({ planId, planName, isPro }: PricingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const checkoutMutation = trpc.subscription.createCheckout.useMutation();

  async function handleCheckout() {
    setLoading(true);
    try {
      const data = await checkoutMutation.mutateAsync({ planId });

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('No checkout URL returned');
        setLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full"
      variant={isPro ? 'default' : 'outline'}
      onClick={handleCheckout}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        `Upgrade to ${planName}`
      )}
    </Button>
  );
}
