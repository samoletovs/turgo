import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { generatePageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return generatePageMetadata({
    title: t('title'),
    description: 'Terms of Service for Turgo — Agent-first classifieds platform',
    path: '/legal/terms',
    locale,
  });
}

export default async function TermsOfServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });

  const sections = [
    'acceptance',
    'platform',
    'accounts',
    'listings',
    'agents',
    'payments',
    'ip',
    'liability',
    'termination',
    'governing',
    'gdpr',
    'changes',
    'contact',
  ];

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mb-8">{t('lastUpdated')}</p>

        {/* Table of contents */}
        <nav className="mb-10 rounded-lg border bg-muted/50 p-4 dark:bg-muted/20">
          <h2 className="mb-3 text-sm font-semibold">{t('toc')}</h2>
          <ol className="space-y-1 text-sm">
            {sections.map((key, i) => (
              <li key={key}>
                <Link
                  href={`#${key}`}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {i + 1}. {t(`sections.${key}.title`)}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1. Acceptance of Terms */}
          <section id="acceptance">
            <h2 className="text-xl font-semibold mb-3">1. {t('sections.acceptance.title')}</h2>
            <p className="text-muted-foreground">
              By accessing or using Turgo (&ldquo;Platform&rdquo;), you agree to be bound by these
              Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you must
              not access or use the Platform. These Terms constitute a legally binding agreement
              between you (&ldquo;User&rdquo;) and Turgo SIA (&ldquo;Company&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo;), a company registered in the Republic of Latvia.
            </p>
          </section>

          {/* 2. Platform Description */}
          <section id="platform">
            <h2 className="text-xl font-semibold mb-3">2. {t('sections.platform.title')}</h2>
            <p className="text-muted-foreground">
              Turgo is an AI-powered classifieds marketplace serving the Baltic states (Latvia,
              Lithuania, and Estonia). The Platform provides:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>Online classified advertising for buying and selling goods</li>
              <li>
                AI-powered selling agents that automate pricing, listing optimization, and buyer
                communication
              </li>
              <li>
                AI-powered buying agents that monitor listings and alert users to matching deals
              </li>
              <li>Real-time messaging between buyers and sellers</li>
              <li>Market analytics and pricing intelligence</li>
              <li>Multi-language support (English, Latvian, Lithuanian, Estonian, Russian)</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Turgo acts solely as an intermediary platform connecting buyers and sellers. We are
              not a party to any transaction between users and do not take ownership, possession, or
              custody of any listed items.
            </p>
          </section>

          {/* 3. User Accounts & Obligations */}
          <section id="accounts">
            <h2 className="text-xl font-semibold mb-3">3. {t('sections.accounts.title')}</h2>
            <p className="text-muted-foreground">
              To use certain features of the Platform, you must create an account. When creating an
              account, you agree to:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security and confidentiality of your login credentials</li>
              <li>Be at least 18 years of age or the age of legal majority in your jurisdiction</li>
              <li>Not create multiple accounts for deceptive purposes</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              <strong>Prohibited conduct:</strong> You must not use the Platform to list prohibited
              items (illegal goods, counterfeit products, weapons, hazardous materials, stolen
              property, or items violating EU or local Baltic state regulations), engage in fraud,
              harass other users, or distribute spam or malware.
            </p>
          </section>

          {/* 4. Listings & Content */}
          <section id="listings">
            <h2 className="text-xl font-semibold mb-3">4. {t('sections.listings.title')}</h2>
            <p className="text-muted-foreground">
              You are solely responsible for the accuracy, legality, and completeness of your
              listings and any content you post. By creating a listing, you represent and warrant
              that:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>You have the legal right to sell the listed item</li>
              <li>The description and photos accurately represent the item</li>
              <li>The pricing information is truthful and not misleading</li>
              <li>The item complies with all applicable laws in Latvia, Lithuania, and Estonia</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Turgo reserves the right to remove, modify, or suspend any listing that violates these
              Terms, without prior notice. Listings are subject to moderation and may be reviewed
              before publication.
            </p>
          </section>

          {/* 5. AI Agent Services */}
          <section id="agents">
            <h2 className="text-xl font-semibold mb-3">5. {t('sections.agents.title')}</h2>
            <p className="text-muted-foreground">
              Turgo offers AI-powered agent services to assist with buying and selling:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                <strong>Selling Agents:</strong> Automated tools that may adjust listing prices,
                respond to buyer inquiries, negotiate offers, and optimize listing visibility based
                on market conditions.
              </li>
              <li>
                <strong>Buying Agents:</strong> Automated tools that monitor new and existing
                listings, identify deals matching your criteria, and alert you to opportunities.
              </li>
              <li>
                <strong>AI Concierge:</strong> A conversational assistant that helps users navigate
                the platform, create listings, and find items.
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              <strong>Disclaimer:</strong> AI agent recommendations, pricing suggestions, and
              automated actions are advisory in nature. While we strive for accuracy, AI outputs may
              contain errors or inaccuracies. You acknowledge that:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>AI-generated pricing is not a professional valuation or appraisal</li>
              <li>
                You are ultimately responsible for all transactions, even those facilitated by
                agents
              </li>
              <li>Automated actions taken by agents on your behalf are binding</li>
              <li>You may configure agent parameters and disable automated features at any time</li>
            </ul>
          </section>

          {/* 6. Payments & Subscriptions */}
          <section id="payments">
            <h2 className="text-xl font-semibold mb-3">6. {t('sections.payments.title')}</h2>
            <p className="text-muted-foreground">
              Turgo offers free and paid subscription tiers (Pro and Business). Payment terms:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>All payments are processed securely through Stripe</li>
              <li>Subscription fees are billed monthly or annually, as selected by the user</li>
              <li>
                You may cancel your subscription at any time; cancellation takes effect at the end
                of the current billing period
              </li>
              <li>Listing boost fees are non-refundable once the boost period has started</li>
              <li>All prices are displayed in EUR and include applicable VAT where required</li>
              <li>We reserve the right to change pricing with 30 days&apos; prior notice</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Refunds are handled on a case-by-case basis in accordance with EU consumer protection
              regulations, including the 14-day cooling-off period under the EU Consumer Rights
              Directive (2011/83/EU) where applicable.
            </p>
          </section>

          {/* 7. Intellectual Property */}
          <section id="ip">
            <h2 className="text-xl font-semibold mb-3">7. {t('sections.ip.title')}</h2>
            <p className="text-muted-foreground">
              All intellectual property rights in the Platform (including but not limited to the
              software, design, logos, trademarks, AI models, and documentation) are owned by Turgo
              SIA or its licensors.
            </p>
            <p className="mt-2 text-muted-foreground">
              By posting content on the Platform, you grant Turgo a non-exclusive, worldwide,
              royalty-free license to use, display, reproduce, and distribute your content solely
              for the purpose of operating and promoting the Platform. You retain all ownership
              rights to your content.
            </p>
            <p className="mt-2 text-muted-foreground">
              You must not copy, reverse engineer, decompile, or create derivative works from the
              Platform or its AI systems without our explicit written permission.
            </p>
          </section>

          {/* 8. Limitation of Liability */}
          <section id="liability">
            <h2 className="text-xl font-semibold mb-3">8. {t('sections.liability.title')}</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by applicable law:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
                warranties of any kind, whether express or implied
              </li>
              <li>
                Turgo shall not be liable for any indirect, incidental, special, consequential, or
                punitive damages arising from your use of the Platform
              </li>
              <li>
                Turgo is not responsible for the quality, safety, legality, or availability of items
                listed by users
              </li>
              <li>
                Turgo is not liable for any losses resulting from AI agent actions, including
                automated pricing adjustments, responses, or negotiations
              </li>
              <li>
                Our total aggregate liability shall not exceed the amount you paid to Turgo in the
                12 months preceding the claim
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Nothing in these Terms limits liability for death, personal injury caused by
              negligence, fraud, or any other liability that cannot be excluded under applicable EU
              or national law.
            </p>
          </section>

          {/* 9. Termination */}
          <section id="termination">
            <h2 className="text-xl font-semibold mb-3">9. {t('sections.termination.title')}</h2>
            <p className="text-muted-foreground">
              You may terminate your account at any time through your account settings. Turgo may
              suspend or terminate your account if you violate these Terms, engage in fraud or
              abuse, or fail to pay applicable fees.
            </p>
            <p className="mt-2 text-muted-foreground">
              Upon termination: (a) your right to use the Platform ceases immediately; (b) active AI
              agents will be deactivated; (c) your listings will be removed; (d) your personal data
              will be handled in accordance with our Privacy Policy and applicable data retention
              requirements under GDPR.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section id="governing">
            <h2 className="text-xl font-semibold mb-3">10. {t('sections.governing.title')}</h2>
            <p className="text-muted-foreground">
              These Terms are governed by and construed in accordance with the laws of the Republic
              of Latvia, without regard to its conflict of law provisions.
            </p>
            <p className="mt-2 text-muted-foreground">
              For users residing in other EU Member States, mandatory consumer protection provisions
              of your country of residence shall apply to the extent they provide a higher level of
              protection. Any disputes arising from these Terms shall be subject to the exclusive
              jurisdiction of the courts of Riga, Latvia, unless EU consumer protection rules
              require otherwise.
            </p>
            <p className="mt-2 text-muted-foreground">
              As a consumer in the EU, you may also use the European Commission&apos;s Online
              Dispute Resolution (ODR) platform at{' '}
              <Link
                href="https://ec.europa.eu/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/odr
              </Link>
              .
            </p>
          </section>

          {/* 11. GDPR Reference */}
          <section id="gdpr">
            <h2 className="text-xl font-semibold mb-3">11. {t('sections.gdpr.title')}</h2>
            <p className="text-muted-foreground">
              Turgo processes personal data in accordance with the General Data Protection
              Regulation (EU) 2016/679 (GDPR) and applicable national data protection laws of
              Latvia, Lithuania, and Estonia. For detailed information about how we collect, use,
              and protect your personal data, please refer to our{' '}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* 12. Changes to Terms */}
          <section id="changes">
            <h2 className="text-xl font-semibold mb-3">12. {t('sections.changes.title')}</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. We will notify you of material changes by
              email or through a prominent notice on the Platform at least 30 days before the
              changes take effect. Your continued use of the Platform after the effective date
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* 13. Contact */}
          <section id="contact">
            <h2 className="text-xl font-semibold mb-3">13. {t('sections.contact.title')}</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms, please contact us:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>Email: legal@turgo.io</li>
              <li>Address: Turgo SIA, Riga, Latvia, LV-1050</li>
              <li>Registration number: 40203XXXXXX</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
