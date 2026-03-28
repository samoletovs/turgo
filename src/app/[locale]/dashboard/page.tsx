import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  Bot,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  MessageSquare,
  DollarSign,
  Zap,
  Activity,
  ArrowUpRight,
  Target,
  Bell,
  CreditCard,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/server/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatRelativeTime } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const userId = session.user.id;
  const t = await getTranslations('dashboard');

  // Fetch aggregated stats
  const [sellingAgents, buyingAgents, recentActions, _listings] = await Promise.all([
    db.sellingAgent.findMany({
      where: { listing: { userId } },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            currency: true,
          },
        },
        _count: { select: { actions: true } },
      },
    }),
    db.buyingAgent.findMany({
      where: { userId },
      include: { _count: { select: { matches: true } } },
    }),
    db.agentAction.findMany({
      where: {
        OR: [{ sellingAgent: { listing: { userId } } }, { buyingAgent: { userId } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        sellingAgent: {
          include: { listing: { select: { title: true, slug: true } } },
        },
        buyingAgent: true,
      },
    }),
    db.listing.findMany({
      where: { userId },
      select: { id: true, status: true },
    }),
  ]);

  const activeSelling = sellingAgents.filter((a) => a.status === 'ACTIVE').length;
  const activeBuying = buyingAgents.filter((a) => a.status === 'ACTIVE').length;
  const totalActions = sellingAgents.reduce((sum, a) => sum + a._count.actions, 0);
  const totalMatches = buyingAgents.reduce((sum, a) => sum + a._count.matches, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/sell">
            <Button size="sm" className="gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> {t('sell')}
            </Button>
          </Link>
          <Link href="/search">
            <Button size="sm" variant="outline" className="gap-1">
              <ShoppingBag className="h-3.5 w-3.5" /> {t('buy')}
            </Button>
          </Link>
          <Link href="/dashboard/subscription">
            <Button size="sm" variant="outline" className="gap-1">
              <CreditCard className="h-3.5 w-3.5" /> {t('subscription')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSelling}</p>
              <p className="text-xs text-muted-foreground">{t('stats.activeSelling')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <ShoppingBag className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeBuying}</p>
              <p className="text-xs text-muted-foreground">{t('stats.activeBuying')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <Activity className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalActions}</p>
              <p className="text-xs text-muted-foreground">{t('stats.actionsTaken')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <Target className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMatches}</p>
              <p className="text-xs text-muted-foreground">{t('stats.dealsFound')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two columns: Agent Status + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Agent status cards */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('myAgents')}</h2>
            <Link href="/dashboard/agents">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                {t('viewAll')} <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {sellingAgents.length === 0 && buyingAgents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">{t('noAgents')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('noAgentsDesc')}</p>
                <div className="flex justify-center gap-3">
                  <Link href="/sell">
                    <Button size="sm">{t('createSellingAgent')}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Selling agents */}
              {sellingAgents.slice(0, 3).map((agent) => (
                <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.listing.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(agent.listing.price, agent.listing.currency)} ·{' '}
                          {agent._count.actions} {t('actions')}
                        </p>
                      </div>
                      <Badge
                        variant={agent.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={
                          agent.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border-0' : ''
                        }
                      >
                        <span
                          className={`mr-1 h-1.5 w-1.5 rounded-full ${agent.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                        {agent.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}

              {/* Buying agents */}
              {buyingAgents.slice(0, 3).map((agent) => {
                const criteria = agent.searchCriteria as Record<string, unknown> | null;
                return (
                  <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                          <ShoppingBag className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {(criteria?.keywords as string) || t('buyingAgent')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('budget')} {formatPrice(agent.maxBudget, 'EUR')} ·{' '}
                            {agent._count.matches} {t('matches')}
                          </p>
                        </div>
                        <Badge
                          variant={agent.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={
                            agent.status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-600 border-0' : ''
                          }
                        >
                          <span
                            className={`mr-1 h-1.5 w-1.5 rounded-full ${agent.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}
                          />
                          {agent.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">{t('recentActivity')}</h2>
          <Card>
            <CardContent className="p-0">
              {recentActions.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentActions.map((action) => {
                    const iconMap: Record<string, typeof Zap> = {
                      PRICE_ADJUST: TrendingDown,
                      AUTO_RESPOND: MessageSquare,
                      NEGOTIATE: DollarSign,
                      BOOST: Zap,
                      MATCH_FOUND: Target,
                      ALERT: Bell,
                    };
                    const Icon = iconMap[action.actionType] || Activity;
                    return (
                      <div key={action.id} className="flex items-start gap-3 p-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">
                            <span className="font-medium">{action.actionType}</span>
                            {action.sellingAgent && (
                              <span className="text-muted-foreground">
                                {' '}
                                — {action.sellingAgent.listing.title}
                              </span>
                            )}
                          </p>
                          {action.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {action.description}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatRelativeTime(action.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
