import { FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center px-4 text-center font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <FileQuestion className="h-10 w-10 text-gray-400" />
        </div>
        <h1 className="mb-2 text-4xl font-bold">404</h1>
        <h2 className="mb-2 text-xl font-semibold">Page Not Found</h2>
        <p className="mb-8 max-w-md text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/en"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
      </body>
    </html>
  );
}
