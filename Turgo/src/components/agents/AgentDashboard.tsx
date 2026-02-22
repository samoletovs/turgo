"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentCard, type AgentCardData } from "./AgentCard";
import { trpc } from "@/lib/trpc/client";
import { Bot, TrendingUp, ShoppingBag, DollarSign } from "lucide-react";

interface AgentDashboardProps {
  locale: string;
  className?: string;
}

export function AgentDashboard({ locale, className }: AgentDashboardProps) {
  const t = useTranslations("dashboard");
  const tStats = useTranslations("dashboard.stats");

  const { data: agents, isLoading: agentsLoading } =
    trpc.agent.myAgents.useQuery();
  const { data: stats, isLoading: statsLoading } =
    trpc.agent.dashboardStats.useQuery();

  const allAgents: AgentCardData[] = [
    ...(agents?.sellingAgents?.map((a) => ({
      ...a,
      type: "SELLING" as const,
      listing: {
        id: a.listing.id,
        title: a.listing.title,
        slug: a.listing.slug,
        images: a.listing.images ?? [],
      },
      actions: (a.actions ?? []).map((act) => ({
        createdAt: act.createdAt,
        description: act.description,
      })),
    })) ?? []),
    ...(agents?.buyingAgents?.map((a) => ({
      ...a,
      type: "BUYING" as const,
      searchCriteria: (a.searchCriteria as Record<string, unknown>) ?? {},
      actions: (a.actions ?? []).map((act) => ({
        createdAt: act.createdAt,
        description: act.description,
      })),
    })) ?? []),
  ];

  const activeCount = allAgents.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className={className}>
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<Bot className="h-5 w-5 text-primary" />}
          label={tStats("activeSelling")}
          value={statsLoading ? null : String(stats?.activeSellingAgents ?? 0)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          label={tStats("activeBuying")}
          value={statsLoading ? null : String(stats?.activeBuyingAgents ?? 0)}
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5 text-green-500" />}
          label={tStats("actionsTaken")}
          value={statsLoading ? null : String(stats?.actionsLast24h ?? 0)}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          label={tStats("dealsFound")}
          value={statsLoading ? null : String(stats?.totalMatches ?? 0)}
        />
      </div>

      {/* Agent grid */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t("myAgents")}</h2>
        <span className="text-sm text-muted-foreground">
          {activeCount} {t("agents.title").toLowerCase()}
        </span>
      </div>

      {agentsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : allAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{t("noAgents")}</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {t("noAgentsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Stat card ---------- */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {value !== null ? (
            <p className="text-xl font-bold tabular-nums">{value}</p>
          ) : (
            <Skeleton className="mt-1 h-6 w-12" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Skeleton ---------- */

function AgentCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
      <div className="flex gap-2 border-t p-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  );
}
