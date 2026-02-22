/**
 * NextAuth.js v5 configuration — Credentials + Google + GitHub providers
 */

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
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

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

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
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        // OAuth sign-in: upsert user + link account
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
          // Check if this OAuth account is already linked
          const existingAccount = await db.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account!.provider,
                providerAccountId: account!.providerAccountId,
              },
            },
          });

          if (!existingAccount) {
            await db.account.create({
              data: {
                userId: existingUser.id,
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
          }

          user.id = existingUser.id;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Refresh role from DB periodically
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, locale: true, name: true, avatar: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.locale = dbUser.locale;
          token.name = dbUser.name;
          token.picture = dbUser.avatar;
        }
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
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);
