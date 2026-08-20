import type { Session } from 'next-auth';

export function hasValidSession(session: Session | null): session is Session {
  return Boolean(session?.user && !session?.error);
}
