import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.cookies' });
  return generatePageMetadata({
    title: t('title'),
    description: t('intro'),
    path: '/legal/cookies',
    locale,
  });
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.cookies' });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t('lastUpdated')}</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
        <p>{t('intro')}</p>

        <section>
          <h2 className="text-xl font-semibold">{t('whatAreCookies')}</h2>
          <p>{t('whatAreCookiesDesc')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('typesTitle')}</h2>

          <h3 className="text-lg font-medium mt-4">{t('necessary')}</h3>
          <p>{t('necessaryDesc')}</p>

          <h3 className="text-lg font-medium mt-4">{t('analytics')}</h3>
          <p>{t('analyticsDesc')}</p>

          <h3 className="text-lg font-medium mt-4">{t('marketing')}</h3>
          <p>{t('marketingDesc')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('manage')}</h2>
          <p>{t('manageDesc')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('contact')}</h2>
          <p>{t('contactDesc')}</p>
        </section>
      </div>
    </div>
  );
}
