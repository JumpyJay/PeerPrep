// /src/app/api/v1/matching/tickets/[ticketId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";
import { MatchingRepo } from "@/modules/matching/matching.repository";

export const runtime = "nodejs";

const JSON_HEADERS = { 
  "content-type": "application/json" as const, 
  "cache-control": "no-store" as const, 
};

const ALLOWED_ORIGINS = new Set([
  process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
]);

// -------------------------
// Helpers
// -------------------------
function withCors(res: NextResponse, origin?: string) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : Array.from(ALLOWED_ORIGINS)[0];

  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Vary", "Origin");
  return res;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || undefined;
  return withCors(
    new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "no-store",
      },
    }),
    origin
  );
}


/**
 * -------------------------------------------------
 * GET /api/v1/matching/tickets/[ticketId]
 * -------------------------------------------------
 * Pure status endpoint (no matching here). Matching is done by job/worker.
 */
export async function GET(req: NextRequest, { params }: { params: { ticketId: string } }) {
  const origin = req.headers.get("origin") || undefined;
  try {
    const { ticketId } = params;

    // READ-ONLY: do not call tryMatch() here
    const t = await MatchingService.getTicket(ticketId);
    if (!t) {
      return withCors(
        NextResponse.json(
          { status: "not_found" },
          { status: 404, headers: JSON_HEADERS }),
          origin
      );
    }

    if (t.status === "MATCHED") {
      const pair = await MatchingRepo.findPairByTicketId(ticketId);
      if (pair && isRecord(pair)) {
        const sessionId = 
          pickString(pair, ["session_id", "collaboration_id"]) || null;
        if (sessionId) {
          return withCors(
            NextResponse.json(
              { status: "matched", session_id: sessionId, result: { pairId: pickString(pair, ["pair_id"]) } },
              { headers: JSON_HEADERS }
            ),
            origin
          );
        }
        return withCors(
          NextResponse.json(
            { status: "matched_pending_session", result: { pairId: pickString(pair, ["pair_id"]) } },
            { headers: JSON_HEADERS }
          ),
          origin
        );
      }
      return withCors(
        NextResponse.json({ status: "matched_pending_session"}, { headers: JSON_HEADERS }),
          origin
      );
    }

    // Map other states
    const map: Record<string, string> = {
      QUEUED: "searching",
      RELAXED: "searching",
      PENDING: "searching",
      CANCELLED: "cancelled",
      TIMEOUT: "timeout",
      EXPIRED: "expired",
    };

    const status = map[t.status] ?? "searching";
    return withCors(
      NextResponse.json({ status }, { headers: JSON_HEADERS }),
      origin
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "poll failed";
    return withCors(
      NextResponse.json(
        { error: message },
        { status: 500, headers: JSON_HEADERS }
      ),
      origin
    );
  }
}

// DELETE
export async function DELETE(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  const origin = req.headers.get("origin") || undefined;
  const { ticketId } = params;

  try {
    // Fast path: QUEUED cancel (what you already had)
    const pre = await MatchingService.cancel(ticketId);
    if (pre) {
      return withCors(
        NextResponse.json(
          { status: "cancelled", ticket_id: ticketId, partner_requeued_ticket_id: null },
          { headers: JSON_HEADERS }
        ),
        origin
      );
    }

    // Recovery path: handle mid-match cancellation
    const rec = await MatchingService.cancelRecover(ticketId);

    if (!rec.cancelled) {
      // still not cancellable or already terminal (idempotent no-op)
      return withCors(
        NextResponse.json(
          { status: "not_cancellable", ticket_id: ticketId },
          { status: 409, headers: JSON_HEADERS }
        ),
        origin
      );
    }

    return withCors(
      NextResponse.json(
        {
          status: rec.partnerRequeuedTicketId
            ? "cancelled_partner_requeued"
            : "cancelled",
          ticket_id: ticketId,
          partner_requeued_ticket_id: rec.partnerRequeuedTicketId,
        },
        { headers: JSON_HEADERS }
      ),
      origin
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "cancel failed";
    return withCors(
      NextResponse.json({ error: message }, { status: 500, headers: JSON_HEADERS }),
      origin
    );
  }
}

