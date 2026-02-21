import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { LOCALES } from "@/lib/constants";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(LOCALES, requested) ? requested : "en";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
