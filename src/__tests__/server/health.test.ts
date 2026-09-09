import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
  searchClient: vi.fn(),
  indexClient: vi.fn(),
  countDocuments: vi.fn<(options: { abortSignal: AbortSignal }) => Promise<number>>(),
  redisConnect: vi.fn(),
  redisPing: vi.fn(),
  redisDisconnect: vi.fn(),
  redisOptions: vi.fn<(url: string, options: { retryStrategy: () => null }) => void>(),
}));

vi.mock('@/server/db', () => ({
  db: { $queryRawUnsafe: mocks.queryDatabase },
}));

vi.mock('@azure/search-documents', () => ({
  AzureKeyCredential: class {
    constructor(public key: string) {}
  },
  SearchClient: class {
    constructor(endpoint: string, index: string, credential: { key: string }) {
      mocks.searchClient(endpoint, index, credential);
    }
    getDocumentsCount = mocks.countDocuments;
  },
  SearchIndexClient: class {
    constructor() {
      mocks.indexClient();
    }
  },
}));

vi.mock('ioredis', () => ({
  default: class {
    constructor(url: string, options: { retryStrategy: () => null }) {
      mocks.redisOptions(url, options);
    }
    connect = mocks.redisConnect;
    ping = mocks.redisPing;
    disconnect = mocks.redisDisconnect;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('AZURE_SEARCH_ENDPOINT', 'https://configured-search.search.windows.net');
  vi.stubEnv('AZURE_SEARCH_API_KEY', 'test-search-key');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')));
  mocks.queryDatabase.mockResolvedValue([{ '?column?': 1 }]);
  mocks.countDocuments.mockResolvedValue(0);
  mocks.redisConnect.mockResolvedValue(undefined);
  mocks.redisPing.mockResolvedValue('PONG');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('GET /api/health', () => {
  it('reports an empty but readable Azure index as healthy, not the obsolete Meilisearch probe', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'healthy',
      services: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
        azureSearch: { status: 'ok' },
        bullmq: { status: 'ok' },
      },
    });
    expect(body.services).not.toHaveProperty('meilisearch');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.searchClient).toHaveBeenCalledWith(
      'https://configured-search.search.windows.net',
      'listings',
      expect.objectContaining({ key: 'test-search-key' }),
    );
    expect(mocks.countDocuments).toHaveBeenCalledOnce();
    expect(mocks.indexClient).not.toHaveBeenCalled();
    expect(mocks.redisDisconnect).toHaveBeenCalledTimes(2);
  });

  it('uses the same default Azure endpoint as marketplace search', async () => {
    vi.stubEnv('AZURE_SEARCH_ENDPOINT', '');
    const { GET } = await import('@/app/api/health/route');

    expect((await GET()).status).toBe(200);
    expect(mocks.searchClient).toHaveBeenCalledWith(
      'https://search-turgo.search.windows.net',
      'listings',
      expect.objectContaining({ key: 'test-search-key' }),
    );
  });

  it('reports missing production credentials as degraded without attempting a request', async () => {
    vi.stubEnv('AZURE_SEARCH_API_KEY', '');
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: 'degraded',
      services: { azureSearch: { status: 'error', message: 'Azure AI Search check failed' } },
    });
    expect(mocks.countDocuments).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 429, 503])(
    'reports Azure HTTP %i as degraded without publishing SDK credentials or diagnostics',
    async (statusCode) => {
      const warnSpy = vi.spyOn(console, 'warn');
      const errorSpy = vi.spyOn(console, 'error');
      mocks.countDocuments.mockRejectedValue(
        Object.assign(new Error('api-key: test-search-key; private SDK response'), {
          statusCode,
          request: { headers: { 'api-key': 'test-search-key' } },
        }),
      );
      const { GET } = await import('@/app/api/health/route');

      const response = await GET();
      const body = await response.text();

      expect(response.status).toBe(503);
      expect(body).toContain('Azure AI Search check failed');
      expect(body).not.toContain('test-search-key');
      expect(body).not.toContain('private SDK response');
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it('aborts a hung search request after three seconds even if the transport ignores cancellation', async () => {
    vi.useFakeTimers();
    mocks.countDocuments.mockImplementation(() => new Promise(() => {}));
    const { GET } = await import('@/app/api/health/route');

    const pending = GET();
    await vi.advanceTimersByTimeAsync(2999);
    const signal = mocks.countDocuments.mock.calls[0][0].abortSignal;
    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      services: { azureSearch: { status: 'error', latencyMs: 3000 } },
    });
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the search deadline when an index read succeeds', async () => {
    vi.useFakeTimers();
    const { GET } = await import('@/app/api/health/route');

    expect((await GET()).status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.countDocuments.mock.calls[0][0].abortSignal.aborted).toBe(false);
  });

  it('keeps concurrent health deadlines independent while sharing the search client', async () => {
    vi.useFakeTimers();
    const { isSearchHealthy } = await import('@/server/services/search');

    const results = await Promise.all([isSearchHealthy(), isSearchHealthy()]);

    expect(results).toEqual([true, true]);
    expect(mocks.searchClient).toHaveBeenCalledOnce();
    expect(mocks.countDocuments).toHaveBeenCalledTimes(2);
    expect(mocks.countDocuments.mock.calls[0][0].abortSignal).not.toBe(
      mocks.countDocuments.mock.calls[1][0].abortSignal,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not mask database failures or publish database connection strings', async () => {
    mocks.queryDatabase.mockRejectedValue(new Error('postgresql://user:private-password@db'));
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('Database check failed');
    expect(body).not.toContain('private-password');
  });

  it('reports Redis and queue failures and closes both failed health connections', async () => {
    mocks.redisPing.mockRejectedValue(new Error('redis://:private-password@redis'));
    const { GET } = await import('@/app/api/health/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.services).toMatchObject({
      redis: { status: 'error', message: 'Redis check failed' },
      bullmq: { status: 'error', message: 'Queue check failed' },
    });
    expect(JSON.stringify(body)).not.toContain('private-password');
    expect(mocks.redisDisconnect).toHaveBeenCalledTimes(2);
    expect(mocks.redisOptions).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        connectTimeout: 3000,
        commandTimeout: 3000,
        retryStrategy: expect.any(Function),
      }),
    );
    expect(mocks.redisOptions.mock.calls[0][1].retryStrategy()).toBeNull();
  });
});
