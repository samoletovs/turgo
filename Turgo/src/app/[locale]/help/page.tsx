export default async function HelpPage() {

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-6">Help Center</h1>
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h3 className="font-medium mb-1">How do I create a listing?</h3>
                <p className="text-sm text-muted-foreground">
                  Click the &quot;+ Sell&quot; button in the navigation bar. Our AI selling agent
                  will guide you through creating an optimized listing with smart pricing suggestions.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <h3 className="font-medium mb-1">How do AI agents work?</h3>
                <p className="text-sm text-muted-foreground">
                  Turgo&apos;s AI agents automatically help you buy and sell. Selling agents optimize
                  your listings and respond to inquiries. Buying agents search for items matching
                  your criteria and alert you to new matches.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <h3 className="font-medium mb-1">What regions are supported?</h3>
                <p className="text-sm text-muted-foreground">
                  Turgo currently covers Latvia, Lithuania, and Estonia. We support English,
                  Latvian, Lithuanian, Estonian, and Russian languages.
                </p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-4">Account & Billing</h2>
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h3 className="font-medium mb-1">Is Turgo free to use?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes! The free plan includes basic listing and agent features. Upgrade to Pro
                  or Business for more listings, agents, and premium features.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
