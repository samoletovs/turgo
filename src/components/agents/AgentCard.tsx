'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AgentStatusBadge } from './AgentStatusBadge';
import { cn, formatPrice, formatRelativeTime, getLocalizedName } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import { Eye, MessageSquare, Target, Star, Pause, Play, Square, Zap } from 'lucide-react';

type AgentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

interface SellingAgentData {
  id: string;
  type: 'SELLING';
  status: AgentStatus;
  currentPrice: number;
  totalViews: number;
  totalInquiries: number;
  totalOffers: number;
  bestOfferPrice?: number | null;
  sellingStrategyId?: string | null;
  listing: {
    id: string;
    title: string;
    slug: string;
    images: { url: string }[];
  };
  actions: { createdAt: Date; description: string }[];
}

interface BuyingAgentData {
  id: string;
  type: 'BUYING';
  status: AgentStatus;
  searchCriteria: Record<string, unknown>;
  maxBudget: number;
  matchCount: number;
  bestMatchScore?: number | null;
  buyingStrategyId?: string | null;
  actions: { createdAt: Date; description: string }[];
}

export type AgentCardData = SellingAgentData | BuyingAgentData;

interface AgentCardProps {
  agent: AgentCardData;
  locale: string;
  className?: string;
}

export function AgentCard({ agent, locale, className }: AgentCardProps) {
  const t = useTranslations('dashboard.detail');
  const tAgent = useTranslations('agent');

  const updateStatus = trpc.agent.updateStatus.useMutation();
  const utils = trpc.useUtils();

  const handleStatusChange = async (newStatus: 'PAUSED' | 'ACTIVE' | 'CANCELLED') => {
    await updateStatus.mutateAsync({ agentId: agent.id, status: newStatus });
    utils.agent.myAgents.invalidate();
  };

  const isSelling = agent.type === 'SELLING';
  const lastAction = agent.actions[0];
  const imageUrl = isSelling && agent.listing.images[0]?.url ? agent.listing.images[0].url : null;

  // Resolve strategy label for display
  const strategyId = isSelling
    ? (agent as SellingAgentData).sellingStrategyId
    : (agent as BuyingAgentData).buyingStrategyId;
  const strategyLabel = strategyId
    ? tAgent(`strategy.${isSelling ? 'selling' : 'buying'}.${strategyId}`)
    : null;

  const title = isSelling
    ? agent.listing.title
    : getLocalizedName(
        (agent as BuyingAgentData).searchCriteria?.query ?? tAgent('buying.title'),
        locale,
      );

  return (
    <Card className={cn('group overflow-hidden transition-shadow hover:shadow-md', className)}>
      {/* Image / header */}
      <div className="relative h-40 w-full bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={typeof title === 'string' ? title : ''}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            {isSelling ? (
              <Zap className="h-10 w-10 text-muted-foreground/40" />
            ) : (
              <Target className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
        )}
        <div className="absolute right-2 top-2">
          <AgentStatusBadge status={agent.status} />
        </div>
        <div className="absolute left-2 top-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              isSelling
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
            )}
          >
            {isSelling ? tAgent('selling.title') : tAgent('buying.title')}
          </span>
        </div>
      </div>

      {/* Content */}
      <CardContent className="space-y-3 p-4">
        <h3 className="truncate text-sm font-semibold">{title}</h3>

        {/* Strategy badge */}
        {strategyLabel && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {strategyLabel}
          </span>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {isSelling ? (
            <>
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                <span>
                  {agent.totalViews} {t('views')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{agent.totalInquiries}</span>
              </div>
              <div className="col-span-2 text-sm font-semibold text-foreground tabular-nums">
                {formatPrice(agent.currentPrice)}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                <span>
                  {agent.matchCount} {tAgent('buying.matches')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" />
                <span>{agent.bestMatchScore != null ? `${agent.bestMatchScore}%` : '—'}</span>
              </div>
              <div className="col-span-2 text-sm font-semibold text-foreground tabular-nums">
                {tAgent('buying.maxPrice')}: {formatPrice(agent.maxBudget)}
              </div>
            </>
          )}
        </div>

        {/* Last action */}
        {lastAction && (
          <p className="truncate text-xs text-muted-foreground">
            {lastAction.description} · {formatRelativeTime(new Date(lastAction.createdAt))}
          </p>
        )}
      </CardContent>

      {/* Quick actions */}
      <CardFooter className="gap-2 border-t px-4 py-3">
        {agent.status === 'ACTIVE' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange('PAUSED')}
            disabled={updateStatus.isPending}
          >
            <Pause className="mr-1 h-3.5 w-3.5" />
            {t('pause')}
          </Button>
        )}
        {agent.status === 'PAUSED' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange('ACTIVE')}
            disabled={updateStatus.isPending}
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            {t('resume')}
          </Button>
        )}
        {(agent.status === 'ACTIVE' || agent.status === 'PAUSED') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleStatusChange('CANCELLED')}
            disabled={updateStatus.isPending}
          >
            <Square className="mr-1 h-3.5 w-3.5" />
            {t('stop')}
          </Button>
        )}
        {isSelling && (
          <Link href={`/listing/${agent.listing.slug}`} className="ml-auto">
            <Button variant="ghost" size="sm">
              {t('viewListing')}
            </Button>
          </Link>
        )}
        <Link href={`/dashboard/agents/${agent.id}`} className={isSelling ? '' : 'ml-auto'}>
          <Button variant="ghost" size="sm">
            {t('history')}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
