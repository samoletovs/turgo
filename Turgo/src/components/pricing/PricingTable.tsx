"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { SubscriptionCard } from "./SubscriptionCard";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/constants";

type PlanName = "FREE" | "PRO" | "BUSINESS";

interface PlanData {
  id?: string;
  name: PlanName;
  stripePriceId?: string | null;
}

interface PricingTableProps {
  plans?: PlanData[];
  currentPlan?: PlanName | null;
  className?: string;
}

export function PricingTable({
  plans,
  currentPlan,
  className,
}: PricingTableProps) {
  const t = useTranslations("pricing");
  const tFeatures = useTranslations("pricing.features");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const handleSubscribe = useCallback(async (planId: string) => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  }, []);

  const planConfigs: {
    key: PlanName;
    isPopular: boolean;
    tKey: "free" | "pro" | "business";
  }[] = [
    { key: "FREE", isPopular: false, tKey: "free" },
    { key: "PRO", isPopular: true, tKey: "pro" },
    { key: "BUSINESS", isPopular: false, tKey: "business" },
  ];

  const buildFeatures = (name: PlanName) => {
    const limits = PLAN_LIMITS[name];
    return [
      {
        label:
          limits.maxListings >= 999999
            ? tFeatures("unlimitedListings")
            : tFeatures("listings", { count: limits.maxListings }),
        included: true,
      },
      {
        label: tFeatures("photos", { count: limits.maxPhotosPerListing }),
        included: true,
      },
      {
        label:
          limits.maxSellingAgents >= 999999
            ? tFeatures("unlimitedAgents")
            : tFeatures("agents", { count: limits.maxSellingAgents }),
        included: true,
      },
      {
        label: limits.hasAiPremium
          ? tFeatures("premiumAgent")
          : tFeatures("basicAgent"),
        included: true,
      },
      { label: tFeatures("analytics"), included: limits.hasAnalytics },
      { label: tFeatures("boosts"), included: name !== "FREE" },
      { label: tFeatures("priority"), included: name === "BUSINESS" },
      { label: tFeatures("api"), included: name === "BUSINESS" },
    ];
  };

  const yearlySavings = Math.round(
    ((PLAN_PRICES.PRO.monthly * 12 - PLAN_PRICES.PRO.yearly) /
      (PLAN_PRICES.PRO.monthly * 12)) *
      100,
  );

  return (
    <div className={className}>
      {/* Interval toggle */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          onClick={() => setInterval("monthly")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            interval === "monthly"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {t("monthly") ?? "Monthly"}
        </button>
        <button
          onClick={() => setInterval("yearly")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            interval === "yearly"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {t("yearly") ?? "Yearly"}
          <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
            -{yearlySavings}%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {planConfigs.map(({ key, isPopular, tKey }) => {
          const price =
            interval === "yearly"
              ? PLAN_PRICES[key].yearly
              : PLAN_PRICES[key].monthly;

          const planData = plans?.find((p) => p.name === key);

          return (
            <SubscriptionCard
              key={key}
              name={t(`${tKey}.name`)}
              description={t(`${tKey}.description`)}
              price={price}
              interval={interval}
              features={buildFeatures(key)}
              isPopular={isPopular}
              isCurrent={currentPlan === key}
              planId={planData?.id}
              onSubscribe={handleSubscribe}
            />
          );
        })}
      </div>
    </div>
  );
}
