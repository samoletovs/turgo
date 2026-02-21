/**
 * Email Service — Resend SDK or SMTP fallback
 */

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@turgo.lv";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Send an email via Resend or log in development */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (process.env.NODE_ENV === "development" || !RESEND_API_KEY) {
    console.log(`[Email] DEV MODE — To: ${options.to} Subject: ${options.subject}`);
    console.log(`[Email] Body preview: ${options.text || options.html.slice(0, 200)}`);
    return true;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Email] Send failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Email] Error:", error);
    return false;
  }
}

/** Send verification email */
export async function sendVerificationEmail(email: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Verify your email — Turgo",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Turgo!</h2>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
          Verify Email
        </a>
        <p style="color: #6b7280; margin-top: 16px; font-size: 14px;">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
      </div>
    `,
    text: `Verify your email: ${url}`,
  });
}

/** Send password reset email */
export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Reset your password — Turgo",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
          Reset Password
        </a>
        <p style="color: #6b7280; margin-top: 16px; font-size: 14px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
    text: `Reset your password: ${url}`,
  });
}

/** Send agent match notification */
export async function sendAgentMatchNotification(
  email: string,
  matchDetails: { listingTitle: string; dealScore: number; url: string }
) {
  return sendEmail({
    to: email,
    subject: `🎯 New match found: ${matchDetails.listingTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Buying Agent Found a Match!</h2>
        <p>We found a listing matching your criteria:</p>
        <div style="padding: 16px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">
          <strong>${matchDetails.listingTitle}</strong>
          <p>Deal score: <strong>${matchDetails.dealScore}/100</strong></p>
        </div>
        <a href="${matchDetails.url}" style="display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px;">
          View Listing
        </a>
      </div>
    `,
    text: `Match found: ${matchDetails.listingTitle} (Score: ${matchDetails.dealScore}/100) — ${matchDetails.url}`,
  });
}

/** Send saved search notification email */
export async function sendSavedSearchNotification(
  email: string,
  details: {
    searchName: string;
    matchCount: number;
    listings: { title: string; price: number; url: string }[];
    manageUrl: string;
  }
) {
  const listingRows = details.listings
    .slice(0, 5)
    .map(
      (l) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <a href="${l.url}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${l.title}</a>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">
            €${l.price.toFixed(2)}
          </td>
        </tr>`
    )
    .join("");

  return sendEmail({
    to: email,
    subject: `🔔 ${details.matchCount} new listing${details.matchCount > 1 ? "s" : ""} match "${details.searchName}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Listings Match Your Saved Search</h2>
        <p>Your search <strong>"${details.searchName}"</strong> has ${details.matchCount} new match${details.matchCount > 1 ? "es" : ""}:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${listingRows}
        </table>
        ${details.matchCount > 5 ? `<p style="color: #6b7280; font-size: 14px;">...and ${details.matchCount - 5} more</p>` : ""}
        <a href="${details.manageUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin-top: 8px;">
          View All Matches
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          You're receiving this because you have email notifications enabled for this saved search.
          <a href="${details.manageUrl}" style="color: #6b7280;">Manage your saved searches</a>
        </p>
      </div>
    `,
    text: `${details.matchCount} new listing(s) match your saved search "${details.searchName}". View: ${details.manageUrl}`,
  });
}
