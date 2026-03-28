/**
 * AI Dev Provider — GitHub Models API
 * Used during development/testing — free with GitHub Copilot subscription
 * Same OpenAI-compatible interface as Azure OpenAI
 */

import type { AiCompletionOptions, AiCompletionResult, AiEmbeddingResult } from '@/types';

const DEFAULT_ENDPOINT = 'https://models.inference.ai.azure.com';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

function getEndpoint(): string {
  return process.env.GITHUB_MODELS_ENDPOINT || DEFAULT_ENDPOINT;
}

function getToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

/** Chat completion via GitHub Models API */
export async function githubModelsComplete(
  options: AiCompletionOptions,
): Promise<AiCompletionResult> {
  const endpoint = getEndpoint();
  const model = options.model || process.env.GITHUB_MODELS_MODEL || DEFAULT_MODEL;
  const token = getToken();

  if (!token) {
    console.warn('[AI-Dev] GITHUB_TOKEN not set, returning mock response');
    return mockComplete(options);
  }

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-Dev] GitHub Models API error:', response.status, errorText);
      return mockComplete(options);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
      model,
      provider: 'github',
    };
  } catch (error) {
    console.error('[AI-Dev] GitHub Models fetch error:', error);
    return mockComplete(options);
  }
}

/** Generate embeddings via GitHub Models API */
export async function githubModelsEmbed(texts: string[]): Promise<AiEmbeddingResult> {
  const endpoint = getEndpoint();
  const model = process.env.GITHUB_MODELS_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const token = getToken();

  if (!token) {
    console.warn('[AI-Dev] GITHUB_TOKEN not set, returning zero embeddings');
    return {
      embeddings: texts.map(() => new Array(1536).fill(0)),
      model,
      provider: 'github',
    };
  }

  try {
    const response = await fetch(`${endpoint}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      console.error('[AI-Dev] Embeddings error:', response.status);
      return {
        embeddings: texts.map(() => new Array(1536).fill(0)),
        model,
        provider: 'github',
      };
    }

    const data = await response.json();
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      model,
      provider: 'github',
      tokensUsed: data.usage?.total_tokens,
    };
  } catch (error) {
    console.error('[AI-Dev] Embeddings fetch error:', error);
    return {
      embeddings: texts.map(() => new Array(1536).fill(0)),
      model,
      provider: 'github',
    };
  }
}

/** Analyze image via GitHub Models (GPT-4o vision) */
export async function githubModelsAnalyzeImage(
  imageUrl: string,
  prompt?: string,
): Promise<AiCompletionResult> {
  const endpoint = getEndpoint();
  const model = process.env.GITHUB_MODELS_VISION_MODEL || 'gpt-4o';
  const token = getToken();

  if (!token) {
    return mockComplete({
      messages: [{ role: 'user', content: prompt || 'Analyze this image' }],
    });
  }

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  prompt ||
                  'Analyze this image for a classifieds listing. Return JSON: {description, tags[], suggestedCategory, suggestedTitle, condition}',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('[AI-Dev] Vision error:', response.status);
      return mockComplete({
        messages: [{ role: 'user', content: prompt || 'Analyze' }],
      });
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
      model,
      provider: 'github',
    };
  } catch (error) {
    console.error('[AI-Dev] Vision fetch error:', error);
    return mockComplete({
      messages: [{ role: 'user', content: prompt || 'Analyze' }],
    });
  }
}

/** Mock response fallback */
function mockComplete(options: AiCompletionOptions): AiCompletionResult {
  const lastUserMsg = options.messages.findLast((m) => m.role === 'user');
  return {
    content: `[AI Mock] Response to: "${lastUserMsg?.content?.toString().slice(0, 50) || 'unknown'}"`,
    model: 'mock',
    provider: 'github',
  };
}
