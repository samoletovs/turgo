import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Zap, Crown, Building2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";

interface PricingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale } = await params;
  const t = await getTranslations("pricing");
  const session = await auth();

  const plans = await db.plan.findMany({
    orderBy: [{ price: "asc" }],
  });

  // Group plans — show monthly by default
  const monthlyPlans = plans.filter(
    (p: typeof plans[number]) => p.name === "FREE" || p.interval === "MONTHLY"
  );

  let currentPlanName: string | null = null;
  if (session?.user) {
    const sub = await db.subscription.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { plan: true },
    });
    currentPlanName = sub?.plan.name || null;
  }

  const planFeatures: Record<string, string[]> = {
    FREE: [
      "5 active listings",
      "Basic search placement",
      "1 AI agent (limited)",
      "Community support",
      "Standard analytics",
    ],
    PRO: [
      "50 active listings",
      "Priority search placement",
      "5 AI agents (full power)",
      "Auto-pricing & auto-respond",
      "Advanced analytics",
      "3 featured boosts/month",
      "Priority support",
    ],
    BUSINESS: [
      "Unlimited listings",
      "Top search placement",
      "Unlimited AI agents",
      "All auto features",
      "Real-time market intelligence",
      "10 featured boosts/month",
      "API access",
      "Dedicated account manager",
    ],
  };

  const planIcons: Record<string, React.ReactNode> = {
    FREE: <Zap className="h-6 w-6" />,
    PRO: <Crown className="h-6 w-6 text-yellow-500" />,
    BUSINESS: <Building2 className="h-6 w-6 text-purple-500" />,
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        {monthlyPlans.map((plan: typeof monthlyPlans[number]) => {
          const isCurrent = currentPlanName === plan.name;
          const isPro = plan.name === "PRO";
          const features = planFeatures[plan.name] || [];

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isPro ? "border-primary shadow-lg scale-105" : ""
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-4 py-1">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <div className="mx-auto mb-2">
                  {planIcons[plan.name]}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.name === "FREE"
                    ? "Get started for free"
                    : plan.name === "PRO"
                    ? "For serious sellers"
                    : "For businesses & dealers"}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {plan.price === 0
                      ? "Free"
                      : formatPrice(plan.price, "EUR")}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-3">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
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
                  ) : (
                    <Button
                      className={`w-full ${isPro ? "" : "variant-outline"}`}
                      variant={isPro ? "default" : "outline"}
                    >
                      {session ? "Upgrade" : "Get Started"}
                    </Button>
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
              q: "Is there a contract or commitment?",
              a: "No contracts! All paid plans are billed monthly and you can cancel anytime. Annual plans offer a discount and are billed once per year.",
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
