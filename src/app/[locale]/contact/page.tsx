import { Mail, MapPin, Clock, Globe } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo';
import { ContactPageJsonLd } from '@/components/json-ld';
import { Card, CardContent } from '@/components/ui/card';
import { ContactForm } from './contact-form';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/contact',
    locale,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });

  const infoCards = [
    {
      icon: Mail,
      title: t('info.email.title'),
      content: 'support@turgo.io',
      href: 'mailto:support@turgo.io',
    },
    {
      icon: MapPin,
      title: t('info.office.title'),
      content: t('info.office.address'),
    },
    {
      icon: Clock,
      title: t('info.hours.title'),
      content: t('info.hours.value'),
    },
    {
      icon: Globe,
      title: t('info.languages.title'),
      content: t('info.languages.value'),
    },
  ];

  return (
    <div className="py-16">
      <ContactPageJsonLd />
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold mb-6">{t('form.title')}</h2>
                <ContactForm />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            {infoCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-xl border p-5 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                    {card.href ? (
                      <a href={card.href} className="text-sm text-primary hover:underline">
                        {card.content}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{card.content}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Social links */}
            <div className="rounded-xl border p-5">
              <h3 className="font-semibold text-sm mb-3">{t('social.title')}</h3>
              <div className="flex gap-3">
                {(
                  [
                    { name: 'X / Twitter', href: 'https://x.com/turgo_io' },
                    {
                      name: 'LinkedIn',
                      href: 'https://linkedin.com/company/turgo',
                    },
                    { name: 'GitHub', href: 'https://github.com/turgo-io' },
                  ] as const
                ).map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
