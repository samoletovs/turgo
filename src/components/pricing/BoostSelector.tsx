'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatPrice } from '@/lib/utils';
import { BOOST_PRICES } from '@/lib/constants';
import { Zap, Star, ArrowUp, Loader2, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

type BoostType = 'FEATURED' | 'HIGHLIGHTED' | 'TOP';

interface BoostSelectorProps {
  listingId: string;
  className?: string;
}

const BOOST_ICONS: Record<BoostType, React.ReactNode> = {
  FEATURED: <Star className="h-5 w-5" />,
  HIGHLIGHTED: <Zap className="h-5 w-5" />,
  TOP: <ArrowUp className="h-5 w-5" />,
};

const BOOST_COLORS: Record<BoostType, string> = {
  FEATURED: 'text-amber-500',
  HIGHLIGHTED: 'text-purple-500',
  TOP: 'text-blue-500',
};

const BOOST_BG: Record<BoostType, string> = {
  FEATURED: 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20',
  HIGHLIGHTED: 'border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20',
  TOP: 'border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20',
};

export function BoostSelector({ listingId, className }: BoostSelectorProps) {
  const t = useTranslations('agent.boost');
  const _tCommon = useTranslations('common');
  const [selectedBoost, setSelectedBoost] = useState<BoostType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [purchased, setPurchased] = useState<BoostType | null>(null);

  const boostMutation = trpc.subscription.createBoostCheckout.useMutation();

  const handlePurchase = useCallback(
    async (boostType: BoostType) => {
      setIsLoading(true);
      try {
        const data = await boostMutation.mutateAsync({
          listingId,
          boostType,
        });
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setPurchased(boostType);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [listingId, boostMutation],
  );

  const boostOptions: {
    type: BoostType;
    priceEur: number;
    days: number;
    titleKey: string;
    descKey: string;
  }[] = [
    {
      type: 'HIGHLIGHTED',
      priceEur: BOOST_PRICES.HIGHLIGHTED.amount / 100,
      days: BOOST_PRICES.HIGHLIGHTED.durationDays,
      titleKey: 'highlighted',
      descKey: 'highlightedDesc',
    },
    {
      type: 'FEATURED',
      priceEur: BOOST_PRICES.FEATURED.amount / 100,
      days: BOOST_PRICES.FEATURED.durationDays,
      titleKey: 'featured',
      descKey: 'featuredDesc',
    },
    {
      type: 'TOP',
      priceEur: BOOST_PRICES.TOP.amount / 100,
      days: BOOST_PRICES.TOP.durationDays,
      titleKey: 'top',
      descKey: 'topDesc',
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {boostOptions.map((opt) => {
          const isSelected = selectedBoost === opt.type;
          const isPurchased = purchased === opt.type;

          return (
            <Card
              key={opt.type}
              className={cn(
                'cursor-pointer transition-all',
                isSelected && 'ring-2 ring-primary',
                BOOST_BG[opt.type],
              )}
              onClick={() => setSelectedBoost(opt.type)}
            >
              <CardHeader className="pb-3 text-center">
                <div
                  className={cn(
                    'mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm',
                    BOOST_COLORS[opt.type],
                  )}
                >
                  {BOOST_ICONS[opt.type]}
                </div>
                <CardTitle className="text-base">{t(opt.titleKey)}</CardTitle>
                <CardDescription className="text-xs">{t(opt.descKey)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-center">
                <div>
                  <span className="text-2xl font-bold tabular-nums">
                    {formatPrice(opt.priceEur)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {' / '}
                    {opt.days} {t('days')}
                  </span>
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  disabled={isLoading || isPurchased}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePurchase(opt.type);
                  }}
                >
                  {isLoading && selectedBoost === opt.type ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : isPurchased ? (
                    <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Zap className="mr-1 h-3.5 w-3.5" />
                  )}
                  {isPurchased ? t('active') : t('boost')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
