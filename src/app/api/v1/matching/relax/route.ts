// app/api/v1/matching/relax/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";

const JSON_HEADERS = { "content-type": "application/json" as const };
export const runtime = "nodejs";

/**
 * POST /api/v1/matching/relax
 *
 * Body:
 * {
 *   "ticketId": "uuid",
 *   "relaxTopics": true,
 *   "relaxDifficulty": false,
 *   "relaxSkill": false,
 *   "extendSeconds": 30
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const ticketId: string | undefined =
      body.ticketId ?? body.ticket_id ?? body.id;
    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId required" },
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const result = await MatchingService.relax({
      ticketId,
      relaxTopics: !!body.relaxTopics,
      relaxDifficulty: !!body.relaxDifficulty,
      relaxSkill: !!body.relaxSkill,
      extendSeconds: body.extendSeconds ?? 30,
    });

    // Return status based on outcome
    if (result) {
      return NextResponse.json(
        { status: "matched", result },
        { headers: JSON_HEADERS }
      );
    } else {
      return NextResponse.json(
        { status: "searching" },
        { headers: JSON_HEADERS }
      );
    }
  } catch (e: any) {
    console.error("[POST /relax] failed:", e);
    return NextResponse.json(
      { error: e?.message ?? "relax failed" },
      { status: 500, headers: JSON_HEADERS }
    );
  }
}

// Optional: preflight for browser calls
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
