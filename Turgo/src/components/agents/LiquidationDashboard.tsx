"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";
import {
  Package,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCcw,
  BarChart3,
  ArrowDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LiquidationItem {
  listingId: string;
  sellingAgentId: string;
  title: string;
  startingPrice: number;
  currentPrice: number;
  minimumPrice: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  soldPrice?: number;
}

interface LiquidationBatchStats {
  batchId: string;
  totalItems: number;
  itemsSold: number;
  itemsRemaining: number;
  itemsCancelled: number;
  totalRevenue: number;
  projectedRemainingValue: number;
  totalStartingValue: number;
  avgDiscountPercent: number;
  deadline: string;
  deadlineProgress: number;
  items: LiquidationItem[];
}

interface LiquidationDashboardProps {
  batchId: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "COMPLETED":
      return "bg-green-500/10 text-green-600 border-green-200";
    case "CANCELLED":
      return "bg-red-500/10 text-red-600 border-red-200";
    case "PAUSED":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatTimeRemaining(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LiquidationDashboard({
  batchId,
  className,
}: LiquidationDashboardProps) {
  const t = useTranslations("liquidation");
  const [stats, setStats] = useState<LiquidationBatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/agents/liquidation/${batchId}`);
      if (!res.ok) throw new Error("Failed to load batch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 60s
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center py-10">
          <XCircle className="mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={fetchStats}
          >
            <RefreshCcw className="mr-1 h-3 w-3" /> {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const progressPercent = Math.round(stats.deadlineProgress * 100);
  const soldPercent =
    stats.totalItems > 0
      ? Math.round((stats.itemsSold / stats.totalItems) * 100)
      : 0;
  const recoveryRate =
    stats.totalStartingValue > 0
      ? Math.round(
          ((stats.totalRevenue + stats.projectedRemainingValue) /
            stats.totalStartingValue) *
            100,
        )
      : 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Package className="h-5 w-5" />
            {t("batchTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("batchId")}: {stats.batchId}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
        >
          <RefreshCcw
            className={cn("mr-1 h-3 w-3", loading && "animate-spin")}
          />
          {t("refresh")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Sold / Total */}
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <CheckCircle2 className="mb-1 h-5 w-5 text-green-500" />
            <p className="text-2xl font-bold">
              {stats.itemsSold}/{stats.totalItems}
            </p>
            <p className="text-xs text-muted-foreground">{t("itemsSold")}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${soldPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <DollarSign className="mb-1 h-5 w-5 text-emerald-500" />
            <p className="text-2xl font-bold">
              {formatPrice(stats.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">{t("totalRevenue")}</p>
          </CardContent>
        </Card>

        {/* Projected Remaining */}
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <BarChart3 className="mb-1 h-5 w-5 text-blue-500" />
            <p className="text-2xl font-bold">
              {formatPrice(stats.projectedRemainingValue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("projectedValue")}
            </p>
          </CardContent>
        </Card>

        {/* Time Remaining */}
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <Clock className="mb-1 h-5 w-5 text-orange-500" />
            <p className="text-2xl font-bold">
              {formatTimeRemaining(stats.deadline)}
            </p>
            <p className="text-xs text-muted-foreground">{t("timeLeft")}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progressPercent > 80
                    ? "bg-red-500"
                    : progressPercent > 50
                      ? "bg-orange-500"
                      : "bg-blue-500",
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recovery & Discount summary */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1">
          <TrendingDown className="h-3 w-3" />
          {t("avgDiscount")}: {stats.avgDiscountPercent}%
        </Badge>
        <Badge variant="outline" className="gap-1">
          <BarChart3 className="h-3 w-3" />
          {t("recoveryRate")}: {recoveryRate}%
        </Badge>
        <Badge variant="outline" className="gap-1">
          <DollarSign className="h-3 w-3" />
          {t("startingValue")}: {formatPrice(stats.totalStartingValue)}
        </Badge>
      </div>

      {/* Item List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("items")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.items.map((item) => {
            const discount =
              item.startingPrice > 0
                ? Math.round(
                    ((item.startingPrice -
                      (item.soldPrice ?? item.currentPrice)) /
                      item.startingPrice) *
                      100,
                  )
                : 0;

            return (
              <div
                key={item.listingId}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {item.status === "COMPLETED" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : item.status === "CANCELLED" ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-blue-500" />
                  )}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.startingPrice)} →{" "}
                    {item.soldPrice
                      ? formatPrice(item.soldPrice)
                      : formatPrice(item.currentPrice)}
                  </p>
                </div>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-xs", statusColor(item.status))}
                >
                  {item.status === "COMPLETED" && item.soldPrice
                    ? `Sold ${formatPrice(item.soldPrice)}`
                    : item.status}
                </Badge>

                {/* Discount */}
                {discount > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    -{discount}%
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
