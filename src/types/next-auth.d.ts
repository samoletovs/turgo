/**
 * Extended NextAuth.js types
 */

import { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    error?: string;
    user: {
      id: string;
      role: 'USER' | 'MODERATOR' | 'ADMIN';
      locale: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'USER' | 'MODERATOR' | 'ADMIN';
    locale: string;
    lastRefreshedAt?: number;
  }
}
