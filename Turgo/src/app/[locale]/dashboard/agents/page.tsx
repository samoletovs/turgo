import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Bot,
  TrendingUp,
  ShoppingBag,
  Eye,
  MessageSquare,
  DollarSign,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

interface AgentsListPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AgentsListPage({ params }: AgentsListPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const userId = session.user.id;

  const [sellingAgents, buyingAgents] = await Promise.all([
    db.sellingAgent.findMany({
      where: { listing: { userId } },
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
            _count: { select: { favorites: true } },
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
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        matches: {
          orderBy: { createdAt: "desc" },
          take: 3,
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
          },
        },
        _count: { select: { matches: true } },
      },
    }),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Agents</h1>
            <p className="text-muted-foreground">
              {sellingAgents.length + buyingAgents.length} total agents
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/sell">
              <Button size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" /> New Selling Agent
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Selling Agents */}
      <div className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Selling Agents
          <Badge variant="secondary" className="ml-1">
            {sellingAgents.length}
          </Badge>
        </h2>

        {sellingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No selling agents. Create a listing with an AI agent to get
                started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sellingAgents.map((agent) => (
              <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                <Card className="transition-colors hover:bg-accent/30">
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Thumbnail */}
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {agent.listing.images[0] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={agent.listing.images[0].url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Bot className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {agent.listing.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-sm font-semibold text-primary">
                          {formatPrice(
                            agent.listing.price,
                            agent.listing.currency,
                          )}
                        </p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" /> {agent._count.actions}
                          </span>
                          {agent.autoRespond && (
                            <span className="flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" /> Auto-reply
                            </span>
                          )}
                          {agent.autoNegotiate && (
                            <span className="flex items-center gap-0.5">
                              <DollarSign className="h-3 w-3" /> Negotiate
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Last activity */}
                      {agent.actions[0] && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Last: {agent.actions[0].actionType} —{" "}
                          {formatRelativeTime(agent.actions[0].createdAt)}
                        </p>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          agent.status === "ACTIVE" ? "default" : "secondary"
                        }
                        className={
                          agent.status === "ACTIVE"
                            ? "bg-green-500/10 text-green-600 border-0"
                            : ""
                        }
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${agent.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"}`}
                        />
                        {agent.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Buying Agents */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ShoppingBag className="h-5 w-5 text-blue-500" />
          Buying Agents
          <Badge variant="secondary" className="ml-1">
            {buyingAgents.length}
          </Badge>
        </h2>

        {buyingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No buying agents. Set one up to automatically find deals.
              </p>
              <Link href="/search?setup_agent=1">
                <Button className="mt-4" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Create Buying Agent
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {buyingAgents.map((agent) => {
              const criteria = agent.searchCriteria as Record<
                string,
                unknown
              > | null;
              return (
                <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                  <Card className="transition-colors hover:bg-accent/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <ShoppingBag className="h-6 w-6 text-blue-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {(criteria?.keywords as string) || "Buying Agent"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-sm text-muted-foreground">
                            Budget: {formatPrice(agent.maxBudget, "EUR")}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {agent._count.matches} matches
                          </span>
                        </div>
                        {agent.matches[0] && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Latest: {agent.matches[0].listing.title}
                          </p>
                        )}
                      </div>

                      <Badge
                        variant={
                          agent.status === "ACTIVE" ? "default" : "secondary"
                        }
                        className={
                          agent.status === "ACTIVE"
                            ? "bg-blue-500/10 text-blue-600 border-0"
                            : ""
                        }
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${agent.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"}`}
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
    </div>
  );
}
