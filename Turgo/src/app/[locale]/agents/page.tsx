import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Bot,
  TrendingUp,
  Zap,
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
import { getTranslations } from "next-intl/server";
import { AgentStatusButton } from "@/components/agents/AgentStatusButton";

interface AgentsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const t = await getTranslations("agent");

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

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "PAUSED":
        return "secondary";
      case "COMPLETED":
        return "default";
      default:
        return "outline";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("myAgents")}</h1>
          <p className="text-muted-foreground">{t("manageAgents")}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/sell">
            <Button>
              <Zap className="mr-2 h-4 w-4" /> {t("newSellingAgent")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Selling Agents */}
      <div className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <TrendingUp className="h-5 w-5 text-green-500" />
          {t("selling.title")} ({sellingAgents.length})
        </h2>

        {sellingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                {t("noSellingAgents")}
              </h3>
              <p className="text-muted-foreground">
                {t("noSellingAgentsDesc")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellingAgents.map((agent: (typeof sellingAgents)[number]) => (
              <Card key={agent.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1 text-base">
                      {agent.listing.title}
                    </CardTitle>
                    <Badge
                      variant={
                        statusColor(agent.status) as
                          | "default"
                          | "secondary"
                          | "destructive"
                          | "outline"
                          | "success"
                      }
                    >
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
                        {t("autoReply")}
                      </span>
                    )}
                    {agent.autoNegotiate && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {t("autoPrice")}
                      </span>
                    )}
                  </div>

                  {/* Recent Actions */}
                  {agent.actions.length > 0 && (
                    <div className="space-y-1 rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium">
                        {t("recentActivity")}
                      </p>
                      {agent.actions.map(
                        (action: (typeof agent.actions)[number]) => (
                          <p
                            key={action.id}
                            className="text-xs text-muted-foreground"
                          >
                            {action.actionType}:{" "}
                            {action.description?.slice(0, 60)}...
                            <span className="ml-1 opacity-60">
                              {formatRelativeTime(action.createdAt)}
                            </span>
                          </p>
                        ),
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/listing/${agent.listing.slug}`}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        {t("viewListing")}
                      </Button>
                    </Link>
                    <AgentStatusButton
                      agentId={agent.id}
                      initialStatus={agent.status}
                    />
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
          {t("buying.title")} ({buyingAgents.length})
        </h2>

        {buyingAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                {t("noBuyingAgents")}
              </h3>
              <p className="text-muted-foreground">{t("noBuyingAgentsDesc")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buyingAgents.map((agent: (typeof buyingAgents)[number]) => {
              const criteria = agent.searchCriteria as Record<
                string,
                unknown
              > | null;
              return (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        {(criteria?.keywords as string) || t("anyCategory")}
                      </CardTitle>
                      <Badge
                        variant={
                          statusColor(agent.status) as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                            | "success"
                        }
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("budgetUpTo")} {formatPrice(agent.maxBudget, "EUR")}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        {agent._count.matches} matches
                      </Badge>
                    </div>

                    {/* Recent Matches */}
                    {agent.matches.length > 0 && (
                      <div className="space-y-1 rounded-lg bg-muted p-3">
                        <p className="text-xs font-medium">
                          {t("recentMatches")}
                        </p>
                        {agent.matches.map(
                          (match: (typeof agent.matches)[number]) => (
                            <Link
                              key={match.id}
                              href={`/listing/${match.listing.slug}`}
                              className="block text-xs text-primary hover:underline"
                            >
                              {match.listing.title} —{" "}
                              {formatPrice(
                                match.listing.price,
                                match.listing.currency,
                              )}
                            </Link>
                          ),
                        )}
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
