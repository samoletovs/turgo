/**
 * Notification Service — Push notifications + enhanced email notifications
 * Handles: new messages, agent actions, price drops on favorites,
 * saved search matches, negotiation events
 */

import { db } from "@/server/db";
import { sendEmail } from "./email";
import { emitNotification } from "@/server/socket";
import { APP_URL, APP_NAME } from "@/lib/constants";

// ──────────────────────────────────────────────
// WEB PUSH
// ──────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || `mailto:support@turgo.lv`;

/** Send a web push notification to all user's subscribed devices */
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: params.userId },
  });

  if (subscriptions.length === 0) return;

  // Dynamic import for web-push (server-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let webpush: any = null;
  try {
    webpush = await import("web-push");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch {
    console.warn("[Push] web-push not available, skipping push notifications");
    return;
  }

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    icon: params.icon || "/icon-192.png",
    badge: "/badge-72.png",
    tag: params.tag,
    data: {
      url: params.url || APP_URL,
      ...params.data,
    },
  });

  const failedSubscriptions: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush!.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (error) {
      console.error(`[Push] Failed for subscription ${sub.id}:`, error);
      failedSubscriptions.push(sub.id);
    }
  }

  // Clean up expired/invalid subscriptions
  if (failedSubscriptions.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { id: { in: failedSubscriptions } },
    });
  }
}

// ──────────────────────────────────────────────
// IN-APP NOTIFICATIONS
// ──────────────────────────────────────────────

/** Create an in-app notification and emit via socket */
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const notification = await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type as never,
      title: params.title,
      body: params.body,
      metadata: params.metadata as never,
    },
  });

  // Emit real-time notification
  emitNotification(params.userId, {
    id: notification.id,
    type: params.type,
    title: params.title,
    body: params.body,
    metadata: params.metadata,
    createdAt: notification.createdAt.toISOString(),
  });
}

// ──────────────────────────────────────────────
// MESSAGE NOTIFICATIONS
// ──────────────────────────────────────────────

/** Notify user of a new message (push + in-app + optional email) */
export async function notifyNewMessage(params: {
  receiverId: string;
  senderId: string;
  senderName: string;
  conversationId: string;
  listingTitle: string;
  messagePreview: string;
  isAgentMessage: boolean;
}): Promise<void> {
  const prefix = params.isAgentMessage ? "🤖 Agent: " : "";
  const title = `New message from ${prefix}${params.senderName}`;
  const body = `Re: ${params.listingTitle} — "${params.messagePreview.slice(0, 80)}"`;

  // In-app notification
  await createNotification({
    userId: params.receiverId,
    type: "NEW_MESSAGE",
    title,
    body,
    metadata: {
      conversationId: params.conversationId,
      senderId: params.senderId,
      isAgentMessage: params.isAgentMessage,
    },
  });

  // Push notification
  await sendPushNotification({
    userId: params.receiverId,
    title,
    body,
    url: `${APP_URL}/messages/${params.conversationId}`,
    tag: `message-${params.conversationId}`,
  });
}

/** Notify user of negotiation events */
export async function notifyNegotiationEvent(params: {
  userId: string;
  type: "OFFER_RECEIVED" | "OFFER_ACCEPTED" | "OFFER_REJECTED" | "COUNTER_OFFER";
  listingTitle: string;
  amount: number;
  counterAmount?: number;
  conversationId: string;
}): Promise<void> {
  const titles: Record<string, string> = {
    OFFER_RECEIVED: `💰 New offer: €${params.amount}`,
    OFFER_ACCEPTED: `✅ Offer accepted: €${params.amount}`,
    OFFER_REJECTED: `❌ Offer declined`,
    COUNTER_OFFER: `🔄 Counter-offer: €${params.counterAmount ?? params.amount}`,
  };

  const title = titles[params.type] || "Negotiation update";
  const body = `Re: ${params.listingTitle}`;

  await createNotification({
    userId: params.userId,
    type: params.type,
    title,
    body,
    metadata: {
      conversationId: params.conversationId,
      amount: params.amount,
      counterAmount: params.counterAmount,
    },
  });

  await sendPushNotification({
    userId: params.userId,
    title,
    body,
    url: `${APP_URL}/messages/${params.conversationId}`,
    tag: `negotiation-${params.conversationId}`,
  });
}

// ──────────────────────────────────────────────
// AGENT NOTIFICATION EMAILS
// ──────────────────────────────────────────────

/** Send daily agent summary email */
export async function sendAgentSummaryEmail(params: {
  email: string;
  agentType: "SELLING" | "BUYING";
  listingTitle?: string;
  highlights: string[];
  recommendations: string[];
  metrics: Record<string, number>;
}): Promise<boolean> {
  const metricRows = Object.entries(params.metrics)
    .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
    .join("");

  const highlightList = params.highlights
    .map((h) => `<li>${h}</li>`)
    .join("");

  const recommendationList = params.recommendations
    .map((r) => `<li>${r}</li>`)
    .join("");

  return sendEmail({
    to: params.email,
    subject: `🤖 Daily ${params.agentType.toLowerCase()} agent update — ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your ${params.agentType === "SELLING" ? "Selling" : "Buying"} Agent Update</h2>
        ${params.listingTitle ? `<p>For: <strong>${params.listingTitle}</strong></p>` : ""}
        
        <h3>📊 Today's Metrics</h3>
        <ul>${metricRows}</ul>
        
        ${highlightList ? `<h3>✨ Highlights</h3><ul>${highlightList}</ul>` : ""}
        ${recommendationList ? `<h3>💡 Recommendations</h3><ul>${recommendationList}</ul>` : ""}
        
        <a href="${APP_URL}/dashboard/agents" 
           style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">
          View Agent Dashboard
        </a>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          ${APP_NAME} — Your AI-powered selling assistant
        </p>
      </div>
    `,
  });
}

