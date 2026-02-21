import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("common");

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-sm text-muted-foreground">Last updated: February 2026</p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect information you provide directly: name, email address, and profile
              details when you create an account. We also collect listing data, messages, and
              usage information to improve our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">
              Your information is used to provide and improve Turgo&apos;s services, including
              AI-powered matching, pricing optimization, and personalized recommendations.
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Storage & Security</h2>
            <p className="text-muted-foreground">
              Your data is stored securely on servers within the European Union, in compliance
              with GDPR regulations. We use industry-standard encryption and security measures
              to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Your Rights</h2>
            <p className="text-muted-foreground">
              Under GDPR, you have the right to access, correct, delete, or export your personal
              data. You can also object to or restrict certain processing activities. Contact us
              at privacy@turgo.io to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies for authentication and preferences. Analytics cookies are
              used only with your consent to help us understand how you use Turgo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Contact</h2>
            <p className="text-muted-foreground">
              For privacy-related inquiries, contact us at privacy@turgo.io.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
