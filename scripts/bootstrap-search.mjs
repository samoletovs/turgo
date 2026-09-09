import { pathToFileURL } from 'node:url';
import { bootstrapSearchIndex, getListingsIndexDefinition } from '../src/server/services/search.ts';

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--schema') {
    console.log(JSON.stringify(getListingsIndexDefinition(), null, 2));
    return 0;
  }
  if (args.length !== 1 || !['--create', '--sync'].includes(args[0])) {
    console.error('Usage: node scripts/bootstrap-search.mjs --schema | --create | --sync');
    return 1;
  }
  if (!process.env.AZURE_SEARCH_API_KEY?.trim()) {
    console.error('AZURE_SEARCH_API_KEY must be supplied through the process environment.');
    return 1;
  }
  if (args[0] === '--sync') {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error('DATABASE_URL must be supplied through the process environment.');
      return 1;
    }
    let database;
    let outcome = 1;
    try {
      const { PrismaClient } = await import('@prisma/client');
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { synchronizeSearch } = await import('../src/server/services/search-sync.ts');
      database = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: process.env.DATABASE_URL,
          connectionTimeoutMillis: 2000,
          statement_timeout: 2000,
        }),
        log: [],
      });
      const result = await synchronizeSearch(database);
      console.log(JSON.stringify({ event: 'search_sync_verified', ...result }));
      outcome = 0;
    } catch {
      console.error(
        JSON.stringify({
          event: 'search_sync_failed',
          reason:
            'Check configuration, permissions, index state, capacity and concurrent requests.',
        }),
      );
    } finally {
      if (database) {
        try {
          await database.$disconnect();
        } catch {
          console.error(
            JSON.stringify({ event: 'search_sync_failed', reason: 'database_disconnect' }),
          );
          outcome = 1;
        }
      }
    }
    return outcome;
  }
  try {
    await bootstrapSearchIndex();
    console.log('Created listings index and verified authenticated reads. No listings backfilled.');
    return 0;
  } catch {
    console.error(
      'Search bootstrap failed. Check admin-key permissions, connectivity and index state. ' +
        'Creation never overwrites an existing index; a timed-out request may have completed in Azure.',
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
