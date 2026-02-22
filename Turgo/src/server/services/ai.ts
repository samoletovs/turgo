/**
 * AI Service Router — Unified interface for all AI providers
 *
 * Routing logic:
 *   AI_PROVIDER="github"  → GitHub Models API (dev/test, free with Copilot)
 *   AI_PROVIDER="azure"   → Azure OpenAI GPT-4o (production, paid users)
 *   AI_PROVIDER="ollama"  → Self-hosted Ollama (fallback, free users in prod)
 *
 * Tier-aware routing (production):
 *   paid user   → ai-premium (Azure OpenAI)
 *   free user   → ai-free    (Ollama / rule-based)
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
import { ollamaComplete, ollamaEmbed, freeAnalyzeImage } from "./ai-free";

export type AiProvider = "github" | "azure" | "ollama";

/** User tier determines premium vs free AI */
export type UserTier = "free" | "pro" | "business";

/** Resolve the active provider from env var */
function getEnvProvider(): AiProvider {
  return (process.env.AI_PROVIDER as AiProvider) || "github";
}

/**
 * Resolve the effective provider for a request.
 * In production (AI_PROVIDER=azure), routes by user tier:
 *   - paid → azure (premium)
 *   - free → ollama (free)
 * In dev (AI_PROVIDER=github), always uses GitHub Models.
 */
function resolveProvider(userTier?: UserTier): AiProvider {
  const envProvider = getEnvProvider();

  // Dev mode: always use GitHub Models regardless of tier
  if (envProvider === "github") return "github";

  // Ollama mode: always use Ollama
  if (envProvider === "ollama") return "ollama";

  // Azure mode: all tiers use Azure OpenAI (GPT-4o-mini is cost-effective enough)
  if (envProvider === "azure") {
    return "azure";
  }

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
      case "ollama":
        return await ollamaComplete(options);
      default:
        return await githubModelsComplete(options);
    }
  } catch (error) {
    console.error(`[AI Router] ${provider} failed, trying fallback:`, error);
    // Cascade fallback: azure → github → ollama → mock
    if (provider === "azure") {
      try {
        return await githubModelsComplete(options);
      } catch {
        /* fall through */
      }
    }
    if (provider !== "ollama") {
      try {
        return await ollamaComplete(options);
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
      case "ollama":
        return await ollamaEmbed(texts);
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
    return await ollamaEmbed(texts);
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
      case "ollama":
        return await freeAnalyzeImage(imageUrl, prompt);
      default:
        return await githubModelsAnalyzeImage(imageUrl, prompt);
    }
  } catch (error) {
    console.error(`[AI Router] Vision ${provider} failed:`, error);
    return await freeAnalyzeImage(imageUrl, prompt);
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
