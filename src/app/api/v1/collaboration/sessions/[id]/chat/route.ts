// src/app/api/v1/collaboration/sessions/[id]/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chatService } from "@/modules/chat/chat.services";
import type { ChatMessage } from "@/modules/chat/chat.types";
import { getUserFromRequest } from "@/lib/decodeJWT";
import { isHttpError } from "@/lib/http-error";

// process-local cache of the last message timestamp per session
const lastBySession = new Map<number, string>(); 

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;                 
    const sessionId = Number.parseInt(id, 10);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
    }

    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get("limit") ?? 100))); // cap between 1..200
    const since = req.nextUrl.searchParams.get("since") ?? undefined;

    // If-Modified-Since fast path
    const ifMod = req.headers.get("if-modified-since");
    const last = lastBySession.get(sessionId);
    if (ifMod && last && new Date(last) <= new Date(ifMod)) {
      return new NextResponse(null, { status: 304 });
    }

    const msgs: ChatMessage[] = await chatService.list(sessionId, since, limit);
    const lastCreated = msgs.at(-1)?.created_at ?? last ?? new Date(0).toISOString();
    lastBySession.set(sessionId, lastCreated);

    const res = NextResponse.json(msgs, { status: 200 });
    res.headers.set("Last-Modified", new Date(lastCreated).toUTCString());
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err: unknown) {
    const status = isHttpError(err) ? err.status : 500;
    return NextResponse.json({ error: "Failed to fetch messages." }, { status });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;                 
    const sessionId = Number.parseInt(id, 10);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
    }

    const { email: senderEmail } = getUserFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const content = (body?.content ?? "").toString().trim();
    if (!content) {
      return NextResponse.json({ error: "Missing 'content'" }, { status: 400 });
    }

    const created = await chatService.create(sessionId, senderEmail, content);
    lastBySession.set(sessionId, created.created_at);

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const status = isHttpError(err) ? err.status : 500;
    const msg = status === 401 ? "Unauthorized" : "Failed to create message.";
    console.error("API Error [POST chat]:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
