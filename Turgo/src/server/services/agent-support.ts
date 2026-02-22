/**
 * Agent Support — AI-powered customer support service
 *
 * Uses the ai.ts router for LLM-powered assistance.
 * Handles: account help, billing questions, how-to, feature explanations.
 * Escalates when confidence < 70% or topic is payment-dispute/legal.
 * Auto-detects user language from locale.
 */

import { db } from "@/server/db";
import { aiComplete } from "./ai";
import { detectLanguage } from "./agent-concierge";
import { createNotification } from "./notification";

import { APP_NAME, APP_URL } from "@/lib/constants";
import type { AiChatMessage } from "@/types";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface SupportTicket {
  userId: string;
  message: string;
  locale?: string;
  category?: SupportCategory;
  history?: AiChatMessage[];
}

export interface SupportResponse {
  message: string;
  confidence: number;
  category: SupportCategory;
  escalated: boolean;
  escalationReason?: string;
  suggestedActions?: { label: string; action: string }[];
}

export type SupportCategory =
  | "account"
  | "billing"
  | "how-to"
  | "feature"
  | "listing"
  | "agent"
  | "payment-dispute"
  | "legal"
  | "technical"
  | "other";

// Topics that ALWAYS escalate to human support
const ESCALATION_TOPICS: SupportCategory[] = ["payment-dispute", "legal"];

// ──────────────────────────────────────────────
// SYSTEM PROMPT
// ──────────────────────────────────────────────

const SUPPORT_SYSTEM_PROMPT = `You are the AI support agent for ${APP_NAME}, a classifieds marketplace for the Baltic region (Latvia, Lithuania, Estonia).

Your responsibilities:
1. Answer user questions about the platform
2. Help with account issues, billing, and listings
3. Explain features (AI agents, auto-negotiate, saved searches, boosts)
4. Guide users through common workflows

PLATFORM KNOWLEDGE:
- Plans: Free (5 listings, 1 agent), Pro €4.99/mo (50 listings, 5 agents, AI features), Business €19.99/mo (unlimited)
- Selling Agent: auto-adjusts price, auto-responds to inquiries, sends daily summaries
- Buying Agent: monitors 24/7 for matching listings, auto-negotiates, deal scoring
- Boosts: Featured (€4.99/7 days), Highlighted (€2.99/3 days), Top (€9.99/7 days)
- Languages: English, Latvian, Russian, Lithuanian, Estonian
- Payment: Stripe integration for subscriptions and boosts
- Support URL: ${APP_URL}/help

RULES:
1. ALWAYS respond in the user's language (detect from their message or locale)
2. Be concise, friendly, and professional
3. If you are NOT confident (< 70% confidence), say so and offer to escalate
4. NEVER make up information about billing or account specifics
5. For payment disputes or legal matters, ALWAYS escalate to human support

Respond in JSON format:
{
  "message": "Your response IN THE USER'S LANGUAGE",
  "confidence": 0-100,
  "category": "account|billing|how-to|feature|listing|agent|payment-dispute|legal|technical|other",
  "suggestedActions": [{"label": "Button text", "action": "action_name"}]
}`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English.",
  lv: "Atbildi latviešu valodā.",
  ru: "Отвечай на русском языке.",
  lt: "Atsakyk lietuvių kalba.",
  et: "Vasta eesti keeles.",
};

// ──────────────────────────────────────────────
// MAIN SUPPORT HANDLER
// ──────────────────────────────────────────────

