import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="flex items-center gap-2 font-bold text-lg">
              <Bot className="h-5 w-5 text-primary" />
              {APP_NAME}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">{APP_NAME}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href={`/${locale}/about`} className="hover:text-foreground">
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className="hover:text-foreground">
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/help`} className="hover:text-foreground">
                  {t("help")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href={`/${locale}/privacy`} className="hover:text-foreground">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="hover:text-foreground">
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories quick links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Categories</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href={`/${locale}/category/transport`} className="hover:text-foreground">
                  Transport
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/category/real-estate`} className="hover:text-foreground">
                  Real Estate
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/category/electronics`} className="hover:text-foreground">
                  Electronics
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/category/jobs`} className="hover:text-foreground">
                  Jobs
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          {t("copyright", { year })}
        </div>
      </div>
    </footer>
  );
}
