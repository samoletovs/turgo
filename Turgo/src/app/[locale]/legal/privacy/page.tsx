import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { generatePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return generatePageMetadata({
    title: t("title"),
    description: "Privacy Policy for Turgo — GDPR-compliant data protection",
    path: "/legal/privacy",
    locale,
  });
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });

  const sections = [
    "controller",
    "dataCollected",
    "purposes",
    "legalBases",
    "retention",
    "thirdParties",
    "cookies",
    "rights",
    "children",
    "international",
    "dpo",
    "complaint",
    "changes",
  ];

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mb-8">{t("lastUpdated")}</p>

        {/* Table of contents */}
        <nav className="mb-10 rounded-lg border bg-muted/50 p-4 dark:bg-muted/20">
          <h2 className="mb-3 text-sm font-semibold">Contents</h2>
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
          {/* 1. Data Controller */}
          <section id="controller">
            <h2 className="text-xl font-semibold mb-3">
              1. {t("sections.controller.title")}
            </h2>
            <p className="text-muted-foreground">
              The data controller responsible for your personal data is:
            </p>
            <ul className="mt-2 list-none pl-0 text-muted-foreground space-y-0.5">
              <li>
                <strong>Company:</strong> Turgo SIA
              </li>
              <li>
                <strong>Address:</strong> Riga, Latvia, LV-1050
              </li>
              <li>
                <strong>Registration:</strong> 40203XXXXXX
              </li>
              <li>
                <strong>Email:</strong> privacy@turgo.io
              </li>
              <li>
                <strong>Data Protection Officer:</strong> dpo@turgo.io
              </li>
            </ul>
          </section>

          {/* 2. Data Collected */}
          <section id="dataCollected">
            <h2 className="text-xl font-semibold mb-3">
              2. {t("sections.dataCollected.title")}
            </h2>
            <p className="text-muted-foreground">
              We collect the following categories of personal data:
            </p>

            <h3 className="mt-4 text-base font-medium">Account Information</h3>
            <ul className="mt-1 list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name, email address, and password (hashed)</li>
              <li>Profile photo (optional)</li>
              <li>Phone number (optional)</li>
              <li>Preferred language and country</li>
            </ul>

            <h3 className="mt-4 text-base font-medium">Listing Data</h3>
            <ul className="mt-1 list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                Listing titles, descriptions, prices, and photos you upload
              </li>
              <li>Category and location selections</li>
              <li>Listing view counts and interaction metrics</li>
            </ul>

            <h3 className="mt-4 text-base font-medium">Communication Data</h3>
            <ul className="mt-1 list-disc pl-6 text-muted-foreground space-y-1">
              <li>Messages exchanged between users through the platform</li>
              <li>AI agent interactions and conversation history</li>
              <li>Support requests and feedback</li>
            </ul>

            <h3 className="mt-4 text-base font-medium">
              Technical & Usage Data
            </h3>
            <ul className="mt-1 list-disc pl-6 text-muted-foreground space-y-1">
              <li>IP address, browser type, device information</li>
              <li>Pages visited, features used, and session duration</li>
              <li>Search queries and filter preferences</li>
              <li>Cookie identifiers (see Section 7)</li>
            </ul>

            <h3 className="mt-4 text-base font-medium">Financial Data</h3>
            <ul className="mt-1 list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                Subscription and payment history (processed by Stripe; we do not
                store card numbers)
              </li>
              <li>Billing address and VAT information where applicable</li>
            </ul>
          </section>

          {/* 3. Purposes */}
          <section id="purposes">
            <h2 className="text-xl font-semibold mb-3">
              3. {t("sections.purposes.title")}
            </h2>
            <p className="text-muted-foreground">
              We process your personal data for the following purposes:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>Providing and operating the classifieds platform</li>
              <li>Creating and managing your user account</li>
              <li>Processing your listings, searches, and transactions</li>
              <li>
                Operating AI-powered agents (pricing, matching, auto-responses)
              </li>
              <li>
                Sending transactional notifications (new messages, agent alerts,
                saved search matches)
              </li>
              <li>Processing subscription payments and managing billing</li>
              <li>
                Providing analytics and market insights to Pro/Business users
              </li>
              <li>
                Detecting and preventing fraud, abuse, and security threats
              </li>
              <li>Improving platform features and user experience</li>
              <li>
                Complying with legal obligations (tax, accounting, law
                enforcement)
              </li>
              <li>Sending marketing communications (only with your consent)</li>
            </ul>
          </section>

          {/* 4. Legal Bases */}
          <section id="legalBases">
            <h2 className="text-xl font-semibold mb-3">
              4. {t("sections.legalBases.title")}
            </h2>
            <p className="text-muted-foreground">
              We process your personal data based on the following legal grounds
              under GDPR Article 6:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left font-semibold text-foreground">
                      Legal Basis
                    </th>
                    <th className="py-2 text-left font-semibold text-foreground">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 pr-4 font-medium">
                      Contract performance (Art. 6(1)(b))
                    </td>
                    <td className="py-2">
                      Account management, listing services, payments, messaging
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">
                      Legitimate interest (Art. 6(1)(f))
                    </td>
                    <td className="py-2">
                      Fraud prevention, analytics, platform improvements,
                      security
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">
                      Consent (Art. 6(1)(a))
                    </td>
                    <td className="py-2">
                      Marketing emails, analytics cookies, push notifications
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">
                      Legal obligation (Art. 6(1)(c))
                    </td>
                    <td className="py-2">
                      Tax records, compliance with court orders
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Retention Periods */}
          <section id="retention">
            <h2 className="text-xl font-semibold mb-3">
              5. {t("sections.retention.title")}
            </h2>
            <p className="text-muted-foreground">
              We retain personal data only as long as necessary:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm text-muted-foreground border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left font-semibold text-foreground">
                      Data Type
                    </th>
                    <th className="py-2 text-left font-semibold text-foreground">
                      Retention Period
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2 pr-4">Account data</td>
                    <td className="py-2">
                      Duration of account + 30 days after deletion
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Listing data</td>
                    <td className="py-2">Duration of listing + 90 days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Messages</td>
                    <td className="py-2">Duration of account + 30 days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Payment records</td>
                    <td className="py-2">7 years (legal/tax obligation)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Server logs</td>
                    <td className="py-2">90 days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Analytics data</td>
                    <td className="py-2">26 months (anonymized thereafter)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Marketing consent records</td>
                    <td className="py-2">Duration of consent + 3 years</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Third Parties */}
          <section id="thirdParties">
            <h2 className="text-xl font-semibold mb-3">
              6. {t("sections.thirdParties.title")}
            </h2>
            <p className="text-muted-foreground">
              We may share your personal data with the following categories of
              third parties, all of whom are bound by data processing
              agreements:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Stripe, Inc.</strong> — Payment processing. Stripe acts
                as an independent data controller for payment data. See{" "}
                <Link
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Stripe&apos;s Privacy Policy
                </Link>
                .
              </li>
              <li>
                <strong>AI Service Providers</strong> (GitHub Models / Azure
                OpenAI) — For AI agent features including pricing suggestions,
                auto-responses, and image analysis. Data sent to AI providers is
                minimized and does not include personally identifying
                information where possible.
              </li>
              <li>
                <strong>Cloud Infrastructure</strong> (Azure / Vercel) — Hosting
                and content delivery. Data is processed within EU/EEA regions.
              </li>
              <li>
                <strong>Email Service Provider</strong> — For transactional and
                marketing emails.
              </li>
              <li>
                <strong>Search Engine</strong> (Meilisearch) — For listing
                search functionality. Self-hosted within our infrastructure.
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              We do not sell your personal data to third parties. We do not
              share your data with third parties for their own marketing
              purposes.
            </p>
          </section>

          {/* 7. Cookies */}
          <section id="cookies">
            <h2 className="text-xl font-semibold mb-3">
              7. {t("sections.cookies.title")}
            </h2>
            <p className="text-muted-foreground">
              We use cookies and similar technologies for the following
              purposes:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                <strong>Strictly Necessary:</strong> Authentication, session
                management, CSRF protection, language preference. These cannot
                be disabled.
              </li>
              <li>
                <strong>Analytics:</strong> Understanding how users interact
                with the platform. Only activated with your consent.
              </li>
              <li>
                <strong>Preferences:</strong> Remembering your theme (dark/light
                mode), region, and display settings.
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              You can manage your cookie preferences at any time through our
              cookie banner or in your browser settings. For more details, see
              our{" "}
              <Link
                href="/legal/cookies"
                className="text-primary hover:underline"
              >
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          {/* 8. Your Rights */}
          <section id="rights">
            <h2 className="text-xl font-semibold mb-3">
              8. {t("sections.rights.title")}
            </h2>
            <p className="text-muted-foreground">
              Under the GDPR, you have the following rights regarding your
              personal data:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Right of Access (Art. 15):</strong> Request a copy of
                all personal data we hold about you. You can also export your
                data from Settings &gt; Data &amp; Privacy.
              </li>
              <li>
                <strong>Right to Rectification (Art. 16):</strong> Request
                correction of inaccurate or incomplete personal data. You can
                update most information directly in your account settings.
              </li>
              <li>
                <strong>Right to Erasure (Art. 17):</strong> Request deletion of
                your personal data (&ldquo;right to be forgotten&rdquo;). You
                can delete your account from Settings &gt; Data &amp; Privacy.
                Some data may be retained where legally required.
              </li>
              <li>
                <strong>Right to Data Portability (Art. 20):</strong> Receive
                your personal data in a structured, commonly used,
                machine-readable format (JSON). Available via the data export
                feature.
              </li>
              <li>
                <strong>Right to Object (Art. 21):</strong> Object to processing
                based on legitimate interests, including direct marketing. You
                can opt out of marketing in your notification settings.
              </li>
              <li>
                <strong>Right to Restrict Processing (Art. 18):</strong> Request
                that we limit the processing of your data in certain
                circumstances.
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> Where processing is
                based on consent, you may withdraw consent at any time without
                affecting the lawfulness of prior processing.
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              To exercise any of these rights, contact us at{" "}
              <Link
                href="mailto:privacy@turgo.io"
                className="text-primary hover:underline"
              >
                privacy@turgo.io
              </Link>
              . We will respond within 30 days.
            </p>
          </section>

          {/* 9. Children */}
          <section id="children">
            <h2 className="text-xl font-semibold mb-3">
              9. {t("sections.children.title")}
            </h2>
            <p className="text-muted-foreground">
              Turgo is not intended for use by individuals under 18 years of
              age. We do not knowingly collect personal data from children. If
              we become aware that we have collected personal data from a child,
              we will take steps to delete it promptly.
            </p>
          </section>

          {/* 10. International Transfers */}
          <section id="international">
            <h2 className="text-xl font-semibold mb-3">
              10. {t("sections.international.title")}
            </h2>
            <p className="text-muted-foreground">
              Your data is primarily stored and processed within the European
              Economic Area (EEA). Where data is transferred outside the EEA
              (e.g., to AI service providers in the United States), we ensure
              appropriate safeguards are in place, including:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>EU-U.S. Data Privacy Framework certification</li>
              <li>
                Standard Contractual Clauses (SCCs) approved by the European
                Commission
              </li>
              <li>Data minimization — only necessary data is transferred</li>
            </ul>
          </section>

          {/* 11. DPO Contact */}
          <section id="dpo">
            <h2 className="text-xl font-semibold mb-3">
              11. {t("sections.dpo.title")}
            </h2>
            <p className="text-muted-foreground">
              Our Data Protection Officer can be reached at:
            </p>
            <ul className="mt-2 list-none pl-0 text-muted-foreground space-y-0.5">
              <li>
                <strong>Email:</strong> dpo@turgo.io
              </li>
              <li>
                <strong>Address:</strong> Data Protection Officer, Turgo SIA,
                Riga, Latvia, LV-1050
              </li>
            </ul>
          </section>

          {/* 12. Supervisory Authority */}
          <section id="complaint">
            <h2 className="text-xl font-semibold mb-3">
              12. {t("sections.complaint.title")}
            </h2>
            <p className="text-muted-foreground">
              If you believe your data protection rights have been violated, you
              have the right to lodge a complaint with a supervisory authority.
              The lead supervisory authority for Turgo is:
            </p>
            <ul className="mt-2 list-none pl-0 text-muted-foreground space-y-0.5">
              <li>
                <strong>Data State Inspectorate of Latvia</strong> (Datu valsts
                inspekcija)
              </li>
              <li>Address: Elijas iela 17, Riga, LV-1050, Latvia</li>
              <li>
                Website:{" "}
                <Link
                  href="https://www.dvi.gov.lv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.dvi.gov.lv
                </Link>
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              You may also file a complaint with the supervisory authority in
              your country of residence:
            </p>
            <ul className="mt-2 list-disc pl-6 text-muted-foreground space-y-1">
              <li>
                <strong>Lithuania:</strong> State Data Protection Inspectorate
                (Valstybinė duomenų apsaugos inspekcija) —{" "}
                <Link
                  href="https://www.ada.lt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.ada.lt
                </Link>
              </li>
              <li>
                <strong>Estonia:</strong> Data Protection Inspectorate
                (Andmekaitse Inspektsioon) —{" "}
                <Link
                  href="https://www.aki.ee"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.aki.ee
                </Link>
              </li>
            </ul>
          </section>

          {/* 13. Changes */}
          <section id="changes">
            <h2 className="text-xl font-semibold mb-3">
              13. {t("sections.changes.title")}
            </h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will
              notify you of material changes via email or a prominent notice on
              the Platform. The &ldquo;Last updated&rdquo; date at the top of
              this policy indicates when it was last revised. We encourage you
              to review this policy periodically.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