/** Process a support message and return AI-powered response */
export async function handleSupportMessage(
  ticket: SupportTicket,
): Promise<SupportResponse> {
  const locale = ticket.locale || detectLanguage(ticket.message);
  const langInstruction =
    LANGUAGE_INSTRUCTIONS[locale] || LANGUAGE_INSTRUCTIONS.en;

  // Fetch user context for personalized support
  const userContext = await getUserContext(ticket.userId);

  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `${SUPPORT_SYSTEM_PROMPT}\n\n${langInstruction}\n\nUser context:\n${userContext}`,
    },
    ...(ticket.history || []),
    { role: "user", content: ticket.message },
  ];

  try {
    const result = await aiComplete({
      messages,
      temperature: 0.2,
      maxTokens: 600,
    });

    const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const confidence = parsed.confidence ?? 50;
    const category = (parsed.category as SupportCategory) || "other";

    // Check if escalation is needed
    const shouldEscalate =
      confidence < 70 || ESCALATION_TOPICS.includes(category);

    if (shouldEscalate) {
      await escalateToHuman(ticket, category, confidence, parsed.message);
    }

    // Track metrics
    await updateSupportMetrics(result.tokensUsed);

    return {
      message: parsed.message,
      confidence,
      category,
      escalated: shouldEscalate,
      escalationReason: shouldEscalate
        ? confidence < 70
          ? "Low confidence — forwarded to human support"
          : `Topic requires human review: ${category}`
        : undefined,
      suggestedActions: parsed.suggestedActions,
    };
  } catch {
    // Fallback to rule-based support
    return fallbackSupportResponse(ticket.message, locale);
  }
}

// ──────────────────────────────────────────────
// USER CONTEXT
// ──────────────────────────────────────────────

async function getUserContext(userId: string): Promise<string> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        role: true,
        locale: true,
        createdAt: true,
        subscription: {
          select: {
            plan: { select: { name: true } },
            status: true,
          },
        },
        _count: {
          select: {
            listings: true,
            sellingAgents: true,
            buyingAgents: true,
          },
        },
      },
    });

    if (!user) return "User not found";

    return [
      `Name: ${user.name || "N/A"}`,
      `Plan: ${user.subscription?.plan.name || "FREE"} (${user.subscription?.status || "N/A"})`,
      `Listings: ${user._count.listings}`,
      `Selling Agents: ${user._count.sellingAgents}`,
      `Buying Agents: ${user._count.buyingAgents}`,
      `Member since: ${user.createdAt.toISOString().split("T")[0]}`,
      `Preferred locale: ${user.locale}`,
    ].join("\n");
  } catch {
    return "Unable to fetch user context";
  }
}

// ──────────────────────────────────────────────
// ESCALATION
// ──────────────────────────────────────────────

async function escalateToHuman(
  ticket: SupportTicket,
  category: SupportCategory,
  confidence: number,
  aiResponse: string,
): Promise<void> {
  // Create escalation item in DB
  await db.escalationItem.create({
    data: {
      source: "CONCIERGE",
      userId: ticket.userId,
      title: `Support escalation: ${category}`,
      description: [
        `User message: ${ticket.message}`,
        `AI response (confidence ${confidence}%): ${aiResponse}`,
        `Category: ${category}`,
        `Locale: ${ticket.locale || "auto-detected"}`,
      ].join("\n\n"),
      metadata: JSON.parse(
        JSON.stringify({
          category,
          confidence,
          locale: ticket.locale,
          history: ticket.history?.slice(-4),
        }),
      ),
      status: "PENDING",
    },
  });

  // Notify admins about the escalation
  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "MODERATOR"] } },
    select: { id: true },
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "AGENT_ACTION",
      title: "Support Escalation",
      body: `Support ticket escalated (${category}): "${ticket.message.slice(0, 80)}..."`,
      metadata: { category, confidence, userId: ticket.userId },
    });
  }
}

// ──────────────────────────────────────────────
// FALLBACK RESPONSES
// ──────────────────────────────────────────────

