import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Security headers applied to every response. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};

export default function middleware(request: NextRequest) {
  // Run the next-intl locale routing first
  const response = intlMiddleware(request);

  // Append security headers to the response
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  // Match all pathnames except API routes, static files, etc.
  matcher: [
    "/",
    "/(en|lv|ru|lt|et)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
