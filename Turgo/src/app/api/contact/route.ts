import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/server/services/email";
import { rateLimit } from "@/lib/rate-limit";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().min(1).max(100),
  message: z.string().min(10).max(5000),
});

const SUBJECT_MAP: Record<string, string> = {
  general: "General Inquiry",
  support: "Support Request",
  billing: "Billing Question",
  partnership: "Partnership Inquiry",
  press: "Press Inquiry",
  feedback: "Feedback",
};

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rl = await rateLimit({
      key: `contact:${ip}`,
      limit: 5,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = await req.json();
    const data = contactSchema.parse(body);

    const subjectLabel = SUBJECT_MAP[data.subject] || data.subject;

    const safeName = escapeHtml(data.name);
    const safeEmail = escapeHtml(data.email);
    const safeMessage = escapeHtml(data.message);
    const safeSubject = escapeHtml(subjectLabel);

    await sendEmail({
      to: "support@turgo.io",
      subject: `[Contact] ${subjectLabel} — from ${data.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; vertical-align: top; width: 120px;">Name:</td>
              <td style="padding: 8px 0;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Subject:</td>
              <td style="padding: 8px 0;">${safeSubject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Message:</td>
              <td style="padding: 8px 0; white-space: pre-wrap;">${safeMessage}</td>
            </tr>
          </table>
        </div>
      `,
      text: `Contact from ${data.name} (${data.email})\nSubject: ${subjectLabel}\n\n${data.message}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid form data", details: error.issues },
        { status: 400 },
      );
    }
    console.error("[Contact API] Error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
