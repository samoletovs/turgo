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
