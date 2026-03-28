import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { appRouter } from '@/server/trpc/router';
import { createTRPCContext } from '@/server/trpc';
import { auth } from '@/lib/auth';

/**
 * Configure basic CORS headers
 */
function setCorsHeaders(res: Response) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Request-Method', '*');
  res.headers.set('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.headers.set('Access-Control-Allow-Headers', '*');
  return res;
}

export function OPTIONS() {
  const response = new Response(null, { status: 204 });
  return setCorsHeaders(response);
}

const handler = async (req: NextRequest) => {
  const session = await auth();

  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: req.headers,
        session,
      }),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`);
          }
        : undefined,
  });

  return setCorsHeaders(response);
};

export { handler as GET, handler as POST };
