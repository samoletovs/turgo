"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Activity, AlertCircle, Cpu, DollarSign } from "lucide-react";

export default function AgentsPage() {
  const { data, isLoading } = trpc.admin.agentMonitoring.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Agent Monitoring</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      title: "Active Selling Agents",
      value: data.activeSellingAgents,
      icon: Bot,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Active Buying Agents",
      value: data.activeBuyingAgents,
      icon: Bot,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Actions (24h)",
      value: data.recentActions,
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Error Rate (24h)",
      value: `${data.errorRate}%`,
      icon: AlertCircle,
      color: data.errorRate > 5 ? "text-red-600" : "text-green-600",
      bg:
        data.errorRate > 5
          ? "bg-red-50 dark:bg-red-950"
          : "bg-green-50 dark:bg-green-950",
    },
    {
      title: "AI Cost Today",
      value: `€${(data.aiCostTodayCents / 100).toFixed(2)}`,
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
    {
      title: "AI Tokens Today",
      value: data.aiTokensToday.toLocaleString(),
      icon: Cpu,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agent Monitoring</h1>
        <p className="text-muted-foreground">
          Live status, items processed, error rates, AI cost tracking
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
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

      {/* Agent Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selling Agents by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.sellingByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        status === "ACTIVE"
                          ? "bg-green-500"
                          : status === "PAUSED"
                            ? "bg-amber-500"
                            : status === "COMPLETED"
                              ? "bg-blue-500"
                              : "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm">{status}</span>
                  </div>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
              {Object.keys(data.sellingByStatus).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No selling agents
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buying Agents by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.buyingByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        status === "ACTIVE"
                          ? "bg-green-500"
                          : status === "PAUSED"
                            ? "bg-amber-500"
                            : status === "COMPLETED"
                              ? "bg-blue-500"
                              : "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm">{status}</span>
                  </div>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
              {Object.keys(data.buyingByStatus).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No buying agents
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics History */}
      {data.metricsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Metrics (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Processed
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Errors</th>
                    <th className="px-3 py-2 text-right font-medium">Avg ms</th>
                    <th className="px-3 py-2 text-right font-medium">Tokens</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.metricsHistory.map((m, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{m.date}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            m.agentType === "SELLING" ? "default" : "secondary"
                          }
                        >
                          {m.agentType}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{m.processed}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={
                            m.errors > 0 ? "text-red-600 font-medium" : ""
                          }
                        >
                          {m.errors}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{m.avgMs}ms</td>
                      <td className="px-3 py-2 text-right">
                        {m.tokens.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        €{(m.costCents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
