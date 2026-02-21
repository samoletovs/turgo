/**
 * AI Free Provider — Ollama self-hosted LLM + lightweight local models
 * Used for free-tier users in production or when premium AI is unavailable
 *
 * Capabilities:
 * - Chat completions via Ollama (llama3.1, mistral, etc.)
 * - Lightweight embeddings via all-MiniLM-L6-v2 (Ollama)
 * - Basic image tagging rules (no vision model for free tier)
 */

import type { AiCompletionOptions, AiCompletionResult, AiEmbeddingResult } from "@/types";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_CHAT_MODEL = "llama3.1:8b";
const DEFAULT_EMBEDDING_MODEL = "all-minilm:l6-v2";

function getBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL;
}

/** Chat completion via Ollama */
export async function ollamaComplete(
  options: AiCompletionOptions
): Promise<AiCompletionResult> {
  const baseUrl = getBaseUrl();
  const model = options.model || process.env.OLLAMA_MODEL || DEFAULT_CHAT_MODEL;

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

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || "",
      model,
      provider: "ollama",
      tokensUsed: data.eval_count,
    };
  } catch (error) {
    console.warn("[AI-Free] Ollama unavailable:", error);
    return freeFallback(options);
  }
}

/** Generate embeddings via Ollama (all-minilm) */
export async function ollamaEmbed(
  texts: string[]
): Promise<AiEmbeddingResult> {
  const baseUrl = getBaseUrl();
  const model = process.env.OLLAMA_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  try {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings error: ${response.status}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding || []);
    }

    return {
      embeddings,
      model,
      provider: "ollama",
    };
  } catch (error) {
    console.warn("[AI-Free] Ollama embeddings unavailable:", error);
    // Return zero vectors as fallback (384-dimensional for MiniLM)
    return {
      embeddings: texts.map(() => new Array(384).fill(0)),
      model: "fallback",
      provider: "ollama",
    };
  }
}

/** Basic rule-based image analysis for free tier (no vision model) */
export async function freeAnalyzeImage(
  imageUrl: string,
  _prompt?: string
): Promise<AiCompletionResult> {
  // Free tier: derive basic info from URL and filename patterns
  const urlLower = imageUrl.toLowerCase();
  const tags: string[] = [];
  let suggestedCategory = "other";

  // Simple heuristics from filename/path
  const categoryHints: Record<string, { tags: string[]; category: string }> = {
    car: { tags: ["vehicle", "automobile"], category: "cars" },
    auto: { tags: ["vehicle", "automobile"], category: "cars" },
    phone: { tags: ["electronics", "smartphone"], category: "phones-tablets" },
    laptop: { tags: ["electronics", "computer"], category: "laptops" },
    apartment: { tags: ["property", "real-estate"], category: "apartments-sale" },
    flat: { tags: ["property", "real-estate"], category: "apartments-sale" },
    house: { tags: ["property", "real-estate"], category: "houses-sale" },
    bike: { tags: ["transport", "bicycle"], category: "bicycles" },
    furniture: { tags: ["home", "interior"], category: "furniture" },
    sofa: { tags: ["home", "furniture"], category: "furniture" },
    shirt: { tags: ["clothing", "fashion"], category: "mens-clothing" },
    dress: { tags: ["clothing", "fashion"], category: "womens-clothing" },
  };

  for (const [keyword, hint] of Object.entries(categoryHints)) {
    if (urlLower.includes(keyword)) {
      tags.push(...hint.tags);
      suggestedCategory = hint.category;
      break;
    }
  }

  if (tags.length === 0) {
    tags.push("item", "listing");
  }

  const result = {
    description: "Image uploaded for listing (analysis available with Pro plan)",
    tags,
    suggestedCategory,
    suggestedTitle: "",
    confidence: 0.2,
  };

  return {
    content: JSON.stringify(result),
    model: "rule-based",
    provider: "ollama",
  };
}

/** Free-tier fallback: rule-based responses when Ollama is unavailable */
function freeFallback(options: AiCompletionOptions): AiCompletionResult {
  const lastUserMsg = options.messages.findLast((m) => m.role === "user");
  const systemMsg = options.messages.find((m) => m.role === "system");
  const userText = lastUserMsg?.content?.toString().toLowerCase() || "";

  // Try to detect context from system prompt
  if (systemMsg?.content?.includes("price") || systemMsg?.content?.includes("pricing")) {
    return {
      content: JSON.stringify({
        suggestedPrice: 0,
        reasoning: "AI pricing unavailable — please set your price based on similar listings.",
        confidence: 0,
      }),
      model: "fallback",
      provider: "ollama",
    };
  }

  if (systemMsg?.content?.includes("negotiat") || systemMsg?.content?.includes("offer")) {
    return {
      content: "Thank you for your interest! Please contact the seller directly to discuss the price.",
      model: "fallback",
      provider: "ollama",
    };
  }

  if (systemMsg?.content?.includes("concierge") || systemMsg?.content?.includes("intent")) {
    let intent = "other";
    if (/sell|pārdod|продать|parduot/i.test(userText)) intent = "sell";
    else if (/buy|find|pirkt|купить|pirkti|osta/i.test(userText)) intent = "buy";
    else if (/help|palīdz|помощь|pagalba/i.test(userText)) intent = "support";
    else if (/browse|search|skatīt|смотреть/i.test(userText)) intent = "browse";

    return {
      content: JSON.stringify({
        intent,
        message:
          intent === "sell"
            ? "Let me help you sell! Start by uploading photos of your item."
            : intent === "buy"
            ? "Tell me what you're looking for and your budget."
            : intent === "support"
            ? "How can I help? Describe your issue."
            : intent === "browse"
            ? "Browse our categories to find what you need."
            : "Welcome! I can help you sell, buy, or browse.",
        suggestedActions: [],
        detectedLanguage: "en",
      }),
      model: "fallback",
      provider: "ollama",
    };
  }

  // Generic fallback
  return {
    content: `[Free tier] Basic response. Upgrade to Pro for AI-powered assistance.`,
    model: "fallback",
    provider: "ollama",
  };
}