function fallbackSupportResponse(
  message: string,
  locale: string,
): SupportResponse {
  const lower = message.toLowerCase();

  // Detect topic from keywords
  const topicMap: {
    pattern: RegExp;
    category: SupportCategory;
    response: Record<string, string>;
  }[] = [
    {
      pattern:
        /password|login|sign in|account|profile|parole|пароль|вход|аккаунт|slaptažodis|parool/i,
      category: "account",
      response: {
        en: "For account issues, please visit your profile settings or try resetting your password from the login page. If you continue to have trouble, I'll connect you with our support team.",
        lv: "Konta problēmu gadījumā, lūdzu, apmeklējiet profila iestatījumus vai mēģiniet atjaunot paroli no pieteikšanās lapas.",
        ru: "По вопросам с аккаунтом, посетите настройки профиля или сбросьте пароль на странице входа.",
        lt: "Dėl paskyros problemų apsilankykite profilio nustatymuose arba bandykite atstatyti slaptažodį.",
        et: "Kontoprobleemide korral külastage profiili seadeid või proovige parooli lähtestada.",
      },
    },
    {
      pattern:
        /billing|payment|subscription|plan|charge|price|rēķin|abonem|оплата|подписка|mokėjim|prenumerat|makse|tellimus/i,
      category: "billing",
      response: {
        en: "For billing questions, you can manage your subscription from your dashboard. Our plans are: Free, Pro (€4.99/mo), and Business (€19.99/mo). Need more specific help?",
        lv: "Norēķinu jautājumus varat pārvaldīt savā informācijas panelī. Mūsu plāni: Bezmaksas, Pro (€4.99/mēn.) un Business (€19.99/mēn.).",
        ru: "Вопросы об оплате можно решить в панели управления. Наши планы: Бесплатный, Pro (€4.99/мес) и Business (€19.99/мес).",
        lt: "Mokėjimo klausimus galite tvarkyti savo prietaisų skydelyje. Mūsų planai: Nemokamas, Pro (€4.99/mėn.) ir Business (€19.99/mėn.).",
        et: "Arveldusküsimusi saate hallata oma juhtpaneelil. Meie plaanid: Tasuta, Pro (€4.99/kuu) ja Business (€19.99/kuu).",
      },
    },
    {
      pattern: /how|create|make|sell|buy|kā|kur|как|создать|kaip|kuidas/i,
      category: "how-to",
      response: {
        en: "I can help you get started! To sell, click 'Start Selling' and our AI will guide you. To buy, use 'Find Items' and our buying agent will monitor for matches 24/7.",
        lv: "Es varu jums palīdzēt sākt! Lai pārdotu, noklikšķiniet 'Sākt pārdošanu' un mūsu AI jums palīdzēs.",
        ru: "Я могу помочь начать! Чтобы продать, нажмите 'Начать продажу' и наш ИИ вас проведёт.",
        lt: "Galiu padėti pradėti! Norėdami parduoti, spustelėkite 'Pradėti pardavimą' ir mūsų AI jus ves.",
        et: "Saan aidata alustada! Müümiseks klõpsake 'Alusta müüki' ja meie AI juhendab teid.",
      },
    },
    {
      pattern: /agent|bot|automat|aģent|агент|agentas|agent/i,
      category: "agent",
      response: {
        en: "Our AI agents work 24/7 for you! The Selling Agent auto-adjusts prices and responds to inquiries. The Buying Agent monitors new listings matching your criteria. Manage them from your dashboard.",
        lv: "Mūsu AI aģenti strādā 24/7! Pārdošanas aģents automātiski pielāgo cenas. Pirkšanas aģents uzrauga jaunus sludinājumus.",
        ru: "Наши AI-агенты работают 24/7! Агент по продажам автоматически корректирует цены. Агент по покупкам отслеживает новые объявления.",
        lt: "Mūsų AI agentai dirba 24/7! Pardavimo agentas automatiškai koreguoja kainas. Pirkimo agentas stebi naujus skelbimus.",
        et: "Meie AI agendid töötavad 24/7! Müügiagent kohandab automaatselt hindu. Ostuagent jälgib uusi kuulutusi.",
      },
    },
  ];

  for (const topic of topicMap) {
    if (topic.pattern.test(lower)) {
      return {
        message: topic.response[locale] || topic.response.en,
        confidence: 60,
        category: topic.category,
        escalated: false,
        suggestedActions: [
          { label: "Contact Support", action: "escalate" },
          { label: "Help Center", action: "help_center" },
        ],
      };
    }
  }

  // Default — low confidence, offer escalation
  const defaultMessages: Record<string, string> = {
    en: "I'm not sure I understand your question fully. Let me connect you with our support team for more detailed assistance.",
    lv: "Neesmu pārliecināts, ka pilnībā saprotu jūsu jautājumu. Ļaujiet man jūs savienot ar mūsu atbalsta komandu.",
    ru: "Я не уверен, что полностью понимаю ваш вопрос. Позвольте связать вас с нашей командой поддержки.",
    lt: "Nesu tikras, ar pilnai suprantu jūsų klausimą. Leiskite sujungti jus su mūsų palaikymo komanda.",
    et: "Ma ei ole kindel, et mõistan teie küsimust täielikult. Lubage ühendada teid meie tugitiimiga.",
  };

  return {
    message: defaultMessages[locale] || defaultMessages.en,
    confidence: 30,
    category: "other",
    escalated: true,
    escalationReason: "Could not determine user intent",
    suggestedActions: [
      { label: "Contact Support", action: "escalate" },
      { label: "Help Center", action: "help_center" },
    ],
  };
}

