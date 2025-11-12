import { NextRequest, NextResponse } from "next/server";
import { sessionService } from "@/modules/collaboration/session.service";
import { Session, Submission } from "@/modules/collaboration/session.types";

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
    // ________________________________________________________
    // type 1: create (create a session)
    if (type === "create") {
      const { question_id, user1_email, user2_email } = body;
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

      // ________________________________________________________
      // type 2: findsession
    } else if (type == "findsession") {
      const { session_id } = body;
      // simple validation if session_id is passed
      if (!session_id) {
        return NextResponse.json(
          {
            error: "Missing required fields: session_id",
          },
          { status: 400 }
        );
      }
      const foundSession: Session = await sessionService.findSession(
        session_id
      );

      // return a 200 Found status, and the session info found
      return NextResponse.json(foundSession, { status: 200 });

      // ________________________________________________________
      // type 3: submitsession
    } else if (type == "submitsession") {
      // retrieve session_id, code_solution
      const { session_id, code_solution } = body;
      // simple validaton, checking whether params passed are correct
      if (!session_id || !code_solution) {
        return NextResponse.json(
          {
            error: "Missing required fields: session_id, code_solution",
          },
          { status: 400 }
        );
      }

      // happy path
      // correct params passed
      // call service submitSession function
      sessionService.submitSession(session_id, code_solution);
      // return a 200 success status
      return NextResponse.json({ status: 200 });

      // ________________________________________________________
      // type 4: findsubmission
    } else if (type == "findsubmissionbyuser") {
      // define find submission api route
      const { user_email } = body;
      // simple validation if user_email is passed
      if (!user_email) {
        return NextResponse.json(
          {
            error: "Missing required fields: user_email",
          },
          { status: 400 }
        );
      }
      const foundSubmission: Submission[] =
        await sessionService.findSubmissionByUser(user_email);

      // return a 200 Found status, and the session info found
      return NextResponse.json(foundSubmission, { status: 200 });

      // ________________________________________________________
      // type 5: findattempt
      // i.e. find all submissions by user under the question
    } else if (type == "findattempt") {
      console.log("fetch attempt route hit!!!!!_________");
      const { question_id, user_email } = body;
      // simple params verification
      if (!user_email || !question_id) {
        console.log("missing response field!!!");
        return NextResponse.json(
          {
            error: "Missing response fields: user_email and/or question_id",
          },
          { status: 400 }
        );
      }

      const foundAttempt: Submission[] = await sessionService.findAttempt(
        question_id,
        user_email
      );

      return NextResponse.json(foundAttempt, { status: 200 });

      // ________________________________________________________
      // type 6: deletesession
    } else if (type == "deletesession") {
      const { session_id } = body;
      // check is session_id is passed
      if (!session_id) {
        return NextResponse.json(
          {
            error: "Missing required fields: session_id",
          },
          { status: 400 }
        );
      }
      sessionService.deleteSession(session_id);
      return NextResponse.json({ status: 200 });
    } else {
      // handle other types or missing type
      return NextResponse.json(
        {
          error: `Invalid or missing query parameter: 'type' parameter is required.`,
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    // handle errors
    console.error("API Error [POST]:", error);

    return NextResponse.json(
      { error: "Failed to create session." },
      { status: 500 }
    );
  }
}
