"use client";

import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALE_FLAGS, type Locale } from "@/lib/constants";
import { useRouter, usePathname } from "@/i18n/navigation";

const COUNTRY_CONFIG: Record<
  string,
  { label: string; flag: string; locale: Locale }
> = {
  LV: { label: "latvia", flag: "🇱🇻", locale: "lv" },
  LT: { label: "lithuania", flag: "🇱🇹", locale: "lt" },
  EE: { label: "estonia", flag: "🇪🇪", locale: "et" },
  ALL: { label: "allBaltics", flag: "🌍", locale: "en" },
};

interface RegionSelectorProps {
  currentLocale: string;
  className?: string;
}

export function RegionSelector({
  currentLocale,
  className,
}: RegionSelectorProps) {
  const t = useTranslations("region");
  const router = useRouter();
  const pathname = usePathname();

  // Derive current country from locale
  const localeToCountry: Record<string, string> = {
    lv: "LV",
    lt: "LT",
    et: "EE",
    ru: "ALL",
    en: "ALL",
  };
  const currentCountry = localeToCountry[currentLocale] || "ALL";

  const handleCountryChange = (country: string) => {
    const config = COUNTRY_CONFIG[country];
    if (config && config.locale !== currentLocale) {
      router.replace(pathname, { locale: config.locale });
    }
  };

  return (
    <Select value={currentCountry} onValueChange={handleCountryChange}>
      <SelectTrigger
        className={`w-auto gap-1 border-none h-8 px-2 ${className || ""}`}
      >
        <MapPin className="h-3.5 w-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(COUNTRY_CONFIG).map(([code, config]) => (
          <SelectItem key={code} value={code}>
            {config.flag} {t(config.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
