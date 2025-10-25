// /src/app/api/v1/matching/tickets/[ticketId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";
import { MatchingRepo } from "@/modules/matching/matching.repository";

export const runtime = "nodejs";
const JSON_HEADERS = { "content-type": "application/json" as const };

// CORS helper
function withCors(res: NextResponse) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("Vary", "Origin");
    return res;
}

/**
 * ---------------------------------------
 * Helper: getSessionIdFromResult()
 * ---------------------------------------
 * Extracts the canonical session or pair ID from any variant 
 * returned by MatchingService (handles snake_case and camelCase).
 * Returns null if no recognizable ID key is found.
 */
function getSessionIdFromResult(result: any): string | null {
    return (
        result?.session_id ??
        result?.sessionId ??
        result?.pair_id ??
        result?.pairId ??
        null
    );
}

export async function OPTIONS() {
    return withCors(
        new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Methods": "GET, OPTIONS",
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
 * for a match. This route checks whether the given ticket has
 * been paired yet.
 * 
 * Request path:
 *  /api/v1/matching/tickets/<ticketId>
 * 
 * Response examples:
 *  - { status: "matched", session_od: "..." } -> match found
 *  - { status: "searching" }                  -> still queued
 *  - { error: "...", status: 500}             -> unexpected failure
 * 
 * Used by: FindMatchButton.tsx -> pollTicket()
 */
export async function GET(
    _req: NextRequest, { params }: { params: { ticketId: string } }
) {
    try {
        const { ticketId } = params;

        // opportunistic housekeeping + matching attempt
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
                return withCors(NextResponse.json({ status: "timeout"}, { headers: JSON_HEADERS }));
            case "EXPIRED":
                return withCors(NextResponse.json({ status: "expired"}, { headers: JSON_HEADERS }));
            case "MATCHED": {
                // in case GET hits after pair exists; attempt to surface session id
                const pair = await MatchingRepo.findPairByTicketId(ticketId);
                const sessionId = pair && (pair as any).session_id ?? pair?.collaboration_id ?? null;
                if (sessionId) {
                    return withCors(
                        NextResponse.json(
                            {
                                status: "matched",
                                session_id: sessionId,
                                result: pair ? { pairId: pair.pair_id } : undefined
                            },
                            { headers: JSON_HEADERS }
                        )
                    );
                }
                return withCors(
                    NextResponse.json(
                        {
                            status: "matched_pending_session",
                            result: pair ? { pairId: pair.pair_id } : undefined
                        },
                        { headers: JSON_HEADERS }
                    )
                );
            }
            default:
                return withCors(NextResponse.json({ status: "searching" }, { headers: JSON_HEADERS }));
        }
    } catch (e: any) {
        return withCors(
            NextResponse.json({ error: e?.message ?? "poll failed" }, { status: 500, headers: JSON_HEADERS })
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
            return NextResponse.json(
                { status: "not_cancellable", ticket_id: params.ticketId },
                { status: 409, headers: JSON_HEADERS }
            );
        }

        return NextResponse.json(
            { status: "cancelled", ticket_id: params.ticketId },
            { headers: JSON_HEADERS }
        );
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "cancel failed" },
            { status: 500, headers: JSON_HEADERS }
        );
    }
}

