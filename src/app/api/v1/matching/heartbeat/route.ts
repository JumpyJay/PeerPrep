// app/api/v1/matching/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MatchingService } from "@/modules/matching/matching.services";

const JSON_HEADERS = { "content-type": "application/json" as const };
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticketId: string | undefined = body.ticketId ?? body.ticket_id ?? body.id;
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId required" }, { status: 400, headers: JSON_HEADERS });
    }

    const ok = await MatchingService.heartbeat(ticketId);
    if (!ok) {
      return NextResponse.json({ status: "not_found" }, { status: 404, headers: JSON_HEADERS });
    }
    return NextResponse.json({ status: "ok" }, { headers: JSON_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "heartbeat failed" }, { status: 500, headers: JSON_HEADERS });
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
