// src/app/api/v1/collaboration/route.ts

import { NextResponse } from "next/server";
import { sessionService } from "@/modules/collaboration/session.service";
import { Session } from "@/modules/collaboration/session.types";

/**
 * handles GET requests to /api/v1/question
 */
export async function GET() {
  try {
    // 1. Call your service layer to get data
    const sessions: Session[] = await sessionService.getAllSessions();

    // 2. Return a successful JSON response
    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    // 3. Handle errors
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions." },
      { status: 500 }
    );
  }
}
