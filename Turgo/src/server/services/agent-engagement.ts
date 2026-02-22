/**
 * Agent Engagement — Lifecycle email campaigns & re-engagement
 *
 * Lifecycle emails via email.ts service:
 *   1. Welcome email (day 1 after signup)
 *   2. First sell prompt (day 3)
 *   3. Re-engagement (2 weeks inactive)
 *
 * Event-triggered:
 *   4. Saved search matches
 *   5. Listing view drops (seller alert)
 *
 * Smart frequency control: max 1 engagement email per user per 48 hours
 */

import { db } from "@/server/db";
import { sendEmail } from "./email";
import { APP_URL, APP_NAME } from "@/lib/constants";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface EngagementReport {
  welcomeEmails: number;
  firstSellPrompts: number;
  reEngagementEmails: number;
  savedSearchAlerts: number;
  viewDropAlerts: number;
  skippedFrequency: number;
  totalSent: number;
}

// Max 1 engagement email per 48 hours per user
const FREQUENCY_LIMIT_HOURS = 48;

// ──────────────────────────────────────────────
// MAIN: DAILY ENGAGEMENT RUN
// ──────────────────────────────────────────────

/** Run the full daily engagement pipeline */
export async function runDailyEngagement(): Promise<EngagementReport> {
  console.log("[Engagement Agent] Starting daily engagement run...");

  const report: EngagementReport = {
    welcomeEmails: 0,
    firstSellPrompts: 0,
    reEngagementEmails: 0,
    savedSearchAlerts: 0,
    viewDropAlerts: 0,
    skippedFrequency: 0,
    totalSent: 0,
  };

  try {
    // 1. Welcome emails (signed up ~24h ago, no engagement email yet)
    report.welcomeEmails = await sendWelcomeEmails();

    // 2. First sell prompts (signed up ~3 days ago, no listings)
    report.firstSellPrompts = await sendFirstSellPrompts();

    // 3. Re-engagement (inactive 2+ weeks)
    report.reEngagementEmails = await sendReEngagementEmails();

    // 4. Saved search match alerts
    report.savedSearchAlerts = await sendSavedSearchAlerts();

    // 5. Listing view drop alerts
    report.viewDropAlerts = await sendViewDropAlerts();

    report.totalSent =
      report.welcomeEmails +
      report.firstSellPrompts +
      report.reEngagementEmails +
      report.savedSearchAlerts +
      report.viewDropAlerts;

    // Update metrics
    await updateEngagementMetrics(report);

    console.log(`[Engagement Agent] Complete: ${JSON.stringify(report)}`);
  } catch (error) {
    console.error("[Engagement Agent] Failed:", error);
    await recordError();
  }

  return report;
}

// ──────────────────────────────────────────────
// 1. WELCOME EMAILS (Day 1)
// ──────────────────────────────────────────────

async function sendWelcomeEmails(): Promise<number> {
  // Users who signed up 20-28 hours ago (allow some window)
  const minTime = new Date(Date.now() - 28 * 60 * 60 * 1000);
  const maxTime = new Date(Date.now() - 20 * 60 * 60 * 1000);

  const newUsers = await db.user.findMany({
    where: {
      createdAt: { gte: minTime, lte: maxTime },
      email: { not: "" },
      marketingOptIn: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
    },
    take: 100,
  });

  let sent = 0;

  for (const user of newUsers) {
    if (await wasRecentlyEmailed(user.id)) continue;

    const locale = user.locale || "en";
    const content = WELCOME_CONTENT[locale] || WELCOME_CONTENT.en;

    const success = await sendEmail({
      to: user.email,
      subject: content.subject,
      html: buildWelcomeHtml(user.name || content.defaultName, content, locale),
      text: content.textPreview,
    });

    if (success) {
      await markEmailed(user.id, "welcome");
      sent++;
    }
  }

  return sent;
}

// ──────────────────────────────────────────────
// 2. FIRST SELL PROMPT (Day 3)
// ──────────────────────────────────────────────

