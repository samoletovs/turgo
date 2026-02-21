/**
 * AI Translation Service — Multi-language message translation
 * Supports LV ↔ RU ↔ EN ↔ LT ↔ ET for Pro/Business users
 */

import { aiComplete, createMessages } from "./ai";
import { db } from "@/server/db";
import type { Locale } from "@/lib/constants";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  lv: "Latvian",
  ru: "Russian",
  lt: "Lithuanian",
  et: "Estonian",
};

// ──────────────────────────────────────────────
// LANGUAGE DETECTION
// ──────────────────────────────────────────────

/** Simple character/pattern-based language detection */
export function detectLanguage(text: string): Locale {
  const lower = text.toLowerCase();

  // Russian — Cyrillic characters
  if (/[а-яёА-ЯЁ]/.test(text)) return "ru";

  // Latvian — unique characters: ā, ē, ī, ū, ģ, ķ, ļ, ņ, ž, č, š
  if (/[āēīūģķļņ]/.test(lower)) return "lv";

  // Lithuanian — unique characters: ą, č, ę, ė, į, š, ų, ū, ž
  if (/[ąęėįųū]/.test(lower)) return "lt";

  // Estonian — unique characters: ä, ö, ü, õ
  if (/[äöüõ]/.test(lower)) return "et";

  // Default to English
  return "en";
}

// ──────────────────────────────────────────────
// TRANSLATION
// ──────────────────────────────────────────────

/** Translate a message to the target language using AI */
export async function translateMessage(
  content: string,
  targetLocale: Locale,
  sourceLocale?: Locale
): Promise<string> {
  const source = sourceLocale || detectLanguage(content);

  if (source === targetLocale) return content;

  const sourceLang = LANGUAGE_NAMES[source] || "Unknown";
  const targetLang = LANGUAGE_NAMES[targetLocale] || "English";

  const messages = createMessages(
    `You are a professional translator for a classifieds marketplace in the Baltic region.
Translate the following message from ${sourceLang} to ${targetLang}.
Keep the tone conversational and natural. Preserve any prices, numbers, and product names.
If the text contains emoji or special characters, keep them as-is.
Return ONLY the translation, nothing else.`,
    content
  );

  try {
    const result = await aiComplete({ messages, temperature: 0.3, maxTokens: 500 });
    return result.content.trim();
  } catch {
    console.error("[Translation] AI translation failed, returning original");
    return content;
  }
}

/** Translate a message to all supported locales */
export async function translateToAll(
  content: string,
  sourceLocale?: Locale
): Promise<Record<string, string>> {
  const source = sourceLocale || detectLanguage(content);
  const targetLocales: Locale[] = ["en", "lv", "ru", "lt", "et"].filter(
    (l) => l !== source
  ) as Locale[];

  const translations: Record<string, string> = { [source]: content };

  // Translate to all target locales in parallel
  const results = await Promise.allSettled(
    targetLocales.map(async (locale) => ({
      locale,
      translation: await translateMessage(content, locale, source),
    }))
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      translations[result.value.locale] = result.value.translation;
    }
  }

  return translations;
}

// ──────────────────────────────────────────────
// USER PLAN CHECK
// ──────────────────────────────────────────────

/** Check if user has translation capability (Pro/Business plan) */
export async function userHasTranslation(userId: string): Promise<boolean> {
  const subscription = await db.subscription.findUnique({
    where: { userId },
    include: { plan: { select: { hasAutoTranslate: true } } },
  });

  return subscription?.plan?.hasAutoTranslate ?? false;
}

// ──────────────────────────────────────────────
// TRANSLATE MESSAGE IN-PLACE
// ──────────────────────────────────────────────

/**
 * Translate a message and store translations.
 * Called after sending a message for Pro/Business users.
 */
export async function translateAndStoreMessage(
  messageId: string,
  senderId: string
): Promise<Record<string, string> | null> {
  const hasTranslation = await userHasTranslation(senderId);
  if (!hasTranslation) return null;

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { content: true, originalLanguage: true },
  });

  if (!message) return null;

  const sourceLocale = (message.originalLanguage as Locale) || detectLanguage(message.content);
  const translations = await translateToAll(message.content, sourceLocale);

  await db.message.update({
    where: { id: messageId },
    data: {
      translatedContent: translations as never,
      originalLanguage: sourceLocale,
    },
  });

  return translations;
}

/** Translate a single message on-demand for a specific user locale */
export async function translateMessageOnDemand(
  messageId: string,
  targetLocale: Locale
): Promise<string> {
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { content: true, translatedContent: true, originalLanguage: true },
  });

  if (!message) throw new Error("Message not found");

  // Check if translation already cached
  const existing = message.translatedContent as Record<string, string> | null;
  if (existing?.[targetLocale]) {
    return existing[targetLocale];
  }

  // Translate
  const sourceLocale = (message.originalLanguage as Locale) || detectLanguage(message.content);
  const translation = await translateMessage(message.content, targetLocale, sourceLocale);

  // Cache the translation
  const updatedTranslations = { ...(existing || {}), [targetLocale]: translation };
  await db.message.update({
    where: { id: messageId },
    data: {
      translatedContent: updatedTranslations as never,
      originalLanguage: sourceLocale,
    },
  });

  return translation;
}
