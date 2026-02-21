"use client";

import { useTranslations } from "next-intl";
import { useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { Shield, BarChart3, Megaphone, X, Settings2 } from "lucide-react";

type CookieConsent = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
};

const COOKIE_CONSENT_KEY = "turgo_cookie_consent";

function setCookieConsent(consent: CookieConsent) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  // Dispatch storage event so useSyncExternalStore picks up same-tab changes
  window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_KEY }));
}

export function CookieConsentBanner() {
  const t = useTranslations("cookie");
  const [showSettings, setShowSettings] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  // useSyncExternalStore requires getSnapshot to return a referentially
  // stable value when nothing has changed.  Return the raw JSON string
  // (primitives are compared by value, so no infinite-loop) and parse once.
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  }, []);
  const getSnapshot = useCallback(
    () => (typeof window === "undefined" ? null : localStorage.getItem(COOKIE_CONSENT_KEY)),
    [],
  );
  const getServerSnapshot = useCallback((): string | null => null, []);
  const rawConsent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const storedConsent: CookieConsent | null = useMemo(
    () => (rawConsent ? JSON.parse(rawConsent) : null),
    [rawConsent],
  );

  // Visible if no stored consent and not dismissed
  const visible = !storedConsent && !dismissed;

  const handleAcceptAll = () => {
    const fullConsent = { necessary: true, analytics: true, marketing: true };
    setCookieConsent(fullConsent);
    setDismissed(true);
  };

  const handleRejectNonEssential = () => {
    const minConsent = { necessary: true, analytics: false, marketing: false };
    setCookieConsent(minConsent);
    setDismissed(true);
  };

  const handleSaveSettings = () => {
    setCookieConsent(consent);
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
      role="dialog"
      aria-label={t("title")}
    >
      <Card className="mx-auto max-w-2xl shadow-lg border-2">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">{t("title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("description")}{" "}
                  <Link
                    href="/legal/cookies"
                    className="underline hover:text-foreground"
                  >
                    {t("settings")}
                  </Link>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showSettings && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span>
                    <strong>{t("necessary")}</strong>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {t("necessaryDesc")}
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span>
                    <strong>{t("analytics")}</strong>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {t("analyticsDesc")}
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={consent.analytics}
                  onChange={(e) =>
                    setConsent((c) => ({ ...c, analytics: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <Megaphone className="h-4 w-4 text-orange-500" />
                  <span>
                    <strong>{t("marketing")}</strong>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {t("marketingDesc")}
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={consent.marketing}
                  onChange={(e) =>
                    setConsent((c) => ({ ...c, marketing: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleAcceptAll}>
              {t("accept")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectNonEssential}
            >
              {t("reject")}
            </Button>
            {showSettings ? (
              <Button variant="secondary" size="sm" onClick={handleSaveSettings}>
                {t("save")}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="gap-1"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {t("settings")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
