import {
  Bot,
  Globe,
  Shield,
  Zap,
  Users,
  Mail,
  MapPin,
  Brain,
  TrendingUp,
  Clock,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { generatePageMetadata } from "@/lib/seo";
import { AboutPageJsonLd } from "@/components/json-ld";
import { Card, CardContent } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return generatePageMetadata({
    title: t("title"),
    description: t("subtitle"),
    path: "/about",
    locale,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });

  const values = [
    {
      icon: Bot,
      title: t("values.agentFirst.title"),
      desc: t("values.agentFirst.desc"),
    },
    {
      icon: Globe,
      title: t("values.balticFocus.title"),
      desc: t("values.balticFocus.desc"),
    },
    {
      icon: Shield,
      title: t("values.trustSafety.title"),
      desc: t("values.trustSafety.desc"),
    },
    {
      icon: Zap,
      title: t("values.innovation.title"),
      desc: t("values.innovation.desc"),
    },
  ];

  const techHighlights = [
    { icon: Brain, title: t("tech.ai.title"), desc: t("tech.ai.desc") },
    {
      icon: TrendingUp,
      title: t("tech.pricing.title"),
      desc: t("tech.pricing.desc"),
    },
    {
      icon: Clock,
      title: t("tech.realtime.title"),
      desc: t("tech.realtime.desc"),
    },
    { icon: Globe, title: t("tech.i18n.title"), desc: t("tech.i18n.desc") },
  ];

  return (
    <div className="py-16">
      <AboutPageJsonLd />

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("subtitle")}
        </p>
      </div>

      {/* Mission */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <div className="rounded-2xl border bg-card p-8 md:p-12">
          <h2 className="text-2xl font-bold mb-4">{t("mission.title")}</h2>
          <p className="text-muted-foreground leading-relaxed text-lg">
            {t("mission.desc")}
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <h2 className="text-2xl font-bold mb-4">{t("story.title")}</h2>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>{t("story.p1")}</p>
          <p>{t("story.p2")}</p>
          <p>{t("story.p3")}</p>
        </div>
      </section>

      {/* Core Values */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <h2 className="text-2xl font-bold mb-8 text-center">
          {t("values.title")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <Card key={v.title}>
                <CardContent className="p-6">
                  <Icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Baltic Market Focus */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <h2 className="text-2xl font-bold mb-4">{t("market.title")}</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {t("market.desc")}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["latvia", "lithuania", "estonia"] as const).map((country) => (
            <div key={country} className="rounded-xl border p-6 text-center">
              <p className="text-3xl mb-2">{t(`market.${country}.flag`)}</p>
              <h3 className="font-semibold">{t(`market.${country}.name`)}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t(`market.${country}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <h2 className="text-2xl font-bold mb-8 text-center">
          {t("tech.title")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {techHighlights.map((th) => {
            const Icon = th.icon;
            return (
              <div key={th.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{th.title}</h3>
                  <p className="text-sm text-muted-foreground">{th.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <h2 className="text-2xl font-bold mb-4">{t("team.title")}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t("team.desc")}
        </p>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-4xl px-4 mt-16">
        <h2 className="text-2xl font-bold mb-6">{t("contact.title")}</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border p-6 flex items-start gap-4">
            <Mail className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">{t("contact.emailLabel")}</h3>
              <a
                href="mailto:hello@turgo.io"
                className="text-sm text-primary hover:underline"
              >
                hello@turgo.io
              </a>
            </div>
          </div>
          <div className="rounded-xl border p-6 flex items-start gap-4">
            <MapPin className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">{t("contact.officeLabel")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("contact.address")}
              </p>
            </div>
          </div>
          <div className="rounded-xl border p-6 flex items-start gap-4">
            <Users className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">
                {t("contact.careersLabel")}
              </h3>
              <a
                href="mailto:careers@turgo.io"
                className="text-sm text-primary hover:underline"
              >
                careers@turgo.io
              </a>
            </div>
          </div>
          <div className="rounded-xl border p-6 flex items-start gap-4">
            <Shield className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">
                {t("contact.supportLabel")}
              </h3>
              <a
                href="mailto:support@turgo.io"
                className="text-sm text-primary hover:underline"
              >
                support@turgo.io
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