// ──────────────────────────────────────────────
// QUICK ANSWERS — Common questions lookup
// ──────────────────────────────────────────────

/** Get a quick answer for FAQ-type questions without LLM */
export function getQuickAnswer(
  question: string,
  locale: string = "en",
): string | null {
  const lower = question.toLowerCase();

  const faq: { pattern: RegExp; answer: Record<string, string> }[] = [
    {
      pattern: /how much.*pro|pro.*cost|price.*pro|pro.*price/i,
      answer: {
        en: "The Pro plan costs €4.99/month or €47.88/year (save 20%).",
        lv: "Pro plāns maksā €4.99/mēn vai €47.88/gadā (ietaupiet 20%).",
        ru: "Тариф Pro стоит €4.99/мес или €47.88/год (экономия 20%).",
        lt: "Pro planas kainuoja €4.99/mėn arba €47.88/metams (sutaupykite 20%).",
        et: "Pro plaan maksab €4.99/kuu või €47.88/aastas (säästate 20%).",
      },
    },
    {
      pattern: /how.*delete.*account|delete.*my.*account/i,
      answer: {
        en: "To delete your account, go to Settings → Account → Delete Account. This action is irreversible.",
        lv: "Lai dzēstu kontu, dodieties uz Iestatījumi → Konts → Dzēst kontu.",
        ru: "Чтобы удалить аккаунт, перейдите в Настройки → Аккаунт → Удалить аккаунт.",
        lt: "Norėdami ištrinti paskyrą, eikite į Nustatymai → Paskyra → Ištrinti paskyrą.",
        et: "Konto kustutamiseks minge Seaded → Konto → Kustuta konto.",
      },
    },
    {
      pattern: /how many.*listing|listing.*limit/i,
      answer: {
        en: "Free plan: 5 listings, Pro: 50 listings, Business: unlimited.",
        lv: "Bezmaksas: 5 sludinājumi, Pro: 50, Business: neierobežoti.",
        ru: "Бесплатный: 5 объявлений, Pro: 50, Business: без ограничений.",
        lt: "Nemokamas: 5 skelbimai, Pro: 50, Business: neribota.",
        et: "Tasuta: 5 kuulutust, Pro: 50, Business: piiramatu.",
      },
    },
  ];

  for (const item of faq) {
    if (item.pattern.test(lower)) {
      return item.answer[locale] || item.answer.en;
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────

async function updateSupportMetrics(tokensUsed?: number): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "BUYING", date: today } },
    create: {
      agentType: "BUYING", // Support falls under the buying-side agent metrics
      date: today,
      itemsProcessed: 1,
      aiTokensUsed: tokensUsed ?? 0,
    },
    update: {
      itemsProcessed: { increment: 1 },
      aiTokensUsed: { increment: tokensUsed ?? 0 },
    },
  });
}
