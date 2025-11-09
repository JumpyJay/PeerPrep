import { NextRequest, NextResponse } from "next/server";
import { sessionService } from "@/modules/collaboration/session.service";
import { Session } from "@/modules/collaboration/session.types";

/**
 * handles GET requests to /api/v1/collaboration
 * This is triggered automatically by any GET request to this URL.
 */
export async function GET() {
  try {
    // calls service layer to get data
    const sessions: Session[] = await sessionService.getAllSessions();

    // returns a successful JSON response
    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    // handle errors
    console.error("API Error [GET]:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions." },
      { status: 500 }
    );
  }
}

/**
 * handles POST requests to /api/v1/collaboration
 */
export async function POST(request: NextRequest) {
  try {
    // read a query parameter
    // e.g. /api/v1/collaboration?type=create
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const body = await request.json();

    // check for type
    // case when type is "create"
    if (type === "create") {
      const questionId = Number(body?.question_id);
      const { user1_email, user2_email } = body;
      // simple validation
      if (!Number.isFinite(questionId) || !user1_email || !user2_email) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: question_id, user1_email, user2_email",
          },
          { status: 400 }
        );
      }

      const newSession: Session = await sessionService.createSession(
        questionId,
        user1_email,
        user2_email
      );

      // return a 201 Created status, a successful POST
      return NextResponse.json(newSession, { status: 201 });
    } else if (type == "findsession") {
      const sessionId = Number(body?.session_id);
      // simple validation if session_id is passed
      if (!Number.isFinite(sessionId)) {
        return NextResponse.json(
          {
            error: "Missing required fields: session_id",
          },
          { status: 400 }
        );
      }
      const foundSession = await sessionService.findSession(sessionId);
      if (!foundSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // return a 200 Found status, and the session info found
      return NextResponse.json(foundSession, { status: 200 });
    } else {
      // handle other types or missing type
      return NextResponse.json(
        {
          error: `Invalid or missing query parameter: 'type=create' is required.`,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    // handle errors
    console.error("API Error [POST]:", error);

    return NextResponse.json(
      { error: "Failed to create session." },
      { status: 500 }
    );
  }
}
