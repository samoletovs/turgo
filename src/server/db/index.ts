import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('localhost:5432/build')) {
    // Return a proxy that will throw only when actually called at runtime
    // This allows the build step to import without connecting
    return new Proxy({} as PrismaClient, {
      get(_, prop) {
        if (prop === 'then' || prop === Symbol.toPrimitive) return undefined;
        throw new Error(`DATABASE_URL is not configured. Cannot access db.${String(prop)}`);
      },
    });
  }
  const pool = new pg.Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export default db;
