import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db';
import { mockDb } from '@/__tests__/setup';
import type { SearchDocument } from '@/server/services/search';

const sdk = vi.hoisted(() => ({
  search: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@azure/search-documents', () => ({
  SearchClient: class {
    search = sdk.search;
    uploadDocuments = sdk.upload;
    deleteDocuments = sdk.remove;
  },
  SearchIndexClient: class {},
  AzureKeyCredential: class {},
}));

import {
  projectSearchListing,
  searchFingerprint,
  searchSnapshotSelect,
  SEARCH_SYNC_DEADLINE_MS,
  SEARCH_SYNC_LIMIT,
  synchronizeSearch,
  type SearchSnapshotRow,
} from '@/server/services/search-sync';

const actualSdk =
  await vi.importActual<typeof import('@azure/search-documents')>('@azure/search-documents');

export function snapshotRow(
  id: string,
  overrides: Partial<SearchSnapshotRow> = {},
): SearchSnapshotRow {
  return {
    id,
    title: 'Synthetic',
    slug: id,
    description: 'Synthetic description',
    price: new Prisma.Decimal(10),
    currency: 'EUR',
    condition: 'USED',
    status: 'ACTIVE',
    negotiable: true,
    categoryId: 'category',
    locationId: 'location',
    category: { slug: 'category', name: { en: 'Category', lv: 'Kategorija' } },
    location: { slug: 'location', name: { en: 'Location' }, countryCode: 'LV' },
    latitude: 1,
    longitude: 2,
    managedByAgent: false,
    viewCount: 0,
    createdAt: new Date('2020-01-01T00:00:00Z'),
    images: [{ url: 'https://example.invalid/image' }],
    _count: { images: 1 },
    attributes: [{ value: 'blue' }],
    ...overrides,
  };
}

let rows: SearchSnapshotRow[];
let index: Map<string, SearchDocument>;

