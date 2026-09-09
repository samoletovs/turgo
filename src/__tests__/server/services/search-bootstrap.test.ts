import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  updateIndex: vi.fn(),
  countDocuments: vi.fn(),
  synchronize: vi.fn(),
  disconnect: vi.fn(),
  databaseOptions: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      mocks.databaseOptions(options);
    }
    $disconnect = mocks.disconnect;
  },
}));
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {},
}));
vi.mock('@/server/services/search-sync', () => ({
  synchronizeSearch: mocks.synchronize,
}));

vi.mock('@azure/search-documents', () => ({
  AzureKeyCredential: class {
    constructor(_key: string) {}
  },
  SearchClient: class {
    getDocumentsCount = mocks.countDocuments;
  },
  SearchIndexClient: class {
    createIndex = mocks.createIndex;
    createOrUpdateIndex = mocks.updateIndex;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('AZURE_SEARCH_API_KEY', 'bootstrap-test-secret');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.createIndex.mockResolvedValue({ name: 'listings' });
  mocks.countDocuments.mockResolvedValue(0);
  mocks.synchronize.mockResolvedValue({ documents: 153, uploaded: 153, deleted: 0 });
  mocks.disconnect.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('search bootstrap command', () => {
  it('requires inherited database credentials before backfill', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');
    expect(await main(['--sync'])).toBe(1);
    expect(mocks.synchronize).not.toHaveBeenCalled();
    expect(mocks.databaseOptions).not.toHaveBeenCalled();
  });

  it('runs the shared verified reconciliation and logs only aggregate counts', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/test');
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');
    expect(await main(['--sync'])).toBe(0);
    expect(mocks.synchronize).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'search_sync_verified',
        documents: 153,
        uploaded: 153,
        deleted: 0,
      }),
    );
    expect(mocks.databaseOptions).toHaveBeenCalledWith(expect.objectContaining({ log: [] }));
  });

  it('returns failure without publishing secrets when reconciliation or disconnect fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/test');
    mocks.synchronize.mockRejectedValue(new Error('bootstrap-test-secret'));
    mocks.disconnect.mockRejectedValue(new Error('bootstrap-test-secret'));
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');
    expect(await main(['--sync'])).toBe(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'bootstrap-test-secret',
    );
  });

  it('exports the shared schema without requiring credentials or creating an index', async () => {
    vi.stubEnv('AZURE_SEARCH_API_KEY', '');
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');
    const { getListingsIndexDefinition } = await import('@/server/services/search');

    expect(await main(['--schema'])).toBe(0);
    const schema = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);

    expect(schema).toEqual(getListingsIndexDefinition());
    expect(schema.fields).toHaveLength(24);
    expect(schema).toMatchObject({
      name: 'listings',
      suggesters: [{ name: 'sg', sourceFields: ['title', 'categoryName'] }],
      defaultScoringProfile: 'boostTitle',
    });
    expect(mocks.createIndex).not.toHaveBeenCalled();
    expect(mocks.countDocuments).not.toHaveBeenCalled();
  });

  it('creates the canonical index and verifies that it is readable before reporting success', async () => {
    vi.useFakeTimers();
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');
    const { getListingsIndexDefinition } = await import('@/server/services/search');

    expect(await main(['--create'])).toBe(0);
    expect(mocks.createIndex).toHaveBeenCalledWith(getListingsIndexDefinition(), {
      abortSignal: expect.any(AbortSignal),
    });
    expect(mocks.countDocuments).toHaveBeenCalledOnce();
    expect(mocks.updateIndex).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      'Created listings index and verified authenticated reads. No listings backfilled.',
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refuses creation without an explicit admin-key environment value', async () => {
    vi.stubEnv('AZURE_SEARCH_API_KEY', '');
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');

    expect(await main(['--create'])).toBe(1);
    expect(mocks.createIndex).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'AZURE_SEARCH_API_KEY must be supplied through the process environment.',
    );
  });

  it.each([401, 403, 409, 429, 503])(
    'fails closed on HTTP %i without leaking SDK errors or updating an existing index',
    async (statusCode) => {
      mocks.createIndex.mockRejectedValue(
        Object.assign(new Error('api-key: bootstrap-test-secret'), { statusCode }),
      );
      const { main } = await import('../../../../scripts/bootstrap-search.mjs');

      expect(await main(['--create'])).toBe(1);
      expect(mocks.updateIndex).not.toHaveBeenCalled();
      expect(mocks.countDocuments).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
        'bootstrap-test-secret',
      );
    },
  );

  it('does not report success when creation completes but the index cannot be read', async () => {
    mocks.countDocuments.mockRejectedValue(new Error('Index not found'));
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');

    expect(await main(['--create'])).toBe(1);
    expect(mocks.createIndex).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('cancels a hung creation after ten seconds and warns that Azure may have completed it', async () => {
    vi.useFakeTimers();
    mocks.createIndex.mockImplementation(() => new Promise(() => {}));
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');

    const pending = main(['--create']);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toBe(1);
    expect(mocks.createIndex.mock.calls[0][1].abortSignal.aborted).toBe(true);
    expect(mocks.countDocuments).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('a timed-out request may have completed in Azure'),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('requires an explicit operation rather than mutating Azure by default', async () => {
    const { main } = await import('../../../../scripts/bootstrap-search.mjs');

    expect(await main([])).toBe(1);
    expect(await main(['--create', '--force'])).toBe(1);
    expect(mocks.createIndex).not.toHaveBeenCalled();
  });
});
