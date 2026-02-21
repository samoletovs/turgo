"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingDown,
  Clock,
  Zap,
  Star,
  MapPin,
  Wrench,
  BarChart3,
  Trophy,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DealScoreBreakdown } from "@/types";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface DealScoreCardProps {
  /** The breakdown of scores across all 7 factors */
  breakdown: DealScoreBreakdown;
  /** Listing title for context */
  title?: string;
  /** Listing price */
  price?: number;
  /** Market average price for comparison */
  marketAvg?: number;
  /** Compact mode for lists */
  compact?: boolean;
}

const FACTORS: {
  key: keyof Omit<DealScoreBreakdown, "total">;
  label: string;
  maxPoints: number;
  icon: typeof TrendingDown;
  color: string;
  description: string;
}[] = [
  { key: "priceVsMarket", label: "Price vs Market", maxPoints: 30, icon: TrendingDown, color: "#22c55e", description: "How the price compares to market average" },
  { key: "timeOnMarket", label: "Time on Market", maxPoints: 15, icon: Clock, color: "#3b82f6", description: "Freshly listed or overdue?" },
  { key: "sellerUrgency", label: "Seller Urgency", maxPoints: 15, icon: Zap, color: "#f97316", description: "How urgently the seller wants to sell" },
  { key: "listingQuality", label: "Listing Quality", maxPoints: 10, icon: Star, color: "#eab308", description: "Photos, description completeness" },
  { key: "sellerReputation", label: "Seller Reputation", maxPoints: 10, icon: BarChart3, color: "#8b5cf6", description: "Seller's track record and ratings" },
  { key: "locationConvenience", label: "Location", maxPoints: 10, icon: MapPin, color: "#ec4899", description: "Proximity and location convenience" },
  { key: "conditionVsPrice", label: "Condition vs Price", maxPoints: 10, icon: Wrench, color: "#06b6d4", description: "Item condition relative to asking price" },
];

function getScoreGrade(total: number): { label: string; emoji: string; color: string; bgColor: string } {
  if (total >= 85) return { label: "Exceptional Deal", emoji: "🏆", color: "text-green-600", bgColor: "bg-green-500/10" };
  if (total >= 70) return { label: "Great Deal", emoji: "🎯", color: "text-blue-600", bgColor: "bg-blue-500/10" };
  if (total >= 55) return { label: "Good Deal", emoji: "👍", color: "text-yellow-600", bgColor: "bg-yellow-500/10" };
  if (total >= 40) return { label: "Fair Deal", emoji: "😐", color: "text-orange-600", bgColor: "bg-orange-500/10" };
  return { label: "Below Average", emoji: "⚠️", color: "text-red-600", bgColor: "bg-red-500/10" };
}

export function DealScoreCard({
  breakdown,
  title,
  price,
  marketAvg,
  compact = false,
}: DealScoreCardProps) {
  const grade = useMemo(() => getScoreGrade(breakdown.total), [breakdown.total]);

  // Circular progress for the total score
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (breakdown.total / 100) * circumference;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Mini circular score */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={3} />
            <motion.circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke={breakdown.total >= 70 ? "#22c55e" : breakdown.total >= 50 ? "#eab308" : "#ef4444"}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 20}
              initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 20 - (breakdown.total / 100) * 2 * Math.PI * 20 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <span className="absolute text-sm font-bold">{breakdown.total}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title || "Deal Score"}</p>
          <p className={`text-xs font-medium ${grade.color}`}>
            {grade.emoji} {grade.label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {/* Header with total score */}
        <div className="mb-5 flex items-center gap-4">
          {/* Large circular score */}
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={6} />
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={breakdown.total >= 70 ? "#22c55e" : breakdown.total >= 50 ? "#eab308" : "#ef4444"}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold">{breakdown.total}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>

          <div className="flex-1">
            <Badge className={`${grade.bgColor} ${grade.color} mb-1 border-0`}>
              {grade.emoji} {grade.label}
            </Badge>
            {title && <p className="text-sm font-medium mt-1">{title}</p>}
            {price != null && marketAvg != null && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">€{price}</span>
                <span>vs market avg</span>
                <span className="font-semibold">€{Math.round(marketAvg)}</span>
                {price < marketAvg && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 text-[10px] border-0">
                    {Math.round(((marketAvg - price) / marketAvg) * 100)}% below
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Factor breakdown bars */}
        <div className="space-y-3">
          {FACTORS.map((factor, i) => {
            const score = breakdown[factor.key];
            const pct = (score / factor.maxPoints) * 100;
            const Icon = factor.icon;
            return (
              <motion.div
                key={factor.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: factor.color }} />
                  <span className="text-xs font-medium flex-1">{factor.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {score}/{factor.maxPoints}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: factor.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.1 * i, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recommendation */}
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          {breakdown.total >= 70 ? (
            <>
              <ThumbsUp className="h-4 w-4 text-green-500" />
              <p className="text-xs">
                <strong className="text-green-600">Recommended —</strong> This is a strong deal.
                Consider making an offer before someone else does.
              </p>
            </>
          ) : breakdown.total >= 50 ? (
            <>
              <Minus className="h-4 w-4 text-yellow-500" />
              <p className="text-xs">
                <strong className="text-yellow-600">Decent —</strong> Worth watching, but consider
                negotiating for a better price.
              </p>
            </>
          ) : (
            <>
              <ThumbsDown className="h-4 w-4 text-red-500" />
              <p className="text-xs">
                <strong className="text-red-600">Pass —</strong> This deal scores below average.
                Better options likely exist.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
