/**
 * Concierge Agent — Intent detection, routing, multi-language support
 * Entry point for all user interactions with the AI system
 */

import { aiComplete } from "./ai";
import type { AgentIntent, ConciergeResponse, AiChatMessage } from "@/types";

const SYSTEM_PROMPT = `You are a concierge for Turgo, an AI-powered classifieds platform in the Baltic region (Latvia, Lithuania, Estonia).

Your role:
1. Detect user intent: SELL, BUY, SUPPORT, BROWSE, or OTHER
2. Guide them to the right action
3. Be helpful, concise, and friendly
4. ALWAYS respond in the user's language. Detect it from their message.

Respond in JSON format:
{
  "intent": "sell|buy|support|browse|other",
  "message": "Your response to the user IN THEIR LANGUAGE",
  "suggestedActions": [{"label": "Button text", "action": "action_name"}],
  "detectedLanguage": "en|lv|ru|lt|et"
}

Key features you can help with:
- SELL: User wants to sell something → guide to selling agent wizard. Actions: sell_start, sell_upload, sell_describe
- BUY: User looking for something → guide to buying agent wizard. Actions: buy_start, buy_describe, browse
- SUPPORT: Need help with account, billing, technical issues → support. Actions: support_account, support_billing, support_listing
- BROWSE: Want to explore categories/listings → browse mode. Actions: browse_categories, browse_featured, search
- OTHER: Greeting, unclear, or off-topic → offer main options. Actions: sell, buy, browse

Always maintain context from conversation history. If a previous intent was established, continue that flow.
If the user says they want to sell and then describes an item, keep intent as "sell" and help them.
If the user says they want to buy and then describes criteria, keep intent as "buy" and help them.`;

const LANGUAGE_PROMPTS: Record<string, string> = {
  en: "Respond in English.",
  lv: "Atbildi latviešu valodā.",
  ru: "Отвечай на русском языке.",
  lt: "Atsakyk lietuvių kalba.",
  et: "Vasta eesti keeles.",
};