async function sendFirstSellPrompts(): Promise<number> {
  // Users who signed up 3 days ago and have no listings
  const minTime = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const maxTime = new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000);

  const users = await db.user.findMany({
    where: {
      createdAt: { gte: minTime, lte: maxTime },
      email: { not: "" },
      marketingOptIn: true,
      listings: { none: {} }, // No listings created
    },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
    },
    take: 100,
  });

  let sent = 0;

  for (const user of users) {
    if (await wasRecentlyEmailed(user.id)) continue;

    const locale = user.locale || "en";
    const content = FIRST_SELL_CONTENT[locale] || FIRST_SELL_CONTENT.en;

    const success = await sendEmail({
      to: user.email,
      subject: content.subject,
      html: buildFirstSellHtml(
        user.name || content.defaultName,
        content,
        locale,
      ),
      text: content.textPreview,
    });

    if (success) {
      await markEmailed(user.id, "first-sell");
      sent++;
    }
  }

  return sent;
}

// ──────────────────────────────────────────────
// 3. RE-ENGAGEMENT (2 weeks inactive)
// ──────────────────────────────────────────────

async function sendReEngagementEmails(): Promise<number> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

  // Users who last logged in 2-3 weeks ago
  const inactiveUsers = await db.user.findMany({
    where: {
      lastLoginAt: { gte: threeWeeksAgo, lte: twoWeeksAgo },
      email: { not: "" },
      marketingOptIn: true,
      isBanned: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      _count: { select: { listings: true, favorites: true } },
    },
    take: 100,
  });

  let sent = 0;

  for (const user of inactiveUsers) {
    if (await wasRecentlyEmailed(user.id)) continue;

    const locale = user.locale || "en";
    const content = REENGAGEMENT_CONTENT[locale] || REENGAGEMENT_CONTENT.en;

    const success = await sendEmail({
      to: user.email,
      subject: content.subject,
      html: buildReEngagementHtml(
        user.name || content.defaultName,
        content,
        user,
        locale,
      ),
      text: content.textPreview,
    });

    if (success) {
      await markEmailed(user.id, "re-engagement");
      sent++;
    }
  }

  return sent;
}

// ──────────────────────────────────────────────
// 4. SAVED SEARCH MATCH ALERTS
// ──────────────────────────────────────────────

