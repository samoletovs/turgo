export default async function TermsPage() {

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-sm text-muted-foreground">Last updated: February 2026</p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Turgo, you agree to be bound by these Terms of Service.
              If you do not agree, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. User Accounts</h2>
            <p className="text-muted-foreground">
              You must provide accurate information when creating an account. You are responsible
              for maintaining the security of your account credentials and for all activities
              under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Listings & Content</h2>
            <p className="text-muted-foreground">
              You are responsible for the accuracy of your listings. Prohibited items include
              illegal goods, counterfeit products, weapons, and any items violating local laws
              in Latvia, Lithuania, or Estonia. Turgo reserves the right to remove any listing
              that violates these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI Agent Services</h2>
            <p className="text-muted-foreground">
              Turgo&apos;s AI agents provide automated assistance including pricing suggestions,
              buyer matching, and listing optimization. While we strive for accuracy, AI
              recommendations are advisory and should not be solely relied upon for transaction
              decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Payments & Subscriptions</h2>
            <p className="text-muted-foreground">
              Paid features are billed through Stripe. You may cancel your subscription at any
              time. Refunds are handled on a case-by-case basis in accordance with EU consumer
              protection regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              Turgo acts as a platform connecting buyers and sellers. We are not a party to any
              transaction and do not guarantee the quality, safety, or legality of listed items.
              Users transact at their own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Governing Law</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of the Republic of Latvia. Any disputes shall
              be resolved in the courts of Riga, Latvia.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
