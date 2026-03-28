'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatPrice } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

interface PlanFeature {
  label: string;
  included: boolean;
}

interface SubscriptionCardProps {
  name: string;
  description: string;
  price: number;
  interval: 'monthly' | 'yearly';
  currency?: string;
  features: PlanFeature[];
  isPopular?: boolean;
  isCurrent?: boolean;
  planId?: string;
  ctaLabel?: string;
  onSubscribe?: (planId: string) => void | Promise<void>;
  className?: string;
}

export function SubscriptionCard({
  name,
  description,
  price,
  interval,
  currency = 'EUR',
  features,
  isPopular = false,
  isCurrent = false,
  planId,
  ctaLabel,
  onSubscribe,
  className,
}: SubscriptionCardProps) {
  const t = useTranslations('pricing.cta');
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!planId || !onSubscribe || isCurrent) return;
    setIsLoading(true);
    try {
      await onSubscribe(planId);
    } finally {
      setIsLoading(false);
    }
  };

  const displayPrice = interval === 'yearly' ? price / 12 : price;
  const label =
    ctaLabel ?? (isCurrent ? t('current') : price === 0 ? t('getStarted') : t('upgrade'));

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow',
        isPopular && 'border-primary shadow-lg ring-1 ring-primary',
        className,
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground shadow-sm">Popular</Badge>
        </div>
      )}

      <CardHeader className="text-center">
        <CardTitle className="text-xl">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold tabular-nums">
            {formatPrice(displayPrice, currency)}
          </span>
          <span className="text-sm text-muted-foreground">
            {price > 0 ? `/${interval === 'yearly' ? 'mo' : 'mo'}` : ''}
          </span>
          {interval === 'yearly' && price > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{formatPrice(price, currency)}/yr</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Check
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  feature.included ? 'text-green-500' : 'text-muted-foreground/30',
                )}
              />
              <span className={cn(!feature.included && 'text-muted-foreground line-through')}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          variant={isPopular ? 'default' : 'outline'}
          disabled={isCurrent || isLoading}
          onClick={handleClick}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {label}
        </Button>
      </CardFooter>
    </Card>
  );
}
