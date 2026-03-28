import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SettingsClient } from './settings-client';
import { generatePageMetadata } from '@/lib/seo';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/dashboard/settings',
    locale,
  });
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/signin`);

  return (
    <SettingsClient
      locale={locale}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    />
  );
}
