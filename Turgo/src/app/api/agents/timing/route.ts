/**
 * Timing Agent API — optimal posting time + seasonal calendar
 * GET /api/agents/timing?categoryId=...&locationId=...
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getOptimalTiming,
  getTimingRecommendation,
} from "@/server/services/agent-timing";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const categoryId = searchParams.get("categoryId");
  const locationId = searchParams.get("locationId") ?? undefined;
  const mode = searchParams.get("mode") ?? "full"; // "full" | "quick"

  if (!categoryId) {
    return NextResponse.json(
      { error: "categoryId is required" },
      { status: 400 },
    );
  }

  try {
    if (mode === "quick") {
      const recommendation = await getTimingRecommendation(
        categoryId,
        locationId,
      );
      return NextResponse.json(recommendation);
    }

    const timing = await getOptimalTiming(categoryId, locationId);
    return NextResponse.json(timing);
  } catch (error) {
    console.error("[Timing API] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze timing" },
      { status: 500 },
    );
  }
}
