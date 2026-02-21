import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Eye,
  MessageSquare,
  DollarSign,
  Pause,
  Play,
  ArrowLeft,
  StopCircle,
  Clock,
  Zap,
  Target,
  Bell,
  Activity,
  Calendar,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

interface AgentDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { locale, id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  // Try to find as selling agent first, then buying agent
  const sellingAgent = await db.sellingAgent.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          currency: true,
          status: true,
          viewCount: true,
          images: { take: 4 },
          userId: true,
          createdAt: true,
        },
      },
      actions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { actions: true } },
    },
  });

  const buyingAgent = sellingAgent
    ? null
    : await db.buyingAgent.findUnique({
        where: { id },
        include: {
          matches: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              listing: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  price: true,
                  currency: true,
                  images: { take: 1 },
                },
              },
            },
          },
          actions: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          _count: { select: { matches: true, actions: true } },
        },
      });

  const agent = sellingAgent || buyingAgent;
  if (!agent) notFound();

  // Verify ownership
  if (sellingAgent && sellingAgent.listing.userId !== session.user.id) notFound();
  if (buyingAgent && buyingAgent.userId !== session.user.id) notFound();

  const isSelling = !!sellingAgent;
  const agentActions = agent.actions || [];

  // Group actions by day for timeline
  const actionsByDay = new Map<string, typeof agentActions>();
  for (const action of agentActions) {
    const dayKey = new Date(action.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!actionsByDay.has(dayKey)) actionsByDay.set(dayKey, []);
    actionsByDay.get(dayKey)!.push(action);
  }

  const actionIconMap: Record<string, typeof Zap> = {
    PRICE_ADJUST: TrendingDown,
    AUTO_RESPOND: MessageSquare,
    NEGOTIATE: DollarSign,
    BOOST: Zap,
    MATCH_FOUND: Target,
    ALERT: Bell,
    STATUS_CHANGE: Activity,
    MONITOR: Eye,
  };

  const actionColorMap: Record<string, string> = {
    PRICE_ADJUST: "text-yellow-500 bg-yellow-500/10",
    AUTO_RESPOND: "text-blue-500 bg-blue-500/10",
    NEGOTIATE: "text-green-500 bg-green-500/10",
    BOOST: "text-purple-500 bg-purple-500/10",
    MATCH_FOUND: "text-orange-500 bg-orange-500/10",
    ALERT: "text-red-500 bg-red-500/10",
    STATUS_CHANGE: "text-gray-500 bg-gray-500/10",
    MONITOR: "text-cyan-500 bg-cyan-500/10",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href={`/${locale}/dashboard/agents`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Agents
      </Link>

      {/* Agent header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-xl ${
              isSelling ? "bg-green-500/10" : "bg-blue-500/10"
            }`}
          >
            {isSelling ? (
              <TrendingUp className="h-7 w-7 text-green-500" />
            ) : (
              <ShoppingBag className="h-7 w-7 text-blue-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">
                {isSelling ? sellingAgent!.listing.title : "Buying Agent"}
              </h1>
              <Badge
                variant={agent.status === "ACTIVE" ? "default" : "secondary"}
                className={
                  agent.status === "ACTIVE"
                    ? isSelling
                      ? "bg-green-500/10 text-green-600 border-0"
                      : "bg-blue-500/10 text-blue-600 border-0"
                    : ""
                }
              >
                <span
                  className={`mr-1.5 h-2 w-2 rounded-full inline-block ${
                    agent.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {agent.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSelling ? (
                <>
                  {formatPrice(sellingAgent!.listing.price, sellingAgent!.listing.currency)} ·
                  Created {formatRelativeTime(agent.createdAt)}
                </>
              ) : (
                <>
                  Budget: {formatPrice(buyingAgent!.maxBudget, "EUR")} ·
                  Created {formatRelativeTime(agent.createdAt)}
                </>
              )}
            </p>
          </div>

          {/* Controls */}
          <div className="flex gap-2 shrink-0">
            {agent.status === "ACTIVE" ? (
              <>
                <Button variant="outline" size="sm" className="gap-1">
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
                <Button variant="destructive" size="sm" className="gap-1">
                  <StopCircle className="h-3.5 w-3.5" /> Stop
                </Button>
              </>
            ) : agent.status === "PAUSED" ? (
              <Button size="sm" className="gap-1">
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats + Config */}
        <div className="space-y-4">
          {/* Agent stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Agent Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Actions</span>
                <span className="font-semibold">{agent._count.actions}</span>
              </div>
              {isSelling && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Views</span>
                    <span className="font-semibold">{sellingAgent!.listing.viewCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Auto-Respond</span>
                    <Badge variant={sellingAgent!.autoRespond ? "default" : "secondary"} className="text-xs">
                      {sellingAgent!.autoRespond ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Auto-Negotiate</span>
                    <Badge variant={sellingAgent!.autoNegotiate ? "default" : "secondary"} className="text-xs">
                      {sellingAgent!.autoNegotiate ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Urgency</span>
                    <span className="font-medium text-xs">{sellingAgent!.urgency}</span>
                  </div>
                  {sellingAgent!.minimumPrice && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Price Floor</span>
                      <span className="font-semibold text-red-500">
                        {formatPrice(sellingAgent!.minimumPrice, sellingAgent!.listing.currency)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {!isSelling && buyingAgent && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Matches Found</span>
                    <span className="font-semibold">{buyingAgent._count.matches}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Max Budget</span>
                    <span className="font-semibold">{formatPrice(buyingAgent.maxBudget, "EUR")}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Selling agent images */}
          {isSelling && sellingAgent!.listing.images.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {sellingAgent!.listing.images.map((img: { id: string; url: string }) => (
                    <div key={img.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
                <Link
                  href={`/${locale}/listing/${sellingAgent!.listing.slug}`}
                  className="mt-2 block text-center text-xs text-primary hover:underline"
                >
                  View listing →
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Buying agent matches */}
          {!isSelling && buyingAgent && buyingAgent.matches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Matches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {buyingAgent.matches.slice(0, 5).map((match: typeof buyingAgent.matches[number]) => (
                  <Link
                    key={match.id}
                    href={`/${locale}/listing/${match.listing.slug}`}
                    className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent transition-colors"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      {match.listing.images?.[0] ? (
                        <img src={match.listing.images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                          <ShoppingBag className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{match.listing.title}</p>
                      <p className="text-xs text-primary font-semibold">
                        {formatPrice(match.listing.price, match.listing.currency)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Score: {match.dealScore}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Agent Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" /> Agent Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentActions.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No actions recorded yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Actions will appear here as the agent works
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(actionsByDay.entries()).map(([day, actions]) => (
                    <div key={day}>
                      {/* Day header */}
                      <div className="mb-3 flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">{day}</span>
                        <div className="flex-1 border-b" />
                      </div>

                      {/* Actions for this day */}
                      <div className="ml-4 space-y-0">
                        {(actions as typeof agentActions).map((action, i) => {
                          const Icon = actionIconMap[action.actionType] || Activity;
                          const colorClass = actionColorMap[action.actionType] || "text-gray-500 bg-gray-500/10";
                          const [textColor, bgColor] = colorClass.split(" ");
                          const isLast = i === (actions as typeof agentActions).length - 1;

                          return (
                            <div key={action.id} className="relative flex gap-3 pb-4">
                              {/* Timeline line */}
                              {!isLast && (
                                <div className="absolute left-[13px] top-7 h-full w-px bg-border" />
                              )}

                              {/* Icon */}
                              <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bgColor}`}>
                                <Icon className={`h-3.5 w-3.5 ${textColor}`} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{action.actionType}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(action.createdAt).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                {action.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {action.description}
                                  </p>
                                )}
                                {action.metadata && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {Object.entries(action.metadata as Record<string, unknown>)
                                      .slice(0, 3)
                                      .map(([key, val]) => (
                                        <Badge key={key} variant="outline" className="text-[10px]">
                                          {key}: {String(val)}
                                        </Badge>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
