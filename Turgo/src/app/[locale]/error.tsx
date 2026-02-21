"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.server");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="mb-2 text-4xl font-bold">500</h1>
      <h2 className="mb-2 text-xl font-semibold">{t("title")}</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        {t("description")}
      </p>
      <Button size="lg" onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {t("cta")}
      </Button>
    </div>
  );
}
