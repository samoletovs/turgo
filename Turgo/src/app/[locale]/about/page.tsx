export default async function AboutPage() {

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-6">About Turgo</h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-lg text-muted-foreground">
            Turgo is an AI-powered classifieds platform built for the Baltic region.
            Our intelligent agents help buyers find exactly what they need and sellers
            optimize their listings for the best results.
          </p>
          <h2 className="text-xl font-semibold mt-8 mb-4">Our Mission</h2>
          <p className="text-muted-foreground">
            We&apos;re reimagining how people buy and sell online by combining the power of
            artificial intelligence with a deep understanding of Baltic markets. Our AI
            agents work 24/7 to match buyers with sellers, optimize pricing, and
            streamline the entire transaction process.
          </p>
          <h2 className="text-xl font-semibold mt-8 mb-4">Coverage</h2>
          <p className="text-muted-foreground">
            Turgo operates across Latvia, Lithuania, and Estonia, providing a unified
            marketplace for the entire Baltic region.
          </p>
        </div>
      </div>
    </div>
  );
}
