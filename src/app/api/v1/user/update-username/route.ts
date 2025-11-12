import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/modules/user/user.service";

export async function PUT(req: NextRequest) {
  try {
    const { username, email } = await req.json();

    if (!username || !email) {
      return NextResponse.json({ error: "Missing username or email" }, { status: 400 });
    }

    const updatedUser = await userService.updateUsername(email, username);

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    console.error("Update username error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}