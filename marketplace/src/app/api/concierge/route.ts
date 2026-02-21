import { NextRequest, NextResponse } from "next/server";
import { processConciergeMessage } from "@/server/services/agent-concierge";
import { conciergeMessageSchema } from "@/lib/validators";
import type { AiChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = conciergeMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    const { message, conversationHistory } = parsed.data;
    const locale = body.locale as string | undefined;

    const history: AiChatMessage[] | undefined = conversationHistory?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await processConciergeMessage(message, history, locale);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[CONCIERGE_ERROR]", error);
    return NextResponse.json(
      {
        intent: "other",
        message: "I'm sorry, I'm having trouble processing your request. Please try again.",
        suggestedActions: [],
      },
      { status: 500 }
    );
  }
}
