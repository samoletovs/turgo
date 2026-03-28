import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import { createCallerFactory } from '@/server/trpc';
import { createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/trpc/router';
import { auth } from '@/lib/auth';

/**
 * Server-side tRPC caller for use in Server Components and Server Actions.
 * This allows calling tRPC procedures directly without HTTP overhead.
 */
const createCaller = createCallerFactory(appRouter);

export const api = cache(async () => {
  const heads = new Headers(await headers());
  heads.set('x-trpc-source', 'rsc');

  const session = await auth();

  return createCaller(
    await createTRPCContext({
      headers: heads,
      session,
    }),
  );
});
