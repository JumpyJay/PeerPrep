// /src/app/api/v1/matching/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  EnqueueSchema,
  HeartbeatSchema,
  TryMatchSchema,
  RelaxSchema,
  CancelSchema,
} from "@/modules/matching/matching.schema";
import { MatchingService } from "@/modules/matching/matching.services";
import { MatchingRepo } from "@/modules/matching/matching.repository";

export const runtime = "nodejs";

const JSON_HEADERS = { "content-type": "application/json" as const };

/** --------------------------------------------------------------
 * CORS helper
 * -------------------------------------------------------------- */
function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

// Small helpers for consistent error responses
function badRequest(message: string) {
  return withCors(
    NextResponse.json({ error: message }, { status: 400, headers: JSON_HEADERS })
  );
}

function serverError(message: string) {
  return withCors(
    NextResponse.json({ error: message }, { status: 500, headers: JSON_HEADERS })
  );
}

/** --------------------------------------------------------------
 * Utils
 * -------------------------------------------------------------- */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** --------------------------------------------------------------
 * Legacy -> Canonical adapters (API boundary only)
 * --------------------------------------------------------------
 * Accepts snake_case keys and friendly strings (e.g. "Easy"),
 * then converts to the canonical shapes validated by Zod.
 * Keeps domain/service layers strictly typed and clean.
 */

// POST /enqueue body adapter
function normalizeEnqueue(raw: unknown) {
  if (!isRecord(raw)) return raw;

  const difficultyMap = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
  const skillMap = {
    beginner: "BEGINNER",
    intermediate: "INTERMEDIATE",
    advanced: "ADVANCED",
  } as const;

  const userId =
    (raw.userId as unknown) ??
    raw.user_id ??
    raw.user ??
    raw.email ??
    "";

  const diffRaw =
    (raw.difficulty as unknown) ??
    raw.Difficulty ??
    raw.level ??
    "";

  const skillRaw =
    (raw.skillLevel as unknown) ??
    raw.skill_level ??
    raw.skill ??
    raw.proficiency ??
    "";

  const topics = (raw.topics as unknown) ?? raw.tags ?? [];
  const strictMode =
    (raw.strictMode as unknown) ??
    raw.strict_mode ??
    raw.strict ??
    false;
  const timeoutSeconds =
    (raw.timeoutSeconds as unknown) ??
    raw.timeout_seconds ??
    raw.timeout ??
    undefined;

  // Normalize friendly strings to enums if needed
  const difficulty =
    difficultyMap[
      String(diffRaw).toLowerCase() as keyof typeof difficultyMap
    ] ?? diffRaw;

  const skillLevel =
    skillMap[
      String(skillRaw).toLowerCase() as keyof typeof skillMap
    ] ?? skillRaw;

  // Soft signal that someone still posts legacy payloads
  const usedLegacy =
    "user_id" in raw ||
    "skill_level" in raw ||
    "tags" in raw ||
    ["easy", "medium", "hard"].includes(String(diffRaw).toLowerCase());
  if (usedLegacy) {
    console.warn(
      "[matching] legacy enqueue payload normalized; please migrate to { userId, difficulty, topics, skillLevel, strictMode }"
    );
  }

  // Canonical shape consumed by Zod -> service layer
  const canonical = {
    userId,
    difficulty,
    topics: Array.isArray(topics) ? topics : [],
    skillLevel,
    strictMode: Boolean(strictMode),
    ...(timeoutSeconds !== undefined
      ? { timeoutSeconds: Number(timeoutSeconds) }
      : {}),
  };

  return canonical;
}

// Minimal adapter for actions that only need ticketId
function normalizeTicketOnly(raw: unknown) {
  if (!isRecord(raw)) return raw;
  const usedLegacy = "ticket_id" in raw;
  if (usedLegacy) console.warn("[matching] legacy ticket_id normalized → ticketId");
  return { ticketId: (raw.ticketId as unknown) ?? raw.ticket_id };
}

// Adapter for relax action body (accept multiple legacy variants)
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
      "[matching] legacy relax payload normalized; please migrate to { ticketId, relaxDifficulty, relaxTopics, relaxSkill, extendSeconds }"
    );
  }

  return {
    ticketId: (raw.ticketId as unknown) ?? raw.ticket_id,
    relaxDifficulty:
      (raw.relaxDifficulty as unknown) ??
      raw.relax_difficulty ??
      raw.relax ??
      undefined,
    relaxTopics:
      (raw.relaxTopics as unknown) ??
      raw.relax_topics ??
      undefined,
    relaxSkill:
      (raw.relaxSkill as unknown) ??
      raw.relax_skill ??
      undefined,
    extendSeconds:
      (raw.extendSeconds as unknown) ??
      raw.extend_seconds ??
      undefined,
  };
}

