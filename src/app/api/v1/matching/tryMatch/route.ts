// /src/app/v1/matching/tryMatch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";

export const runtime = "nodejs";

// Tiny helpers to avoid `any`
function pickString(obj: unknown, key: string): string | null {
  if (typeof obj !== "object" || obj === null) return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "tryMatch failed"; }
}

/**
 * POST /api/v1/matching/tryMatch
 * Body: { "ticketId": "<uuid>" }
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const ticketId = pickString(json, "ticketId");
    if (!ticketId) {
      return NextResponse.json(
        { error: "invalid_request", detail: "ticketId (string) is required" },
        { status: 400 }
      );
    }

    const result = await MatchingService.tryMatch(ticketId);
    if (!result) {
      return NextResponse.json({ status: "no_partner", result: null });
    }
    return NextResponse.json({ status: "matched", result });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}