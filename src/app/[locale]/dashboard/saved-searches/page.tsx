import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { generatePageMetadata } from '@/lib/seo';
import { SavedSearchesClient } from './saved-searches-client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'savedSearches' });
  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/dashboard/saved-searches',
    locale,
  });
}

export default async function SavedSearchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/signin`);

  return <SavedSearchesClient locale={locale} />;
}
