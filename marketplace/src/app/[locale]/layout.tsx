import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { LOCALES } from "@/lib/constants";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ConciergeChat } from "@/components/concierge-chat";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(LOCALES, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const session = await auth();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <Providers>
        <div className="flex min-h-screen flex-col">
          <Navbar
            locale={locale}
            user={session?.user ? { name: session.user.name || "", avatar: session.user.image || undefined } : null}
          />
          <main className="flex-1">{children}</main>
          <Footer locale={locale} />
        </div>
        <ConciergeChat locale={locale} />
      </Providers>
    </NextIntlClientProvider>
  );
}
