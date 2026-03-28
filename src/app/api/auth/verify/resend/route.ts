import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/server/db';
import { sendVerificationEmail } from '@/server/services/email';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/auth/verify/resend
 * Resend a verification email for a given address.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit({
    key: `verify-resend:${ip}`,
    limit: 3,
    windowMs: 3_600_000,
  });

  if (!rl.success) {
    return NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = body?.email?.toLowerCase?.();

  if (!email) {
    return NextResponse.json({ message: 'Email required' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  });

  // Always return success to avoid email enumeration
  if (!user || user.emailVerified) {
    return NextResponse.json({ success: true });
  }

  // Clean up old tokens
  await db.verificationToken.deleteMany({
    where: { identifier: `email-verify:${user.email}` },
  });

  const token = randomBytes(32).toString('hex');
  await db.verificationToken.create({
    data: {
      identifier: `email-verify:${user.email}`,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user.email, token);

  return NextResponse.json({ success: true });
}
