// app/api/v1/matching/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";

const JSON_HEADERS = { "content-type": "application/json" as const };
export const runtime = "nodejs";

function getTicketId(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const v = r.ticketId ?? r.ticket_id ?? r.id;
  return typeof v === "string" ? v : null;
}

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

    const ticketId = getTicketId(raw);
    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId required" },
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const ok = await MatchingService.heartbeat(ticketId);
    if (!ok) {
      return NextResponse.json(
        { status: "not_found" },
        { status: 404, headers: JSON_HEADERS }
      );
    }

    return NextResponse.json({ status: "ok" }, { headers: JSON_HEADERS });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "heartbeat failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSON_HEADERS }
    );
  }
}

// Optional CORS preflight
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
