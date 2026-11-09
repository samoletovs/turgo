import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db';
import { createCallerFactory } from '@/server/trpc';
import { aiRouter } from '@/server/trpc/routers/ai';

const createCaller = createCallerFactory(aiRouter);
const fetchMock = vi.fn<typeof fetch>();

function caller(authenticated = true) {
  return createCaller({
    db,
    session: authenticated
      ? {
          user: { id: 'test-user', email: 'test@example.test', role: 'USER', locale: 'en' },
          expires: '',
        }
      : null,
    headers: new Headers(),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('AI_PROVIDER', 'azure');
  vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://example.openai.azure.com/');
  vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-only');
  vi.stubEnv('AZURE_OPENAI_DEPLOYMENT_NAME', 'existing-deployment');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('Azure AI diagnostics', () => {
  it.each(['gpt-4o-mini', 'gpt-6-luna', 'gpt-6-luna-custom', undefined, ''])(
    'uses compatible diagnostic options for deployment %s',
    async (configuredDeployment) => {
      vi.stubEnv('AZURE_OPENAI_DEPLOYMENT_NAME', configuredDeployment);
      const deployment = configuredDeployment || 'gpt-6-luna';
      fetchMock.mockResolvedValue(
        Response.json({ choices: [{ message: { content: 'OK' } }], model: 'existing-model' }),
      );
      const result = await caller().diagnosticStatus();
      expect(result.azureConfig.apiVersion).toBe('v1');
      expect(result.azureConfig.deployment).toBe(deployment);
      expect(result.azureStatus).toBe('connected');
      expect(result.azureResponse).toBe('OK');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.openai.azure.com/openai/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: deployment,
            messages: [{ role: 'user', content: "Say 'OK' in one word." }],
            max_completion_tokens: 5,
            ...(deployment === 'gpt-6-luna' ? { reasoning_effort: 'none' } : {}),
            temperature: 0,
          }),
        }),
      );
    },
  );

  it('still requires authentication before making an inference call', async () => {
    await expect(caller(false).diagnosticStatus()).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an upstream error rather than claiming connectivity', async () => {
    fetchMock.mockResolvedValue(new Response('unavailable', { status: 503 }));
    const result = await caller().diagnosticStatus();
    expect(result.azureStatus).toBe('error');
    expect(result.azureError).toContain('503');
  });
});
