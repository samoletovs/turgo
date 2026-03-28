'use client';

import { useTranslations } from 'next-intl';
import { Search, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BuyingAgentWizard } from '@/components/wizards/buying';

export function BuyPageClient({
  locale,
  categories,
  locations,
}: {
  locale: string;
  categories: {
    id: string;
    name: string | Record<string, string>;
    slug: string;
    children?: {
      id: string;
      name: string | Record<string, string>;
      slug: string;
    }[];
  }[];
  locations: {
    id: string;
    name: string | Record<string, string>;
    slug: string;
    children?: {
      id: string;
      name: string | Record<string, string>;
      slug: string;
    }[];
  }[];
}) {
  const t = useTranslations('buy');

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>

        <BuyingAgentWizard locale={locale} categories={categories} locations={locations} />

        {/* Browse fallback link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('orBrowse')}{' '}
            <Link
              href="/search"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Search className="h-3.5 w-3.5" />
              {t('browseLink')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
