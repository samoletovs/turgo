import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  devModelsEndpoint,
  githubModelsAnalyzeImage,
  githubModelsComplete,
  githubModelsEmbed,
} from '@/server/services/ai-dev';
import { aiEmbed } from '@/server/services/ai';

const fetchMock = vi.fn<typeof fetch>();
const chat = { messages: [{ role: 'user' as const, content: 'hello there' }] };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('GITHUB_TOKEN', 'test-only');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe('dev AI provider after the GitHub Models retirement', () => {
  it.each([
    ['unset', undefined],
    ['blank', '  '],
    ['the retired GitHub Models host', 'https://models.inference.ai.azure.com'],
    ['the retired host with a path', 'https://MODELS.inference.ai.azure.com/v1/'],
    ['not a URL', 'models.inference.ai.azure.com'],
  ])('returns mocks without any network call when the endpoint is %s', async (_, endpoint) => {
    if (endpoint === undefined)
      vi.stubEnv('GITHUB_MODELS_ENDPOINT', undefined as unknown as string);
    else vi.stubEnv('GITHUB_MODELS_ENDPOINT', endpoint);

    expect(devModelsEndpoint()).toBeNull();
    expect((await githubModelsComplete(chat)).model).toBe('mock');
    expect((await githubModelsAnalyzeImage('https://example.com/a.png')).model).toBe('mock');
    const embedded = await githubModelsEmbed(['a', 'b']);
    expect(embedded.embeddings).toHaveLength(2);
    expect(embedded.embeddings[0]).toHaveLength(1536);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still calls an explicitly configured OpenAI-compatible endpoint', async () => {
    vi.stubEnv('GITHUB_MODELS_ENDPOINT', 'http://localhost:11434/v1/');
    fetchMock.mockResolvedValue(
      Response.json({ choices: [{ message: { content: 'hi' } }], usage: { total_tokens: 3 } }),
    );

    const result = await githubModelsComplete(chat);

    expect(result.content).toBe('hi');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('keeps the 1536-dimension fallback when Azure embeddings fail in production', async () => {
    vi.stubEnv('AI_PROVIDER', 'azure');
    vi.stubEnv('GITHUB_MODELS_ENDPOINT', 'https://models.inference.ai.azure.com');
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://example.openai.azure.com/');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-only');
    vi.stubEnv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'embedding-deployment');
    fetchMock.mockRejectedValue(new Error('azure down'));

    const result = await aiEmbed(['a']);

    expect(result.embeddings[0]).toHaveLength(1536);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain('models.inference.ai.azure.com');
    }
  });
});