// DI: tell MatchingService how to create a collaboration session
// Temporary stub so session_id exists immediately
MatchingService.setCollaborationCreator(async () => {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { session_id: id };
});

/*
 // Call collaboration API when POST is added
 MatchingService.setCollaborationCreator(async ({ userA, userB, questionId }) => {
   const res = await fetch(`${process.env.COLLAB_BASE_URL ?? ""}/api/v1/collaboration`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ userA, userB, questionId }),
     cache: "no-store",
   });
   if (!res.ok) {
     const msg = await res.text().catch(() => "");
     throw new Error(`Collab create failed: ${res.status} ${msg}`);
   }
   const { session_id } = await res.json();
   return { session_id };
 });
*/

/** --------------------------------------------------------------
 * ROUTES
 * --------------------------------------------------------------
 * POST: enqueue -> immediate match attempt
 * PATCH: heartbeat | try-match | relax | cancel
 * GET: health/debug helpers
 * OPTIONS: CORS preflight
 */

// POST /api/v1/matching
// Returns either:
// - { status: "matched", session_id, result }
// - { status: "queued", ticket_id }
export async function POST(req: NextRequest) {
  try {
    // Opportunistic cleanup to keep queue healthy
    await MatchingService.housekeep();

    // Guard malformed JSON before parsing with Zod
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    // Legacy -> canonical -> Zod validation
    const adapted = normalizeEnqueue(raw);
    const input = EnqueueSchema.parse(adapted);

    // Create ticket (dedupe-aware)
    const { ticket, existing } = await MatchingService.enqueueWithExisting(input);

    const body = {
      status: "queued" as const,
      ticket_id: ticket.ticketId,
      ...(existing ? { existing: true as const } : {}),
    };

    return withCors(
      new NextResponse(JSON.stringify(body), {
        status: existing ? 200 : 201,
        headers: {
          ...JSON_HEADERS,
          // tell client where to poll
          Location: `/api/v1/matching/tickets/${ticket.ticketId}`,
        },
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to enqueue ticket";
    return badRequest(message);
  }
}

// PATCH /api/v1/matching?action=heartbeat|try-match|relax|cancel
export async function PATCH(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  if (!action) {
    return badRequest("Missing 'action' query param.");
  }

  try {
    await MatchingService.housekeep();

    // Parse JSON first; then normalize -> Zod
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return badRequest("Invalid JSON body.");
    }

    switch (action) {
      case "heartbeat": {
        const adapted = normalizeTicketOnly(raw);
        const { ticketId } = HeartbeatSchema.parse(adapted);
        const ok = await MatchingService.heartbeat(ticketId);
        return withCors(NextResponse.json({ ok }, { headers: JSON_HEADERS }));
      }

      case "try-match": {
        const adapted = normalizeTicketOnly(raw);
        const { ticketId } = TryMatchSchema.parse(adapted);
        const result = await MatchingService.tryMatch(ticketId); // null | MatchResult
        return withCors(NextResponse.json({ result }, { headers: JSON_HEADERS }));
      }

      case "relax": {
        const adapted = normalizeRelax(raw);
        const input = RelaxSchema.parse(adapted);
        const result = await MatchingService.relax(input); // null | MatchResult
        return withCors(NextResponse.json({ result }, { headers: JSON_HEADERS }));
      }

      case "cancel": {
        const adapted = normalizeTicketOnly(raw);
        const { ticketId } = CancelSchema.parse(adapted);
        const ok = await MatchingService.cancel(ticketId);
        return withCors(NextResponse.json({ ok }, { headers: JSON_HEADERS }));
      }

      default:
        return badRequest("Unsupported action. Use heartbeat | try-match | relax | cancel.");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process request";
    return serverError(message);
  }
}

// OPTIONS: handle preflight for browsers and tools
export async function OPTIONS() {
  return withCors(
    new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  );
}

// GET: simple health check -> dev dump
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tid = url.searchParams.get("try");  // /api/v1/matching?try=<uuid>
  const dump = url.searchParams.get("dump"); // /api/v1/matching?dump=1

  try {
    if (tid) {
      const result = await MatchingService.tryMatch(tid);
      return withCors(NextResponse.json({ ok: true, result }, { status: 200 }));
    }

    if (dump === "1") {
      // DEV ONLY: expose tickets and pairs
      const tickets = Array.from(MatchingRepo.__getTickets?.().values?.() ?? []);
      const pairs = Array.from(MatchingRepo.__getPairs?.().values?.() ?? []);
      return withCors(
        NextResponse.json({ ok: true, tickets, pairs }, { status: 200 })
      );
    }

    return withCors(
      NextResponse.json(
        { ok: true, message: "Matching API is up and responding. Use POST/PATCH for actions." },
        { status: 200 }
      )
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET debug] error:", msg);
    return withCors(
      NextResponse.json(
        { ok: false, error: msg },
        { status: 500 }
      )
    );
  }
}
