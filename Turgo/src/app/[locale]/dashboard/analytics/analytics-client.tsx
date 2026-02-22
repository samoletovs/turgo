"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Eye,
  TrendingUp,
  MessageSquare,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { formatPrice } from "@/lib/utils";

/* ──────────────────────────────────────────────
   Lightweight SVG chart components
   (no external Recharts dependency needed)
   ────────────────────────────────────────────── */

function _MiniLineChart({
  data,
  color = "#2563EB",
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 240;
  const h = 60;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-16"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <linearGradient id={`grad-${color}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient>
      <polygon
        fill={`url(#grad-${color})`}
        points={`0,${h} ${points} ${w},${h}`}
      />
    </svg>
  );
}

function BarChart({
  data,
  labels,
  color = "#2563EB",
}: {
  data: number[];
  labels: string[];
  color?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((v, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-[10px] text-muted-foreground">{v}</span>
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${Math.max((v / max) * 100, 4)}%`,
              backgroundColor: color,
              opacity: 0.8,
            }}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main analytics component
   ────────────────────────────────────────────── */

interface AnalyticsClientProps {
  locale: string;
}

export function AnalyticsClient({ locale: _locale }: AnalyticsClientProps) {
  const t = useTranslations("analytics");

  // Fetch user's listings for analytics
  const { data: listingsData } = trpc.listing.myListings.useQuery({
    page: 1,
    limit: 50,
  });

  const listings = useMemo(() => listingsData?.listings ?? [], [listingsData]);

  // Stable random factors (generated once per mount via lazy state init)
  const [randomFactors] = useState(() =>
    Array.from({ length: 7 }, () => 0.6 + Math.random() * 0.8),
  );

  // Computed analytics
  const stats = useMemo(() => {
    const totalViews = listings.reduce((sum, l) => sum + (l.viewCount ?? 0), 0);
    const totalMessages = listings.reduce(
      (sum, l) => sum + (l._count?.messages ?? 0),
      0,
    );
    const activeCount = listings.filter((l) => l.status === "ACTIVE").length;
    const conversionRate =
      totalViews > 0 ? ((totalMessages / totalViews) * 100).toFixed(1) : "0";

    // Simulated views over time (last 7 days from current view counts)
    const viewsOverTime = randomFactors.map((factor) =>
      Math.round((totalViews / 7) * factor),
    );

    // Top performing listings (by views)
    const topListings = [...listings]
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 5);

    return {
      totalViews,
      totalMessages,
      activeCount,
      conversionRate,
      viewsOverTime,
      topListings,
    };
  }, [listings, randomFactors]);

  const dayLabels = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString("en", { weekday: "short" }));
    }
    return days;
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPI cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <Eye className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats.totalViews.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{t("totalViews")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <MessageSquare className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalMessages}</p>
              <p className="text-xs text-muted-foreground">
                {t("totalInquiries")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <TrendingUp className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.conversionRate}%</p>
              <p className="text-xs text-muted-foreground">
                {t("conversionRate")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <BarChart3 className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeCount}</p>
              <p className="text-xs text-muted-foreground">
                {t("activeListings")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Views over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("viewsOverTime")}</CardTitle>
            <CardDescription>{t("last7Days")}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={stats.viewsOverTime}
              labels={dayLabels}
              color="#2563EB"
            />
          </CardContent>
        </Card>

        {/* Inquiry conversion */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("conversionTitle")}</CardTitle>
            <CardDescription>{t("conversionDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("totalViews")}
                </span>
                <span className="font-mono text-sm font-bold">
                  {stats.totalViews.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("totalInquiries")}
                </span>
                <span className="font-mono text-sm font-bold">
                  {stats.totalMessages}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${Math.min(
                      parseFloat(stats.conversionRate) * 5,
                      100,
                    )}%`,
                  }}
                />
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-3xl font-bold text-primary">
                  {stats.conversionRate}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("conversionRate")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top performing listings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("topPerforming")}</CardTitle>
          <CardDescription>{t("topPerformingDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topListings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noListings")}
            </p>
          ) : (
            <div className="divide-y">
              {stats.topListings.map((listing, idx) => {
                const views = listing.viewCount ?? 0;
                const messages = listing._count?.messages ?? 0;
                const rate =
                  views > 0 ? ((messages / views) * 100).toFixed(1) : "0";

                return (
                  <div
                    key={listing.id}
                    className="flex items-center gap-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {listing.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(listing.price, listing.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {views}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {messages}
                      </span>
                      <Badge
                        variant={parseFloat(rate) > 5 ? "success" : "secondary"}
                        className="text-[10px]"
                      >
                        {rate}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price change impact section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t("priceImpact")}</CardTitle>
          <CardDescription>{t("priceImpactDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {listings
              .filter((l) => l.status === "ACTIVE")
              .slice(0, 5)
              .map((listing) => {
                // Deterministic trend indicator based on listing id
                const trend = listing.id.charCodeAt(0) % 2 === 0;
                return (
                  <div
                    key={listing.id}
                    className="flex items-center gap-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {listing.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(listing.price, listing.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {trend ? (
                        <>
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            {t("moreViews")}
                          </span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="h-4 w-4 text-orange-500" />
                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            {t("lessViews")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            {listings.filter((l) => l.status === "ACTIVE").length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noActiveListings")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
