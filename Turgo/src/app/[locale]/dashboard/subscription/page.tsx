import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Crown,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  CheckCircle,
  Shield,
  Zap,
  Building2,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { SubscriptionActions } from "./subscription-client";

interface SubscriptionPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SubscriptionPage({
  params,
}: SubscriptionPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: { include: { plan: true } },
      _count: {
        select: {
          listings: true,
          sellingAgents: true,
          buyingAgents: true,
        },
      },
    },
  });

  if (!user) {
    redirect(`/${locale}/auth/signin`);
  }

  const subscription = user.subscription;
  const plan = subscription?.plan;
  const planName = plan?.name || "FREE";
  const isActive = subscription?.status === "ACTIVE";
  const isCancelPending = subscription?.cancelAtPeriodEnd;

  const planIcons: Record<string, React.ReactNode> = {
    FREE: <Zap className="h-8 w-8 text-gray-400" />,
    PRO: <Crown className="h-8 w-8 text-yellow-500" />,
    BUSINESS: <Building2 className="h-8 w-8 text-purple-500" />,
  };

  const usageLimits = {
    listings: {
      current: user._count.listings,
      max: plan?.maxListings ?? 5,
    },
    sellingAgents: {
      current: user._count.sellingAgents,
      max: plan?.maxSellingAgents ?? 1,
    },
    buyingAgents: {
      current: user._count.buyingAgents,
      max: plan?.maxBuyingAgents ?? 1,
    },
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">Manage your plan and billing</p>
      </div>

      {/* Current Plan Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {planIcons[planName]}
              <div>
                <CardTitle className="text-xl">{planName} Plan</CardTitle>
                <CardDescription>
                  {planName === "FREE"
                    ? "Basic features included"
                    : `${formatPrice(plan?.price || 0, "EUR")}/${plan?.interval === "YEARLY" ? "year" : "month"}`}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={
                isActive && !isCancelPending
                  ? "bg-green-500/10 text-green-600 border-0"
                  : isCancelPending
                    ? "bg-yellow-500/10 text-yellow-600 border-0"
                    : ""
              }
            >
              {isCancelPending
                ? "Cancelling"
                : isActive
                  ? "Active"
                  : subscription?.status || "Free"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Billing period info */}
          {subscription?.currentPeriodEnd && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {isCancelPending ? (
                <span>
                  Access until{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              ) : (
                <span>
                  Next billing date:{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {isCancelPending && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-800 dark:bg-yellow-950">
              <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800 dark:text-yellow-200">
                Your subscription is set to cancel at the end of the current
                period. You can resume it anytime before then.
              </span>
            </div>
          )}

          {/* AI Provider info */}
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
            <Shield className="h-4 w-4" />
            <span>
              AI Provider:{" "}
              <strong>
                {planName === "FREE" ? "Basic (Ollama)" : "Premium (GPT-4o)"}
              </strong>
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {planName === "FREE" ? (
              <Link href="/pricing">
                <Button className="gap-1">
                  <ArrowUpRight className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              </Link>
            ) : (
              <SubscriptionActions
                hasSubscription={!!subscription?.stripeSubscriptionId}
                isCancelPending={!!isCancelPending}
                hasStripeCustomer={!!subscription?.stripeCustomerId}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(usageLimits).map(([key, { current, max }]) => {
              const label =
                key === "listings"
                  ? "Active Listings"
                  : key === "sellingAgents"
                    ? "Selling Agents"
                    : "Buying Agents";
              const isUnlimited = max === -1 || max > 9999;
              const percentage = isUnlimited
                ? 0
                : max > 0
                  ? (current / max) * 100
                  : 0;
              const isNearLimit = !isUnlimited && percentage >= 80;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{label}</span>
                    <span
                      className={
                        isNearLimit
                          ? "text-orange-500 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {current} / {isUnlimited ? "Unlimited" : max}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isNearLimit ? "bg-orange-500" : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {Object.values(usageLimits).some(
            ({ current, max }) => max > 0 && max < 9999 && current >= max,
          ) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-800 dark:bg-orange-950">
              <AlertCircle className="mt-0.5 h-4 w-4 text-orange-600" />
              <span className="text-orange-800 dark:text-orange-200">
                You&apos;ve reached your plan limit.{" "}
                <Link href="/pricing" className="underline font-medium">
                  Upgrade
                </Link>{" "}
                for more capacity.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan features summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              {
                label: "Photos per listing",
                value: plan?.maxPhotosPerListing ?? 5,
              },
              {
                label: "Listing duration",
                value: `${plan?.listingDurationDays ?? 30} days`,
              },
              { label: "Saved searches", value: plan?.maxSavedSearches ?? 3 },
              { label: "Premium AI", value: plan?.hasAiPremium ? "Yes" : "No" },
              { label: "Analytics", value: plan?.hasAnalytics ? "Yes" : "No" },
              {
                label: "Auto-negotiate",
                value: plan?.hasAutoNegotiate ? "Yes" : "No",
              },
              {
                label: "Auto-translate",
                value: plan?.hasAutoTranslate ? "Yes" : "No",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium flex items-center gap-1">
                  {item.value === "Yes" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : item.value === "No" ? (
                    <span className="text-muted-foreground/60">—</span>
                  ) : null}
                  {typeof item.value === "number"
                    ? item.value === -1
                      ? "Unlimited"
                      : item.value
                    : item.value !== "Yes" && item.value !== "No"
                      ? item.value
                      : null}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
