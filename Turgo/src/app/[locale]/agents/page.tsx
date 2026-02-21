import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Bot,
  TrendingUp,
  TrendingDown,
  Zap,
  Pause,
  Play,
  Eye,
  MessageSquare,
  DollarSign,
  ShoppingBag,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

interface AgentsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const [sellingAgents, buyingAgents] = await Promise.all([
    db.sellingAgent.findMany({
      where: { listing: { userId: session.user.id } },
      orderBy: { createdAt: "desc" },
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
        actions: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        _count: { select: { actions: true } },
      },
    }),
    db.buyingAgent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        matches: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            listing: {
              select: { id: true, title: true, slug: true, price: true, currency: true },
            },
          },
        },
        _count: { select: { matches: true } },
      },
    }),
  ]);

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "success";
      case "PAUSED": return "secondary";
      case "COMPLETED": return "default";
      default: return "outline";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My AI Agents</h1>
          <p className="text-muted-foreground">
            Manage your selling and buying agents
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/${locale}/sell`}>
            <Button>
              <Zap className="mr-2 h-4 w-4" /> New Selling Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Selling Agents */}
      <div className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Selling Agents ({sellingAgents.length})
        </h2>

        {sellingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No selling agents</h3>
              <p className="text-muted-foreground">
                Create a listing with an AI agent to automate pricing and responses
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellingAgents.map((agent: typeof sellingAgents[number]) => (
              <Card key={agent.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1 text-base">
                      {agent.listing.title}
                    </CardTitle>
                    <Badge variant={statusColor(agent.status) as "default" | "secondary" | "destructive" | "outline" | "success"}>
                      {agent.status}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatPrice(agent.listing.price, agent.listing.currency)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {agent._count.actions} actions
                    </span>
                    {agent.autoRespond && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Auto-reply
                      </span>
                    )}
                    {agent.autoNegotiate && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        Auto-price
                      </span>
                    )}
                  </div>

                  {/* Recent Actions */}
                  {agent.actions.length > 0 && (
                    <div className="space-y-1 rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium">Recent activity</p>
                      {agent.actions.map((action: typeof agent.actions[number]) => (
                        <p key={action.id} className="text-xs text-muted-foreground">
                          {action.actionType}: {action.description?.slice(0, 60)}...
                          <span className="ml-1 opacity-60">
                            {formatRelativeTime(action.createdAt)}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link href={`/${locale}/listing/${agent.listing.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Listing
                      </Button>
                    </Link>
                    <Button
                      variant={agent.status === "ACTIVE" ? "secondary" : "default"}
                      size="sm"
                    >
                      {agent.status === "ACTIVE" ? (
                        <><Pause className="mr-1 h-3 w-3" /> Pause</>
                      ) : (
                        <><Play className="mr-1 h-3 w-3" /> Resume</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Buying Agents */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <ShoppingBag className="h-5 w-5 text-blue-500" />
          Buying Agents ({buyingAgents.length})
        </h2>

        {buyingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No buying agents</h3>
              <p className="text-muted-foreground">
                Set up a buying agent to automatically find deals matching your criteria
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buyingAgents.map((agent: typeof buyingAgents[number]) => {
              const criteria = agent.searchCriteria as Record<string, unknown> | null;
              return (
              <Card key={agent.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {(criteria?.keywords as string) || "Any category"}
                    </CardTitle>
                    <Badge variant={statusColor(agent.status) as "default" | "secondary" | "destructive" | "outline" | "success"}>
                      {agent.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Budget: up to {formatPrice(agent.maxBudget, "EUR")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{agent._count.matches} matches</Badge>
                  </div>

                  {/* Recent Matches */}
                  {agent.matches.length > 0 && (
                    <div className="space-y-1 rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium">Recent matches</p>
                      {agent.matches.map((match: typeof agent.matches[number]) => (
                        <Link
                          key={match.id}
                          href={`/${locale}/listing/${match.listing.slug}`}
                          className="block text-xs text-primary hover:underline"
                        >
                          {match.listing.title} — {formatPrice(match.listing.price, match.listing.currency)}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
