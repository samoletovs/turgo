import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except API routes, static files, etc.
  matcher: [
    "/",
    "/(en|lv|ru|lt|et)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
