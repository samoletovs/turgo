import { NextRequest, NextResponse } from "next/server";
import { processConciergeMessage } from "@/server/services/agent-concierge";
import { conciergeMessageSchema } from "@/lib/validators";
import { auth } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import type { AiChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    // Auth required
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 20 req/min per IP
    const ip = getClientIp(req);
    const rl = await rateLimit({
      key: `concierge:${ip}`,
      limit: RATE_LIMITS.CONCIERGE.max,
      windowMs: RATE_LIMITS.CONCIERGE.windowMs,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = await req.json();
    const parsed = conciergeMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 },
      );
    }

    const { message, conversationHistory } = parsed.data;
    const locale = body.locale as string | undefined;

    const history: AiChatMessage[] | undefined = conversationHistory?.map(
      (m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    );

    const response = await processConciergeMessage(message, history, locale);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[CONCIERGE_ERROR]", error);
    return NextResponse.json(
      {
        intent: "other",
        message:
          "I'm sorry, I'm having trouble processing your request. Please try again.",
        suggestedActions: [],
      },
      { status: 500 },
    );
  }
}
