/**
 * HTML Sanitization — strips dangerous HTML while keeping basic formatting.
 *
 * Uses DOMPurify via isomorphic-dompurify so it works both on the server
 * (Node.js / tRPC mutations) and in the browser.
 */

import DOMPurify from "isomorphic-dompurify";

/** Tags that are allowed through sanitization (basic formatting only). */
const ALLOWED_TAGS = ["b", "i", "em", "strong", "br", "p", "ul", "ol", "li"];

/**
 * Sanitize user-supplied HTML, stripping everything except basic formatting
 * tags (b, i, em, strong, br, p, ul, ol, li).
 *
 * @param input – raw user-generated string (may contain HTML)
 * @returns      sanitised string safe for storage and rendering
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [], // no attributes allowed
  });
}
