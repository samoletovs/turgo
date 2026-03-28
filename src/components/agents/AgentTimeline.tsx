'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';
import { formatRelativeTime } from '@/lib/utils';
import {
  TrendingDown,
  MessageSquare,
  HandCoins,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface AgentTimelineProps {
  agentId: string;
  agentType: 'SELLING' | 'BUYING';
  className?: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  PRICE_ADJUSTMENT: <TrendingDown className="h-4 w-4 text-orange-500" />,
  AUTO_RESPONSE: <MessageSquare className="h-4 w-4 text-blue-500" />,
  OFFER_RECEIVED: <HandCoins className="h-4 w-4 text-green-500" />,
  OFFER_SENT: <HandCoins className="h-4 w-4 text-emerald-500" />,
  COUNTER_OFFER: <HandCoins className="h-4 w-4 text-yellow-500" />,
  BOOST_APPLIED: <Zap className="h-4 w-4 text-purple-500" />,
  MATCH_FOUND: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  OFFER_ACCEPTED: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  OFFER_REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  ESCALATED: <AlertCircle className="h-4 w-4 text-amber-500" />,
  STATUS_CHANGE: <Clock className="h-4 w-4 text-muted-foreground" />,
};

function getActionIcon(actionType: string) {
  return ACTION_ICONS[actionType] ?? <Clock className="h-4 w-4 text-muted-foreground" />;
}

export function AgentTimeline({ agentId, agentType: _agentType, className }: AgentTimelineProps) {
  const t = useTranslations('dashboard.detail');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.agent.getActions.useInfiniteQuery(
      { agentId, limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    );

  const actions = data?.pages.flatMap((p) => p.actions) ?? [];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">{t('timeline')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">{t('timeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">{t('noActions')}</p>
            <p className="text-xs text-muted-foreground/70">{t('noActionsDesc')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{t('timeline')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 h-full w-px bg-border" />

          {actions.map((action, idx) => {
            const meta =
              action.metadata && typeof action.metadata === 'object'
                ? (action.metadata as Record<string, unknown>)
                : null;

            return (
              <div key={action.id ?? idx} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Dot on timeline */}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card">
                  {getActionIcon(action.actionType)}
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium leading-snug">{action.description}</p>

                  {/* Metadata badges */}
                  {meta && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {meta.oldPrice != null && meta.newPrice != null && (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
                          €{String(meta.oldPrice)} → €{String(meta.newPrice)}
                        </span>
                      )}
                      {meta.offerAmount != null && (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                          €{String(meta.offerAmount)}
                        </span>
                      )}
                      {meta.boostType != null && (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          {String(meta.boostType)}
                        </span>
                      )}
                      {meta.dealScore != null && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Score: {String(meta.dealScore)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Approval status */}
                  {action.requiresApproval && !action.approvedAt && !action.rejectedAt && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Pending approval
                    </span>
                  )}

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(new Date(action.createdAt))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-4 w-full rounded-lg border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
