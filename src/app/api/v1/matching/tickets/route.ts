// /api/v1/matching/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";
import { normalizeDifficulty, type Difficulty } from "@/modules/matching/matching.utils";
import type { SkillLevel } from "@/modules/matching/matching.types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const diff: Difficulty = normalizeDifficulty(body?.difficulty) ?? "EASY";

  // sanitize, then cast
  const lvlStr = String(body?.skillLevel ?? "").toUpperCase().trim();
  const skillLevel = (lvlStr || "BEGINNER") as SkillLevel;

  const ticket = await MatchingService.enqueue({
    userId: String(body.userId),
    difficulty: diff,
    topics: Array.isArray(body.topics) ? body.topics : [],
    skillLevel,                     // <- now typed
    strictMode: !!body.strictMode,
    timeoutSeconds: body.timeoutSeconds ?? undefined,
  });

  return NextResponse.json(ticket);
}