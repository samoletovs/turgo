"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  MapPin,
  Tag,
  ShoppingCart,
  Store,
  ArrowRightLeft,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "LV", name: "latvia", flag: "🇱🇻" },
  { code: "LT", name: "lithuania", flag: "🇱🇹" },
  { code: "EE", name: "estonia", flag: "🇪🇪" },
];

const CATEGORIES = [
  "transport",
  "real-estate",
  "electronics",
  "home-garden",
  "fashion",
  "jobs",
  "services",
  "kids-baby",
  "sports-outdoors",
  "pets",
  "hobbies-leisure",
  "agriculture",
];

const USE_CASES = [
  { id: "buying", icon: ShoppingCart },
  { id: "selling", icon: Store },
  { id: "both", icon: ArrowRightLeft },
];

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const tHome = useTranslations("home");
  const tRegion = useTranslations("region");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);

  const steps = [
    // Step 0: Welcome
    <div key="0" className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h1 className="text-3xl font-bold">{t("welcome.title")}</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        {t("welcome.subtitle")}
      </p>
    </div>,

    // Step 1: Country selection
    <div key="1" className="space-y-6">
      <div className="text-center space-y-2">
        <MapPin className="h-8 w-8 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">{t("step1.title")}</h2>
        <p className="text-muted-foreground">{t("step1.subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 max-w-lg mx-auto">
        {COUNTRIES.map((country) => (
          <button
            key={country.code}
            onClick={() => setSelectedCountry(country.code)}
            className={cn(
              "rounded-xl border-2 p-4 text-center transition-all hover:border-primary",
              selectedCountry === country.code
                ? "border-primary bg-primary/5"
                : "border-muted"
            )}
          >
            <span className="text-3xl">{country.flag}</span>
            <p className="mt-2 text-sm font-medium">
              {tRegion(country.name)}
            </p>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Interests
    <div key="2" className="space-y-6">
      <div className="text-center space-y-2">
        <Tag className="h-8 w-8 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">{t("step2.title")}</h2>
        <p className="text-muted-foreground">{t("step2.subtitle")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 max-w-2xl mx-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() =>
              setSelectedCategories((prev) =>
                prev.includes(cat)
                  ? prev.filter((c) => c !== cat)
                  : [...prev, cat]
              )
            }
            className={cn(
              "rounded-xl border-2 p-3 text-sm font-medium transition-all hover:border-primary",
              selectedCategories.includes(cat)
                ? "border-primary bg-primary/5"
                : "border-muted"
            )}
          >
            {selectedCategories.includes(cat) && (
              <CheckCircle className="h-4 w-4 text-primary inline mr-1" />
            )}
            {tHome(`categories.${cat}`)}
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Use case
    <div key="3" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{t("step3.title")}</h2>
        <p className="text-muted-foreground">{t("step3.subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 max-w-lg mx-auto">
        {USE_CASES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSelectedUseCase(id)}
            className={cn(
              "rounded-xl border-2 p-6 text-center transition-all hover:border-primary",
              selectedUseCase === id
                ? "border-primary bg-primary/5"
                : "border-muted"
            )}
          >
            <Icon className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">{t(`step3.${id}`)}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 4: Done
    <div key="4" className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
      </div>
      <h2 className="text-3xl font-bold">{t("step4.title")}</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        {t("step4.subtitle")}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
        <Button size="lg" onClick={() => router.push("/search")}>
          {t("step4.exploreCta")}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => router.push("/sell")}
        >
          {t("step4.sellCta")}
        </Button>
      </div>
    </div>,
  ];

  const isLastStep = step === steps.length - 1;
  const isFirstStep = step === 0;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="max-w-2xl w-full">
        <CardContent className="p-8">
          {/* Progress dots */}
          <div className="mb-8 flex justify-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === step ? "w-8 bg-primary" : "w-2 bg-muted"
                )}
              />
            ))}
          </div>

          {/* Step content */}
          {steps[step]}

          {/* Navigation */}
          {!isLastStep && (
            <div className="mt-8 flex items-center justify-between">
              {!isFirstStep ? (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  {/* Back */}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                >
                  {t("skip")}
                </Button>
              )}
              <Button onClick={() => setStep((s) => s + 1)}>
                {isFirstStep ? t("continue") : t("continue")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
