import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo';
import { FaqJsonLd } from '@/components/json-ld';
import { HelpContent } from './help-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help' });
  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/help',
    locale,
  });
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help' });

  // Build FAQ pairs for JSON-LD
  const sections = [
    'gettingStarted',
    'sellingAgents',
    'buyingAgents',
    'buyingStrategies',
    'payments',
    'accountPrivacy',
  ] as const;

  const faqPairs: { question: string; answer: string }[] = [];
  for (const section of sections) {
    for (const key of ['q1', 'q2', 'q3', 'q4', 'q5']) {
      try {
        const q = t(`sections.${section}.${key}.q`);
        const a = t(`sections.${section}.${key}.a`);
        if (q && a) faqPairs.push({ question: q, answer: a });
      } catch {
        // Key may not exist
      }
    }
  }

  return (
    <div className="py-16">
      <FaqJsonLd questions={faqPairs} />
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
        <HelpContent />

        {/* Contact support CTA */}
        <div className="mt-12 rounded-xl border bg-muted/50 p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">{t('cta.title')}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t('cta.desc')}</p>
          <a
            href={`/${locale}/contact`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('cta.button')}
          </a>
        </div>
      </div>
    </div>
  );
}
