/**
 * NextAuth.js v5 configuration — Credentials + Google + GitHub providers
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import { getRedis } from '@/lib/redis';
import { hasValidSession } from '@/lib/auth-session';

/** Set a force-refresh flag so the JWT callback re-queries the DB on next request. */
export async function triggerAuthRefresh(userId: string): Promise<void> {
  const client = await getRedis();
  if (client) {
    await client.set(`auth:refresh:${userId}`, '1', 'EX', 60);
  }
}

// ── Token refresh interval (5 minutes) ──────────────────────
const TOKEN_REFRESH_INTERVAL_MS = 300_000;

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);

        if (!isValid) {
          return null;
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') {
        // OAuth sign-in: enforce safe account linking
        if (!user.email) return false;

        const existingUser = await db.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // Create new user from OAuth
          const newUser = await db.user.create({
            data: {
              email: user.email,
              name: user.name,
              avatar: user.image,
              emailVerified: new Date(),
              gdprConsentAt: new Date(),
            },
          });

          // Link OAuth account
          await db.account.create({
            data: {
              userId: newUser.id,
              type: account!.type,
              provider: account!.provider,
              providerAccountId: account!.providerAccountId,
              access_token: account!.access_token ?? undefined,
              refresh_token: account!.refresh_token ?? undefined,
              token_type: account!.token_type ?? undefined,
              scope: account!.scope ?? undefined,
              id_token: account!.id_token ?? undefined,
              expires_at: account!.expires_at ?? undefined,
            },
          });

          user.id = newUser.id;
        } else {
          // Check if this specific OAuth account is already linked
          const existingAccount = await db.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account!.provider,
                providerAccountId: account!.providerAccountId,
              },
            },
          });

          if (!existingAccount) {
            // Check if the existing user has ANY linked account for this provider
            const linkedToThis = await db.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: account!.provider,
              },
            });

            if (!linkedToThis) {
              // Account exists but is NOT linked to this OAuth provider.
              // Reject to prevent account takeover — user must link from settings.
              return '/auth/error?error=OAuthAccountNotLinked&message=An+account+with+this+email+already+exists.+Please+sign+in+with+your+original+method+and+link+accounts+in+settings.';
            }
          }

          user.id = existingUser.id;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      // Initial sign-in: populate token fields from user object
      if (user) {
        token.id = user.id as string;
        token.lastRefreshedAt = 0; // force a DB fetch on first request
      }

      if (!token.id) return token;

      // Determine whether we need to refresh from the database
      let needsRefresh = false;
      const age = Date.now() - (Number(token.lastRefreshedAt) || 0);

      if (age > TOKEN_REFRESH_INTERVAL_MS) {
        needsRefresh = true;
      }

      // Check Redis force-refresh flag (non-blocking; skip if Redis down)
      if (!needsRefresh) {
        try {
          const client = await getRedis();
          if (client) {
            const flag = await client.get(`auth:refresh:${token.id}`);
            if (flag) {
              needsRefresh = true;
              await client.del(`auth:refresh:${token.id}`);
            }
          }
        } catch {
          // Redis errors should not break auth
        }
      }

      if (needsRefresh) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, locale: true, name: true, avatar: true },
        });

        if (!dbUser) {
          // User has been deleted — return empty object to force sign-out
          return {} as typeof token;
        }

        token.role = dbUser.role;
        token.locale = dbUser.locale;
        token.name = dbUser.name;
        token.picture = dbUser.avatar;
        token.lastRefreshedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).locale = token.locale;
      }
      return session;
    },
  },
};

export const {
  handlers: { GET, POST },
  auth: nextAuth,
  signIn,
  signOut,
} = NextAuth(authConfig);

export async function auth(): Promise<Session | null> {
  const session = await nextAuth();
  return hasValidSession(session) ? session : null;
}