/** Process a user message and return intent + response */
export async function processConciergeMessage(
  message: string,
  history?: AiChatMessage[],
  locale?: string,
): Promise<ConciergeResponse> {
  const detectedLang = locale || detectLanguage(message);
  const langInstruction = LANGUAGE_PROMPTS[detectedLang] || LANGUAGE_PROMPTS.en;

  const messages: AiChatMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${langInstruction}` },
    ...(history || []),
    { role: "user", content: message },
  ];

  try {
    const result = await aiComplete({
      messages,
      temperature: 0.3,
      maxTokens: 500,
    });

    // Try to parse JSON response
    const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      intent: parsed.intent as AgentIntent,
      message: parsed.message,
      suggestedActions: parsed.suggestedActions,
      data: { detectedLanguage: parsed.detectedLanguage || detectedLang },
    };
  } catch (error) {
    console.error(
      "[Concierge] AI failed, using rule-based fallback:",
      error instanceof Error ? error.message : error,
    );
    // Fallback to rule-based detection
    return fallbackIntentDetection(message, detectedLang);
  }
}

/** Rule-based fallback when AI is unavailable */
function fallbackIntentDetection(
  message: string,
  lang: string,
): ConciergeResponse {
  const lower = message.toLowerCase();

  // Multi-language keyword matching
  const sellKeywords =
    /sell|pārdot|pārdod|продать|продаю|parduoti|parduodu|müüa|müün/;
  const buyKeywords =
    /buy|find|looking|want|need|pirkt|meklē|gribu|купить|ищу|хочу|pirkti|ieškau|noriu|osta|otsin|tahan/;
  const supportKeywords =
    /help|support|problem|issue|bug|palīdz|помощь|проблема|pagalba|problema|abi/;
  const browseKeywords =
    /browse|search|show|categ|explore|skatīt|parādīt|смотреть|показать|žiūrėti|rodyti|vaata|näita/;

  const responses = FALLBACK_RESPONSES[lang] || FALLBACK_RESPONSES.en;

  if (sellKeywords.test(lower)) {
    return {
      intent: "sell",
      message: responses.sell,
      suggestedActions: [
        { label: responses.sellUpload, action: "sell_upload" },
        { label: responses.sellDescribe, action: "sell_describe" },
      ],
      data: { detectedLanguage: lang },
    };
  }

  if (buyKeywords.test(lower)) {
    return {
      intent: "buy",
      message: responses.buy,
      suggestedActions: [
        { label: responses.buyDescribe, action: "buy_describe" },
        { label: responses.browseCategories, action: "browse" },
      ],
      data: { detectedLanguage: lang },
    };
  }

  if (supportKeywords.test(lower)) {
    return {
      intent: "support",
      message: responses.support,
      suggestedActions: [
        { label: responses.supportAccount, action: "support_account" },
        { label: responses.supportBilling, action: "support_billing" },
        { label: responses.supportListing, action: "support_listing" },
      ],
      data: { detectedLanguage: lang },
    };
  }

  if (browseKeywords.test(lower)) {
    return {
      intent: "browse",
      message: responses.browse,
      suggestedActions: [
        { label: responses.browseCategories, action: "browse_categories" },
        { label: responses.browseFeatured, action: "browse_featured" },
      ],
      data: { detectedLanguage: lang },
    };
  }

  // Default greeting / unclear intent
  return {
    intent: "other",
    message: responses.greeting,
    suggestedActions: [
      { label: responses.wantToSell, action: "sell" },
      { label: responses.wantToBuy, action: "buy" },
      { label: responses.wantToBrowse, action: "browse" },
    ],
    data: { detectedLanguage: lang },
  };
}

const FALLBACK_RESPONSES: Record<string, Record<string, string>> = {
  en: {
    sell: "Great! I'll help you sell your item. Let's start by uploading some photos — I'll analyze them and handle everything from pricing to finding buyers.",
    sellUpload: "📸 Upload photos",
    sellDescribe: "📝 Describe item",
    buy: "I'll help you find exactly what you need! Tell me what you're looking for — I'll monitor new listings 24/7 and alert you to the best deals.",
    buyDescribe: "🔍 Describe what I need",
    browseCategories: "📂 Browse categories",
    support: "I'm here to help! What issue are you experiencing?",
    supportAccount: "👤 Account issue",
    supportBilling: "💳 Billing question",
    supportListing: "📋 Listing help",
    browse:
      "Let me show you what's available! Browse by category or search for something specific.",
    browseFeatured: "🔥 Featured listings",
    greeting:
      "Hello! I'm your Turgo concierge. How can I help you today?\n\n• **Sell** — Upload photos and I'll handle everything\n• **Buy** — Describe what you need, I'll find it 24/7\n• **Browse** — Explore categories and listings",
    wantToSell: "🏷️ I want to sell",
    wantToBuy: "🔍 I'm looking for something",
    wantToBrowse: "📂 Browse listings",
  },
  lv: {
    sell: "Lieliski! Es palīdzēšu jums pārdot preci. Sāksim ar fotogrāfiju augšupielādi — es tās analizēšu un parūpēšos par visu.",
    sellUpload: "📸 Augšupielādēt foto",
    sellDescribe: "📝 Aprakstīt preci",
    buy: "Es palīdzēšu jums atrast tieši to, kas jums vajadzīgs! Pastāstiet, ko meklējat — es uzraudzīšu jaunus sludinājumus 24/7.",
    buyDescribe: "🔍 Aprakstīt, ko meklēju",
    browseCategories: "📂 Kategorijas",
    support: "Esmu šeit, lai palīdzētu! Kāda ir jūsu problēma?",
    supportAccount: "👤 Konts",
    supportBilling: "💳 Maksājumi",
    supportListing: "📋 Sludinājumi",
    browse: "Apskatīsim, kas ir pieejams!",
    browseFeatured: "🔥 Populārākie",
    greeting:
      "Sveiki! Es esmu jūsu tirgus vietas asistents. Kā varu palīdzēt?\n\n• **Pārdot** — Augšupielādējiet foto\n• **Pirkt** — Aprakstiet, ko meklējat\n• **Pārlūkot** — Apskatīt kategorijas",
    wantToSell: "🏷️ Gribu pārdot",
    wantToBuy: "🔍 Meklēju preci",
    wantToBrowse: "📂 Pārlūkot",
  },
  ru: {
    sell: "Отлично! Я помогу вам продать товар. Начнём с загрузки фотографий — я их проанализирую и займусь всем остальным.",
    sellUpload: "📸 Загрузить фото",
    sellDescribe: "📝 Описать товар",
    buy: "Я помогу вам найти именно то, что нужно! Расскажите, что ищете — я буду следить за новыми объявлениями 24/7.",
    buyDescribe: "🔍 Описать, что ищу",
    browseCategories: "📂 Категории",
    support: "Я здесь, чтобы помочь! Какая у вас проблема?",
    supportAccount: "👤 Аккаунт",
    supportBilling: "💳 Оплата",
    supportListing: "📋 Объявления",
    browse: "Давайте посмотрим, что доступно!",
    browseFeatured: "🔥 Популярные",
    greeting:
      "Привет! Я ваш помощник маркетплейса. Чем могу помочь?\n\n• **Продать** — Загрузите фото\n• **Купить** — Опишите, что ищете\n• **Просмотреть** — Обзор категорий",
    wantToSell: "🏷️ Хочу продать",
    wantToBuy: "🔍 Ищу товар",
    wantToBrowse: "📂 Просмотреть",
  },
  lt: {
    sell: "Puiku! Padėsiu jums parduoti prekę. Pradėkime nuo nuotraukų įkėlimo — jas analizuosiu ir pasirūpinsiu viskuo.",
    sellUpload: "📸 Įkelti nuotraukas",
    sellDescribe: "📝 Aprašyti prekę",
    buy: "Padėsiu rasti tai, ko jums reikia! Pasakykite, ko ieškote — stebėsiu naujus skelbimus 24/7.",
    buyDescribe: "🔍 Aprašyti, ko ieškau",
    browseCategories: "📂 Kategorijos",
    support: "Esu čia, kad padėčiau! Kokia jūsų problema?",
    supportAccount: "👤 Paskyra",
    supportBilling: "💳 Mokėjimai",
    supportListing: "📋 Skelbimai",
    browse: "Pažiūrėkime, kas yra!",
    browseFeatured: "🔥 Populiariausi",
    greeting:
      "Sveiki! Esu jūsų prekyvietės asistentas. Kaip galiu padėti?\n\n• **Parduoti** — Įkelkite nuotraukas\n• **Pirkti** — Aprašykite, ko ieškote\n• **Naršyti** — Peržiūrėti kategorijas",
    wantToSell: "🏷️ Noriu parduoti",
    wantToBuy: "🔍 Ieškau prekės",
    wantToBrowse: "📂 Naršyti",
  },
  et: {
    sell: "Suurepärane! Aitan teil kaupa müüa. Alustame fotode üleslaadimisega — analüüsin neid ja hoolitsen kõige eest.",
    sellUpload: "📸 Laadi fotod üles",
    sellDescribe: "📝 Kirjelda kaupa",
    buy: "Aitan teil leida täpselt seda, mida vajate! Kirjeldage, mida otsite — jälgin uusi kuulutusi 24/7.",
    buyDescribe: "🔍 Kirjelda, mida otsin",
    browseCategories: "📂 Kategooriad",
    support: "Olen siin, et aidata! Milline on teie probleem?",
    supportAccount: "👤 Konto",
    supportBilling: "💳 Maksed",
    supportListing: "📋 Kuulutused",
    browse: "Vaatame, mis on saadaval!",
    browseFeatured: "🔥 Populaarsed",
    greeting:
      "Tere! Olen teie turu assistent. Kuidas saan aidata?\n\n• **Müüa** — Laadige fotod üles\n• **Osta** — Kirjeldage, mida otsite\n• **Sirvige** — Vaadake kategooriaid",
    wantToSell: "🏷️ Tahan müüa",
    wantToBuy: "🔍 Otsin kaupa",
    wantToBrowse: "📂 Sirvi",
  },
};

/** Detect language from message */
export function detectLanguage(message: string): string {
  const latvianChars = /[āčēģīķļņšūž]/i;
  const russianChars = /[а-яА-Я]/;
  const lithuanianChars = /[ąčęėįšųūž]/i;
  const estonianChars = /[äöüõšž]/i;

  if (russianChars.test(message)) return "ru";
  if (latvianChars.test(message)) return "lv";
  if (lithuanianChars.test(message)) return "lt";
  if (estonianChars.test(message)) return "et";
  return "en";
}
