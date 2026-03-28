import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

/**
 * GET /api/auth/verify?token=<token>
 *
 * Validates the email-verification token, marks the user's emailVerified
 * timestamp, deletes the consumed token, then redirects to the UI page
 * with a status query param so the client can show the right message.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return redirectToVerifyPage(req, 'invalid');
  }

  try {
    const record = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!record || !record.identifier.startsWith('email-verify:')) {
      return redirectToVerifyPage(req, 'invalid');
    }

    if (record.expires < new Date()) {
      // Clean up expired token
      await db.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: record.identifier,
            token: record.token,
          },
        },
      });
      return redirectToVerifyPage(req, 'expired');
    }

    const email = record.identifier.replace('email-verify:', '');

    // Mark user as verified
    await db.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Delete consumed token
    await db.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: record.identifier,
          token: record.token,
        },
      },
    });

    return redirectToVerifyPage(req, 'success');
  } catch (error) {
    console.error('[VERIFY_EMAIL]', error);
    return redirectToVerifyPage(req, 'error');
  }
}

function redirectToVerifyPage(
  req: NextRequest,
  status: 'success' | 'invalid' | 'expired' | 'error',
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return NextResponse.redirect(`${baseUrl}/auth/verify?status=${status}`);
}