beforeEach(() => {
  vi.clearAllMocks();
  rows = [snapshotRow('one')];
  index = new Map();
  mockDb.$queryRaw.mockResolvedValue([{ locked: true }]);
  mockDb.$executeRaw.mockResolvedValue(0);
  mockDb.listing.findMany.mockImplementation(({ take }) =>
    rows.filter(({ status }) => status === 'ACTIVE').slice(0, take),
  );
  sdk.search.mockImplementation(async () => ({
    count: index.size,
    results: (async function* () {
      for (const document of index.values()) yield { document };
    })(),
  }));
  sdk.upload.mockImplementation(async (documents: SearchDocument[]) => {
    documents.forEach((document) => index.set(document.id, { ...document }));
    return { results: documents.map(({ id }) => ({ key: id, succeeded: true })) };
  });
  sdk.remove.mockImplementation(async (_key: string, ids: string[]) => {
    ids.forEach((id) => index.delete(id));
    return { results: ids.map((id) => ({ key: id, succeeded: true })) };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('authoritative search reconciliation', () => {
  it('matches real SDK GeographyPoint responses without repeatedly uploading unchanged locations', async () => {
    const document = projectSearchListing(rows[0]);
    const requests: string[] = [];
    const client = new actualSdk.SearchClient<SearchDocument>(
      'https://synthetic.search.windows.net',
      'listings',
      new actualSdk.AzureKeyCredential('synthetic-test-key'),
      {
        httpClient: {
          async sendRequest(request) {
            requests.push(request.url);
            if (!request.url.includes('/docs/search')) {
              throw new Error('Unchanged SDK geography must not cause an index write');
            }
            return {
              request,
              status: 200,
              headers: request.headers,
              bodyAsText: JSON.stringify({
                '@odata.count': 1,
                value: [{ '@search.score': 1, ...document }],
              }),
            };
          },
        },
      },
    );

    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await synchronizeSearch(db, client)).toEqual({
        documents: 1,
        uploaded: 0,
        deleted: 0,
      });
    }
    expect(requests).toHaveLength(2);
  });

  it('tolerates only geographic floating-point round-trip noise and still detects movement', () => {
    const source = projectSearchListing(
      snapshotRow('one', { longitude: 12.3456789, latitude: 45.123456789 }),
    );
    const roundTrip: SearchDocument = {
      ...source,
      location: { type: 'Point', coordinates: [12.345678900000002, 45.123456788999994] },
    };
    expect(searchFingerprint(roundTrip)).toBe(searchFingerprint(source));
    roundTrip.location = { type: 'Point', coordinates: [12.3456799, 45.123456789] };
    expect(searchFingerprint(roundTrip)).not.toBe(searchFingerprint(source));
  });

  it('backfills all public inventory and verifies ID/content parity, then performs no duplicate writes', async () => {
    rows = Array.from({ length: 153 }, (_, i) => snapshotRow(`synthetic-${i}`));

    expect(await synchronizeSearch(db)).toEqual({ documents: 153, uploaded: 153, deleted: 0 });
    expect([...index.keys()].sort()).toEqual(rows.map(({ id }) => id).sort());
    for (const row of rows) {
      expect(searchFingerprint(index.get(row.id)!)).toBe(
        searchFingerprint(projectSearchListing(row)),
      );
    }
    expect(sdk.upload.mock.calls.map(([batch]) => batch.length)).toEqual([100, 53]);

    expect(await synchronizeSearch(db)).toEqual({ documents: 153, uploaded: 0, deleted: 0 });
    expect(sdk.upload).toHaveBeenCalledTimes(2);
  });

  it('reconciles create, update, inactive, reactivation and delete on successive reads', async () => {
    await synchronizeSearch(db);
    rows.push(snapshotRow('two'));
    rows[0] = snapshotRow('one', { title: 'Changed', price: new Prisma.Decimal(20) });
    await synchronizeSearch(db);
    expect(index.get('one')?.title).toBe('Changed');
    expect(index.get('one')?.price).toBe(20);
    expect(index.has('two')).toBe(true);

    rows[0].status = 'DRAFT';
    await synchronizeSearch(db);
    expect(index.has('one')).toBe(false);
    rows[0].status = 'ACTIVE';
    await synchronizeSearch(db);
    expect(index.has('one')).toBe(true);
    rows = [];
    await synchronizeSearch(db);
    expect(index.size).toBe(0);
  });

  it('uses full replacement to clear images, location, attributes and coordinates', async () => {
    await synchronizeSearch(db);
    rows[0] = snapshotRow('one', {
      locationId: null,
      location: null,
      latitude: null,
      longitude: null,
      images: [],
      _count: { images: 0 },
      attributes: [],
    });

    await synchronizeSearch(db);

    expect(index.get('one')).toMatchObject({
      imageUrl: '',
      imageCount: 0,
      hasImages: false,
      locationId: '',
      locationSlug: '',
      locationName: '',
      countryCode: '',
      attributeValues: '',
      location: null,
    });
  });

  it('projects only allowlisted public fields and deterministic multilingual search text', () => {
    const row = {
      ...snapshotRow('one'),
      contactPhone: 'do-not-copy',
      userId: 'do-not-copy',
      address: 'do-not-copy',
    };
    const document = projectSearchListing(row);
    expect(JSON.stringify(document)).not.toContain('do-not-copy');
    expect(JSON.stringify(searchSnapshotSelect)).not.toMatch(
      /contactPhone|contactEmail|userId|address/,
    );
    expect(document.categoryName).toBe('Category Kategorija');
  });

  it('detects wrong IDs even when index and database counts match', async () => {
    index.set('stale', projectSearchListing(snapshotRow('stale')));
    await synchronizeSearch(db);
    expect([...index.keys()]).toEqual(['one']);
    expect(sdk.remove).toHaveBeenCalledBefore(sdk.upload);
  });

  it.each(['failed', 'missing', 'duplicate'])(
    'rejects %s per-item write results',
    async (failure) => {
      sdk.upload.mockResolvedValueOnce({
        results:
          failure === 'missing'
            ? []
            : failure === 'duplicate'
              ? [
                  { key: 'one', succeeded: true },
                  { key: 'one', succeeded: true },
                ]
              : [{ key: 'one', succeeded: false, errorMessage: 'private SDK diagnostic' }],
      });
      await expect(synchronizeSearch(db)).rejects.toThrow('partial');
    },
  );

  it('rejects a partial deletion without reporting success', async () => {
    index.set('stale', projectSearchListing(snapshotRow('stale')));
    sdk.remove.mockResolvedValueOnce({ results: [{ key: 'stale', succeeded: false }] });
    await expect(synchronizeSearch(db)).rejects.toThrow('partial');
    expect(sdk.upload).not.toHaveBeenCalled();
  });

  it('does not accept acknowledged writes until ID and content read-back match', async () => {
    sdk.upload.mockResolvedValueOnce({ results: [{ key: 'one', succeeded: true }] });
    await expect(synchronizeSearch(db)).rejects.toThrow('parity');
  });

  it('detects a database change during indexing and leaves the request to database fallback', async () => {
    sdk.upload.mockImplementationOnce(async (documents: SearchDocument[]) => {
      documents.forEach((document) => index.set(document.id, document));
      rows[0].title = 'Changed concurrently';
      return { results: [{ key: 'one', succeeded: true }] };
    });
    await expect(synchronizeSearch(db)).rejects.toThrow('changed');
    await synchronizeSearch(db);
    expect(index.get('one')?.title).toBe('Changed concurrently');
  });

  it('falls back without doing any search work when another replica owns the advisory lock', async () => {
    mockDb.$queryRaw.mockResolvedValueOnce([{ locked: false }]);
    await expect(synchronizeSearch(db)).rejects.toThrow('busy');
    expect(sdk.search).not.toHaveBeenCalled();
    expect(mockDb.listing.findMany).not.toHaveBeenCalled();
    expect(mockDb.$queryRaw.mock.calls[0][0].join('')).toContain(
      'pg_try_advisory_xact_lock(81743, 1)',
    );
  });

  it('serializes overlapping replica reconciliations and permits a later idempotent retry', async () => {
    let release!: () => void;
    sdk.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ count: 0, results: [] });
        }),
    );
    mockDb.$queryRaw
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ locked: false }]);

    const first = synchronizeSearch(db);
    await vi.waitFor(() => expect(sdk.search).toHaveBeenCalledOnce());
    await expect(synchronizeSearch(db)).rejects.toThrow('busy');
    expect(sdk.upload).not.toHaveBeenCalled();
    release();
    await expect(first).resolves.toEqual({ documents: 1, uploaded: 1, deleted: 0 });
    await expect(synchronizeSearch(db)).resolves.toEqual({ documents: 1, uploaded: 0, deleted: 0 });
    expect(sdk.upload).toHaveBeenCalledOnce();
  });

  it('rejects oversized authoritative inventory before changing the index', async () => {
    rows = Array.from({ length: SEARCH_SYNC_LIMIT + 1 }, (_, i) => snapshotRow(String(i)));
    await expect(synchronizeSearch(db)).rejects.toThrow('capacity');
    expect(sdk.upload).not.toHaveBeenCalled();
    expect(sdk.remove).not.toHaveBeenCalled();
  });

  it('rejects an oversized index rather than entering an unbounded scan/delete loop', async () => {
    sdk.search.mockResolvedValueOnce({ count: SEARCH_SYNC_LIMIT + 1, results: [] });
    await expect(synchronizeSearch(db)).rejects.toThrow('capacity');
    expect(sdk.upload).not.toHaveBeenCalled();
  });

  it('aborts stalled index I/O at the shared deadline and performs no late writes', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    sdk.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ count: 0, results: [] });
        }),
    );
    const pending = expect(synchronizeSearch(db)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(SEARCH_SYNC_DEADLINE_MS);
    await pending;
    expect(sdk.search.mock.calls[0][1].abortSignal.aborted).toBe(true);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.upload).not.toHaveBeenCalled();
    expect(sdk.remove).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
