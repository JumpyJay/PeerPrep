// src/app/api/v1/db/health/route.ts
import { NextResponse } from "next/server";
import { getConnectionPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = await getConnectionPool();
    const { rows } = await pool.query("select now()");
    return NextResponse.json({ ok: true, now: rows[0].now }, { status: 200 });
  } catch (err: unknown) {  // <-- use unknown
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    console.error("[db/health] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}