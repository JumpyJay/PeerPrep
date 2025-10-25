// /src/app/api/v1/matching/tickets/[ticketId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";
import { MatchingRepo } from "@/modules/matching/matching.repository";

export const runtime = "nodejs";
const JSON_HEADERS = { "content-type": "application/json" as const };

// -------------------------
// Helpers
// -------------------------
function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
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

/**
 * Extracts a canonical session/pair identifier from any variant returned by the service.
 * Supports: session_id, sessionId, pair_id, pairId
 */
function getSessionIdFromResult(result: unknown): string | null {
  if (!isRecord(result)) return null;
  return pickString(result, ["session_id", "sessionId", "pair_id", "pairId"]);
}

export async function OPTIONS() {
  return withCors(
    new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  );
}

/**
 * -------------------------------------------------
 * GET /api/v1/matching/tickets/[ticketId]
 * -------------------------------------------------
 * Polling endpoint used by the front-end while a user is waiting
 * for a match. Checks whether the given ticket has been paired yet.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const { ticketId } = params;

    // Opportunistic housekeeping + matching attempt
    await MatchingService.housekeep().catch(() => {});
    const result = await MatchingService.tryMatch(ticketId);

    if (result) {
      const sessionId = getSessionIdFromResult(result);
      if (sessionId) {
        return withCors(
          NextResponse.json(
            { status: "matched", session_id: sessionId, result },
            { headers: JSON_HEADERS }
          )
        );
      }
      return withCors(
        NextResponse.json(
          { status: "matched_pending_session", result },
          { headers: JSON_HEADERS }
        )
      );
    }

    // No new match formed -> report true ticket state
    const t = await MatchingService.getTicket(ticketId);
    if (!t) {
      return withCors(
        NextResponse.json({ status: "not_found" }, { status: 404, headers: JSON_HEADERS })
      );
    }

    switch (t.status) {
      case "QUEUED":
        return withCors(NextResponse.json({ status: "searching" }, { headers: JSON_HEADERS }));

      case "CANCELLED":
        return withCors(NextResponse.json({ status: "cancelled" }, { headers: JSON_HEADERS }));

      case "TIMEOUT":
        return withCors(NextResponse.json({ status: "timeout" }, { headers: JSON_HEADERS }));

      case "EXPIRED":
        return withCors(NextResponse.json({ status: "expired" }, { headers: JSON_HEADERS }));

      case "MATCHED": {
        // If GET hits after pair exists; attempt to surface session id
        const pair = await MatchingRepo.findPairByTicketId(ticketId);
        if (!pair) {
          return withCors(
            NextResponse.json(
              { status: "matched_pending_session" },
              { headers: JSON_HEADERS }
            )
          );
        }

        // Read session/collaboration id from pair with safe narrowing
        const pairObj = isRecord(pair) ? pair : ({} as Record<string, unknown>);
        const sessionId =
          pickString(pairObj, ["session_id", "collaboration_id"]) || null;

        if (sessionId) {
          return withCors(
            NextResponse.json(
              {
                status: "matched",
                session_id: sessionId,
                result: isRecord(pair) ? { pairId: pickString(pairObj, ["pair_id"]) } : undefined,
              },
              { headers: JSON_HEADERS }
            )
          );
        }

        return withCors(
          NextResponse.json(
            {
              status: "matched_pending_session",
              result: isRecord(pair) ? { pairId: pickString(pairObj, ["pair_id"]) } : undefined,
            },
            { headers: JSON_HEADERS }
          )
        );
      }

      default:
        return withCors(NextResponse.json({ status: "searching" }, { headers: JSON_HEADERS }));
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "poll failed";
    return withCors(
      NextResponse.json({ error: message }, { status: 500, headers: JSON_HEADERS })
    );
  }
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const ok = await MatchingService.cancel(params.ticketId);

    if (!ok) {
      // Ticket wasn't cancellable (already matched, cancelled, or not found)
      return withCors(
        NextResponse.json(
          { status: "not_cancellable", ticket_id: params.ticketId },
          { status: 409, headers: JSON_HEADERS }
        )
      );
    }

    return withCors(
      NextResponse.json(
        { status: "cancelled", ticket_id: params.ticketId },
        { headers: JSON_HEADERS }
      )
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "cancel failed";
    return withCors(
      NextResponse.json(
        { error: message },
        { status: 500, headers: JSON_HEADERS }
      )
    );
  }
}
