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

  it.each(['gpt-4o-mini', 'gpt-6-luna', 'gpt-6-luna-custom'])(
    'sends compatible chat options for runtime deployment %s',
    async (deployment) => {
      vi.stubEnv('AZURE_OPENAI_DEPLOYMENT_NAME', deployment);
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
            model: deployment,
            messages,
            temperature: 0,
            max_completion_tokens: 25,
            ...(deployment === 'gpt-6-luna' ? { reasoning_effort: 'none' } : {}),
            response_format: { type: 'json_object' },
          }),
        }),
      );
      expect(result).toEqual({
        content: 'hello',
        tokensUsed: 9,
        model: deployment,
        provider: 'azure',
      });
    },
  );

  it.each([undefined, ''])('defaults chat to Luna when deployment is %s', async (deployment) => {
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT_NAME', deployment);
    fetchMock.mockResolvedValue(Response.json({ choices: [{ message: { content: 'hello' } }] }));
    const messages = [{ role: 'user' as const, content: 'hello' }];
    const result = await azureOpenAiComplete({ messages });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      model: 'gpt-6-luna',
      messages,
      temperature: 0.7,
      max_completion_tokens: 1000,
      reasoning_effort: 'none',
    });
    expect(result.model).toBe('gpt-6-luna');
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

  it.each(['gpt-4o-mini', 'gpt-6-luna', 'gpt-6-luna-custom'])(
    'preserves multimodal JSON and sampling options for runtime deployment %s',
    async (deployment) => {
      vi.stubEnv('AZURE_OPENAI_VISION_DEPLOYMENT', deployment);
      fetchMock.mockResolvedValue(
        Response.json({ choices: [{ message: { content: '{"description":"test"}' } }] }),
      );
      await azureAnalyzeImage('https://example.test/synthetic.png', 'Describe this');
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.openai.azure.com/openai/v1/chat/completions');
      const body = JSON.parse(String(options?.body));
      expect(body).toMatchObject({
        model: deployment,
        temperature: 0.3,
        max_completion_tokens: 800,
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
      expect(body).not.toHaveProperty('max_tokens');
      if (deployment === 'gpt-6-luna') {
        expect(body.reasoning_effort).toBe('none');
      } else {
        expect(body).not.toHaveProperty('reasoning_effort');
      }
    },
  );

  it.each([undefined, ''])('defaults vision to Luna when deployment is %s', async (deployment) => {
    vi.stubEnv('AZURE_OPENAI_VISION_DEPLOYMENT', deployment);
    fetchMock.mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"description":"test"}' } }] }),
    );
    const result = await azureAnalyzeImage('https://example.test/synthetic.png');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      model: 'gpt-6-luna',
      temperature: 0.3,
      max_completion_tokens: 800,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
    });
    expect(body).not.toHaveProperty('max_tokens');
    expect(result.model).toBe('gpt-6-luna');
  });

  it('still rejects upstream failures instead of returning a successful result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(
      azureOpenAiComplete({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toThrow('Azure OpenAI error: 503');
  });
});
