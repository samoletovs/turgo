import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Check, Zap, Crown, Building2, X } from "lucide-react";
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
import { PricingCheckoutButton } from "./pricing-client";

interface PricingPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string; interval?: string }>;
}

export default async function PricingPage({
  params,
  searchParams,
}: PricingPageProps) {
  const { locale } = await params;
  const { checkout, interval } = await searchParams;
  const t = await getTranslations("pricing");
  const session = await auth();

  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: [{ price: "asc" }],
  });

  const showYearly = interval === "yearly";
  const displayPlans = plans.filter(
    (p: (typeof plans)[number]) =>
      p.name === "FREE" ||
      (showYearly ? p.interval === "YEARLY" : p.interval === "MONTHLY"),
  );

  let currentPlanName: string | null = null;
  if (session?.user) {
    const sub = await db.subscription.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { plan: true },
    });
    currentPlanName = sub?.plan.name || null;
  }

  const planFeatures: Record<
    string,
    { included: string[]; excluded?: string[] }
  > = {
    FREE: {
      included: [
        "5 active listings",
        "5 photos per listing",
        "1 basic AI agent",
        "Community support",
        "30-day listing duration",
      ],
      excluded: [
        "Premium AI (GPT-4o)",
        "Auto-negotiate",
        "Analytics dashboard",
        "Auto-translate",
        "Featured boosts",
      ],
    },
    PRO: {
      included: [
        "50 active listings",
        "15 photos per listing",
        "5 AI agents (full power)",
        "Premium AI (GPT-4o)",
        "Auto-pricing & auto-respond",
        "Auto-negotiate offers",
        "Advanced analytics",
        "Auto-translate (5 languages)",
        "Priority support",
        "60-day listing duration",
      ],
    },
    BUSINESS: {
      included: [
        "Unlimited listings",
        "30 photos per listing",
        "Unlimited AI agents",
        "Premium AI (GPT-4o)",
        "All automation features",
        "Real-time market intelligence",
        "API access",
        "Auto-translate (5 languages)",
        "Dedicated account manager",
        "90-day listing duration",
      ],
    },
  };

  const planIcons: Record<string, React.ReactNode> = {
    FREE: <Zap className="h-6 w-6" />,
    PRO: <Crown className="h-6 w-6 text-yellow-500" />,
    BUSINESS: <Building2 className="h-6 w-6 text-purple-500" />,
  };

  const planSubtitles: Record<string, string> = {
    FREE: "Get started for free",
    PRO: "For serious sellers & buyers",
    BUSINESS: "For businesses & dealers",
  };

  return (
    <div className="container mx-auto px-4 py-16">
      {checkout === "success" && (
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Subscription activated successfully! Welcome to your new plan.
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          Checkout was cancelled. No charges were made.
        </div>
      )}

      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("subtitle")}</p>

        <div className="mt-6 inline-flex items-center gap-3 rounded-lg border p-1">
          <Link
            href="/pricing"
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              !showYearly
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </Link>
          <Link
            href="/pricing?interval=yearly"
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              showYearly
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <Badge variant="secondary" className="ml-2 text-xs">
              Save 20%
            </Badge>
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        {displayPlans.map((plan: (typeof displayPlans)[number]) => {
          const isCurrent = currentPlanName === plan.name;
          const isPro = plan.name === "PRO";
          const features = planFeatures[plan.name];

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${isPro ? "border-primary shadow-lg scale-105" : ""}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-4 py-1">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <div className="mx-auto mb-2">{planIcons[plan.name]}</div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{planSubtitles[plan.name]}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {plan.price === 0 ? "Free" : formatPrice(plan.price, "EUR")}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">
                      /{plan.interval === "YEARLY" ? "year" : "month"}
                    </span>
                  )}
                </div>
                {plan.interval === "YEARLY" && plan.price > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPrice(plan.price / 12, "EUR")}/month
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-3">
                  {features?.included.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {feature}
                    </li>
                  ))}
                  {features?.excluded?.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.name === "FREE" ? (
                    <Button variant="outline" className="w-full" disabled>
                      Free forever
                    </Button>
                  ) : session?.user ? (
                    <PricingCheckoutButton
                      planId={plan.id}
                      planName={plan.name}
                      isPro={isPro}
                    />
                  ) : (
                    <Link href="/auth/register">
                      <Button
                        className="w-full"
                        variant={isPro ? "default" : "outline"}
                      >
                        Get Started
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="mb-8 text-center text-2xl font-bold">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {[
            {
              q: "Can I upgrade or downgrade anytime?",
              a: "Yes, you can change your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, the change takes effect at the end of your billing period.",
            },
            {
              q: "What are AI agents?",
              a: "AI agents are intelligent assistants that automate selling and buying tasks. Selling agents can auto-respond to inquiries, adjust pricing based on market conditions, and optimize your listing. Buying agents monitor listings and alert you to deals matching your criteria.",
            },
            {
              q: "What's the difference between free and premium AI?",
              a: "Free users get basic AI assistance powered by lightweight models. Pro and Business users get premium AI powered by GPT-4o \u2014 smarter pricing, better auto-responses, image analysis, and multi-language translation.",
            },
            {
              q: "Is there a contract or commitment?",
              a: "No contracts! All paid plans are billed monthly and you can cancel anytime. Annual plans offer a 20% discount and are billed once per year.",
            },
            {
              q: "What payment methods do you accept?",
              a: "We accept all major credit cards (Visa, Mastercard, American Express) through our secure Stripe payment processing.",
            },
          ].map((faq) => (
            <div key={faq.q} className="rounded-lg border p-6">
              <h3 className="font-semibold">{faq.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
