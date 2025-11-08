import { NextRequest, NextResponse } from "next/server";
import { sessionService } from "@/modules/collaboration/session.service";
import { Session } from "@/modules/collaboration/session.types";

/**
 * handles GET requests to /api/v1/collaboration
 * This is triggered automatically by any GET request to this URL.
 */
export async function GET() {
  try {
    // 1. Call your service layer to get data
    const sessions: Session[] = await sessionService.getAllSessions();

    // 2. Return a successful JSON response
    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    // 3. Handle errors
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
    const { question_id, user1_email, user2_email } = body;

    // check for type
    // case when type is "create"
    if (type === "create") {
      // simple validation
      if (!question_id || !user1_email || !user2_email) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: question_id, user1_email, user2_email",
          },
          { status: 400 }
        );
      }

      const newSession: Session = await sessionService.createSession(
        question_id,
        user1_email,
        user2_email
      );

      // return a 201 Created status, a successful POST
      return NextResponse.json(newSession, { status: 201 });
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
