import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { IndexDocumentsResult, SearchClient } from '@azure/search-documents';
import {
  getListingsIndexDefinition,
  getSearchClient,
  searchCoordinates,
  toSearchDocument,
  withSearchDeadline,
  type SearchDocument,
} from './search.ts';

export const SEARCH_SYNC_LIMIT = 500;
export const SEARCH_SYNC_DEADLINE_MS = 8000;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const MAX_BATCH_BYTES = 4 * 1024 * 1024;

export class SearchSyncError extends Error {
  readonly code: 'busy' | 'capacity' | 'partial' | 'parity' | 'changed';

  constructor(code: SearchSyncError['code']) {
    super(`Search synchronization ${code}`);
    this.code = code;
  }
}

// Whitelist only public search data. Never select user/contact/address fields.
export const searchSnapshotSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  currency: true,
  condition: true,
  status: true,
  negotiable: true,
  categoryId: true,
  locationId: true,
  latitude: true,
  longitude: true,
  managedByAgent: true,
  viewCount: true,
  createdAt: true,
  category: { select: { slug: true, name: true } },
  location: { select: { slug: true, name: true, countryCode: true } },
  images: {
    select: { url: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    take: 1,
  },
  _count: { select: { images: true } },
  attributes: { select: { value: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.ListingSelect;

export type SearchSnapshotRow = Prisma.ListingGetPayload<{ select: typeof searchSnapshotSelect }>;

function localizedSearchText(value: Prisma.JsonValue): string {
  if (typeof value === 'string') return value;
  if (!value || Array.isArray(value) || typeof value !== 'object') return '';
  return Object.keys(value)
    .sort()
    .map((key) => value[key])
    .filter((text): text is string => typeof text === 'string')
    .join(' ');
}

export function projectSearchListing(row: SearchSnapshotRow): SearchDocument {
  return toSearchDocument({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    condition: row.condition,
    status: row.status,
    negotiable: row.negotiable,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    categoryName: localizedSearchText(row.category.name),
    locationId: row.locationId ?? '',
    locationSlug: row.location?.slug ?? '',
    locationName: row.location ? localizedSearchText(row.location.name) : '',
    countryCode: row.location?.countryCode ?? '',
    latitude: row.latitude,
    longitude: row.longitude,
    managedByAgent: row.managedByAgent,
    viewCount: row.viewCount,
    imageUrl: row.images[0]?.url ?? '',
    imageCount: row._count.images,
    attributeValues: row.attributes.map(({ value }) => value).join(' '),
    createdAt: row.createdAt,
  });
}

export function searchFingerprint(document: SearchDocument): string {
  const canonical = getListingsIndexDefinition().fields.map(({ name }) => {
    const value = document[name as keyof SearchDocument];
    if (name === 'createdAt' && typeof value === 'string') return new Date(value).toISOString();
    if (name === 'location') {
      const point = document.location;
      if (!point) return null;
      return 'coordinates' in point
        ? searchCoordinates(...point.coordinates)
        : searchCoordinates(point.longitude, point.latitude);
    }
    return value ?? null;
  });
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function byId(documents: SearchDocument[]): Map<string, string> {
  const result = new Map(documents.map((document) => [document.id, searchFingerprint(document)]));
  if (result.size !== documents.length) throw new SearchSyncError('parity');
  return result;
}

function sameSnapshot(left: SearchDocument[], right: SearchDocument[]): boolean {
  const expected = byId(left);
  const actual = byId(right);
  return (
    expected.size === actual.size && [...expected].every(([id, hash]) => actual.get(id) === hash)
  );
}

async function databaseSnapshot(tx: Prisma.TransactionClient): Promise<SearchDocument[]> {
  const rows = await tx.listing.findMany({
    where: { status: 'ACTIVE' },
    select: searchSnapshotSelect,
    orderBy: { id: 'asc' },
    take: SEARCH_SYNC_LIMIT + 1,
  });
  const documents = rows.map(projectSearchListing);
  checkCapacity(documents);
  return documents;
}

function checkCapacity(documents: SearchDocument[]): void {
  if (
    documents.length > SEARCH_SYNC_LIMIT ||
    Buffer.byteLength(JSON.stringify(documents)) > MAX_SNAPSHOT_BYTES
  ) {
    throw new SearchSyncError('capacity');
  }
}

async function indexSnapshot(
  client: SearchClient<SearchDocument>,
  abortSignal: AbortSignal,
): Promise<SearchDocument[]> {
  abortSignal.throwIfAborted();
  const response = await client.search('*', {
    top: SEARCH_SYNC_LIMIT + 1,
    includeTotalCount: true,
    abortSignal,
  });
  if (response.count === undefined || response.count > SEARCH_SYNC_LIMIT) {
    throw new SearchSyncError('capacity');
  }
  const documents: SearchDocument[] = [];
  let bytes = 0;
  for await (const { document } of response.results) {
    abortSignal.throwIfAborted();
    documents.push(document);
    bytes += Buffer.byteLength(JSON.stringify(document));
    if (documents.length > SEARCH_SYNC_LIMIT || bytes > MAX_SNAPSHOT_BYTES) {
      throw new SearchSyncError('capacity');
    }
  }
  if (documents.length !== response.count) throw new SearchSyncError('parity');
  return documents;
}

function verifyItems(result: IndexDocumentsResult, ids: string[]): void {
  const results = new Map(result.results.map((item) => [item.key, item.succeeded]));
  if (
    results.size !== ids.length ||
    result.results.length !== ids.length ||
    ids.some((id) => results.get(id) !== true)
  ) {
    throw new SearchSyncError('partial');
  }
}

function uploadBatches(documents: SearchDocument[]): SearchDocument[][] {
  const batches: SearchDocument[][] = [];
  let batch: SearchDocument[] = [];
  let bytes = 0;
  for (const document of documents) {
    const size = Buffer.byteLength(JSON.stringify(document)) + 1;
    if (size > MAX_BATCH_BYTES) throw new SearchSyncError('capacity');
    if (batch.length === 100 || bytes + size > MAX_BATCH_BYTES) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(document);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export interface SearchSyncResult {
  documents: number;
  uploaded: number;
  deleted: number;
}

export async function synchronizeSearch(
  database: PrismaClient,
  client = getSearchClient(),
): Promise<SearchSyncResult> {
  return withSearchDeadline(
    (signal) =>
      database.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
          const locks = await tx.$queryRaw<{ locked: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(81743, 1) AS locked
          `;
          if (locks[0]?.locked !== true) throw new SearchSyncError('busy');
          signal.throwIfAborted();
          const expected = await databaseSnapshot(tx);
          const existing = await indexSnapshot(client, signal);
          const existingHashes = byId(existing);
          const expectedIds = new Set(expected.map(({ id }) => id));
          const deleted = existing.filter(({ id }) => !expectedIds.has(id)).map(({ id }) => id);
          const uploads = expected.filter(
            (doc) => existingHashes.get(doc.id) !== searchFingerprint(doc),
          );
          const batches = uploadBatches(uploads);

          // Remove stale/private records before replacing changed documents.
          for (let offset = 0; offset < deleted.length; offset += 100) {
            signal.throwIfAborted();
            const ids = deleted.slice(offset, offset + 100);
            verifyItems(await client.deleteDocuments('id', ids, { abortSignal: signal }), ids);
          }
          for (const batch of batches) {
            signal.throwIfAborted();
            // Upload replaces the whole record, so clearing optional fields cannot leave old values.
            verifyItems(
              await client.uploadDocuments(batch, { abortSignal: signal }),
              batch.map(({ id }) => id),
            );
          }
          const verified =
            uploads.length || deleted.length ? await indexSnapshot(client, signal) : existing;
          if (!sameSnapshot(expected, verified)) throw new SearchSyncError('parity');
          if (!sameSnapshot(expected, await databaseSnapshot(tx)))
            throw new SearchSyncError('changed');
          signal.throwIfAborted();
          return { documents: expected.length, uploaded: uploads.length, deleted: deleted.length };
        },
        { maxWait: 1000, timeout: SEARCH_SYNC_DEADLINE_MS + 1000 },
      ),
    SEARCH_SYNC_DEADLINE_MS,
  );
}

export function reportSearchFallback(error: unknown): void {
  console.warn(
    JSON.stringify({
      event: 'search_database_fallback',
      reason: error instanceof SearchSyncError ? error.code : 'unavailable',
    }),
  );
}