async function sendSavedSearchAlerts(): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find saved searches that haven't been notified recently
  const searches = await db.savedSearch.findMany({
    where: {
      notifyEmail: true,
      OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lte: oneDayAgo } }],
    },
    include: {
      user: { select: { id: true, email: true, locale: true } },
    },
    take: 100,
  });

  let sent = 0;

  for (const search of searches) {
    if (await wasRecentlyEmailed(search.userId)) continue;

    try {
      // Check for new matching listings
      const filters = search.filters as Record<string, unknown>;
      const matchQuery: Record<string, unknown> = {
        status: "ACTIVE",
        createdAt: { gte: search.lastNotifiedAt || oneDayAgo },
      };

      if (filters.categoryId) {
        matchQuery.categoryId = filters.categoryId;
      }
      if (filters.minPrice || filters.maxPrice) {
        matchQuery.price = {};
        if (filters.minPrice)
          (matchQuery.price as Record<string, number>).gte =
            filters.minPrice as number;
        if (filters.maxPrice)
          (matchQuery.price as Record<string, number>).lte =
            filters.maxPrice as number;
      }

      const newMatches = await db.listing.findMany({
        where: matchQuery,
        select: {
          id: true,
          title: true,
          price: true,
          slug: true,
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      });

      if (newMatches.length > 0) {
        const listingItems = newMatches
          .map(
            (l) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><a href="${APP_URL}/listing/${l.slug}" style="color:#2563eb;text-decoration:none;">${l.title}</a></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">€${l.price.toFixed(2)}</td></tr>`,
          )
          .join("");

        const success = await sendEmail({
          to: search.user.email,
          subject: `🔔 ${newMatches.length} new listing${newMatches.length > 1 ? "s" : ""} match "${search.name}"`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2>New matches for "${search.name}"</h2>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">${listingItems}</table>
              <a href="${APP_URL}/search?saved=${search.id}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">View All Matches</a>
              <p style="color:#9ca3af;font-size:12px;margin-top:24px;">You can manage your saved searches in your dashboard.</p>
            </div>
          `,
        });

        if (success) {
          await db.savedSearch.update({
            where: { id: search.id },
            data: { lastNotifiedAt: new Date() },
          });
          await markEmailed(search.userId, "saved-search");
          sent++;
        }
      }
    } catch (error) {
      console.error(
        `[Engagement Agent] Saved search alert failed for ${search.id}:`,
        error,
      );
    }
  }

  return sent;
}

// ──────────────────────────────────────────────
// 5. LISTING VIEW DROP ALERTS
// ──────────────────────────────────────────────

async function sendViewDropAlerts(): Promise<number> {
  // Find listings that previously had decent views but dropped
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const listings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      viewCount: { gte: 10 }, // Had some visibility
      updatedAt: { lte: oneWeekAgo }, // No activity for a week
    },
    select: {
      id: true,
      title: true,
      slug: true,
      viewCount: true,
      userId: true,
      user: { select: { email: true, locale: true } },
    },
    take: 50,
  });

  let sent = 0;

  for (const listing of listings) {
    if (await wasRecentlyEmailed(listing.userId)) continue;

    const locale = listing.user.locale || "en";

    const subjects: Record<string, string> = {
      en: `📉 Views dropping on "${listing.title}" — here's how to fix it`,
      lv: `📉 Skatījumi samazinās "${listing.title}"`,
      ru: `📉 Просмотры снижаются: "${listing.title}"`,
      lt: `📉 Peržiūros mažėja: "${listing.title}"`,
      et: `📉 Vaatamised vähenevad: "${listing.title}"`,
    };

    const success = await sendEmail({
      to: listing.user.email,
      subject: subjects[locale] || subjects.en,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>Your listing needs attention</h2>
          <p>Your listing <strong>"${listing.title}"</strong> has seen a drop in views (${listing.viewCount} total).</p>
          <h3>Quick tips to boost visibility:</h3>
          <ul>
            <li>Update your photos — fresh images attract more clicks</li>
            <li>Review your price — compare with similar listings</li>
            <li>Improve your description — add more details</li>
            <li>Consider a Featured Boost for prime placement</li>
          </ul>
          <a href="${APP_URL}/listing/${listing.slug}/edit"
             style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;margin-top:8px;">
            Edit Listing
          </a>
          <a href="${APP_URL}/listing/${listing.slug}"
             style="display:inline-block;padding:12px 24px;background:#059669;color:white;text-decoration:none;border-radius:8px;margin:8px 0 0 8px;">
            Boost Listing
          </a>
        </div>
      `,
    });

    if (success) {
      await markEmailed(listing.userId, "view-drop");
      sent++;
    }
  }

  return sent;
}

// ──────────────────────────────────────────────
// FREQUENCY CONTROL
// ──────────────────────────────────────────────

/** Check if user was emailed within the frequency limit */
async function wasRecentlyEmailed(userId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - FREQUENCY_LIMIT_HOURS * 60 * 60 * 1000);

  // Check notifications of type AGENT_ACTION as our email log proxy
  const recent = await db.notification.findFirst({
    where: {
      userId,
      type: "AGENT_ACTION",
      createdAt: { gte: cutoff },
      metadata: {
        path: ["emailType"],
        not: "undefined" as never,
      },
    },
  });

  return recent !== null;
}

/** Mark that we sent an engagement email to this user */
async function markEmailed(userId: string, emailType: string): Promise<void> {
  await db.notification.create({
    data: {
      userId,
      type: "AGENT_ACTION",
      title: `Engagement: ${emailType}`,
      body: `Engagement email sent: ${emailType}`,
      isRead: true, // Don't show as unread notification
      metadata: { emailType, sentAt: new Date().toISOString() },
    },
  });
}

// ──────────────────────────────────────────────
// EMAIL CONTENT (multi-language)
// ──────────────────────────────────────────────

interface EmailContent {
  subject: string;
  greeting: string;
  body: string;
  cta: string;
  ctaUrl: string;
  textPreview: string;
  defaultName: string;
}

const WELCOME_CONTENT: Record<string, EmailContent> = {
  en: {
    subject: `Welcome to ${APP_NAME}! 🎉`,
    greeting: "Welcome aboard!",
    body: "You've joined the smartest classifieds platform in the Baltics. Our AI agents work 24/7 to help you buy and sell smarter.\n\nHere's what you can do:\n• List items with AI-powered pricing\n• Set up a Buying Agent to find deals\n• Get real-time market insights",
    cta: "Start Exploring",
    ctaUrl: `${APP_URL}/en`,
    textPreview: `Welcome to ${APP_NAME}! Start buying and selling with AI agents.`,
    defaultName: "there",
  },
  lv: {
    subject: `Laipni lūdzam ${APP_NAME}! 🎉`,
    greeting: "Laipni lūdzam!",
    body: "Jūs esat pievienojies gudrākajai sludinājumu platformai Baltijā. Mūsu AI aģenti strādā 24/7.\n\n• Ievietojiet preces ar AI cenu ieteikumiem\n• Uzstādiet Pirkšanas Aģentu\n• Saņemiet tirgus datus reāllaikā",
    cta: "Sākt pārlūkot",
    ctaUrl: `${APP_URL}/lv`,
    textPreview: `Laipni lūdzam ${APP_NAME}! Sāciet pirkt un pārdot ar AI aģentiem.`,
    defaultName: "draugs",
  },
  ru: {
    subject: `Добро пожаловать в ${APP_NAME}! 🎉`,
    greeting: "Добро пожаловать!",
    body: "Вы присоединились к самой умной площадке объявлений в Балтии. Наши AI-агенты работают 24/7.\n\n• Размещайте товары с AI-ценообразованием\n• Настройте Агента по покупкам\n• Получайте данные о рынке в реальном времени",
    cta: "Начать",
    ctaUrl: `${APP_URL}/ru`,
    textPreview: `Добро пожаловать в ${APP_NAME}! Начните покупать и продавать с AI-агентами.`,
    defaultName: "друг",
  },
  lt: {
    subject: `Sveiki atvykę į ${APP_NAME}! 🎉`,
    greeting: "Sveiki atvykę!",
    body: "Prisijungėte prie protingiausios skelbimų platformos Baltijos šalyse. Mūsų AI agentai dirba 24/7.\n\n• Skelbkite prekes su AI kainodara\n• Nustatykite Pirkimo Agentą\n• Gaukite rinkos duomenis realiu laiku",
    cta: "Pradėti naršyti",
    ctaUrl: `${APP_URL}/lt`,
    textPreview: `Sveiki atvykę į ${APP_NAME}! Pradėkite pirkti ir parduoti su AI agentais.`,
    defaultName: "drauge",
  },
  et: {
    subject: `Tere tulemast ${APP_NAME}! 🎉`,
    greeting: "Tere tulemast!",
    body: "Olete liitunud Baltikumi nutikama kuulutuste platvormiga. Meie AI agendid töötavad 24/7.\n\n• Lisage kaupu AI hinnasoovitustega\n• Seadistage Ostuagent\n• Saage turuandmeid reaalajas",
    cta: "Alusta sirvimist",
    ctaUrl: `${APP_URL}/et`,
    textPreview: `Tere tulemast ${APP_NAME}! Alustage ostmist ja müümist AI agentidega.`,
    defaultName: "sõber",
  },
};

const FIRST_SELL_CONTENT: Record<string, EmailContent> = {
  en: {
    subject: `Ready to sell? Our AI handles everything 🤖`,
    greeting: "Got something to sell?",
    body: "List your first item in under 2 minutes! Just upload a photo and our AI will:\n\n• Suggest optimal pricing based on market data\n• Write a compelling description\n• Auto-respond to buyer inquiries\n• Adjust the price to sell faster",
    cta: "Start Selling",
    ctaUrl: `${APP_URL}/en/sell`,
    textPreview:
      "Sell your first item — our AI handles pricing, descriptions, and buyer communication.",
    defaultName: "there",
  },
  lv: {
    subject: `Gatavs pārdot? Mūsu AI visu nokārtos 🤖`,
    greeting: "Ir ko pārdot?",
    body: "Ievietojiet savu pirmo preci mazāk nekā 2 minūtēs! Vienkārši augšupielādējiet foto un mūsu AI:\n\n• Ieteiks optimālo cenu\n• Uzrakstīs aprakstu\n• Automātiski atbildēs pircējiem\n• Pielāgos cenu ātrākai pārdošanai",
    cta: "Sākt pārdošanu",
    ctaUrl: `${APP_URL}/lv/sell`,
    textPreview:
      "Pārdodiet savu pirmo preci — mūsu AI parūpēsies par cenu un komunikāciju.",
    defaultName: "draugs",
  },
  ru: {
    subject: `Готовы продавать? Наш ИИ сделает всё 🤖`,
    greeting: "Есть что продать?",
    body: "Разместите первый товар за 2 минуты! Просто загрузите фото и наш ИИ:\n\n• Предложит оптимальную цену\n• Напишет описание\n• Будет отвечать покупателям автоматически\n• Скорректирует цену для быстрой продажи",
    cta: "Начать продажу",
    ctaUrl: `${APP_URL}/ru/sell`,
    textPreview:
      "Продайте первый товар — наш ИИ позаботится о цене и общении с покупателями.",
    defaultName: "друг",
  },
  lt: {
    subject: `Pasiruošę parduoti? Mūsų AI viską sutvarkys 🤖`,
    greeting: "Turite ką parduoti?",
    body: "Paskelbkite pirmą prekę per 2 minutes! Tiesiog įkelkite nuotrauką ir mūsų AI:\n\n• Pasiūlys optimalią kainą\n• Parašys aprašymą\n• Automatiškai atsakys pirkėjams\n• Koreguos kainą greitesniam pardavimui",
    cta: "Pradėti pardavimą",
    ctaUrl: `${APP_URL}/lt/sell`,
    textPreview:
      "Parduokite pirmą prekę — mūsų AI pasirūpins kainodara ir komunikacija.",
    defaultName: "drauge",
  },
  et: {
    subject: `Valmis müüma? Meie AI teeb kõik ära 🤖`,
    greeting: "On midagi müüa?",
    body: "Lisage esimene kaup alla 2 minutiga! Laadige lihtsalt foto üles ja meie AI:\n\n• Soovitab optimaalset hinda\n• Kirjutab kirjelduse\n• Vastab ostjatele automaatselt\n• Kohandab hinda kiiremaks müügiks",
    cta: "Alusta müüki",
    ctaUrl: `${APP_URL}/et/sell`,
    textPreview:
      "Müüge esimene kaup — meie AI hoolitseb hinnastamise ja suhtluse eest.",
    defaultName: "sõber",
  },
};

const REENGAGEMENT_CONTENT: Record<string, EmailContent> = {
  en: {
    subject: `We miss you! See what's new on ${APP_NAME} 👀`,
    greeting: "We haven't seen you in a while!",
    body: "A lot has happened while you were away. New listings, price drops, and your agents are waiting.\n\nDon't miss out on the latest deals in your area!",
    cta: "Come Back",
    ctaUrl: `${APP_URL}/en`,
    textPreview: `We miss you! Check out what's new on ${APP_NAME}.`,
    defaultName: "there",
  },
  lv: {
    subject: `Mēs tevi pietrūkst! Skaties jaunumus ${APP_NAME} 👀`,
    greeting: "Sen neesam jūs redzējuši!",
    body: "Daudz kas noticis, kamēr jūs bijāt projām. Jauni sludinājumi, cenu kritumi un jūsu aģenti gaida.\n\nNepalaidiet garām jaunākos piedāvājumus!",
    cta: "Atgriezties",
    ctaUrl: `${APP_URL}/lv`,
    textPreview: `Mēs tevi pietrūkst! Apskatiet jaunumus ${APP_NAME}.`,
    defaultName: "draugs",
  },
  ru: {
    subject: `Мы скучаем! Смотрите новинки на ${APP_NAME} 👀`,
    greeting: "Давно вас не видели!",
    body: "Многое произошло, пока вас не было. Новые объявления, снижение цен и ваши агенты ждут.\n\nНе пропустите последние предложения!",
    cta: "Вернуться",
    ctaUrl: `${APP_URL}/ru`,
    textPreview: `Мы скучаем! Посмотрите новинки на ${APP_NAME}.`,
    defaultName: "друг",
  },
  lt: {
    subject: `Pasiilgome! Žiūrėkite naujienas ${APP_NAME} 👀`,
    greeting: "Seniai jūsų nematėme!",
    body: "Daug kas įvyko, kol jūsų nebuvo. Nauji skelbimai, kainų kritimai ir jūsų agentai laukia.\n\nNepraleiskite naujausių pasiūlymų!",
    cta: "Grįžti",
    ctaUrl: `${APP_URL}/lt`,
    textPreview: `Pasiilgome! Peržiūrėkite naujienas ${APP_NAME}.`,
    defaultName: "drauge",
  },
  et: {
    subject: `Igatseme sind! Vaata uudiseid ${APP_NAME} 👀`,
    greeting: "Pole teid ammu näinud!",
    body: "Palju on juhtunud, kuni te ära olite. Uued kuulutused, hinnalangused ja teie agendid ootavad.\n\nÄrge jätke uusimaid pakkumisi kasutamata!",
    cta: "Tule tagasi",
    ctaUrl: `${APP_URL}/et`,
    textPreview: `Igatseme sind! Vaata uudiseid ${APP_NAME}.`,
    defaultName: "sõber",
  },
};

// ──────────────────────────────────────────────
// HTML BUILDERS
// ──────────────────────────────────────────────

function buildWelcomeHtml(
  name: string,
  content: EmailContent,
  _locale: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2>${content.greeting}</h2>
      <p>Hi ${name},</p>
      <p style="white-space:pre-line;">${content.body}</p>
      <a href="${content.ctaUrl}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">
        ${content.cta}
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        You're receiving this because you signed up for ${APP_NAME}.
      </p>
    </div>
  `;
}

function buildFirstSellHtml(
  name: string,
  content: EmailContent,
  _locale: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2>${content.greeting}</h2>
      <p>Hi ${name},</p>
      <p style="white-space:pre-line;">${content.body}</p>
      <a href="${content.ctaUrl}"
         style="display:inline-block;padding:14px 28px;background:#059669;color:white;text-decoration:none;border-radius:8px;margin-top:16px;font-size:16px;">
        ${content.cta}
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        You're receiving this because you signed up for ${APP_NAME}.
      </p>
    </div>
  `;
}

function buildReEngagementHtml(
  name: string,
  content: EmailContent,
  user: { _count: { listings: number; favorites: number } },
  _locale: string,
): string {
  const statsLine =
    user._count.listings > 0
      ? `You have ${user._count.listings} listing${user._count.listings > 1 ? "s" : ""} that may need attention.`
      : user._count.favorites > 0
        ? `You have ${user._count.favorites} favorited item${user._count.favorites > 1 ? "s" : ""} — some may have new prices!`
        : "";

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2>${content.greeting}</h2>
      <p>Hi ${name},</p>
      <p style="white-space:pre-line;">${content.body}</p>
      ${statsLine ? `<p style="padding:12px;background:#f3f4f6;border-radius:8px;margin:16px 0;"><strong>${statsLine}</strong></p>` : ""}
      <a href="${content.ctaUrl}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">
        ${content.cta}
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        You're receiving this because you have an account on ${APP_NAME}.
        <a href="${APP_URL}/profile/settings" style="color:#6b7280;">Unsubscribe</a>
      </p>
    </div>
  `;
}

// ──────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────

async function updateEngagementMetrics(
  report: EngagementReport,
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "BUYING", date: today } },
    create: {
      agentType: "BUYING",
      date: today,
      itemsProcessed: report.totalSent,
    },
    update: {
      itemsProcessed: { increment: report.totalSent },
    },
  });
}

async function recordError(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.agentMetrics.upsert({
    where: { agentType_date: { agentType: "BUYING", date: today } },
    create: {
      agentType: "BUYING",
      date: today,
      errorsCount: 1,
    },
    update: {
      errorsCount: { increment: 1 },
    },
  });
}
