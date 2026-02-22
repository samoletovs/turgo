"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Zap,
} from "lucide-react";

export default function RevenuePage() {
  const { data, isLoading } = trpc.admin.revenue.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-1/2" /><div className="h-8 bg-muted rounded w-3/4" /></div></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      title: "Monthly Recurring Revenue",
      value: `€${data.mrr.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Boost Revenue (This Month)",
      value: `€${data.boostRevenue.toFixed(2)}`,
      icon: Zap,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
    {
      title: "Total Subscribers",
      value: data.totalSubscribers,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Churn Rate",
      value: `${data.churnRate}%`,
      icon: data.churnRate > 5 ? TrendingDown : TrendingUp,
      color: data.churnRate > 5 ? "text-red-600" : "text-green-600",
      bg: data.churnRate > 5 ? "bg-red-50 dark:bg-red-950" : "bg-green-50 dark:bg-green-950",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
        <p className="text-muted-foreground">
          Subscription MRR, boost revenue, and churn tracking
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`rounded-lg p-3 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscription Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subscription Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["FREE", "PRO", "BUSINESS"] as const).map((plan) => {
              const count = data.planCounts[plan] || 0;
              const total = Object.values(data.planCounts).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
              const colors: Record<string, string> = {
                FREE: "bg-gray-500",
                PRO: "bg-blue-500",
                BUSINESS: "bg-purple-500",
              };

              return (
                <div key={plan} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{plan}</span>
                    <span className="text-sm text-muted-foreground">{count} users</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors[plan]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct}% of total</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* MRR History Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Over Time (12 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Simple bar chart */}
            <div className="flex items-end gap-1 h-48">
              {data.mrrHistory.map((point, i) => {
                const maxVal = Math.max(...data.mrrHistory.map((p) => p.mrr + p.boosts), 1);
                const totalHeight = ((point.mrr + point.boosts) / maxVal) * 100;
                const mrrHeight = (point.mrr / maxVal) * 100;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                      <div
                        className="w-full bg-amber-400 rounded-t"
                        style={{ height: `${totalHeight - mrrHeight}%`, minHeight: point.boosts > 0 ? 2 : 0 }}
                        title={`Boosts: €${point.boosts}`}
                      />
                      <div
                        className="w-full bg-primary rounded-b"
                        style={{ height: `${mrrHeight}%`, minHeight: point.mrr > 0 ? 2 : 0 }}
                        title={`MRR: €${point.mrr}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap">
                      {point.month}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 justify-center text-sm">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-primary" />
                <span className="text-muted-foreground">Subscription MRR</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-amber-400" />
                <span className="text-muted-foreground">Boost Revenue</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
