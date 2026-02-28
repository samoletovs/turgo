"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bot,
  ArrowRight,
  Tag,
  ShoppingBag,
  TrendingDown,
  Star,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface HeroTabbedProps {
  locale: string;
}

type HeroMode = "sell" | "buy";

export function HeroTabbed({ locale }: HeroTabbedProps) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const [mode, setMode] = useState<HeroMode>("sell");

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-16 sm:py-20">
      {/* Decorative gradient blobs — rendered once statically */}
      <div className="pointer-events-none absolute -left-32 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-4">
        {/* Tab switcher */}
        <div className="mb-10 flex justify-center">
          <div className="inline-flex rounded-xl border bg-muted/50 p-1">
            <button
              onClick={() => setMode("sell")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all",
                mode === "sell"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Tag className="h-4 w-4" />
              {t("hero.tabs.sell")}
            </button>
            <button
              onClick={() => setMode("buy")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all",
                mode === "buy"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShoppingBag className="h-4 w-4" />
              {t("hero.tabs.buy")}
            </button>
          </div>
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left column — text + search + CTA */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                {t(`hero.${mode}.title`)}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground lg:max-w-lg">
                {t(`hero.${mode}.subtitle`)}
              </p>

              {/* Search bar */}
              <form
                className="mt-8 flex max-w-xl gap-2 mx-auto lg:mx-0"
                action={
                  mode === "sell" ? `/${locale}/sell` : `/${locale}/search`
                }
                method="GET"
                suppressHydrationWarning
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="q"
                    placeholder={t(`hero.${mode}.searchPlaceholder`)}
                    className="h-12 pl-10 text-base rounded-xl"
                  />
                </div>
                <Button type="submit" size="lg" className="rounded-xl">
                  {tCommon("search")}
                </Button>
              </form>

              {/* CTA */}
              <div className="mt-6 flex flex-col items-center gap-2 lg:items-start">
                <Button asChild size="lg" className={cn("gap-2 rounded-xl")}>
                  <Link href={mode === "sell" ? "/sell" : "/buy"}>
                    {mode === "sell" ? (
                      <Bot className="h-5 w-5" />
                    ) : (
                      <ShoppingBag className="h-5 w-5" />
                    )}
                    {t(`hero.${mode}.cta`)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <a
                  href="#categories"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("hero.browseBelow")}
                </a>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right column — static visual card */}
          <div className="flex justify-center lg:justify-end">
            <AnimatePresence mode="wait">
              {mode === "sell" ? (
                <SellVisual key="sell-visual" />
              ) : (
                <BuyVisual key="buy-visual" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Static sell visual card ── */
function SellVisual() {
  const t = useTranslations("home");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative mx-auto w-full max-w-sm lg:max-w-md"
    >
      <DemoCard badgeLabel="SOLD">
        {/* Mock listing card */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex gap-3">
            <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
              <Tag className="h-6 w-6 text-primary/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">iPhone 15 Pro</p>
              <p className="text-lg font-bold text-primary">€849</p>
              <div className="flex items-center gap-1 mt-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span className="text-xs text-muted-foreground">
                  {t("hero.sell.aiOptimized")}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-full rounded-full bg-primary" />
            </div>
            <span className="text-xs text-muted-foreground">
              {t("hero.demoListingCreated")}
            </span>
          </div>
        </div>
      </DemoCard>
    </motion.div>
  );
}

/* ── Static buy visual card ── */
function BuyVisual() {
  const t = useTranslations("home");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative mx-auto w-full max-w-sm lg:max-w-md"
    >
      <DemoCard badgeLabel="MATCH">
        {/* Match found card */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              {t("hero.buy.matchFound")}
            </span>
          </div>

          <div className="flex gap-3">
            <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-6 w-6 text-primary/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">MacBook Air M3</p>
              <p className="text-lg font-bold text-primary">€1,049</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingDown className="h-3 w-3 text-green-500" />
                <span className="text-xs font-medium text-green-600">
                  {t("hero.buy.belowMarket")}
                </span>
              </div>
            </div>
          </div>

          {/* Deal score */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {t("hero.buy.dealScore")}
            </span>
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span className="text-sm font-bold text-foreground">92/100</span>
            </div>
          </div>
        </div>
      </DemoCard>
    </motion.div>
  );
}

/* ── Shared demo card shell (header + badge) ── */
function DemoCard({
  badgeLabel,
  children,
}: {
  badgeLabel: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("home");

  return (
    <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/10 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2 border-b border-border/40 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{t("hero.agentName")}</p>
          <p className="text-xs text-green-500">{t("hero.demoOnline")}</p>
        </div>
      </div>

      {children}

      {/* Badge */}
      <div className="absolute -right-3 -top-3 flex items-center gap-1 rounded-full bg-green-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg -rotate-6">
        <CheckCircle className="h-3.5 w-3.5" />
        {badgeLabel}
      </div>
    </div>
  );
}
