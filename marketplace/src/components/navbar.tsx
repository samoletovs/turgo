"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Search,
  Heart,
  MessageSquare,
  User,
  Plus,
  Menu,
  X,
  Bot,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_NAME, LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from "@/lib/constants";
import { useState } from "react";

interface NavbarProps {
  locale: string;
  user?: { name: string; avatar?: string } | null;
}

export function Navbar({ locale, user }: NavbarProps) {
  const t = useTranslations("nav");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2 font-bold text-xl shrink-0">
          <Bot className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        {/* Search bar (desktop) */}
        <div className="hidden flex-1 md:flex max-w-xl">
          <form
            className="relative flex w-full"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                window.location.href = `/${locale}/search?q=${encodeURIComponent(searchQuery)}`;
              }
            }}
          >
            <Input
              placeholder={t("home")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-r-none"
            />
            <Button type="submit" size="icon" className="rounded-l-none">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/sell`}>
              <Plus className="h-4 w-4 mr-1" />
              {t("sell")}
            </Link>
          </Button>

          {user ? (
            <>
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/${locale}/favorites`}>
                  <Heart className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/${locale}/messages`}>
                  <MessageSquare className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/${locale}/profile`}>
                  <User className="h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${locale}/auth/signin`}>{t("signIn")}</Link>
            </Button>
          )}

          {/* Language picker */}
          <Select
            value={locale}
            onValueChange={(newLocale) => {
              const path = window.location.pathname.replace(`/${locale}`, `/${newLocale}`);
              window.location.href = path || `/${newLocale}`;
            }}
          >
            <SelectTrigger className="w-auto gap-1 border-none h-8 px-2">
              <Globe className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {LOCALE_FLAGS[loc]} {LOCALE_LABELS[loc]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </nav>

        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden ml-auto"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t p-4 md:hidden">
          <form
            className="relative mb-4 flex"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                window.location.href = `/${locale}/search?q=${encodeURIComponent(searchQuery)}`;
              }
            }}
          >
            <Input
              placeholder={t("home")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-r-none"
            />
            <Button type="submit" size="icon" className="rounded-l-none">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            <Button variant="default" asChild className="w-full justify-start">
              <Link href={`/${locale}/sell`}>
                <Plus className="h-4 w-4 mr-2" />
                {t("sell")}
              </Link>
            </Button>

            {user ? (
              <>
                <Button variant="ghost" asChild className="w-full justify-start">
                  <Link href={`/${locale}/favorites`}>
                    <Heart className="h-4 w-4 mr-2" />
                    {t("favorites")}
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="w-full justify-start">
                  <Link href={`/${locale}/messages`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t("messages")}
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="w-full justify-start">
                  <Link href={`/${locale}/agents`}>
                    <Bot className="h-4 w-4 mr-2" />
                    {t("agents")}
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="w-full justify-start">
                  <Link href={`/${locale}/profile`}>
                    <User className="h-4 w-4 mr-2" />
                    {t("profile")}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" asChild className="w-full justify-start">
                  <Link href={`/${locale}/auth/signin`}>{t("signIn")}</Link>
                </Button>
                <Button variant="ghost" asChild className="w-full justify-start">
                  <Link href={`/${locale}/auth/register`}>{t("signUp")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
