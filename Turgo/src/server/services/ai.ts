/**
 * AI Service Router
 * Delegates to the correct AI provider based on environment and user tier:
 * - "github" → GitHub Models API (dev/test, free with Copilot)
 * - "azure" → Azure OpenAI GPT-4o (production, paid tier)
 * - "ollama" → Self-hosted Ollama (fallback)
 */

import type { AiChatMessage, AiCompletionResult, AiCompletionOptions } from "@/types";

export type AiProvider = "github" | "azure" | "ollama";

function getProvider(): AiProvider {
  return (process.env.AI_PROVIDER as AiProvider) || "github";
}

/** Unified AI completion — routes to the correct provider */
export async function aiComplete(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const provider = getProvider();

  switch (provider) {
    case "github":
      return githubModelsComplete(options);
    case "azure":
      return azureOpenAiComplete(options);
    case "ollama":
      return ollamaComplete(options);
    default:
      return githubModelsComplete(options);
  }
}

/** GitHub Models API (dev/test) */
async function githubModelsComplete(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const endpoint = process.env.GITHUB_MODELS_ENDPOINT || "https://models.inference.ai.azure.com";
  const model = options.model || process.env.GITHUB_MODELS_MODEL || "gpt-4o";
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.warn("GITHUB_TOKEN not set, returning mock response");
    return mockComplete(options);
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
    }),
  });

  if (!response.ok) {
    console.error("GitHub Models API error:", response.status, await response.text());
    return mockComplete(options);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    tokensUsed: data.usage?.total_tokens,
    model,
    provider: "github",
  };
}

/** Azure OpenAI (production paid tier) */
async function azureOpenAiComplete(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o";

  if (!endpoint || !apiKey) {
    console.warn("Azure OpenAI not configured, falling back to GitHub Models");
    return githubModelsComplete(options);
  }

  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
      }),
    }
  );

  if (!response.ok) {
    console.error("Azure OpenAI error:", response.status);
    return githubModelsComplete(options); // Fallback
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    tokensUsed: data.usage?.total_tokens,
    model: deployment,
    provider: "azure",
  };
}

/** Ollama self-hosted (fallback for free tier in production) */
async function ollamaComplete(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = options.model || process.env.OLLAMA_MODEL || "llama3.1:8b";

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 1000,
        },
      }),
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

    const data = await response.json();
    return {
      content: data.message?.content || "",
      model,
      provider: "ollama",
    };
  } catch {
    console.warn("Ollama unavailable, returning mock response");
    return mockComplete(options);
  }
}

/** Mock response for when no AI provider is available */
function mockComplete(options: AiCompletionOptions): AiCompletionResult {
  const lastUserMsg = options.messages.findLast((m: AiChatMessage) => m.role === "user");
  return {
    content: `[AI Mock] Response to: "${lastUserMsg?.content?.slice(0, 50) || "unknown"}"`,
    model: "mock",
    provider: "github",
  };
}

/** Helper: create a system + user message pair */
export function createMessages(
  systemPrompt: string,
  userMessage: string
): AiChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}
