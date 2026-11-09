/**
 * AI Premium Provider — Azure OpenAI GPT-6 Luna + Azure AI Vision
 * Used for paid-tier users in production
 *
 * Capabilities:
 * - Chat completions via Azure OpenAI (GPT-6 Luna, reasoning disabled)
 * - Embeddings via Azure OpenAI (text-embedding-3-small — 5x cheaper than large)
 * - Image analysis via Azure OpenAI GPT-6 Luna vision
 */

import type { AiCompletionOptions, AiCompletionResult, AiEmbeddingResult } from '@/types';

export const DEFAULT_AZURE_OPENAI_DEPLOYMENT = 'gpt-6-luna';

export function azureOpenAiTokenOptions(deployment: string, maxTokens: number) {
  return {
    max_completion_tokens: maxTokens,
    // Existing deployments must keep working between the code release and model flip.
    ...(deployment === 'gpt-6-luna' ? { reasoning_effort: 'none' as const } : {}),
  };
}

export function azureOpenAiUrl(
  endpoint: string,
  operation: 'chat/completions' | 'embeddings',
): string {
  return `${endpoint.replace(/\/+$/, '')}/openai/v1/${operation}`;
}

/** Chat completion via Azure OpenAI */
export async function azureOpenAiComplete(
  options: AiCompletionOptions,
): Promise<AiCompletionResult> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || DEFAULT_AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey) {
    throw new Error('[AI-Premium] AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY required');
  }

  const response = await fetch(azureOpenAiUrl(endpoint, 'chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      ...azureOpenAiTokenOptions(deployment, options.maxTokens ?? 1000),
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI-Premium] Azure OpenAI error:', response.status, errorText);
    throw new Error(`Azure OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens,
    model: deployment,
    provider: 'azure',
  };
}

/** Generate embeddings via Azure OpenAI */
export async function azureOpenAiEmbed(texts: string[]): Promise<AiEmbeddingResult> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

  if (!endpoint || !apiKey) {
    throw new Error('[AI-Premium] AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY required');
  }

  const response = await fetch(azureOpenAiUrl(endpoint, 'embeddings'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      input: texts,
    }),
  });

  if (!response.ok) {
    console.error('[AI-Premium] Azure embeddings error:', response.status);
    throw new Error(`Azure embeddings error: ${response.status}`);
  }

  const data = await response.json();
  return {
    embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
    model: deployment,
    provider: 'azure',
    tokensUsed: data.usage?.total_tokens,
  };
}

/** Analyze image via Azure OpenAI vision */
export async function azureAnalyzeImage(
  imageUrl: string,
  prompt?: string,
): Promise<AiCompletionResult> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_VISION_DEPLOYMENT || DEFAULT_AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey) {
    throw new Error('[AI-Premium] Azure credentials required for vision');
  }

  const response = await fetch(azureOpenAiUrl(endpoint, 'chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      messages: [
        {
          role: 'system',
          content: `You are an expert classifieds photo analyzer for the Baltic region marketplace.
Analyze the image and return JSON with:
- description: clear description of the item
- tags: array of relevant search tags
- suggestedCategory: best matching category slug
- suggestedTitle: suggested listing title
- condition: NEW, USED, or REFURBISHED based on visual analysis
- confidence: 0-1 how confident you are`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                prompt ||
                'Analyze this image for a classifieds listing. What is it? Condition? Suggest a price category.',
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' },
            },
          ],
        },
      ],
      temperature: 0.3,
      ...azureOpenAiTokenOptions(deployment, 800),
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI-Premium] Azure Vision error:', response.status, errorText);
    throw new Error(`Azure Vision error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens,
    model: deployment,
    provider: 'azure',
  };
}

/**
 * Azure AI Vision — Dedicated image analysis service
 * (Separate from Azure OpenAI, uses Azure Computer Vision 4.0)
 */
export async function azureVisionAnalyze(imageUrl: string): Promise<{
  description: string;
  tags: string[];
  confidence: number;
}> {
  const endpoint = process.env.AZURE_VISION_ENDPOINT;
  const apiKey = process.env.AZURE_VISION_API_KEY;

  if (!endpoint || !apiKey) {
    // Fall back to Azure OpenAI vision
    const result = await azureAnalyzeImage(imageUrl);
    try {
      const parsed = JSON.parse(result.content);
      return {
        description: parsed.description || '',
        tags: parsed.tags || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch {
      return {
        description: result.content,
        tags: [],
        confidence: 0.3,
      };
    }
  }

  const response = await fetch(
    `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=caption,tags,objects`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: JSON.stringify({ url: imageUrl }),
    },
  );

  if (!response.ok) {
    console.error('[AI-Premium] Azure Vision API error:', response.status);
    throw new Error(`Azure Vision API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    description: data.captionResult?.text || '',
    tags: (data.tagsResult?.values || []).map((t: { name: string }) => t.name),
    confidence: data.captionResult?.confidence || 0.5,
  };
}
