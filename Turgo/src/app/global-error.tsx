"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center px-4 text-center font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="mb-2 text-4xl font-bold">500</h1>
        <h2 className="mb-2 text-xl font-semibold">Something Went Wrong</h2>
        <p className="mb-8 max-w-md text-gray-500">
          We&apos;re experiencing technical difficulties. Please try again
          later.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </body>
    </html>
  );
}
