import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  azureAnalyzeImage,
  azureOpenAiComplete,
  azureOpenAiEmbed,
  azureOpenAiUrl,
} from '@/server/services/ai-premium';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://example.openai.azure.com/');
  vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-only');
  vi.stubEnv('AZURE_OPENAI_DEPLOYMENT_NAME', 'chat-deployment');
  vi.stubEnv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'embedding-deployment');
  vi.stubEnv('AZURE_OPENAI_VISION_DEPLOYMENT', 'vision-deployment');
  // An old environment setting must never bring back the dated preview routes.
  vi.stubEnv('AZURE_OPENAI_API_VERSION', '2024-12-01-preview');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe('Azure OpenAI v1', () => {
  it.each(['https://example.openai.azure.com', 'https://example.openai.azure.com/'])(
    'normalizes the resource endpoint %s',
    (endpoint) => {
      expect(azureOpenAiUrl(endpoint, 'chat/completions')).toBe(
        'https://example.openai.azure.com/openai/v1/chat/completions',
      );
    },
  );

  it('sends the existing chat deployment and completion options in the v1 body', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [{ message: { content: 'hello' } }],
        usage: { total_tokens: 9 },
      }),
    );
    const messages = [{ role: 'user' as const, content: 'hello' }];
    const result = await azureOpenAiComplete({
      messages,
      temperature: 0,
      maxTokens: 25,
      responseFormat: { type: 'json_object' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.openai.azure.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': 'test-only' },
        body: JSON.stringify({
          model: 'chat-deployment',
          messages,
          temperature: 0,
          max_tokens: 25,
          response_format: { type: 'json_object' },
        }),
      }),
    );
    expect(result).toEqual({
      content: 'hello',
      tokensUsed: 9,
      model: 'chat-deployment',
      provider: 'azure',
    });
  });

  it('preserves embedding inputs and deployment while removing api-version', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ data: [{ embedding: [0.1, 0.2] }], usage: { total_tokens: 2 } }),
    );
    const result = await azureOpenAiEmbed(['synthetic text']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.openai.azure.com/openai/v1/embeddings',
      expect.objectContaining({
        body: JSON.stringify({ model: 'embedding-deployment', input: ['synthetic text'] }),
      }),
    );
    expect(result.embeddings).toEqual([[0.1, 0.2]]);
    expect(result.model).toBe('embedding-deployment');
  });

  it('keeps the multimodal image and JSON response contract on v1', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"description":"test"}' } }] }),
    );
    await azureAnalyzeImage('https://example.test/synthetic.png', 'Describe this');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.openai.azure.com/openai/v1/chat/completions');
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: 'vision-deployment',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.test/synthetic.png', detail: 'high' },
            },
          ],
        },
      ],
    });
  });

  it('still rejects upstream failures instead of returning a successful result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(
      azureOpenAiComplete({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toThrow('Azure OpenAI error: 503');
  });
});