// ──────────────────────────────────────────────
// PRICE DROP NOTIFICATIONS
// ──────────────────────────────────────────────

/** Notify users who favorited a listing about a price drop */
export async function notifyPriceDrop(params: {
  listingId: string;
  listingTitle: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
}): Promise<void> {
  const favorites = await db.favorite.findMany({
    where: { listingId: params.listingId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          marketingOptIn: true,
          locale: true,
        },
      },
    },
  });

  const discount = Math.round(
    ((params.oldPrice - params.newPrice) / params.oldPrice) * 100
  );
  const title = `📉 Price drop: ${params.listingTitle}`;
  const body = `Price reduced by ${discount}% — from €${params.oldPrice.toFixed(0)} to €${params.newPrice.toFixed(0)}`;

  for (const fav of favorites) {
    // In-app + push notification
    await createNotification({
      userId: fav.user.id,
      type: "PRICE_DROP",
      title,
      body,
      metadata: {
        listingId: params.listingId,
        oldPrice: params.oldPrice,
        newPrice: params.newPrice,
        discount,
      },
    });

    await sendPushNotification({
      userId: fav.user.id,
      title,
      body,
      url: `${APP_URL}/listing/${params.listingId}`,
      tag: `price-drop-${params.listingId}`,
    });

    // Email notification
    if (fav.user.marketingOptIn) {
      await sendEmail({
        to: fav.user.email,
        subject: `📉 Price dropped ${discount}%: ${params.listingTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Price Drop Alert!</h2>
            <p>An item in your favorites just got cheaper:</p>
            <div style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
              <h3 style="margin: 0 0 8px 0;">${params.listingTitle}</h3>
              <p style="margin: 0;">
                <span style="text-decoration: line-through; color: #6b7280;">€${params.oldPrice.toFixed(0)}</span>
                <span style="font-size: 24px; font-weight: bold; color: #16a34a; margin-left: 8px;">€${params.newPrice.toFixed(0)}</span>
                <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px;">
                  -${discount}%
                </span>
              </p>
            </div>
            <a href="${APP_URL}/listing/${params.listingId}" 
               style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px;">
              View Listing
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              You're receiving this because you favorited this item.
              <a href="${APP_URL}/favorites" style="color: #6b7280;">Manage favorites</a>
            </p>
          </div>
        `,
      });
    }
  }
}

// ──────────────────────────────────────────────
// SAVED SEARCH MATCH NOTIFICATIONS
// ──────────────────────────────────────────────

/** Check saved searches and notify users of new matches */
export async function checkAndNotifySavedSearchMatches(): Promise<void> {
  const searches = await db.savedSearch.findMany({
    where: {
      notifyEmail: true,
      OR: [
        { lastNotifiedAt: null },
        {
          lastNotifiedAt: {
            lt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours cooldown
          },
        },
      ],
    },
    include: {
      user: { select: { id: true, email: true, locale: true } },
    },
  });

  for (const search of searches) {
    const filters = search.filters as Record<string, unknown>;
    const since = search.lastNotifiedAt || search.createdAt;

    // Build listing query from saved search filters
    const where: Record<string, unknown> = {
      status: "ACTIVE",
      createdAt: { gt: since },
    };

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.condition) where.condition = filters.condition;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {
        ...(filters.minPrice ? { gte: filters.minPrice as number } : {}),
        ...(filters.maxPrice ? { lte: filters.maxPrice as number } : {}),
      };
    }
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query as string, mode: "insensitive" } },
        { description: { contains: filters.query as string, mode: "insensitive" } },
      ];
    }

    const matchingListings = await db.listing.findMany({
      where: where as never,
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        currency: true,
      },
    });

    if (matchingListings.length === 0) continue;

    // In-app notification
    await createNotification({
      userId: search.user.id,
      type: "SAVED_SEARCH_MATCH",
      title: `🔔 ${matchingListings.length} new match${matchingListings.length > 1 ? "es" : ""} for "${search.name}"`,
      body: matchingListings
        .slice(0, 3)
        .map((l) => `${l.title} — €${l.price}`)
        .join(", "),
      metadata: {
        searchId: search.id,
        matchCount: matchingListings.length,
      },
    });

    // Push notification
    await sendPushNotification({
      userId: search.user.id,
      title: `🔔 New matches for "${search.name}"`,
      body: `${matchingListings.length} new listing${matchingListings.length > 1 ? "s" : ""} match your saved search`,
      url: `${APP_URL}/search?savedSearch=${search.id}`,
      tag: `saved-search-${search.id}`,
    });

    // Email notification using existing template
    const { sendSavedSearchNotification } = await import("./email");
    await sendSavedSearchNotification(search.user.email, {
      searchName: search.name,
      matchCount: matchingListings.length,
      listings: matchingListings.map((l) => ({
        title: l.title,
        price: l.price,
        url: `${APP_URL}/listing/${l.slug}`,
      })),
      manageUrl: `${APP_URL}/profile`,
    });

    // Update last notified timestamp
    await db.savedSearch.update({
      where: { id: search.id },
      data: { lastNotifiedAt: new Date() },
    });
  }
}

// ──────────────────────────────────────────────
// PUSH SUBSCRIPTION MANAGEMENT
// ──────────────────────────────────────────────

/** Register a push subscription for a user */
export async function registerPushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  // Upsert by endpoint to avoid duplicates
  const existing = await db.pushSubscription.findFirst({
    where: { userId: params.userId, endpoint: params.endpoint },
  });

  if (existing) return;

  await db.pushSubscription.create({
    data: {
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
    },
  });
}

/** Remove a push subscription */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await db.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

/** Get VAPID public key for client registration */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
