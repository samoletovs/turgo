/**
 * Liquidation Batch Stats API
 * GET /api/agents/liquidation/[batchId]
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLiquidationBatchStats } from "@/server/services/agent-liquidation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId } = await params;

  try {
    const stats = await getLiquidationBatchStats(batchId, session.user.id);
    if (!stats) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Liquidation API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load batch stats" },
      { status: 500 },
    );
  }
}
