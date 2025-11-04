import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/modules/user/user.service";

/**
 * Handles POST requests using asynchronous calls
 */
export async function POST(req: NextRequest) {
  try {
    // parse JSON body of request
    const { action, ...body } = await req.json();

    // handle new user creation 
    if (action === "register") {
      // result is the user info
      const result = await userService.register(body);
      return NextResponse.json(result, { status: 201 });
    }

    // handle existing user log in
    if (action === "login") {
      const result = await userService.login(body);
      return NextResponse.json(result, { status: 200 });
    }

    // handle invalid actions
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("User API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
