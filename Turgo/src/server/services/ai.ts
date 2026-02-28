/**
 * AI Service Router — Unified interface for all AI providers
 *
 * Routing logic:
 *   AI_PROVIDER="github"  → GitHub Models API (dev/test, free with Copilot)
 *   AI_PROVIDER="azure"   → Azure OpenAI GPT-4o (production)
 *
 * All providers implement the same interface so agents are provider-agnostic.
 */

import type {
  AiChatMessage,
  AiCompletionResult,
  AiCompletionOptions,
  AiEmbeddingResult,
} from "@/types";

// Provider implementations
import {
  githubModelsComplete,
  githubModelsEmbed,
  githubModelsAnalyzeImage,
} from "./ai-dev";
import {
  azureOpenAiComplete,
  azureOpenAiEmbed,
  azureAnalyzeImage,
} from "./ai-premium";

export type AiProvider = "github" | "azure";

/** User tier determines premium vs free AI */
export type UserTier = "free" | "pro" | "business";

/** Resolve the active provider from env var */
function getEnvProvider(): AiProvider {
  return (process.env.AI_PROVIDER as AiProvider) || "github";
}

/**
 * Resolve the effective provider for a request.
 * In production (AI_PROVIDER=azure), uses Azure OpenAI.
 * In dev (AI_PROVIDER=github), always uses GitHub Models.
 */
function resolveProvider(userTier?: UserTier): AiProvider {
  const envProvider = getEnvProvider();

  if (envProvider === "azure") return "azure";

  return "github";
}

// ──────────────────────────────────────────────
// CHAT COMPLETIONS
// ──────────────────────────────────────────────

/** Unified AI completion — routes to the correct provider */
export async function aiComplete(
  options: AiCompletionOptions,
  userTier?: UserTier,
): Promise<AiCompletionResult> {
  const provider = resolveProvider(userTier);

  try {
    switch (provider) {
      case "github":
        return await githubModelsComplete(options);
      case "azure":
        return await azureOpenAiComplete(options);
      default:
        return await githubModelsComplete(options);
    }
  } catch (error) {
    console.error(`[AI Router] ${provider} failed, trying fallback:`, error);
    // Cascade fallback: azure → github → mock
    if (provider === "azure") {
      try {
        return await githubModelsComplete(options);
      } catch {
        /* fall through */
      }
    }
    return mockComplete(options);
  }
}

// ──────────────────────────────────────────────
// EMBEDDINGS
// ──────────────────────────────────────────────

/** Unified embedding generation */
export async function aiEmbed(
  texts: string[],
  userTier?: UserTier,
): Promise<AiEmbeddingResult> {
  const provider = resolveProvider(userTier);

  try {
    switch (provider) {
      case "github":
        return await githubModelsEmbed(texts);
      case "azure":
        return await azureOpenAiEmbed(texts);
      default:
        return await githubModelsEmbed(texts);
    }
  } catch (error) {
    console.error(`[AI Router] Embedding ${provider} failed:`, error);
    if (provider === "azure") {
      try {
        return await githubModelsEmbed(texts);
      } catch {
        /* fall through */
      }
    }
    // Return zero vectors as mock fallback
    return {
      embeddings: texts.map(() => new Array(384).fill(0)),
      model: "mock",
      provider: "github" as const,
    };
  }
}

// ──────────────────────────────────────────────
// IMAGE ANALYSIS
// ──────────────────────────────────────────────

/** Unified image analysis */
export async function aiAnalyzeImage(
  imageUrl: string,
  prompt?: string,
  userTier?: UserTier,
): Promise<AiCompletionResult> {
  const provider = resolveProvider(userTier);

  try {
    switch (provider) {
      case "github":
        return await githubModelsAnalyzeImage(imageUrl, prompt);
      case "azure":
        return await azureAnalyzeImage(imageUrl, prompt);
      default:
        return await githubModelsAnalyzeImage(imageUrl, prompt);
    }
  } catch (error) {
    console.error(`[AI Router] Vision ${provider} failed:`, error);
    return {
      content: "[Vision unavailable]",
      model: "mock",
      provider: "github" as const,
    };
  }
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

/** Mock response for when no AI provider is available */
function mockComplete(options: AiCompletionOptions): AiCompletionResult {
  const lastUserMsg = options.messages.findLast(
    (m: AiChatMessage) => m.role === "user",
  );
  return {
    content: `[AI Mock] Response to: "${lastUserMsg?.content?.toString().slice(0, 50) || "unknown"}"`,
    model: "mock",
    provider: "github",
  };
}

/** Helper: create a system + user message pair */
export function createMessages(
  systemPrompt: string,
  userMessage: string,
): AiChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}

/** Get current provider info (for diagnostics / UI) */
export function getAiProviderInfo(userTier?: UserTier) {
  const envProvider = getEnvProvider();
  const effectiveProvider = resolveProvider(userTier);
  return {
    envProvider,
    effectiveProvider,
    userTier: userTier || "free",
    isPremium: effectiveProvider === "azure",
    isDev: envProvider === "github",
  };
}
