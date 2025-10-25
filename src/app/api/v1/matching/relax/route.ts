// app/api/v1/matching/relax/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";
import { RelaxSchema } from "@/modules/matching/matching.schema";

const JSON_HEADERS = { "content-type": "application/json" as const };
export const runtime = "nodejs";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Normalize a relax request body from various legacy shapes to the canonical
 * shape expected by RelaxSchema.
 */
function normalizeRelax(raw: unknown) {
  if (!isRecord(raw)) return raw;

  const usedLegacy =
    "ticket_id" in raw ||
    "relax_difficulty" in raw ||
    "relax_topics" in raw ||
    "relax_skill" in raw ||
    "extend_seconds" in raw;

  if (usedLegacy) {
    console.warn(
      "[matching] legacy relax payload normalized; please migrate to { ticketId, relaxTopics, relaxDifficulty, relaxSkill, extendSeconds }"
    );
  }

  // Coercions (booleans, numbers)
  const bool = (v: unknown): boolean | undefined =>
    typeof v === "boolean"
      ? v
      : typeof v === "string"
        ? ["1", "true", "yes", "on"].includes(v.toLowerCase())
        : typeof v === "number"
          ? v !== 0
          : undefined;

  const num = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  return {
    ticketId: (raw.ticketId as unknown) ?? raw.ticket_id ?? raw.id,
    relaxTopics:
      bool(raw.relaxTopics) ??
      bool(raw.relax_topics) ??
      bool(raw.relax),
    relaxDifficulty:
      bool(raw.relaxDifficulty) ??
      bool(raw.relax_difficulty),
    relaxSkill:
      bool(raw.relaxSkill) ??
      bool(raw.relax_skill),
    // default extendSeconds to 30 only if not supplied; the schema can also default
    extendSeconds:
      num(raw.extendSeconds) ??
      num(raw.extend_seconds),
  };
}

/**
 * POST /api/v1/matching/relax
 *
 * Body (canonical):
 * {
 *   "ticketId": "uuid",
 *   "relaxTopics": boolean,
 *   "relaxDifficulty": boolean,
 *   "relaxSkill": boolean,
 *   "extendSeconds": number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const adapted = normalizeRelax(raw);
    // Validate + coerce with Zod; you can set defaults in the schema if desired
    const input = RelaxSchema.parse(adapted);

    // Optionally enforce a default here if your schema doesn't:
    if (typeof input.extendSeconds !== "number") {
      input.extendSeconds = 30;
    }

    const result = await MatchingService.relax(input); // null | MatchResult

    // Return status based on outcome
    if (result) {
      return NextResponse.json(
        { status: "matched", result },
        { headers: JSON_HEADERS }
      );
    }
    return NextResponse.json(
      { status: "searching" },
      { headers: JSON_HEADERS }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "relax failed";
    console.error("[POST /relax] failed:", message);
    return NextResponse.json(
      { error: message },
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
